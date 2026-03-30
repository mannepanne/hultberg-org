// ABOUT: Integration tests for /now page
// ABOUT: Tests markdown rendering, widget inclusion, and sanitization

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';

interface NowContent {
  markdown: string;
  lastUpdated: string;
}

describe('GET /now', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();

    // Mock global fetch to return test content data
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: '# Test Content\n\nThis is a **test** with _markdown_ formatting.\n\n- Item 1\n- Item 2',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    });
  });

  it('returns 200 for /now page', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
  });

  it('returns HTML content type', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('displays page title', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain("What I'm doing now");
  });

  it('renders markdown to HTML', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Check for HTML rendering of markdown
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>test</strong>');
    expect(html).toContain('<em>markdown</em>');
    expect(html).toContain('<li>Item 1</li>');
  });

  it('includes Goodreads widget', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('gr_updates_widget');
    expect(html).toContain('goodreads.com/widgets/user_update_widget');
  });

  it('includes GitHub widget container', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('github-contributions');
    expect(html).toContain('github-repos');
    expect(html).toContain('data-username="mannepanne"');
  });

  it('includes GitHub widget script', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('/now/github-widget.js');
  });

  it('includes navigation links', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('/updates');
    expect(html).toContain('linkedin.com/in/hultberg');
    expect(html).toContain('github.com/mannepanne');
  });

  it('includes widget styles', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('.widgets-container');
    expect(html).toContain('.github-widget');
    expect(html).toContain('.contribution-grid');
  });

  it('includes CSP header with frame-src for Goodreads', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain('frame-src https://goodreads.com');
  });

  it('includes CSP header with connect-src for GitHub API', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://api.github.com');
  });

  it('sanitizes HTML in markdown content', async () => {
    // Mock content with potentially dangerous HTML
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: '# Test\n\n<script>alert("XSS")</script>\n\n<a href="javascript:alert()">Bad Link</a>',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should not contain dangerous script tags or javascript: links in content
    expect(html).not.toContain('alert("XSS")');
    expect(html).not.toContain('javascript:alert()');
  });

  it('sanitizes img tags with onerror handlers', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: '<img src=x onerror=alert(1)>',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).not.toContain('onerror=alert(1)');
    expect(html).not.toContain('onerror=');
  });

  it('sanitizes case variation attacks', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: '<a href="JaVaScRiPt:alert(1)">Click</a>',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).not.toMatch(/javascript:/i);
  });

  it('sanitizes dangerous tags', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: '<iframe src="evil.com"></iframe>\n<object data="evil.swf"></object>',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Should not contain the malicious iframe from content (but Goodreads widget iframe is OK)
    expect(html).not.toContain('evil.com');
    expect(html).not.toContain('evil.swf');
    expect(html).not.toContain('<object');
  });

  it('returns 500 if content.json cannot be loaded', async () => {
    // Mock fetch to return 404 for content.json
    global.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(500);
  });

  it('returns 500 if content.json is malformed JSON', async () => {
    // Mock fetch to return malformed JSON
    global.fetch = vi.fn(async () => {
      return new Response('{ invalid json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(500);
  });

  it('includes Google Analytics', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('googletagmanager.com/gtag');
    expect(html).toContain('G-D1L22CCJTJ');
  });

  it('includes Cloudflare Web Analytics', async () => {
    const request = new Request('http://localhost/now');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('cloudflareinsights.com/beacon.min.js');
    expect(html).toContain('f71c3c28b82c4c6991ec3d41b7f1496f');
  });
});
