// ABOUT: Integration tests for /sitemap.xml
// ABOUT: Verifies sitemaps.org-compliant XML, published-only filter, and lastmod handling

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import type { NowContent, UpdateIndex } from '@/types';

const sampleIndex: UpdateIndex = {
  updates: [
    {
      slug: 'newer-update',
      title: 'Newer Update',
      excerpt: 'Newer',
      publishedDate: '2026-03-20T10:00:00Z',
      status: 'published',
    },
    {
      slug: 'older-update',
      title: 'Older Update',
      excerpt: 'Older',
      publishedDate: '2026-02-10T10:00:00Z',
      status: 'published',
    },
    {
      slug: 'draft-update',
      title: 'Draft Update',
      excerpt: 'Draft',
      publishedDate: '',
      status: 'draft',
    },
    {
      slug: 'unpublished-update',
      title: 'Unpublished Update',
      excerpt: 'Hidden',
      publishedDate: '2026-01-01T10:00:00Z',
      status: 'unpublished',
    },
  ],
};

const sampleNow: NowContent = {
  markdown: 'Now content',
  lastUpdated: '2026-03-31T11:16:42.122Z',
};

function mockFetch(index: UpdateIndex | null, now: NowContent | null) {
  global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/updates/data/index.json')) {
      if (index === null) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(JSON.stringify(index), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/now/data/content.json')) {
      if (now === null) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(JSON.stringify(now), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  });
}

describe('GET /sitemap.xml', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    mockFetch(sampleIndex, sampleNow);
  });

  it('returns 200 for /sitemap.xml', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
  });

  it('returns XML content type', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.headers.get('Content-Type')).toContain('application/xml');
  });

  it('emits a sitemaps.org-compliant urlset root', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');
  });

  it('includes core static pages with absolute URLs', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    expect(xml).toContain('<loc>http://localhost/</loc>');
    expect(xml).toContain('<loc>http://localhost/now</loc>');
    expect(xml).toContain('<loc>http://localhost/updates</loc>');
    expect(xml).toContain('<loc>http://localhost/use-of-ai</loc>');
    expect(xml).toContain('<loc>http://localhost/2005/11/recipe_sharing_.html</loc>');
  });

  it('includes one URL per published update', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    expect(xml).toContain('<loc>http://localhost/updates/newer-update</loc>');
    expect(xml).toContain('<loc>http://localhost/updates/older-update</loc>');
  });

  it('excludes draft and unpublished updates', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    expect(xml).not.toContain('draft-update');
    expect(xml).not.toContain('unpublished-update');
  });

  it('uses the /now content lastUpdated as the /now lastmod', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    const nowBlock = xml.match(/<url>\s*<loc>http:\/\/localhost\/now<\/loc>[\s\S]*?<\/url>/);
    expect(nowBlock).toBeTruthy();
    expect(nowBlock![0]).toContain('<lastmod>2026-03-31T11:16:42.122Z</lastmod>');
  });

  it('uses the newest published update date as the /updates lastmod', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    const updatesBlock = xml.match(/<url>\s*<loc>http:\/\/localhost\/updates<\/loc>[\s\S]*?<\/url>/);
    expect(updatesBlock).toBeTruthy();
    expect(updatesBlock![0]).toContain('<lastmod>2026-03-20T10:00:00.000Z</lastmod>');
  });

  it('uses each update\'s publishedDate as its lastmod', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    const newerBlock = xml.match(/<url>\s*<loc>http:\/\/localhost\/updates\/newer-update<\/loc>[\s\S]*?<\/url>/);
    expect(newerBlock).toBeTruthy();
    expect(newerBlock![0]).toContain('<lastmod>2026-03-20T10:00:00.000Z</lastmod>');
  });

  it('omits lastmod for pages without a known modification date', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    const useOfAi = xml.match(/<url>\s*<loc>http:\/\/localhost\/use-of-ai<\/loc>[\s\S]*?<\/url>/);
    expect(useOfAi).toBeTruthy();
    expect(useOfAi![0]).not.toContain('<lastmod>');

    const recipe = xml.match(/<url>\s*<loc>http:\/\/localhost\/2005\/11\/recipe_sharing_\.html<\/loc>[\s\S]*?<\/url>/);
    expect(recipe).toBeTruthy();
    expect(recipe![0]).not.toContain('<lastmod>');
  });

  it('still returns a valid sitemap when the updates index is missing', async () => {
    mockFetch(null, sampleNow);

    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>http://localhost/now</loc>');
    expect(xml).not.toContain('/updates/newer-update');

    const updatesBlock = xml.match(/<url>\s*<loc>http:\/\/localhost\/updates<\/loc>[\s\S]*?<\/url>/);
    expect(updatesBlock).toBeTruthy();
    expect(updatesBlock![0]).not.toContain('<lastmod>');
  });

  it('still returns a valid sitemap when the /now content is missing', async () => {
    mockFetch(sampleIndex, null);

    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    expect(response.status).toBe(200);
    const nowBlock = xml.match(/<url>\s*<loc>http:\/\/localhost\/now<\/loc>[\s\S]*?<\/url>/);
    expect(nowBlock).toBeTruthy();
    expect(nowBlock![0]).not.toContain('<lastmod>');
  });

  it('lists updates newest-first', async () => {
    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    const newerIndex = xml.indexOf('/updates/newer-update');
    const olderIndex = xml.indexOf('/updates/older-update');

    expect(newerIndex).toBeGreaterThan(-1);
    expect(olderIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeLessThan(olderIndex);
  });

  it('omits lastmod when an update has an unparseable publishedDate', async () => {
    mockFetch(
      {
        updates: [
          {
            slug: 'broken-date-update',
            title: 'Broken Date',
            excerpt: 'X',
            publishedDate: 'not-a-real-date',
            status: 'published',
          },
        ],
      },
      sampleNow,
    );

    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    const block = xml.match(/<url>\s*<loc>http:\/\/localhost\/updates\/broken-date-update<\/loc>[\s\S]*?<\/url>/);
    expect(block).toBeTruthy();
    expect(block![0]).not.toContain('<lastmod>');
  });

  it('returns sitemap entries even with an empty updates list', async () => {
    mockFetch({ updates: [] }, sampleNow);

    const request = new Request('http://localhost/sitemap.xml');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('<loc>http://localhost/</loc>');
    expect(xml).toContain('<loc>http://localhost/updates</loc>');
    expect(xml).not.toMatch(/<loc>http:\/\/localhost\/updates\/[a-z]/);
  });
});
