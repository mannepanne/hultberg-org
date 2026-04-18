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
 * lastProvider reflects the most recent attempt in `results` (whether
 * success or failure) to help the dashboard show what was tried last.
 */
export interface DispatchResult {
  sent: boolean;
  provider: 'cf' | 'resend' | 'none';
}

export function mergeEmailDelivery(
  previous: GSCEmailDelivery,
  results: DispatchResult[],
  now: Date,
): GSCEmailDelivery {
  if (results.length === 0) {
    return previous;
  }

  const nowIso = now.toISOString();
  const anySuccess = results.some((r) => r.sent);
  const anyFailure = results.some((r) => !r.sent);
  const lastResult = results[results.length - 1];

  return {
    lastProvider: lastResult.provider,
    lastSuccessAt: anySuccess ? nowIso : previous.lastSuccessAt,
    lastErrorAt: anyFailure ? nowIso : previous.lastErrorAt,
  };
}
