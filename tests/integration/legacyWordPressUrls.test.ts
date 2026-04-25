// ABOUT: Integration tests for the legacy WordPress query-string 410 handler
// ABOUT: Verifies "/" with old WP query params returns Gone, others fall through

import { describe, it, expect } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';

describe('Legacy WordPress query-string URLs', () => {
  const ctx = createMockContext();

  it.each([
    '/?p=1',
    '/?p=999',
    '/?page_id=2',
    '/?cat=1',
    '/?m=200511',
    '/?feed=rss2',
    '/?s=anything',
    '/?tag=swedish',
    '/?paged=2',
    '/?author=1',
    '/?preview=true',
  ])('returns 410 Gone for %s', async (path) => {
    const request = new Request(`http://localhost${path}`);
    const response = await worker.fetch(request, createMockEnv(), ctx);
    expect(response.status).toBe(410);
  });

  it('does not 410 the homepage when no query string is present', async () => {
    const request = new Request('http://localhost/');
    // ASSETS is unmocked in tests, so the delegation falls through to global
    // fetch — we only assert status is NOT 410 (the legacy-WP guard rejected).
    const response = await worker.fetch(request, createMockEnv(), ctx).catch(() => null);
    expect(response?.status).not.toBe(410);
  });

  it('does not 410 unrelated query parameters like utm_source', async () => {
    const request = new Request('http://localhost/?utm_source=twitter&utm_medium=social');
    const response = await worker.fetch(request, createMockEnv(), ctx).catch(() => null);
    expect(response?.status).not.toBe(410);
  });

  it('does not 410 query strings on non-root paths', async () => {
    const request = new Request('http://localhost/some-unmatched-path?p=1');
    const response = await worker.fetch(request, createMockEnv(), ctx);
    expect(response.status).not.toBe(410);
    expect(response.status).toBe(404);
  });
});
