// ABOUT: Integration tests for the scheduled GSC poll orchestrator.
// ABOUT: Mocks the GSC API via global fetch and verifies end-to-end behaviour:
// ABOUT: snapshot persistence, alert graduation, email dispatch, and dedup.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runDailyPoll } from '@/scheduled';
import { createMockEnv } from '../mocks/env';
import type { GSCSnapshot } from '@/types';

const privateKeyPem = readFileSync(
  join(__dirname, '..', 'fixtures', 'test-private-key.pem'),
  'utf8',
);

const SITE_URL = 'sc-domain:hultberg.org';
const NOW = new Date('2026-04-18T08:00:00Z');

const serviceAccountJson = JSON.stringify({
  type: 'service_account',
  client_email: 'test-sa@wandering-paths.iam.gserviceaccount.com',
  private_key: privateKeyPem,
});

interface MockGSCResponses {
  sitemaps?: unknown;
  analyticsByDateRange?: Map<string, unknown>;
  analyticsTopQueries?: unknown;
}

function mockGSCApi(responses: MockGSCResponses): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(
        JSON.stringify({ access_token: 'test-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.endsWith('/sitemaps')) {
      return new Response(JSON.stringify(responses.sitemaps ?? { sitemap: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/searchAnalytics/query')) {
      const body = JSON.parse(init?.body?.toString() ?? '{}');
      const hasQueryDim = Array.isArray(body.dimensions) && body.dimensions.includes('query');
      if (hasQueryDim) {
        return new Response(JSON.stringify(responses.analyticsTopQueries ?? { rows: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const key = `${body.startDate}_${body.endDate}`;
      const dated = responses.analyticsByDateRange?.get(key);
      return new Response(JSON.stringify(dated ?? { rows: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  });
  global.fetch = spy as unknown as typeof fetch;
  return spy;
}

function goodSitemapsResponse(overrides: { errors?: number; warnings?: number; indexed?: string } = {}) {
  return {
    sitemap: [
      {
        path: 'https://hultberg.org/sitemap.xml',
        lastSubmitted: '2026-04-17T00:00:00Z',
        lastDownloaded: '2026-04-17T00:00:00Z',
        errors: overrides.errors ?? 0,
        warnings: overrides.warnings ?? 0,
        contents: [{ type: 'web', submitted: '20', indexed: overrides.indexed ?? '18' }],
      },
    ],
  };
}

describe('runDailyPoll', () => {
  let sendEmailMock: ReturnType<typeof vi.fn>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    sendEmailMock = vi.fn(async () => undefined);
    env = createMockEnv({
      GSC_SERVICE_ACCOUNT_JSON: serviceAccountJson,
      ADMIN_EMAIL: 'magnus@example.com',
      SEND_EMAIL: { send: sendEmailMock } as any,
    });
  });

  it('throws when GSC_SERVICE_ACCOUNT_JSON is missing', async () => {
    const bareEnv = createMockEnv({ GSC_SERVICE_ACCOUNT_JSON: undefined });
    await expect(runDailyPoll(bareEnv, { now: NOW })).rejects.toThrow(/GSC_SERVICE_ACCOUNT_JSON/);
  });

  it('throws when GSC_KV binding is missing', async () => {
    const bareEnv = createMockEnv({
      GSC_SERVICE_ACCOUNT_JSON: serviceAccountJson,
      GSC_KV: undefined,
    });
    await expect(runDailyPoll(bareEnv, { now: NOW })).rejects.toThrow(/GSC_KV/);
  });

  it('writes a snapshot to KV at status:latest and status:history', async () => {
    mockGSCApi({ sitemaps: goodSitemapsResponse() });

    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL });

    expect(snapshot.siteUrl).toBe(SITE_URL);
    expect(snapshot.indexing.indexedCount).toBe(18);
    expect(snapshot.sitemaps).toHaveLength(1);
    expect(snapshot.alerts).toEqual([]);

    const latest = await env.GSC_KV!.get('status:latest');
    expect(latest).not.toBeNull();
    const parsed = JSON.parse(latest!) as GSCSnapshot;
    expect(parsed.indexing.indexedCount).toBe(18);

    const history = await env.GSC_KV!.get('status:history:2026-04-18');
    expect(history).not.toBeNull();
  });

  it('marks cron-path snapshots with source: cron', async () => {
    mockGSCApi({ sitemaps: goodSitemapsResponse() });
    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL });
    expect(snapshot.source).toBe('cron');
  });

  it('marks manual-path snapshots with source: manual when skipDispatch is true', async () => {
    mockGSCApi({ sitemaps: goodSitemapsResponse() });
    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL, skipDispatch: true });
    expect(snapshot.source).toBe('manual');
  });

  it('includes top queries in the performance payload', async () => {
    mockGSCApi({
      sitemaps: goodSitemapsResponse(),
      analyticsTopQueries: {
        rows: [
          { keys: ['magnus hultberg'], clicks: 145, impressions: 3204, ctr: 0.045, position: 2.1 },
          { keys: ['flying jacob recipe'], clicks: 62, impressions: 1128, ctr: 0.055, position: 4.8 },
        ],
      },
    });

    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL });

    expect(snapshot.performance.topQueries).toHaveLength(2);
    expect(snapshot.performance.topQueries[0].query).toBe('magnus hultberg');
    expect(snapshot.performance.topQueries[0].clicks).toBe(145);
  });

  it('does not alert on first observation of a condition, but marks pending', async () => {
    // Previous snapshot shows indexed=20. Today shows indexed=10 (50% drop, first time seen).
    const priorSnapshot: GSCSnapshot = {
      capturedAt: '2026-04-11T08:00:00Z',
      siteUrl: SITE_URL,
      sitemaps: [],
      indexing: { indexedCount: 20 },
      performance: {
        period: '28d', totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0,
        topQueries: [], priorPeriodClicks: 0, priorPeriodImpressions: 0,
      },
      alerts: [],
      pendingAlerts: [],
      emailDelivery: { lastProvider: null, lastSuccessAt: null, lastErrorAt: null },
    };
    // Week-ago snapshot is used for the indexed-drop check.
    await env.GSC_KV!.put('status:history:2026-04-11', JSON.stringify(priorSnapshot));
    await env.GSC_KV!.put('status:latest', JSON.stringify(priorSnapshot));

    mockGSCApi({ sitemaps: goodSitemapsResponse({ indexed: '10' }) });

    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL });

    expect(snapshot.alerts).toEqual([]);
    expect(snapshot.pendingAlerts.map((p) => p.type)).toContain('indexed-drop');
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('graduates a pending condition on the second observation and sends email', async () => {
    // Week-ago: 20 indexed. Previous-latest: pending indexed-drop. Today: still 10 indexed → alert.
    const weekAgo: GSCSnapshot = {
      capturedAt: '2026-04-11T08:00:00Z',
      siteUrl: SITE_URL, sitemaps: [],
      indexing: { indexedCount: 20 },
      performance: {
        period: '28d', totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0,
        topQueries: [], priorPeriodClicks: 0, priorPeriodImpressions: 0,
      },
      alerts: [], pendingAlerts: [],
      emailDelivery: { lastProvider: null, lastSuccessAt: null, lastErrorAt: null },
    };
    const previousLatest: GSCSnapshot = {
      ...weekAgo,
      capturedAt: '2026-04-17T08:00:00Z',
      indexing: { indexedCount: 10 },
      pendingAlerts: [{ type: 'indexed-drop', firstDetectedAt: '2026-04-17T08:00:00Z' }],
    };
    await env.GSC_KV!.put('status:history:2026-04-11', JSON.stringify(weekAgo));
    await env.GSC_KV!.put('status:latest', JSON.stringify(previousLatest));

    mockGSCApi({ sitemaps: goodSitemapsResponse({ indexed: '10' }) });

    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL });

    expect(snapshot.alerts).toHaveLength(1);
    expect(snapshot.alerts[0].type).toBe('indexed-drop');
    expect(snapshot.alerts[0].emailSent).toBe(true);
    expect(snapshot.emailDelivery.lastProvider).toBe('cf');
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates: does not re-send an alert within 24h', async () => {
    // Set up for graduation
    const weekAgo: GSCSnapshot = {
      capturedAt: '2026-04-11T08:00:00Z',
      siteUrl: SITE_URL, sitemaps: [],
      indexing: { indexedCount: 20 },
      performance: {
        period: '28d', totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0,
        topQueries: [], priorPeriodClicks: 0, priorPeriodImpressions: 0,
      },
      alerts: [], pendingAlerts: [],
      emailDelivery: { lastProvider: null, lastSuccessAt: null, lastErrorAt: null },
    };
    const previousLatest: GSCSnapshot = {
      ...weekAgo,
      capturedAt: '2026-04-17T08:00:00Z',
      indexing: { indexedCount: 10 },
      pendingAlerts: [{ type: 'indexed-drop', firstDetectedAt: '2026-04-17T08:00:00Z' }],
    };
    await env.GSC_KV!.put('status:history:2026-04-11', JSON.stringify(weekAgo));
    await env.GSC_KV!.put('status:latest', JSON.stringify(previousLatest));
    // Dedup key already present (new shape per spec: alert:dedup:{type}:{discriminator})
    await env.GSC_KV!.put('alert:dedup:indexed-drop:', '2026-04-18T00:00:00Z');

    mockGSCApi({ sitemaps: goodSitemapsResponse({ indexed: '10' }) });

    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL });

    expect(snapshot.alerts).toHaveLength(1);
    expect(snapshot.alerts[0].emailSent).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
    // Dedup-suppressed dispatches must not advance email-delivery state —
    // otherwise the dashboard reads chronic alerts as chronic delivery failure.
    expect(snapshot.emailDelivery).toEqual(previousLatest.emailDelivery);
  });

  it('skipDispatch: graduates alerts but does NOT send email or write dedup keys', async () => {
    // Set up for graduation: previous pending, conditions still trigger today.
    const weekAgo: GSCSnapshot = {
      capturedAt: '2026-04-11T08:00:00Z',
      siteUrl: SITE_URL, sitemaps: [],
      indexing: { indexedCount: 20 },
      performance: {
        period: '28d', totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0,
        topQueries: [], priorPeriodClicks: 0, priorPeriodImpressions: 0,
      },
      alerts: [], pendingAlerts: [],
      emailDelivery: { lastProvider: null, lastSuccessAt: null, lastErrorAt: null },
    };
    const previousLatest: GSCSnapshot = {
      ...weekAgo,
      capturedAt: '2026-04-17T08:00:00Z',
      indexing: { indexedCount: 10 },
      pendingAlerts: [{ type: 'indexed-drop', firstDetectedAt: '2026-04-17T08:00:00Z' }],
    };
    await env.GSC_KV!.put('status:history:2026-04-11', JSON.stringify(weekAgo));
    await env.GSC_KV!.put('status:latest', JSON.stringify(previousLatest));

    mockGSCApi({ sitemaps: goodSitemapsResponse({ indexed: '10' }) });

    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL, skipDispatch: true });

    // Alert is graduated and present in snapshot (state machine still runs).
    expect(snapshot.alerts).toHaveLength(1);
    expect(snapshot.alerts[0].type).toBe('indexed-drop');
    // But no email was sent and emailSent stays false.
    expect(snapshot.alerts[0].emailSent).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
    // Email delivery state is untouched — refresh doesn't advance it.
    expect(snapshot.emailDelivery).toEqual(previousLatest.emailDelivery);
    // Crucially: no dedup key written, so the next cron run will attempt delivery.
    expect(await env.GSC_KV!.get('alert:dedup:indexed-drop:')).toBeNull();
  });

  it('handles an empty sitemap list gracefully', async () => {
    mockGSCApi({ sitemaps: { sitemap: [] } });

    const snapshot = await runDailyPoll(env, { now: NOW, siteUrl: SITE_URL });

    expect(snapshot.sitemaps).toEqual([]);
    expect(snapshot.indexing.indexedCount).toBe(0);
    expect(snapshot.alerts).toEqual([]);
  });
});
