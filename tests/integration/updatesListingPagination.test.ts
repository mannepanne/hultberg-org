// ABOUT: Integration tests for /updates pagination
// ABOUT: Tests query parameter parsing, page navigation, and edge cases

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import type { UpdateIndex } from '@/types';

describe('GET /updates - Pagination', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();

    // Mock 10 published updates to create 2 pages (5+5)
    const mockFetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/updates/data/index.json')) {
        const indexData: UpdateIndex = {
          updates: [
            {
              slug: 'update-10',
              title: 'Update 10',
              excerpt: 'Tenth update',
              publishedDate: '2026-03-10T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-9',
              title: 'Update 9',
              excerpt: 'Ninth update',
              publishedDate: '2026-03-09T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-8',
              title: 'Update 8',
              excerpt: 'Eighth update',
              publishedDate: '2026-03-08T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-7',
              title: 'Update 7',
              excerpt: 'Seventh update',
              publishedDate: '2026-03-07T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-6',
              title: 'Update 6',
              excerpt: 'Sixth update',
              publishedDate: '2026-03-06T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-5',
              title: 'Update 5',
              excerpt: 'Fifth update',
              publishedDate: '2026-03-05T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-4',
              title: 'Update 4',
              excerpt: 'Fourth update',
              publishedDate: '2026-03-04T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-3',
              title: 'Update 3',
              excerpt: 'Third update',
              publishedDate: '2026-03-03T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-2',
              title: 'Update 2',
              excerpt: 'Second update',
              publishedDate: '2026-03-02T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-1',
              title: 'Update 1',
              excerpt: 'First update',
              publishedDate: '2026-03-01T10:00:00Z',
              status: 'published',
            },
          ],
        };
        return new Response(JSON.stringify(indexData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    });

    global.fetch = mockFetch;
  });

  // Basic pagination tests
  it('shows first 5 updates on page 1 by default', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should show updates 10, 9, 8, 7, 6 (newest first)
    expect(html).toContain('Update 10');
    expect(html).toContain('Update 9');
    expect(html).toContain('Update 8');
    expect(html).toContain('Update 7');
    expect(html).toContain('Update 6');

    // Should not show updates from page 2 (use slugs with quotes to avoid false matches)
    expect(html).not.toContain('"/updates/update-5"');
    expect(html).not.toContain('"/updates/update-4"');
    expect(html).not.toContain('"/updates/update-3"');
    expect(html).not.toContain('"/updates/update-2"');
    expect(html).not.toContain('"/updates/update-1"');
  });

  it('shows first 5 updates when page=1 explicitly set', async () => {
    const request = new Request('http://localhost/updates?page=1');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('Update 10');
    expect(html).toContain('Update 6');
    expect(html).not.toContain('"/updates/update-5"');
  });

  it('shows updates 6-10 on page 2', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should show updates 5, 4, 3, 2, 1
    expect(html).toContain('"/updates/update-5"');
    expect(html).toContain('"/updates/update-4"');
    expect(html).toContain('"/updates/update-3"');
    expect(html).toContain('"/updates/update-2"');
    expect(html).toContain('"/updates/update-1"');

    // Should not show updates from page 1
    expect(html).not.toContain('"/updates/update-10"');
    expect(html).not.toContain('"/updates/update-6"');
  });

  // Query parameter parsing tests
  it('defaults to page 1 for invalid page param (abc)', async () => {
    const request = new Request('http://localhost/updates?page=abc');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should show first 3 updates
    expect(html).toContain('Update 10');
    expect(html).toContain('Update 9');
    expect(html).toContain('Update 8');
  });

  it('defaults to page 1 for negative page param (-1)', async () => {
    const request = new Request('http://localhost/updates?page=-1');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('Update 10');
    expect(html).toContain('Update 9');
    expect(html).toContain('Update 8');
  });

  it('defaults to page 1 for zero page param (0)', async () => {
    const request = new Request('http://localhost/updates?page=0');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('Update 10');
    expect(html).toContain('Update 9');
    expect(html).toContain('Update 8');
  });

  it('clamps to last page when page exceeds total pages (page=999)', async () => {
    const request = new Request('http://localhost/updates?page=999');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should show page 2 (last page with updates 5-1)
    expect(html).toContain('"/updates/update-1"');
    expect(html).toContain('"/updates/update-5"');
    expect(html).not.toContain('"/updates/update-6"');

    // Should show page 2 highlighted
    expect(html).toContain('[2]');
  });

  // Navigation rendering tests
  it('includes "Next ›" link on page 1', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('Next ›');
    expect(html).toContain('/updates?page=2');
  });

  it('includes "‹ Prev" link on page 2', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('‹ Prev');
  });

  it('does not include "‹ Prev" on page 1', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).not.toContain('‹ Prev');
  });

  it('does not include "Next ›" on last page', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).not.toContain('Next ›');
  });

  it('highlights current page in navigation ([2])', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('[2]');
  });

  it('includes links to all page numbers', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should have links or indicators for pages 1, 2
    expect(html).toMatch(/>\s*1\s*</);
    expect(html).toContain('[2]');
  });

  it('page 1 link goes to /updates (no query param)', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Page 1 link should be clean /updates URL with ARIA label
    expect(html).toContain('href="/updates" aria-label="Page 1">1</a>');
  });

  it('page 2+ links go to /updates?page=N', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('/updates?page=2');
  });

  it('prev link from page 2 goes to /updates (no query param)', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Prev link from page 2 should go to /updates (page 1) with ARIA label
    expect(html).toContain('href="/updates" aria-label="Previous page">‹ Prev</a>');
  });

  // Content verification tests
  it('maintains reverse chronological order within each page', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Update 5 should appear before update 4, which appears before update 3, etc.
    const update5Index = html.indexOf('"/updates/update-5"');
    const update4Index = html.indexOf('"/updates/update-4"');
    const update3Index = html.indexOf('"/updates/update-3"');

    expect(update5Index).toBeLessThan(update4Index);
    expect(update4Index).toBeLessThan(update3Index);
  });

  it('does not duplicate updates across pages', async () => {
    // Fetch page 1 and page 2
    const request1 = new Request('http://localhost/updates');
    const response1 = await worker.fetch(request1, mockEnv, mockCtx);
    const html1 = await response1.text();

    const request2 = new Request('http://localhost/updates?page=2');
    const response2 = await worker.fetch(request2, mockEnv, mockCtx);
    const html2 = await response2.text();

    // Page 1 has updates 10, 9, 8, 7, 6
    expect(html1).toContain('"/updates/update-10"');
    expect(html1).toContain('"/updates/update-6"');

    // Page 2 has updates 5, 4, 3, 2, 1
    expect(html2).toContain('"/updates/update-5"');
    expect(html2).toContain('"/updates/update-1"');

    // Page 1 should NOT have page 2 content
    expect(html1).not.toContain('"/updates/update-5"');

    // Page 2 should NOT have page 1 content
    expect(html2).not.toContain('"/updates/update-6"');
  });

  it('filters out draft updates on paginated pages', async () => {
    // Mock with draft update mixed in (5 published = 1 page)
    const mockFetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/updates/data/index.json')) {
        const indexData: UpdateIndex = {
          updates: [
            {
              slug: 'update-5',
              title: 'Update 5',
              excerpt: 'Fifth update',
              publishedDate: '2026-03-05T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'draft-update',
              title: 'Draft Update',
              excerpt: 'This is a draft',
              publishedDate: '',
              status: 'draft',
            },
            {
              slug: 'update-4',
              title: 'Update 4',
              excerpt: 'Fourth update',
              publishedDate: '2026-03-04T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-3',
              title: 'Update 3',
              excerpt: 'Third update',
              publishedDate: '2026-03-03T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-2',
              title: 'Update 2',
              excerpt: 'Second update',
              publishedDate: '2026-03-02T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-1',
              title: 'Update 1',
              excerpt: 'First update',
              publishedDate: '2026-03-01T10:00:00Z',
              status: 'published',
            },
          ],
        };
        return new Response(JSON.stringify(indexData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });
    global.fetch = mockFetch;

    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should show all 5 published updates on page 1
    expect(html).toContain('Update 5');
    expect(html).toContain('Update 4');
    expect(html).toContain('Update 3');
    expect(html).toContain('Update 2');
    expect(html).toContain('Update 1');

    // Should not show draft
    expect(html).not.toContain('Draft Update');
  });

  it('includes canonical link on page 1', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<link rel="canonical" href="https://hultberg.org/updates" />');
  });

  it('does not include canonical link on page 2+', async () => {
    const request = new Request('http://localhost/updates?page=2');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).not.toContain('<link rel="canonical"');
  });
});

