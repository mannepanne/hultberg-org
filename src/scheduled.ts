// ABOUT: Cron handler for the daily GSC poll.
// ABOUT: Orchestrates fetch → diff → alert → persist, with two-consecutive-observation
// ABOUT: gating for drop alerts to avoid false positives from GSC data lag.

import { GSCClient } from '@/gsc';
import { sendAlert } from '@/notifier';
import {
  mergeEmailDelivery,
  sanitiseUpstreamError,
  type DispatchResult,
} from '@/gscHelpers';
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
  /**
   * If true, compute the snapshot (including alerts graduation) and persist
   * it to KV, but do NOT send emails and do NOT write dedup keys. Used by the
   * manual-refresh endpoint so a user clicking "Refresh" doesn't trigger
   * surprise emails — email is a cron-only side effect.
   */
  skipDispatch?: boolean;
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
    // skipDispatch undefined (cron path) → 'cron'; true (manual-refresh path) → 'manual'.
    source: opts.skipDispatch ? 'manual' : 'cron',
  };

  if (!opts.skipDispatch) {
    const dispatched = await dispatchAlerts(env, kv, alerts, now);
    snapshot.emailDelivery = mergeEmailDelivery(snapshot.emailDelivery, dispatched, now);
    snapshot.alerts = snapshot.alerts.map((a, i) => ({
      ...a,
      emailSent: dispatched[i]?.sent ?? false,
    }));
  }
  // When skipDispatch: alerts retain emailSent=false from resolveAlerts,
  // emailDelivery is unchanged from previous, no dedup keys written. Next
  // cron run will still see these alerts (via continuation logic) and deliver
  // emails if conditions still hold.

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

interface AlertCondition {
  type: GSCAlertType;
  severity: 'high' | 'medium';
  subject: string;      // magnitude-aware, fits in an email subject line
  message: string;      // full body explanation
  discriminator?: string; // per-alert dedup discriminator (e.g. sitemap path)
}

/**
 * Decide which conditions fire as alerts (graduated from pending → real, or
 * continuation from the prior run's alerts) vs which are flagged as pending
 * on this observation. Exported for testing — no I/O, no time surprises.
 *
 * State machine per alert type:
 *   not-pending/not-alerted  + triggered  → pending (no email yet)
 *   pending                  + triggered  → alert (graduated; email dispatched)
 *   alerted                  + triggered  → alert (continuation; dedup prevents re-email within 24h)
 *   anything                 + resolved   → drops out entirely
 */
