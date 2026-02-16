// ABOUT: Integration tests for /updates/feed.xml RSS feed
// ABOUT: Tests RSS 2.0 format, published updates filter, and absolute URLs

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import type { UpdateIndex } from '@/types';

describe('GET /updates/feed.xml', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();

    // Mock global fetch to return test index data
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/updates/data/index.json')) {
        const indexData: UpdateIndex = {
          updates: [
            {
              slug: 'published-update-2',
              title: 'Second Published Update',
              excerpt: 'This is the second update',
              publishedDate: '2026-02-16T10:00:00Z',
              status: 'published',
            },
            {
              slug: 'published-update-1',
              title: 'First Published Update',
              excerpt: 'This is the first update',
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

      return new Response('Not Found', { status: 404 });
    });
  });

  it('returns 200 for /updates/feed.xml', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.status).toBe(200);
  });

  it('returns XML content type', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});

    const contentType = response.headers.get('Content-Type');
    expect(contentType).toContain('application/rss+xml');
  });

  it('returns valid RSS 2.0 XML structure', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    // Check for RSS 2.0 root element
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
  });

  it('includes feed metadata (title, description, link)', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    expect(xml).toContain('<title>');
    expect(xml).toContain('<description>');
    expect(xml).toContain('<link>');
  });

  it('includes all published updates as items', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    expect(xml).toContain('Second Published Update');
    expect(xml).toContain('First Published Update');
    expect(xml).toContain('<item>');
  });

  it('includes update metadata in each item (title, link, description, pubDate)', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    // Each item should have required RSS elements
    const itemMatches = xml.match(/<item>/g);
    expect(itemMatches).toBeTruthy();
    expect(itemMatches!.length).toBe(2);

    // Check for required item elements
    expect(xml).toContain('<title>Second Published Update</title>');
    expect(xml).toContain('<pubDate>');
  });

  it('uses absolute URLs for update links', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    // Should contain absolute URLs, not relative
    expect(xml).toContain('http://localhost/updates/published-update-1');
    expect(xml).toContain('http://localhost/updates/published-update-2');
  });

  it('formats pubDate as RFC 822', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    // RFC 822 date format includes day of week (e.g., "Sat, 15 Feb 2026")
    expect(xml).toMatch(/<pubDate>[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2} \d{4}/);
  });

  it('does not include draft updates', async () => {
    // Mock fetch to include a draft update
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
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

    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    expect(xml).toContain('Published Update');
    expect(xml).not.toContain('Draft Update');
  });

  it('includes items in reverse chronological order', async () => {
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    // Second update (Feb 16) should appear before first update (Feb 15)
    const secondIndex = xml.indexOf('Second Published Update');
    const firstIndex = xml.indexOf('First Published Update');

    expect(secondIndex).toBeLessThan(firstIndex);
    expect(secondIndex).toBeGreaterThan(-1);
    expect(firstIndex).toBeGreaterThan(-1);
  });

  it('handles empty updates list', async () => {
    // Mock fetch to return empty index
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
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

    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, mockEnv, {});
    const xml = await response.text();

    // Should still return valid RSS with no items
    expect(response.status).toBe(200);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
  });
});
