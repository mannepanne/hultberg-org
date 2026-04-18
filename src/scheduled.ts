// ABOUT: Cron handler for the daily GSC poll.
// ABOUT: Orchestrates fetch → diff → alert → persist, with two-consecutive-observation
// ABOUT: gating for drop alerts to avoid false positives from GSC data lag.

import { GSCClient } from '@/gsc';
import { sendAlert } from '@/notifier';
import type {
  Env,
  GSCAlert,
  GSCAlertType,
  GSCPendingAlert,
  GSCPerformance,
  GSCSitemapStatus,
  GSCSnapshot,
  GSCTopQuery,
} from '@/types';

const DEFAULT_SITE_URL = 'sc-domain:hultberg.org';

// Thresholds are intentionally conservative to start; we'll tune from real data.
const INDEXED_DROP_RATIO = 0.8;        // current < 80% of prior 7d → pending/alert
const IMPRESSIONS_DROP_RATIO = 0.5;    // current < 50% of prior 28d → pending/alert
const ALERT_DEDUP_TTL_SECONDS = 24 * 60 * 60;
const HISTORY_TTL_SECONDS = 35 * 24 * 60 * 60;

export interface RunDailyPollOptions {
  siteUrl?: string;
  now?: Date;
}

/**
 * Main orchestrator for the scheduled GSC poll. Safe to call from both the
 * cron handler and from an auth-gated manual-refresh endpoint.
 */
export async function runDailyPoll(
  env: Env,
  opts: RunDailyPollOptions = {},
): Promise<GSCSnapshot> {
  if (!env.GSC_SERVICE_ACCOUNT_JSON) {
    throw new Error('Scheduled: GSC_SERVICE_ACCOUNT_JSON secret is not configured');
  }
  if (!env.GSC_KV) {
    throw new Error('Scheduled: GSC_KV namespace binding is not configured');
  }

  const siteUrl = opts.siteUrl ?? DEFAULT_SITE_URL;
  const now = opts.now ?? new Date();
  const kv = env.GSC_KV;

  const client = GSCClient.fromSecret(env.GSC_SERVICE_ACCOUNT_JSON, siteUrl);

  const [sitemaps, performance, weekAgoSnapshot] = await Promise.all([
    fetchSitemaps(client),
    fetchPerformance(client, now),
    loadHistorySnapshot(kv, daysAgo(now, 7)),
  ]);

  const indexedCount = sitemaps.reduce((sum, sm) => sum + sm.indexed, 0);
  const previousLatest = await loadLatestSnapshot(kv);

  const { alerts, pendingAlerts } = resolveAlerts({
    now,
    current: { indexedCount, sitemaps, performance },
    previousLatest,
    weekAgo: weekAgoSnapshot,
  });

  const snapshot: GSCSnapshot = {
    capturedAt: now.toISOString(),
    siteUrl,
    sitemaps,
    indexing: { indexedCount },
    performance,
    alerts,
    pendingAlerts,
    emailDelivery: previousLatest?.emailDelivery ?? {
      lastProvider: null,
      lastSuccessAt: null,
      lastErrorAt: null,
    },
  };

  const dispatched = await dispatchAlerts(env, kv, alerts, now);
  snapshot.emailDelivery = mergeEmailDelivery(snapshot.emailDelivery, dispatched, now);
  snapshot.alerts = snapshot.alerts.map((a, i) => ({
    ...a,
    emailSent: dispatched[i]?.sent ?? false,
  }));

  await Promise.all([
    kv.put('status:latest', JSON.stringify(snapshot)),
    kv.put(`status:history:${yyyymmdd(now)}`, JSON.stringify(snapshot), {
      expirationTtl: HISTORY_TTL_SECONDS,
    }),
  ]);

  return snapshot;
}

// ---- Data fetching ----

async function fetchSitemaps(client: GSCClient): Promise<GSCSitemapStatus[]> {
  const raw = await client.listSitemaps();
  return raw.map((sm) => {
    const web = sm.contents?.find((c) => c.type === 'web');
    return {
      path: sm.path,
      lastSubmitted: sm.lastSubmitted ?? null,
      lastDownloaded: sm.lastDownloaded ?? null,
      errors: sm.errors ?? 0,
      warnings: sm.warnings ?? 0,
      submitted: web ? Number(web.submitted) || 0 : 0,
      indexed: web ? Number(web.indexed) || 0 : 0,
    };
  });
}

