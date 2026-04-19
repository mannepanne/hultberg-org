// ABOUT: Integration tests for GET /admin/api/gsc-status.
// ABOUT: Covers auth gating, empty KV, populated KV, corrupt snapshot.

import { describe, it, expect, beforeEach } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { GSCSnapshot } from '@/types';

const SAMPLE_SNAPSHOT: GSCSnapshot = {
  capturedAt: '2026-04-18T08:00:00Z',
  siteUrl: 'sc-domain:hultberg.org',
  sitemaps: [],
  indexing: { indexedCount: 18 },
  performance: {
    period: '28d',
    totalClicks: 100, totalImpressions: 3000, avgCtr: 0.033, avgPosition: 5,
    topQueries: [], priorPeriodClicks: 80, priorPeriodImpressions: 2500,
  },
  alerts: [],
  pendingAlerts: [],
  emailDelivery: { lastProvider: null, lastSuccessAt: null, lastErrorAt: null },
};

describe('GET /admin/api/gsc-status', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('redirects unauthenticated requests', async () => {
    const request = new Request('http://localhost/admin/api/gsc-status', { method: 'GET' });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    // requireAuth returns a 302 response for unauth'd access
    expect([302, 401]).toContain(response.status);
  });

  it('returns snapshot: null when KV is empty', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/gsc-status', {
      method: 'GET',
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; snapshot: unknown };
    expect(body.ok).toBe(true);
    expect(body.snapshot).toBeNull();
  });

  it('returns the stored snapshot when present', async () => {
    await mockEnv.GSC_KV.put('status:latest', JSON.stringify(SAMPLE_SNAPSHOT));
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/gsc-status', {
      method: 'GET',
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; snapshot: GSCSnapshot };
    expect(body.ok).toBe(true);
    expect(body.snapshot.siteUrl).toBe('sc-domain:hultberg.org');
    expect(body.snapshot.indexing.indexedCount).toBe(18);
  });

  it('returns 500 when snapshot JSON is corrupt', async () => {
    await mockEnv.GSC_KV.put('status:latest', '{not-valid-json');
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/gsc-status', {
      method: 'GET',
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(500);
    const body = await response.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Corrupt');
  });

  it('returns 500 when GSC_KV binding is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const envWithoutKV = { ...mockEnv, GSC_KV: undefined };
    const request = new Request('http://localhost/admin/api/gsc-status', {
      method: 'GET',
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, envWithoutKV, mockCtx);
    expect(response.status).toBe(500);
  });

  it('returns manualCheckLastClicked alongside snapshot when KV key is set', async () => {
    await mockEnv.GSC_KV.put('status:latest', JSON.stringify(SAMPLE_SNAPSHOT));
    await mockEnv.GSC_KV.put('manual-check:lastClicked', '2026-04-10T12:00:00Z');
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/gsc-status', {
      method: 'GET',
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);
    const body = await response.json() as { manualCheckLastClicked: string | null };
    expect(body.manualCheckLastClicked).toBe('2026-04-10T12:00:00Z');
  });

  it('returns manualCheckLastClicked: null when KV key is absent', async () => {
    await mockEnv.GSC_KV.put('status:latest', JSON.stringify(SAMPLE_SNAPSHOT));
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/gsc-status', {
      method: 'GET',
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const body = await response.json() as { manualCheckLastClicked: string | null };
    expect(body.manualCheckLastClicked).toBeNull();
  });

  it('sets a no-store cache-control header (admin data, per-user)', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/gsc-status', {
      method: 'GET',
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
});
