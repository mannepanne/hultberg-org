// ABOUT: Integration tests for /updates listing page
// ABOUT: Tests pagination, filtering, and sorting of published updates

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import type { UpdateIndex } from '@/types';

describe('GET /updates', () => {
  let mockEnv: any;
  let mockFetch: any;

  beforeEach(() => {
    mockEnv = createMockEnv();

    // Mock global fetch to return test fixtures
    mockFetch = vi.fn(async (url: string) => {
      if (url.includes('/updates/data/index.json')) {
        const indexData: UpdateIndex = {
          updates: [
            {
              slug: 'published-update-2',
              title: 'Second Published Update',
              excerpt: 'This update has no custom excerpt',
              publishedDate: '2026-02-16T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'published-update-1',
              title: 'First Published Update',
              excerpt: 'This is the first published update',
              publishedDate: '2026-02-15T10:00:00Z',
              status: 'published',
            },
          ],
        };
        return new Response(JSON.stringify(indexData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Default 404 for unknown URLs
      return new Response('Not Found', { status: 404 });
    });

    global.fetch = mockFetch;
  });

  it('returns 200 for /updates', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.status).toBe(200);
  });

  it('returns HTML content type', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('displays all published updates', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    expect(html).toContain('Second Published Update');
    expect(html).toContain('First Published Update');
  });

  it('displays updates in reverse chronological order (newest first)', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    // Second update (Feb 16) should appear before first update (Feb 15)
    const secondIndex = html.indexOf('Second Published Update');
    const firstIndex = html.indexOf('First Published Update');

    expect(secondIndex).toBeLessThan(firstIndex);
    expect(secondIndex).toBeGreaterThan(-1);
    expect(firstIndex).toBeGreaterThan(-1);
  });

  it('displays excerpts for each update', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    expect(html).toContain('This update has no custom excerpt');
    expect(html).toContain('This is the first published update');
  });

  it('links each update title to individual page', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    expect(html).toContain('/updates/published-update-1');
    expect(html).toContain('/updates/published-update-2');
  });

  it('does not display draft updates', async () => {
    // Mock fetch to include a draft update in response
    mockFetch = vi.fn(async (url: string) => {
      if (url.includes('/updates/data/index.json')) {
        const indexData: UpdateIndex = {
          updates: [
            {
              slug: 'published-update-1',
              title: 'Published Update',
              excerpt: 'Published',
              publishedDate: '2026-02-15T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'draft-update',
              title: 'Draft Update',
              excerpt: 'Draft',
              publishedDate: '',
              status: 'draft',
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
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    expect(html).toContain('Published Update');
    expect(html).not.toContain('Draft Update');
  });
});

describe('GET /updates - Empty State', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();

    // Mock fetch to return empty index
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('/updates/data/index.json')) {
        const indexData: UpdateIndex = { updates: [] };
        return new Response(JSON.stringify(indexData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });
  });

  it('displays empty state message when no updates exist', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    expect(html).toContain('No updates yet');
  });
});
