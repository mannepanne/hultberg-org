// ABOUT: Integration tests for /now page editor
// ABOUT: GET /admin/now/edit

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env, NowContent } from '@/types';

describe('GET /admin/now/edit', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('redirects to login when not authenticated', async () => {
    const request = new Request('http://localhost/admin/now/edit');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin');
  });

  it('returns 200 with editor HTML when authenticated', async () => {
    // Mock content.json fetch
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: '# Test content',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/now/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('renders editor form with content from content.json', async () => {
    const testMarkdown = '# Test Heading\n\nTest paragraph.';

    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: testMarkdown,
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/now/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('Edit /now Page');
    expect(html).toContain(testMarkdown.replace(/&/g, '&amp;'));
    expect(html).toContain('id="content"');
  });

  it('renders empty form when content.json does not exist', async () => {
    global.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/now/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Edit /now Page');
    expect(html).toContain('id="content"');
  });

  it('includes EasyMDE editor script', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: 'Test',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/now/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('easymde');
    expect(html).toContain('cdn.jsdelivr.net');
  });

  it('includes saveContent function for AJAX save', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: 'Test',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/now/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('saveContent');
    expect(html).toContain('/admin/api/save-now');
  });

  it('sets Content-Security-Policy header including cdn.jsdelivr.net', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: 'Test',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/now/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain('cdn.jsdelivr.net');
  });

  it('includes "Now" link in navigation', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: 'Test',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/now/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('href="/admin/now/edit"');
    expect(html).toContain('>Now<');
  });

  it('does not include image upload functionality', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: 'Test',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/now/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).not.toContain('upload-image');
    expect(html).not.toContain('triggerUpload');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/now/data/content.json')) {
        const content: NowContent = {
          markdown: 'Test',
          lastUpdated: '2026-03-30T12:00:00Z',
        };
        return new Response(JSON.stringify(content), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Make 10 successful requests to hit rate limit
    for (let i = 0; i < 10; i++) {
      const request = new Request('http://localhost/admin/now/edit', {
        headers: {
          Cookie: `auth_token=${jwt}`,
          'CF-Connecting-IP': '203.0.113.1',
        },
      });
      await worker.fetch(request, mockEnv, mockCtx);
    }

    // 11th request should be rate limited
    const request = new Request('http://localhost/admin/now/edit', {
      headers: {
        Cookie: `auth_token=${jwt}`,
        'CF-Connecting-IP': '203.0.113.1',
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(429);
  });
});
