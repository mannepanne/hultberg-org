// ABOUT: Unit tests for the resolveAlerts pure function.
// ABOUT: Verifies two-consecutive-observation graduation, first-observation pending
// ABOUT: behaviour, and each alert-type condition.

import { describe, it, expect } from 'vitest';
import { resolveAlerts } from '@/scheduled';
import type { GSCSnapshot, GSCSitemapStatus, GSCPerformance } from '@/types';

const NOW = new Date('2026-04-18T08:00:00Z');

function makePerformance(overrides: Partial<GSCPerformance> = {}): GSCPerformance {
  return {
    period: '28d',
    totalClicks: 100,
    totalImpressions: 5000,
    avgCtr: 0.02,
    avgPosition: 15,
    topQueries: [],
    priorPeriodClicks: 100,
    priorPeriodImpressions: 5000,
    ...overrides,
  };
}

function makeSitemap(overrides: Partial<GSCSitemapStatus> = {}): GSCSitemapStatus {
  return {
    path: 'https://hultberg.org/sitemap.xml',
    lastSubmitted: '2026-04-18T00:00:00Z',
    lastDownloaded: '2026-04-18T00:00:00Z',
    errors: 0,
    warnings: 0,
    submitted: 20,
    indexed: 18,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<GSCSnapshot> = {}): GSCSnapshot {
  return {
    capturedAt: '2026-04-17T08:00:00Z',
    siteUrl: 'sc-domain:hultberg.org',
    sitemaps: [makeSitemap()],
    indexing: { indexedCount: 18 },
    performance: makePerformance(),
    alerts: [],
    pendingAlerts: [],
    emailDelivery: { lastProvider: null, lastSuccessAt: null, lastErrorAt: null },
    ...overrides,
  };
}

describe('resolveAlerts — indexed-drop', () => {
  it('does not alert on a first-observed drop (marks pending instead)', () => {
    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      current: { indexedCount: 10, sitemaps: [makeSitemap({ indexed: 10 })], performance: makePerformance() },
      previousLatest: makeSnapshot({ pendingAlerts: [] }),
      weekAgo: makeSnapshot({ indexing: { indexedCount: 20 } }),
    });

    expect(alerts).toEqual([]);
    expect(pendingAlerts).toHaveLength(1);
    expect(pendingAlerts[0].type).toBe('indexed-drop');
  });

  it('graduates to a real alert on the second consecutive observation', () => {
    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      current: { indexedCount: 10, sitemaps: [makeSitemap({ indexed: 10 })], performance: makePerformance() },
      previousLatest: makeSnapshot({
        pendingAlerts: [{ type: 'indexed-drop', firstDetectedAt: '2026-04-17T08:00:00Z' }],
      }),
      weekAgo: makeSnapshot({ indexing: { indexedCount: 20 } }),
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: 'indexed-drop',
      severity: 'high',
      detectedAt: NOW.toISOString(),
      emailSent: false,
    });
    expect(pendingAlerts).toEqual([]);
  });

  it('does not alert when no 7-day snapshot is available', () => {
    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      current: { indexedCount: 10, sitemaps: [makeSitemap()], performance: makePerformance() },
      previousLatest: null,
      weekAgo: null,
    });

    expect(alerts).toEqual([]);
    expect(pendingAlerts).toEqual([]);
  });

  it('does not alert on a small dip that stays above the threshold', () => {
    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      current: { indexedCount: 18, sitemaps: [makeSitemap({ indexed: 18 })], performance: makePerformance() },
      previousLatest: makeSnapshot(),
      weekAgo: makeSnapshot({ indexing: { indexedCount: 20 } }),
    });

    expect(alerts).toEqual([]);
    expect(pendingAlerts).toEqual([]);
  });
});

describe('resolveAlerts — sitemap-error', () => {
  it('flags a pending alert when errors first appear', () => {
    const current = {
      indexedCount: 18,
      sitemaps: [makeSitemap({ errors: 1, warnings: 0 })],
      performance: makePerformance(),
    };
    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      current,
      previousLatest: makeSnapshot(),
      weekAgo: null,
    });

    expect(alerts).toEqual([]);
    expect(pendingAlerts.map((p) => p.type)).toContain('sitemap-error');
  });

  it('graduates when the error persists across two runs', () => {
    const current = {
      indexedCount: 18,
      sitemaps: [makeSitemap({ errors: 1 })],
      performance: makePerformance(),
    };
    const previous = makeSnapshot({
      pendingAlerts: [{ type: 'sitemap-error', firstDetectedAt: '2026-04-17T08:00:00Z' }],
    });
    const { alerts } = resolveAlerts({ now: NOW, current, previousLatest: previous, weekAgo: null });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('sitemap-error');
    expect(alerts[0].message).toContain('1 error');
  });
});

