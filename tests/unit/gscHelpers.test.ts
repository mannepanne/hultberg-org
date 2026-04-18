// ABOUT: Unit tests for the small pure helpers used by the scheduled handler.

import { describe, it, expect } from 'vitest';
import { sanitiseUpstreamError, mergeEmailDelivery, type DispatchResult } from '@/gscHelpers';
import type { GSCEmailDelivery } from '@/types';

const NOW = new Date('2026-04-18T08:00:00Z');
const EARLIER = '2026-04-17T08:00:00Z';

describe('sanitiseUpstreamError', () => {
  it('returns the message for an Error', () => {
    expect(sanitiseUpstreamError(new Error('boom'))).toBe('boom');
  });

  it('returns string form for non-Error throws', () => {
    expect(sanitiseUpstreamError('plain string')).toBe('plain string');
    expect(sanitiseUpstreamError(42)).toBe('42');
  });

  it('strips everything after the first newline', () => {
    const err = new Error('first line\nsecond line\nthird line');
    expect(sanitiseUpstreamError(err)).toBe('first line');
  });

  it('truncates very long messages to ~200 chars with an ellipsis', () => {
    const longMsg = 'x'.repeat(500);
    const result = sanitiseUpstreamError(new Error(longMsg));
    expect(result.length).toBeLessThanOrEqual(201);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate short messages', () => {
    const err = new Error('short error');
    expect(sanitiseUpstreamError(err)).toBe('short error');
  });
});

describe('mergeEmailDelivery', () => {
  const freshPrev: GSCEmailDelivery = { lastProvider: null, lastSuccessAt: null, lastErrorAt: null };

  it('returns previous state unchanged when no alerts dispatched', () => {
    expect(mergeEmailDelivery(freshPrev, [], NOW)).toEqual(freshPrev);
  });

  it('records a success when all dispatches succeed', () => {
    const results: DispatchResult[] = [
      { sent: true, provider: 'cf' },
      { sent: true, provider: 'cf' },
    ];
    expect(mergeEmailDelivery(freshPrev, results, NOW)).toEqual({
      lastProvider: 'cf',
      lastSuccessAt: NOW.toISOString(),
      lastErrorAt: null,
    });
  });

  it('records both success and failure when mixed', () => {
    const results: DispatchResult[] = [
      { sent: true, provider: 'cf' },
      { sent: false, provider: 'none' },
    ];
    expect(mergeEmailDelivery(freshPrev, results, NOW)).toEqual({
      lastProvider: 'none',
      lastSuccessAt: NOW.toISOString(),
      lastErrorAt: NOW.toISOString(),
    });
  });

  it('preserves prior lastSuccessAt when the current batch has no success', () => {
    const prev: GSCEmailDelivery = { lastProvider: 'cf', lastSuccessAt: EARLIER, lastErrorAt: null };
    const results: DispatchResult[] = [{ sent: false, provider: 'none' }];
    expect(mergeEmailDelivery(prev, results, NOW)).toEqual({
      lastProvider: 'none',
      lastSuccessAt: EARLIER,
      lastErrorAt: NOW.toISOString(),
    });
  });

  it('preserves prior lastErrorAt when the current batch has no failure', () => {
    const prev: GSCEmailDelivery = { lastProvider: 'resend', lastSuccessAt: null, lastErrorAt: EARLIER };
    const results: DispatchResult[] = [{ sent: true, provider: 'cf' }];
    expect(mergeEmailDelivery(prev, results, NOW)).toEqual({
      lastProvider: 'cf',
      lastSuccessAt: NOW.toISOString(),
      lastErrorAt: EARLIER,
    });
  });

  it('updates lastProvider to the last attempted result (not the last successful)', () => {
    const results: DispatchResult[] = [
      { sent: true, provider: 'cf' },
      { sent: false, provider: 'none' },
    ];
    const merged = mergeEmailDelivery(freshPrev, results, NOW);
    expect(merged.lastProvider).toBe('none');
  });

  it('fixes the regression: success earlier in batch is not erased by later failure', () => {
    // This is the specific bug the review caught: the previous implementation sampled only
    // the last result, so alert A:success followed by alert B:fail left lastSuccessAt = null.
    const results: DispatchResult[] = [
      { sent: true, provider: 'cf' },
      { sent: false, provider: 'none' },
      { sent: false, provider: 'none' },
    ];
    const merged = mergeEmailDelivery(freshPrev, results, NOW);
    expect(merged.lastSuccessAt).toBe(NOW.toISOString());
    expect(merged.lastErrorAt).toBe(NOW.toISOString());
  });
});
