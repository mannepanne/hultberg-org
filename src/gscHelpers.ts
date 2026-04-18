// ABOUT: Small pure helpers used by the GSC scheduled handler.
// ABOUT: Kept here to isolate logic that is trivially unit-testable (no I/O).

import type { GSCEmailDelivery } from './types';

/**
 * Trim an error's string representation to something safe to log or return
 * over HTTP. Strips after the first newline and caps length so upstream
 * response bodies cannot leak via logs or JSON responses.
 */
export function sanitiseUpstreamError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split('\n', 1)[0] ?? '';
  const MAX = 200;
  return firstLine.length > MAX ? `${firstLine.slice(0, MAX)}…` : firstLine;
}

/**
 * Merge a previous email-delivery state with per-alert dispatch results.
 * Updates lastSuccessAt and lastErrorAt independently so that one failed
 * send in a batch doesn't erase a successful one, and vice versa.
 * lastProvider reflects the most recent *attempted* delivery (dedup-
 * suppressed entries are skipped — they're not a provider outcome).
 *
 * provider values:
 *   'cf' | 'resend'  — a real delivery attempt that succeeded
 *   'none'           — a real delivery attempt that failed (both providers)
 *   'dedup'          — suppressed by the 24h dedup key; not a delivery attempt
 */
export interface DispatchResult {
  sent: boolean;
  provider: 'cf' | 'resend' | 'none' | 'dedup';
}

export function mergeEmailDelivery(
  previous: GSCEmailDelivery,
  results: DispatchResult[],
  now: Date,
): GSCEmailDelivery {
  const attempts = results.filter((r) => r.provider !== 'dedup');
  if (attempts.length === 0) {
    return previous;
  }

  const nowIso = now.toISOString();
  const anySuccess = attempts.some((r) => r.sent);
  const anyFailure = attempts.some((r) => !r.sent);
  const lastAttempt = attempts[attempts.length - 1];

  return {
    lastProvider: lastAttempt.provider as GSCEmailDelivery['lastProvider'],
    lastSuccessAt: anySuccess ? nowIso : previous.lastSuccessAt,
    lastErrorAt: anyFailure ? nowIso : previous.lastErrorAt,
  };
}