export function resolveAlerts(input: ResolveAlertsInput): ResolveAlertsOutput {
  const { now, current, previousLatest, weekAgo } = input;
  const previousPending = new Map<GSCAlertType, GSCPendingAlert>(
    (previousLatest?.pendingAlerts ?? []).map((p) => [p.type, p]),
  );
  const previouslyAlerted = new Set<GSCAlertType>(
    (previousLatest?.alerts ?? []).map((a) => a.type),
  );

  const alerts: GSCAlert[] = [];
  const pendingAlerts: GSCPendingAlert[] = [];
  const conditions: AlertCondition[] = [];

  if (weekAgo && weekAgo.indexing.indexedCount > 0) {
    const ratio = current.indexedCount / weekAgo.indexing.indexedCount;
    if (ratio < INDEXED_DROP_RATIO) {
      const dropPct = Math.round((1 - ratio) * 100);
      conditions.push({
        type: 'indexed-drop',
        severity: 'high',
        subject: `Indexed pages dropped ${dropPct}% (${weekAgo.indexing.indexedCount}→${current.indexedCount})`,
        message: `Indexed pages dropped from ${weekAgo.indexing.indexedCount} to ${current.indexedCount} (${dropPct}% decrease) over the last 7 days.`,
      });
    }
  }

  const sitemapsWithErrors = current.sitemaps.filter((sm) => sm.errors > 0);
  if (sitemapsWithErrors.length > 0) {
    const totalErrors = sitemapsWithErrors.reduce((sum, sm) => sum + sm.errors, 0);
    const paths = sitemapsWithErrors.map((sm) => sm.path).join(', ');
    conditions.push({
      type: 'sitemap-error',
      severity: 'high',
      subject: `Sitemap has ${totalErrors} error${totalErrors === 1 ? '' : 's'}`,
      message: `Sitemap reports ${totalErrors} error(s): ${paths}`,
      // Per-path discriminator keeps future multi-sitemap setups from silently
      // squashing each other in the dedup window. Single-sitemap today just
      // gives a stable key.
      discriminator: sitemapsWithErrors.map((sm) => sm.path).sort().join('|'),
    });
  }

  if (previousLatest) {
    const newWarnings = current.sitemaps.reduce((sum, sm) => sum + sm.warnings, 0);
    const oldWarnings = previousLatest.sitemaps.reduce((sum, sm) => sum + sm.warnings, 0);
    if (newWarnings > oldWarnings) {
      const delta = newWarnings - oldWarnings;
      conditions.push({
        type: 'new-crawl-warning',
        severity: 'medium',
        subject: `${delta} new sitemap warning${delta === 1 ? '' : 's'}`,
        message: `New sitemap warning(s) appeared: ${delta} more than the last check (${oldWarnings}→${newWarnings}).`,
      });
    }
  }

  if (current.performance.priorPeriodImpressions > 0) {
    const ratio = current.performance.totalImpressions / current.performance.priorPeriodImpressions;
    if (ratio < IMPRESSIONS_DROP_RATIO) {
      const dropPct = Math.round((1 - ratio) * 100);
      conditions.push({
        type: 'impressions-drop',
        severity: 'medium',
        subject: `Impressions dropped ${dropPct}% (${current.performance.priorPeriodImpressions}→${current.performance.totalImpressions})`,
        message: `28-day impressions dropped from ${current.performance.priorPeriodImpressions} to ${current.performance.totalImpressions} (${dropPct}% decrease) vs the prior 28 days.`,
      });
    }
  }

  const previousAlertedByType = new Map<GSCAlertType, GSCAlert>(
    (previousLatest?.alerts ?? []).map((a) => [a.type, a]),
  );

  for (const cond of conditions) {
    const previousAlert = previousAlertedByType.get(cond.type);
    const previousPendingEntry = previousPending.get(cond.type);

    if (previousAlert || previousPendingEntry) {
      // Continuation (alerted → still alerting) or graduation (pending → alert).
      // Preserve the ORIGINAL firstDetectedAt so the widget can render
      // "seen for N days" honestly.
      const firstDetectedAt =
        previousAlert?.firstDetectedAt ??
        previousPendingEntry?.firstDetectedAt ??
        now.toISOString();

      alerts.push({
        type: cond.type,
        severity: cond.severity,
        subject: cond.subject,
        message: cond.message,
        firstDetectedAt,
        detectedAt: now.toISOString(),
        emailSent: false,
        discriminator: cond.discriminator,
      });
    } else {
      // First observation of this condition — mark pending, no email yet.
      pendingAlerts.push({ type: cond.type, firstDetectedAt: now.toISOString() });
    }
  }

  return { alerts, pendingAlerts };
}

// ---- Alert dispatch ----

async function dispatchAlerts(
  env: Env,
  kv: KVNamespace,
  alerts: GSCAlert[],
  now: Date,
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];
  for (const alert of alerts) {
    const dedupKey = `alert:dedup:${alert.type}:${alert.discriminator ?? ''}`;
    const existing = await kv.get(dedupKey);
    if (existing) {
      // Dedup suppression is not a delivery failure — tag as 'dedup' so
      // mergeEmailDelivery doesn't advance lastErrorAt for steady-state alerts.
      results.push({ sent: false, provider: 'dedup' });
      continue;
    }

    const subject = `[hultberg.org] ${alert.subject}`;
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
      console.error(`Scheduled GSC poll failed: ${sanitiseUpstreamError(err)}`);
    }),
  );
}