describe('GET /updates - Pagination with Single Page', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();

    // Mock only 2 updates (fits on 1 page)
    const mockFetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/updates/data/index.json')) {
        const indexData: UpdateIndex = {
          updates: [
            {
              slug: 'update-2',
              title: 'Update 2',
              excerpt: 'Second update',
              publishedDate: '2026-03-02T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'update-1',
              title: 'Update 1',
              excerpt: 'First update',
              publishedDate: '2026-03-01T10:00:00Z',
              status: 'published',
            },
          ],
        };
        return new Response(JSON.stringify(indexData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    global.fetch = mockFetch;
  });

  it('shows no pagination nav when only 1 page exists', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should show both updates
    expect(html).toContain('Update 2');
    expect(html).toContain('Update 1');

    // Should not show any pagination navigation
    expect(html).not.toContain('Next ›');
    expect(html).not.toContain('‹ Prev');
    expect(html).not.toContain('[1]');
  });
});

describe('GET /updates - Pagination with Empty State', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();

    // Mock empty updates
    const mockFetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/updates/data/index.json')) {
        const indexData: UpdateIndex = { updates: [] };
        return new Response(JSON.stringify(indexData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    global.fetch = mockFetch;
  });

  it('shows no pagination nav for empty updates list', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should show empty state
    expect(html).toContain('No updates yet');

    // Should not show pagination
    expect(html).not.toContain('Next ›');
    expect(html).not.toContain('‹ Prev');
  });
});
