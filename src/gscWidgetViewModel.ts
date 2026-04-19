// ABOUT: Pure transformation from a GSCSnapshot into a flat view-model for the
// ABOUT: dashboard widget. Keeping the DOM-free half separate means the bulk of
// ABOUT: the widget's logic is unit-testable in the Node test runtime.

import type { GSCSnapshot } from './types';

export interface WidgetAlert {
  type: string;
  severity: 'high' | 'medium';
  subject: string;
  message: string;
  firstDetectedAt: string;
  daysSeen: number;
  emailSent: boolean;
}

export interface WidgetKpiTile {
  label: string;
  value: string;
  sub: string;
  deltaClass: 'up' | 'down' | 'flat';
}

export interface WidgetTopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctrPct: string;     // pre-formatted, e.g. "4.5%"
  position: string;   // pre-formatted, e.g. "2.1"
}

export interface WidgetViewModel {
  state: 'empty' | 'stale' | 'fresh';
  freshnessLabel: string;      // "Last refreshed 4h ago" or "No data yet"
  alerts: WidgetAlert[];
  kpis: WidgetKpiTile[];
  topQueries: WidgetTopQuery[];
  emailDelivery: {
    label: string;             // "CF · 2h ago" / "Resend (fallback) · 1d ago" / "Never attempted" / "Both providers failed · Xh ago"
    kind: 'ok' | 'warn' | 'error' | 'idle';
  };
}

const STALE_HOURS = 36;

/**
 * Build a view-model from a snapshot + current time.
 * If snapshot is null (no data yet), returns the empty state.
 */
export function renderViewModel(snapshot: GSCSnapshot | null, now: Date): WidgetViewModel {
  if (!snapshot) {
    return {
      state: 'empty',
      freshnessLabel: 'No data yet — the first poll runs daily at 08:00 UTC.',
      alerts: [],
      kpis: [],
      topQueries: [],
      emailDelivery: { label: 'Never attempted', kind: 'idle' },
    };
  }

  const ageMs = now.getTime() - new Date(snapshot.capturedAt).getTime();
  const ageHours = Math.max(0, Math.floor(ageMs / (60 * 60 * 1000)));
  const isStale = ageHours >= STALE_HOURS;

  return {
    state: isStale ? 'stale' : 'fresh',
    freshnessLabel: freshnessLabel(ageHours),
    alerts: snapshot.alerts.map((a) => {
      // Back-compat: alerts written by PR #29's cron lack firstDetectedAt.
      // Fall back to detectedAt, then to the snapshot's own capture time —
      // anything but `undefined`, which would render as "Seen for NaN days".
      const firstDetectedAt = a.firstDetectedAt ?? a.detectedAt ?? snapshot.capturedAt;
      return {
        type: a.type,
        severity: a.severity,
        subject: a.subject,
        message: a.message,
        firstDetectedAt,
        daysSeen: daysBetween(new Date(firstDetectedAt), now),
        emailSent: a.emailSent,
      };
    }),
    kpis: buildKpis(snapshot),
    topQueries: snapshot.performance.topQueries.map((q) => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctrPct: `${(q.ctr * 100).toFixed(1)}%`,
      position: q.position.toFixed(1),
    })),
    emailDelivery: buildEmailDelivery(snapshot, now),
  };
}

function freshnessLabel(ageHours: number): string {
  if (ageHours === 0) return 'Refreshed moments ago';
  if (ageHours === 1) return 'Refreshed 1 hour ago';
  if (ageHours < 24) return `Refreshed ${ageHours} hours ago`;
  const days = Math.floor(ageHours / 24);
  return days === 1 ? 'Refreshed 1 day ago' : `Refreshed ${days} days ago`;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

function buildKpis(snapshot: GSCSnapshot): WidgetKpiTile[] {
  const sitemap = snapshot.sitemaps[0];
  const submitted = sitemap?.submitted ?? 0;
  const indexed = sitemap?.indexed ?? 0;

  const clicksDelta = snapshot.performance.priorPeriodClicks > 0
    ? (snapshot.performance.totalClicks - snapshot.performance.priorPeriodClicks) / snapshot.performance.priorPeriodClicks
    : 0;
  const impressionsDelta = snapshot.performance.priorPeriodImpressions > 0
    ? (snapshot.performance.totalImpressions - snapshot.performance.priorPeriodImpressions) / snapshot.performance.priorPeriodImpressions
    : 0;

  return [
    {
      label: 'Indexed pages',
      value: String(snapshot.indexing.indexedCount),
      sub: '',
      deltaClass: 'flat',
    },
    {
      label: 'Sitemap',
      value: submitted === 0 ? '0' : `${indexed} / ${submitted}`,
      sub: 'indexed / submitted',
      deltaClass: 'flat',
    },
    {
      label: 'Clicks (28d)',
      value: String(snapshot.performance.totalClicks),
      sub: formatDeltaSub(clicksDelta, 'vs prior 28d'),
      deltaClass: deltaClassFor(clicksDelta),
    },
    {
      label: 'Impressions (28d)',
      value: String(snapshot.performance.totalImpressions),
      sub: formatDeltaSub(impressionsDelta, 'vs prior 28d'),
      deltaClass: deltaClassFor(impressionsDelta),
    },
  ];
}

function formatDeltaSub(delta: number, suffix: string): string {
  if (delta === 0) return `no change ${suffix}`;
  const pct = Math.round(delta * 100);
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}% ${suffix}`;
}

function deltaClassFor(delta: number): 'up' | 'down' | 'flat' {
  if (delta > 0.02) return 'up';
  if (delta < -0.02) return 'down';
  return 'flat';
}

function buildEmailDelivery(snapshot: GSCSnapshot, now: Date): WidgetViewModel['emailDelivery'] {
  const d = snapshot.emailDelivery;
  if (!d.lastProvider && !d.lastSuccessAt && !d.lastErrorAt) {
    return { label: 'Never attempted', kind: 'idle' };
  }

  if (d.lastProvider === 'none') {
    const age = d.lastErrorAt ? relativeTimeLabel(new Date(d.lastErrorAt), now) : 'recently';
    return { label: `Both providers failed · ${age}`, kind: 'error' };
  }

  if (d.lastProvider === 'resend') {
    const age = d.lastSuccessAt ? relativeTimeLabel(new Date(d.lastSuccessAt), now) : 'recently';
    return { label: `Resend (fallback) · ${age}`, kind: 'warn' };
  }

  if (d.lastProvider === 'cf') {
    const age = d.lastSuccessAt ? relativeTimeLabel(new Date(d.lastSuccessAt), now) : 'recently';
    return { label: `CF · ${age}`, kind: 'ok' };
  }

  return { label: 'Never attempted', kind: 'idle' };
}

function relativeTimeLabel(from: Date, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - from.getTime()) / (60 * 60 * 1000)));
  if (hours < 1) return 'just now';
  if (hours === 1) return '1h ago';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}
