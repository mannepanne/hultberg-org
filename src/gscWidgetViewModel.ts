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
  /**
   * Recency nudge for the "Check Search Console" link. Rendered in the
   * footer as either "Last checked in GSC UI: N days ago" or "Never
   * checked" — encourages the admin to periodically visit GSC directly
   * for manual actions / security issues that aren't in the API.
   */
  manualCheckRecency: {
    label: string;
    neverClicked: boolean;
  };
  /**
   * Optional advisory line shown above the alerts strip. Set when a manual
   * refresh has graduated at least one alert that has not yet been emailed —
   * tells the admin that dispatch will happen on the next 08:00 UTC cron.
   */
  caveat?: string;
}

const STALE_HOURS = 36;

/**
 * Build a view-model from a snapshot + current time.
 * If snapshot is null (no data yet), returns the empty state.
 *
 * `manualCheckLastClicked` is the ISO timestamp of the last time the admin
 * clicked the "Check Search Console" link in the widget footer, or `null`
 * if never clicked (fresh install, or never-clicked state).
 */
export function renderViewModel(
  snapshot: GSCSnapshot | null,
  now: Date,
  manualCheckLastClicked: string | null = null,
): WidgetViewModel {
  const manualCheckRecency = buildManualCheckRecency(manualCheckLastClicked, now);

  if (!snapshot) {
    return {
      state: 'empty',
      freshnessLabel: 'No data yet — the first poll runs daily at 08:00 UTC.',
      alerts: [],
      kpis: [],
      topQueries: [],
      emailDelivery: { label: 'Never attempted', kind: 'idle' },
      manualCheckRecency,
    };
  }

  const ageMs = now.getTime() - new Date(snapshot.capturedAt).getTime();
  const ageHours = Math.max(0, Math.floor(ageMs / (60 * 60 * 1000)));
  const isStale = ageHours >= STALE_HOURS;

  const widgetAlerts: WidgetAlert[] = snapshot.alerts.map((a) => {
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
  });

  // Treat undefined source as 'cron' (back-compat with snapshots written
  // before the source field existed).
  const isManual = snapshot.source === 'manual';
  const hasUnsentAlert = widgetAlerts.some((a) => !a.emailSent);
  const caveat = isManual && hasUnsentAlert
    ? 'Manual refresh — alerts emailed at next 08:00 UTC cron.'
    : undefined;

  return {
    state: isStale ? 'stale' : 'fresh',
    freshnessLabel: freshnessLabel(ageHours),
    alerts: widgetAlerts,
    kpis: buildKpis(snapshot),
    topQueries: snapshot.performance.topQueries.map((q) => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctrPct: `${(q.ctr * 100).toFixed(1)}%`,
      position: q.position.toFixed(1),
    })),
    emailDelivery: buildEmailDelivery(snapshot, now),
    manualCheckRecency,
    ...(caveat !== undefined ? { caveat } : {}),
  };
}

function buildManualCheckRecency(
  lastClicked: string | null,
  now: Date,
): WidgetViewModel['manualCheckRecency'] {
  if (!lastClicked) {
    return { label: 'Never checked in GSC UI', neverClicked: true };
  }
  const parsed = new Date(lastClicked);
  if (Number.isNaN(parsed.getTime())) {
    // Corrupt KV value — fall back to "never" rather than crash.
    return { label: 'Never checked in GSC UI', neverClicked: true };
  }
  const hours = Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / (60 * 60 * 1000)));
  if (hours < 24) {
    return { label: 'Last checked in GSC UI: today', neverClicked: false };
  }
  const days = Math.floor(hours / 24);
  return {
    label: days === 1
      ? 'Last checked in GSC UI: 1 day ago'
      : `Last checked in GSC UI: ${days} days ago`,
    neverClicked: false,
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

  // Indexed-pages delta uses an ABSOLUTE diff (e.g. "+2 vs 28d ago"), not a
  // percentage like Clicks/Impressions. The absolute number is more
  // intuitive for a small indexed count (20 pages → +2 reads clearer than
  // "+10%"). When the 28d-ago snapshot is absent (cold start, first 28 days
  // of data), the sub is empty and deltaClass is flat.
  const priorIndexed = snapshot.indexing.priorPeriodIndexedCount;
  const indexedTile = buildIndexedTile(snapshot.indexing.indexedCount, priorIndexed);

  return [
    indexedTile,
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

function buildIndexedTile(
  current: number,
  prior: number | null | undefined,
): WidgetKpiTile {
  if (prior === null || prior === undefined) {
    return {
      label: 'Indexed pages',
      value: String(current),
      sub: '',
      deltaClass: 'flat',
    };
  }
  const diff = current - prior;
  let sub: string;
  let deltaClass: 'up' | 'down' | 'flat';
  if (diff === 0) {
    sub = 'no change vs 28d ago';
    deltaClass = 'flat';
  } else {
    sub = `${diff > 0 ? '+' : ''}${diff} vs 28d ago`;
    deltaClass = diff > 0 ? 'up' : 'down';
  }
  return {
    label: 'Indexed pages',
    value: String(current),
    sub,
    deltaClass,
  };
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