async function fetchPerformance(client: GSCClient, now: Date): Promise<GSCPerformance> {
  // Skip the most recent 2 days to avoid GSC data-lag.
  const currentEnd = daysAgo(now, 2);
  const currentStart = daysAgo(now, 29);
  const priorEnd = daysAgo(now, 30);
  const priorStart = daysAgo(now, 57);

  const [currentRows, priorRows, topQueryRows] = await Promise.all([
    client.queryAnalytics({
      startDate: yyyymmdd(currentStart),
      endDate: yyyymmdd(currentEnd),
    }),
    client.queryAnalytics({
      startDate: yyyymmdd(priorStart),
      endDate: yyyymmdd(priorEnd),
    }),
    client.queryAnalytics({
      startDate: yyyymmdd(currentStart),
      endDate: yyyymmdd(currentEnd),
      dimensions: ['query'],
      rowLimit: 5,
    }),
  ]);

  const current = aggregateRows(currentRows);
  const prior = aggregateRows(priorRows);

  const topQueries: GSCTopQuery[] = topQueryRows.map((row) => ({
    query: row.keys[0] ?? '',
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  return {
    period: '28d',
    totalClicks: current.clicks,
    totalImpressions: current.impressions,
    avgCtr: current.impressions > 0 ? current.clicks / current.impressions : 0,
    avgPosition: current.avgPosition,
    topQueries,
    priorPeriodClicks: prior.clicks,
    priorPeriodImpressions: prior.impressions,
  };
}

function aggregateRows(rows: Array<{ clicks: number; impressions: number; position: number }>) {
  let clicks = 0;
  let impressions = 0;
  let positionSum = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    positionSum += r.position;
  }
  return {
    clicks,
    impressions,
    avgPosition: rows.length > 0 ? positionSum / rows.length : 0,
  };
}

// ---- Alert resolution (pure, easy to test) ----

interface ResolveAlertsInput {
  now: Date;
  current: {
    indexedCount: number;
    sitemaps: GSCSitemapStatus[];
    performance: GSCPerformance;
  };
  previousLatest: GSCSnapshot | null;
  weekAgo: GSCSnapshot | null;
}

interface ResolveAlertsOutput {
  alerts: GSCAlert[];
  pendingAlerts: GSCPendingAlert[];
}

/**
 * Decide which conditions fire as alerts (graduated from pending → real) vs
 * which are flagged as pending on this observation.
 * Exported for testing — no I/O, no time-of-day surprises.
 */
export function resolveAlerts(input: ResolveAlertsInput): ResolveAlertsOutput {
  const { now, current, previousLatest, weekAgo } = input;
  const previousPending = new Map<GSCAlertType, GSCPendingAlert>(
    (previousLatest?.pendingAlerts ?? []).map((p) => [p.type, p]),
  );

  const alerts: GSCAlert[] = [];
  const pendingAlerts: GSCPendingAlert[] = [];

  const conditions: Array<{
    type: GSCAlertType;
    triggered: boolean;
    severity: 'high' | 'medium';
    message: string;
  }> = [];

  if (weekAgo && weekAgo.indexing.indexedCount > 0) {
    const ratio = current.indexedCount / weekAgo.indexing.indexedCount;
    if (ratio < INDEXED_DROP_RATIO) {
      conditions.push({
        type: 'indexed-drop',
        triggered: true,
        severity: 'high',
        message: `Indexed pages dropped from ${weekAgo.indexing.indexedCount} to ${current.indexedCount} (${Math.round((1 - ratio) * 100)}% decrease) over the last 7 days.`,
      });
    }
  }

  const totalSitemapErrors = current.sitemaps.reduce((sum, sm) => sum + sm.errors, 0);
  if (totalSitemapErrors > 0) {
    const paths = current.sitemaps.filter((sm) => sm.errors > 0).map((sm) => sm.path).join(', ');
    conditions.push({
      type: 'sitemap-error',
      triggered: true,
      severity: 'high',
      message: `Sitemap reports ${totalSitemapErrors} error(s): ${paths}`,
    });
  }

  if (previousLatest) {
    const newWarnings = current.sitemaps.reduce((sum, sm) => sum + sm.warnings, 0);
    const oldWarnings = previousLatest.sitemaps.reduce((sum, sm) => sum + sm.warnings, 0);
    if (newWarnings > oldWarnings) {
      conditions.push({
        type: 'new-crawl-error',
        triggered: true,
        severity: 'medium',
        message: `New sitemap warning(s) appeared: ${newWarnings - oldWarnings} more than the last check.`,
      });
    }
  }

  if (current.performance.priorPeriodImpressions > 0) {
    const ratio = current.performance.totalImpressions / current.performance.priorPeriodImpressions;
    if (ratio < IMPRESSIONS_DROP_RATIO) {
      conditions.push({
        type: 'impressions-drop',
        triggered: true,
        severity: 'medium',
        message: `28-day impressions dropped from ${current.performance.priorPeriodImpressions} to ${current.performance.totalImpressions} (${Math.round((1 - ratio) * 100)}% decrease) vs the prior 28 days.`,
      });
    }
  }

  for (const cond of conditions) {
    if (!cond.triggered) continue;
    const previousPendingEntry = previousPending.get(cond.type);
    if (previousPendingEntry) {
      // Graduated: condition was pending last run, still met this run → alert.
      alerts.push({
        type: cond.type,
        severity: cond.severity,
        message: cond.message,
        detectedAt: now.toISOString(),
        emailSent: false,
      });
    } else {
      // First observation — mark pending, do not alert yet.
      pendingAlerts.push({ type: cond.type, firstDetectedAt: now.toISOString() });
    }
  }

  return { alerts, pendingAlerts };
}

// ---- Alert dispatch ----

interface AlertDispatchResult {
  sent: boolean;
  provider: 'cf' | 'resend' | 'none';
}

async function dispatchAlerts(
  env: Env,
  kv: KVNamespace,
  alerts: GSCAlert[],
  now: Date,
): Promise<AlertDispatchResult[]> {
  const results: AlertDispatchResult[] = [];
  for (const alert of alerts) {
    const dedupKey = `alert:dedup:${alert.type}`;
    const existing = await kv.get(dedupKey);
    if (existing) {
      results.push({ sent: false, provider: 'none' });
      continue;
    }

    const subject = `[hultberg.org] ${subjectForAlert(alert)}`;
    const body = `${alert.message}\n\nDetected at: ${alert.detectedAt}\n\nOpen Search Console: https://search.google.com/search-console?resource_id=sc-domain%3Ahultberg.org`;

    const result = await sendAlert(env, { subject, body });

    if (result.provider === 'cf' || result.provider === 'resend') {
      await kv.put(dedupKey, now.toISOString(), { expirationTtl: ALERT_DEDUP_TTL_SECONDS });
      results.push({ sent: true, provider: result.provider });
    } else {
      results.push({ sent: false, provider: 'none' });
    }
  }
  return results;
}

function subjectForAlert(alert: GSCAlert): string {
  switch (alert.type) {
    case 'indexed-drop':
      return 'Indexed page count dropped';
    case 'sitemap-error':
      return 'Sitemap error detected';
    case 'new-crawl-error':
      return 'New sitemap warning';
    case 'impressions-drop':
      return 'Search impressions dropped';
  }
}

function mergeEmailDelivery(
  previous: GSCSnapshot['emailDelivery'],
  dispatched: AlertDispatchResult[],
  now: Date,
): GSCSnapshot['emailDelivery'] {
  const lastResult = dispatched[dispatched.length - 1];
  if (!lastResult) return previous;

  const nowIso = now.toISOString();
  if (lastResult.sent) {
    return {
      lastProvider: lastResult.provider,
      lastSuccessAt: nowIso,
      lastErrorAt: previous.lastErrorAt,
    };
  }
  return {
    lastProvider: lastResult.provider,
    lastSuccessAt: previous.lastSuccessAt,
    lastErrorAt: nowIso,
  };
}

// ---- KV helpers ----

async function loadLatestSnapshot(kv: KVNamespace): Promise<GSCSnapshot | null> {
  const raw = await kv.get('status:latest');
  return raw ? (JSON.parse(raw) as GSCSnapshot) : null;
}

async function loadHistorySnapshot(kv: KVNamespace, date: Date): Promise<GSCSnapshot | null> {
  const raw = await kv.get(`status:history:${yyyymmdd(date)}`);
  return raw ? (JSON.parse(raw) as GSCSnapshot) : null;
}

// ---- Date helpers ----

function yyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/**
 * Worker `scheduled` entry point — wraps runDailyPoll with ctx.waitUntil so async
 * work completes after the outer handler returns.
 */
export async function handleScheduled(
  _event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  ctx.waitUntil(
    runDailyPoll(env).catch((err) => {
      console.error('Scheduled GSC poll failed:', err);
    }),
  );
}
