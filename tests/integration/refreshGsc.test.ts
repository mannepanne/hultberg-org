// ABOUT: Integration tests for POST /admin/api/refresh-gsc.
// ABOUT: Covers auth, origin check, rate limiting, skipDispatch semantics.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';

const privateKeyPem = readFileSync(
  join(__dirname, '..', 'fixtures', 'test-private-key.pem'),
  'utf8',
);

const serviceAccountJson = JSON.stringify({
  type: 'service_account',
  client_email: 'test-sa@example.iam.gserviceaccount.com',
  private_key: privateKeyPem,
});

function mockGSCFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/sitemaps')) {
      return new Response(JSON.stringify({
        sitemap: [{
          path: 'https://hultberg.org/sitemap.xml',
          errors: 0, warnings: 0,
          contents: [{ type: 'web', submitted: '18', indexed: '5' }],
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/searchAnalytics/query')) {
      return new Response(JSON.stringify({ rows: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('POST /admin/api/refresh-gsc', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;
  let sendEmailMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendEmailMock = vi.fn(async () => undefined);
    mockEnv = createMockEnv({
      GSC_SERVICE_ACCOUNT_JSON: serviceAccountJson,
      ADMIN_EMAIL: 'magnus@example.com',
      SEND_EMAIL: { send: sendEmailMock } as any,
    });
    mockCtx = createMockContext();
    mockGSCFetch();
  });

  async function authedRequest(overrides: RequestInit = {}) {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    return new Request('http://localhost/admin/api/refresh-gsc', {
      method: 'POST',
      headers: {
        Cookie: `auth_token=${jwt}`,
        Origin: 'http://localhost',
        ...(overrides.headers as Record<string, string> ?? {}),
      },
      ...overrides,
    });
  }

  it('redirects unauthenticated requests', async () => {
    const request = new Request('http://localhost/admin/api/refresh-gsc', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect([302, 401]).toContain(response.status);
  });

  it('rejects cross-origin requests', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/refresh-gsc', {
      method: 'POST',
      headers: {
        Cookie: `auth_token=${jwt}`,
        Origin: 'http://evil.example.com',
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(403);
  });

  it('runs the poll and returns the new snapshot', async () => {
    const response = await worker.fetch(await authedRequest(), mockEnv, mockCtx);
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; snapshot: any };
    expect(body.ok).toBe(true);
    expect(body.snapshot.indexing.indexedCount).toBe(5);
  });

  it('does NOT send email even when alerts graduate (skipDispatch semantics)', async () => {
    // Seed pending-state so today's observation would normally graduate + email.
    // Compute the 7-day-ago history key from real "now" — the refresh endpoint
    // doesn't accept a `now` override, so we have to align with the wall clock.
    const realNow = new Date();
    const sevenDaysAgo = new Date(realNow);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const yyyymmdd = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const weekAgo = {
      capturedAt: sevenDaysAgo.toISOString(),
      siteUrl: 'sc-domain:hultberg.org',
      sitemaps: [],
      indexing: { indexedCount: 20 },
      performance: {
        period: '28d', totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0,
        topQueries: [], priorPeriodClicks: 0, priorPeriodImpressions: 0,
      },
      alerts: [], pendingAlerts: [],
      emailDelivery: { lastProvider: null, lastSuccessAt: null, lastErrorAt: null },
    };
    const previousLatest = {
      ...weekAgo,
      capturedAt: realNow.toISOString(),
      indexing: { indexedCount: 5 },
      pendingAlerts: [{ type: 'indexed-drop', firstDetectedAt: realNow.toISOString() }],
    };
    await mockEnv.GSC_KV.put(`status:history:${yyyymmdd(sevenDaysAgo)}`, JSON.stringify(weekAgo));
    await mockEnv.GSC_KV.put('status:latest', JSON.stringify(previousLatest));

    const response = await worker.fetch(await authedRequest(), mockEnv, mockCtx);
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; snapshot: any };

    // Alert IS graduated into the snapshot (refresh computes state)...
    expect(body.snapshot.alerts).toHaveLength(1);
    expect(body.snapshot.alerts[0].type).toBe('indexed-drop');
    expect(body.snapshot.alerts[0].emailSent).toBe(false);
    // ...but email was NOT sent (refresh skips dispatch).
    expect(sendEmailMock).not.toHaveBeenCalled();
    // ...and no dedup key was written, so the next cron will still deliver.
    expect(await mockEnv.GSC_KV.get('alert:dedup:indexed-drop:')).toBeNull();
  });

  it('rate-limits a second refresh within the window', async () => {
    const first = await worker.fetch(await authedRequest(), mockEnv, mockCtx);
    expect(first.status).toBe(200);

    const second = await worker.fetch(await authedRequest(), mockEnv, mockCtx);
    expect(second.status).toBe(429);
    const body = await second.json() as { ok: boolean; error: string };
    expect(body.error).toContain('60s');
  });
});
