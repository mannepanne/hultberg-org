// ABOUT: Unit tests for the GSC dashboard widget view-model.

import { describe, it, expect } from 'vitest';
import { renderViewModel } from '@/gscWidgetViewModel';
import type { GSCSnapshot } from '@/types';

const NOW = new Date('2026-04-18T12:00:00Z');

function makeSnapshot(overrides: Partial<GSCSnapshot> = {}): GSCSnapshot {
  return {
    capturedAt: '2026-04-18T08:00:00Z', // 4h ago
    siteUrl: 'sc-domain:hultberg.org',
    sitemaps: [{
      path: 'https://hultberg.org/sitemap.xml',
      lastSubmitted: null, lastDownloaded: null,
      errors: 0, warnings: 0, submitted: 20, indexed: 18,
    }],
    indexing: { indexedCount: 18 },
    performance: {
      period: '28d',
      totalClicks: 120, totalImpressions: 4000, avgCtr: 0.03, avgPosition: 5,
      topQueries: [], priorPeriodClicks: 100, priorPeriodImpressions: 3500,
    },
    alerts: [],
    pendingAlerts: [],
    emailDelivery: { lastProvider: null, lastSuccessAt: null, lastErrorAt: null },
    ...overrides,
  };
}

describe('renderViewModel — empty state', () => {
  it('returns empty state when snapshot is null', () => {
    const vm = renderViewModel(null, NOW);
    expect(vm.state).toBe('empty');
    expect(vm.freshnessLabel).toContain('No data yet');
    expect(vm.alerts).toEqual([]);
    expect(vm.kpis).toEqual([]);
    expect(vm.topQueries).toEqual([]);
    expect(vm.emailDelivery.kind).toBe('idle');
  });
});

describe('renderViewModel — freshness', () => {
  it('marks 4h-old snapshot as fresh', () => {
    const vm = renderViewModel(makeSnapshot({ capturedAt: '2026-04-18T08:00:00Z' }), NOW);
    expect(vm.state).toBe('fresh');
    expect(vm.freshnessLabel).toBe('Refreshed 4 hours ago');
  });

  it('marks 36h+ snapshot as stale', () => {
    const vm = renderViewModel(
      makeSnapshot({ capturedAt: '2026-04-17T00:00:00Z' }),
      NOW,
    );
    expect(vm.state).toBe('stale');
  });

  it('uses day-granularity for older snapshots', () => {
    const vm = renderViewModel(
      makeSnapshot({ capturedAt: '2026-04-15T12:00:00Z' }), // 3 days ago
      NOW,
    );
    expect(vm.freshnessLabel).toBe('Refreshed 3 days ago');
  });
});

describe('renderViewModel — KPIs', () => {
  it('emits four KPI tiles in the expected order', () => {
    const vm = renderViewModel(makeSnapshot(), NOW);
    expect(vm.kpis.map((k) => k.label)).toEqual([
      'Indexed pages',
      'Sitemap',
      'Clicks (28d)',
      'Impressions (28d)',
    ]);
  });

  it('formats sitemap as "indexed / submitted"', () => {
    const vm = renderViewModel(makeSnapshot(), NOW);
    const sitemap = vm.kpis.find((k) => k.label === 'Sitemap')!;
    expect(sitemap.value).toBe('18 / 20');
    expect(sitemap.sub).toBe('indexed / submitted');
  });

  it('shows an up-delta class when clicks grew', () => {
    const vm = renderViewModel(
      makeSnapshot({
        performance: {
          period: '28d',
          totalClicks: 120, totalImpressions: 4000, avgCtr: 0.03, avgPosition: 5,
          topQueries: [], priorPeriodClicks: 100, priorPeriodImpressions: 3500,
        },
      }),
      NOW,
    );
    const clicks = vm.kpis.find((k) => k.label === 'Clicks (28d)')!;
    expect(clicks.value).toBe('120');
    expect(clicks.deltaClass).toBe('up');
    expect(clicks.sub).toContain('+20%');
  });

  it('shows a down-delta class when impressions fell', () => {
    const vm = renderViewModel(
      makeSnapshot({
        performance: {
          period: '28d',
          totalClicks: 80, totalImpressions: 2000, avgCtr: 0.04, avgPosition: 5,
          topQueries: [], priorPeriodClicks: 100, priorPeriodImpressions: 4000,
        },
      }),
      NOW,
    );
    const impressions = vm.kpis.find((k) => k.label === 'Impressions (28d)')!;
    expect(impressions.deltaClass).toBe('down');
    expect(impressions.sub).toContain('-50%');
  });
});