describe('resolveAlerts — new-crawl-warning (warnings)', () => {
  it('flags when warnings increase compared to previous snapshot', () => {
    const current = {
      indexedCount: 18,
      sitemaps: [makeSitemap({ warnings: 2 })],
      performance: makePerformance(),
    };
    const previous = makeSnapshot({ sitemaps: [makeSitemap({ warnings: 1 })] });

    const { pendingAlerts } = resolveAlerts({
      now: NOW,
      current,
      previousLatest: previous,
      weekAgo: null,
    });

    expect(pendingAlerts.map((p) => p.type)).toContain('new-crawl-warning');
  });

  it('does not flag when warning count is stable', () => {
    const current = {
      indexedCount: 18,
      sitemaps: [makeSitemap({ warnings: 1 })],
      performance: makePerformance(),
    };
    const previous = makeSnapshot({ sitemaps: [makeSitemap({ warnings: 1 })] });

    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      current,
      previousLatest: previous,
      weekAgo: null,
    });

    expect(alerts).toEqual([]);
    expect(pendingAlerts).toEqual([]);
  });
});

describe('resolveAlerts — continuation (no pending re-pending oscillation)', () => {
  it('keeps a previously-alerted, still-triggering condition in alerts (not recycled to pending)', () => {
    const previousLatest = makeSnapshot({
      alerts: [{
        type: 'indexed-drop',
        severity: 'high',
        subject: 'Indexed pages dropped 50% (20→10)',
        message: 'x',
        detectedAt: '2026-04-17T08:00:00Z',
        emailSent: true,
      }],
      pendingAlerts: [],
    });

    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      current: { indexedCount: 10, sitemaps: [makeSitemap({ indexed: 10 })], performance: makePerformance() },
      previousLatest,
      weekAgo: makeSnapshot({ indexing: { indexedCount: 20 } }),
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('indexed-drop');
    expect(pendingAlerts).toEqual([]);
  });

  it('drops a previously-alerted condition that has resolved (neither alerts nor pending)', () => {
    const previousLatest = makeSnapshot({
      alerts: [{
        type: 'indexed-drop',
        severity: 'high',
        subject: 'x',
        message: 'x',
        detectedAt: '2026-04-17T08:00:00Z',
        emailSent: true,
      }],
    });

    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      // Recovered: current matches week-ago
      current: { indexedCount: 20, sitemaps: [makeSitemap({ indexed: 20 })], performance: makePerformance() },
      previousLatest,
      weekAgo: makeSnapshot({ indexing: { indexedCount: 20 } }),
    });

    expect(alerts).toEqual([]);
    expect(pendingAlerts).toEqual([]);
  });
});

describe('resolveAlerts — subject magnitude', () => {
  it('indexed-drop subject includes percent and from→to numbers', () => {
    const previous = makeSnapshot({
      pendingAlerts: [{ type: 'indexed-drop', firstDetectedAt: '2026-04-17T08:00:00Z' }],
    });
    const { alerts } = resolveAlerts({
      now: NOW,
      current: { indexedCount: 10, sitemaps: [makeSitemap({ indexed: 10 })], performance: makePerformance() },
      previousLatest: previous,
      weekAgo: makeSnapshot({ indexing: { indexedCount: 20 } }),
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].subject).toBe('Indexed pages dropped 50% (20→10)');
  });

  it('impressions-drop subject includes percent and from→to numbers', () => {
    const previous = makeSnapshot({
      pendingAlerts: [{ type: 'impressions-drop', firstDetectedAt: '2026-04-17T08:00:00Z' }],
    });
    const { alerts } = resolveAlerts({
      now: NOW,
      current: {
        indexedCount: 18,
        sitemaps: [makeSitemap()],
        performance: makePerformance({ totalImpressions: 1000, priorPeriodImpressions: 5000 }),
      },
      previousLatest: previous,
      weekAgo: null,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].subject).toBe('Impressions dropped 80% (5000→1000)');
  });
});

describe('resolveAlerts — impressions-drop', () => {
  it('flags pending when impressions collapse vs prior 28d', () => {
    const perf = makePerformance({ totalImpressions: 1000, priorPeriodImpressions: 5000 });
    const current = {
      indexedCount: 18,
      sitemaps: [makeSitemap()],
      performance: perf,
    };
    const { pendingAlerts } = resolveAlerts({
      now: NOW,
      current,
      previousLatest: makeSnapshot(),
      weekAgo: null,
    });

    expect(pendingAlerts.map((p) => p.type)).toContain('impressions-drop');
  });

  it('does not flag when prior-period impressions are zero (avoid div-by-zero spam)', () => {
    const perf = makePerformance({ totalImpressions: 0, priorPeriodImpressions: 0 });
    const current = {
      indexedCount: 18,
      sitemaps: [makeSitemap()],
      performance: perf,
    };
    const { alerts, pendingAlerts } = resolveAlerts({
      now: NOW,
      current,
      previousLatest: makeSnapshot(),
      weekAgo: null,
    });

    expect(alerts).toEqual([]);
    expect(pendingAlerts).toEqual([]);
  });
});
