// ABOUT: Integration tests for /updates/{slug} individual page
// ABOUT: Tests markdown rendering, draft handling, and 404 responses

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import type { Update } from '@/types';

describe('GET /updates/{slug}', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();

    // Mock global fetch to return test update data
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('/updates/data/published-update-1.json')) {
        const update: Update = {
          slug: 'published-update-1',
          title: 'Test Published Update',
          excerpt: 'Test excerpt',
          content: '# Test Update\n\nThis is a **test** update with _markdown_ formatting.',
          status: 'published',
          publishedDate: '2026-02-15T10:00:00Z',
          editedDate: '2026-02-15T10:00:00Z',
          author: 'Magnus Hultberg',
          images: [],
        };
        return new Response(JSON.stringify(update), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/updates/data/draft-update.json')) {
        const update: Update = {
          slug: 'draft-update',
          title: 'Draft Update',
          excerpt: 'Draft',
          content: '# Draft\n\nThis is a draft.',
          status: 'draft',
          publishedDate: '',
          editedDate: '2026-02-16T10:00:00Z',
          author: 'Magnus Hultberg',
          images: [],
        };
        return new Response(JSON.stringify(update), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/updates/data/with-images.json')) {
        const update: Update = {
          slug: 'with-images',
          title: 'Update With Images',
          excerpt: 'Has images',
          content: '# With Images\n\n![Test](image.jpg)',
          status: 'published',
          publishedDate: '2026-02-16T10:00:00Z',
          editedDate: '2026-02-16T10:00:00Z',
          author: 'Magnus Hultberg',
          images: ['/images/updates/with-images/image.jpg'],
        };
        return new Response(JSON.stringify(update), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Default 404 for unknown updates
      return new Response('Not Found', { status: 404 });
    });
  });

  it('returns 200 for published update', async () => {
    const request = new Request('http://localhost/updates/published-update-1');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.status).toBe(200);
  });

  it('returns HTML content type', async () => {
    const request = new Request('http://localhost/updates/published-update-1');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('displays update title', async () => {
    const request = new Request('http://localhost/updates/published-update-1');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    expect(html).toContain('Test Published Update');
  });

  it('displays author name', async () => {
    const request = new Request('http://localhost/updates/published-update-1');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    expect(html).toContain('Magnus Hultberg');
  });

  it('renders markdown to HTML', async () => {
    const request = new Request('http://localhost/updates/published-update-1');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    // Check for HTML rendering of markdown
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>test</strong>');
    expect(html).toContain('<em>markdown</em>');
  });

  it('returns 404 for draft update (public user)', async () => {
    const request = new Request('http://localhost/updates/draft-update');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.status).toBe(404);
  });

  it('returns 404 for non-existent update', async () => {
    const request = new Request('http://localhost/updates/does-not-exist');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.status).toBe(404);
  });

  it('displays published date', async () => {
    const request = new Request('http://localhost/updates/published-update-1');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    // Should contain formatted date (e.g., "15 February 2026")
    expect(html).toContain('February');
    expect(html).toContain('2026');
  });

  it('displays edited date if different from published', async () => {
    // Mock an update with different edited date
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('/updates/data/edited-update.json')) {
        const update: Update = {
          slug: 'edited-update',
          title: 'Edited Update',
          excerpt: 'Edited',
          content: '# Edited',
          status: 'published',
          publishedDate: '2026-02-15T10:00:00Z',
          editedDate: '2026-02-16T15:00:00Z',
          author: 'Magnus Hultberg',
          images: [],
        };
        return new Response(JSON.stringify(update), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/updates/edited-update');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    // Should show edited date indication
    expect(html.toLowerCase()).toMatch(/edited|updated/);
  });

  it('includes link back to updates listing', async () => {
    const request = new Request('http://localhost/updates/published-update-1');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    expect(html).toContain('/updates');
  });

  it('sanitizes HTML in markdown content', async () => {
    // Mock an update with potentially dangerous HTML
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('/updates/data/html-test.json')) {
        const update: Update = {
          slug: 'html-test',
          title: 'HTML Test',
          excerpt: 'Test',
          content: '# Test\n\n<script>alert("XSS")</script>\n\n<a href="javascript:alert()">Bad Link</a>',
          status: 'published',
          publishedDate: '2026-02-15T10:00:00Z',
          editedDate: '2026-02-15T10:00:00Z',
          author: 'Magnus Hultberg',
          images: [],
        };
        return new Response(JSON.stringify(update), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/updates/html-test');
    const response = await worker.fetch(request, mockEnv, {});
    const html = await response.text();

    // Should not contain dangerous script tags or javascript: links in content
    expect(html).not.toContain('alert("XSS")');
    expect(html).not.toContain('javascript:alert()');
  });
});