describe('renderViewModel — top queries', () => {
  it('pre-formats ctr and position for rendering', () => {
    const vm = renderViewModel(
      makeSnapshot({
        performance: {
          period: '28d',
          totalClicks: 120, totalImpressions: 4000, avgCtr: 0.03, avgPosition: 5,
          topQueries: [
            { query: 'magnus hultberg', clicks: 100, impressions: 2000, ctr: 0.05, position: 2.17 },
          ],
          priorPeriodClicks: 100, priorPeriodImpressions: 3500,
        },
      }),
      NOW,
    );
    expect(vm.topQueries).toHaveLength(1);
    expect(vm.topQueries[0].query).toBe('magnus hultberg');
    expect(vm.topQueries[0].ctrPct).toBe('5.0%');
    expect(vm.topQueries[0].position).toBe('2.2');
  });
});

describe('renderViewModel — alerts back-compat', () => {
  it('falls back to detectedAt when firstDetectedAt is missing (PR #29 legacy snapshot)', () => {
    // Construct an alert object as PR #29 wrote it — without firstDetectedAt.
    const legacyAlert = {
      type: 'sitemap-error' as const,
      severity: 'high' as const,
      subject: 'x',
      message: 'x',
      detectedAt: '2026-04-16T08:00:00Z',
      emailSent: true,
    } as unknown as GSCSnapshot['alerts'][number];

    const vm = renderViewModel(
      makeSnapshot({ alerts: [legacyAlert] }),
      NOW,
    );
    expect(vm.alerts).toHaveLength(1);
    // Must NOT be NaN.
    expect(Number.isNaN(vm.alerts[0].daysSeen)).toBe(false);
    expect(vm.alerts[0].daysSeen).toBe(3);
    expect(vm.alerts[0].firstDetectedAt).toBe('2026-04-16T08:00:00Z');
  });

  it('falls back to snapshot.capturedAt when both firstDetectedAt and detectedAt are missing', () => {
    const verylegacy = {
      type: 'sitemap-error' as const,
      severity: 'high' as const,
      subject: 'x',
      message: 'x',
      emailSent: true,
    } as unknown as GSCSnapshot['alerts'][number];

    const vm = renderViewModel(
      makeSnapshot({ alerts: [verylegacy], capturedAt: '2026-04-17T08:00:00Z' }),
      NOW,
    );
    expect(Number.isNaN(vm.alerts[0].daysSeen)).toBe(false);
    expect(vm.alerts[0].firstDetectedAt).toBe('2026-04-17T08:00:00Z');
  });
});

describe('renderViewModel — alerts', () => {
  it('calculates days-seen from firstDetectedAt', () => {
    const vm = renderViewModel(
      makeSnapshot({
        alerts: [{
          type: 'indexed-drop',
          severity: 'high',
          subject: 'Indexed pages dropped 50%',
          message: 'x',
          firstDetectedAt: '2026-04-16T08:00:00Z', // 2 days ago
          detectedAt: '2026-04-18T08:00:00Z',
          emailSent: true,
        }],
      }),
      NOW,
    );
    expect(vm.alerts).toHaveLength(1);
    expect(vm.alerts[0].daysSeen).toBe(3); // inclusive count
    expect(vm.alerts[0].emailSent).toBe(true);
  });
});

describe('renderViewModel — email delivery', () => {
  it('reports "Never attempted" for a pristine state', () => {
    const vm = renderViewModel(makeSnapshot(), NOW);
    expect(vm.emailDelivery.kind).toBe('idle');
    expect(vm.emailDelivery.label).toBe('Never attempted');
  });

  it('reports CF provider as ok', () => {
    const vm = renderViewModel(
      makeSnapshot({
        emailDelivery: {
          lastProvider: 'cf',
          lastSuccessAt: '2026-04-18T10:00:00Z',
          lastErrorAt: null,
        },
      }),
      NOW,
    );
    expect(vm.emailDelivery.kind).toBe('ok');
    expect(vm.emailDelivery.label).toContain('CF');
    expect(vm.emailDelivery.label).toContain('2h ago');
  });

  it('reports Resend fallback as warn', () => {
    const vm = renderViewModel(
      makeSnapshot({
        emailDelivery: {
          lastProvider: 'resend',
          lastSuccessAt: '2026-04-18T11:00:00Z',
          lastErrorAt: null,
        },
      }),
      NOW,
    );
    expect(vm.emailDelivery.kind).toBe('warn');
    expect(vm.emailDelivery.label).toContain('Resend');
  });

  it("reports 'none' provider as error", () => {
    const vm = renderViewModel(
      makeSnapshot({
        emailDelivery: {
          lastProvider: 'none',
          lastSuccessAt: null,
          lastErrorAt: '2026-04-18T11:00:00Z',
        },
      }),
      NOW,
    );
    expect(vm.emailDelivery.kind).toBe('error');
    expect(vm.emailDelivery.label).toContain('Both providers failed');
  });
});
