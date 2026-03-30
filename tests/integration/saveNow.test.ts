// ABOUT: Integration tests for POST /admin/api/save-now
// ABOUT: Tests Origin validation, authentication, rate limiting, validation, and GitHub save flow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';

const ORIGIN = 'http://localhost';
const NOW_CONTENT_URL = 'https://api.github.com/repos/mannepanne/hultberg-org/contents/public/now/data/content.json';

function makeSaveRequest(
  body: Record<string, unknown>,
  jwt?: string,
  origin = ORIGIN
): Request {
  return new Request('http://localhost/admin/api/save-now', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
      'CF-Connecting-IP': '203.0.113.1',
      ...(jwt ? { Cookie: `auth_token=${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /admin/api/save-now', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('returns 403 when Origin header is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/save-now', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth_token=${jwt}`,
      },
      body: JSON.stringify({ markdown: 'Test content' }),
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 403 when Origin header is wrong', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest(
      { markdown: 'Test content' },
      jwt,
      'https://evil.com'
    );
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const request = makeSaveRequest({ markdown: 'Test content' });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(401);
  });

  it('returns 400 when markdown is empty', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest({ markdown: '' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('empty');
  });

  it('returns 400 when markdown is whitespace only', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest({ markdown: '   \n\n   ' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('empty');
  });

  it('returns 400 when markdown is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest({}, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
  });

  it('returns 400 when content exceeds 100KB', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const oversizedContent = 'x'.repeat(101 * 1024);
    const request = makeSaveRequest({ markdown: oversizedContent }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('100KB');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API to succeed
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.github.com')) {
        return new Response(JSON.stringify({ content: {} }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    // Make 10 successful requests to hit rate limit
    for (let i = 0; i < 10; i++) {
      const request = makeSaveRequest({ markdown: `Content ${i}` }, jwt);
      await worker.fetch(request, mockEnv, mockCtx);
    }

    // 11th request should be rate limited
    const request = makeSaveRequest({ markdown: 'Content 11' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(429);
  });

  it('saves content successfully and returns success response', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === NOW_CONTENT_URL) {
        const method = typeof input === 'object' && 'method' in input ? input.method : 'GET';
        if (method === 'PUT') {
          return new Response(JSON.stringify({ content: {} }), { status: 200 });
        }
        // GET for existing file SHA
        return new Response(JSON.stringify({ sha: 'existing-sha-123' }), { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    });

    const request = makeSaveRequest({
      markdown: '# My Now Page\n\nThis is what I\'m doing now.',
    }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('saves with valid content and authenticated user', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const req = input instanceof Request ? input : new Request(typeof input === 'string' ? input : input.toString());
      const url = req.url;

      if (url === NOW_CONTENT_URL) {
        if (req.method === 'PUT') {
          return new Response(JSON.stringify({ content: {} }), { status: 200 });
        }
        // GET for existing file SHA
        return new Response(JSON.stringify({ sha: 'existing-sha-123' }), { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    });

    const request = makeSaveRequest({
      markdown: '# Test\n\nContent',
    }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('handles large content within limit', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const req = input instanceof Request ? input : new Request(typeof input === 'string' ? input : input.toString());
      const url = req.url;

      if (url === NOW_CONTENT_URL) {
        if (req.method === 'PUT') {
          return new Response(JSON.stringify({ content: {} }), { status: 200 });
        }
        // GET for existing file SHA
        return new Response(JSON.stringify({ sha: 'existing-sha-123' }), { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    });

    // Content just under 100KB limit
    const largeContent = 'x'.repeat(100 * 1024 - 100);
    const request = makeSaveRequest({
      markdown: largeContent,
    }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('returns 500 when GitHub API fails', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API to fail
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.github.com')) {
        return new Response('Server Error', { status: 500 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = makeSaveRequest({
      markdown: 'Test content',
    }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(500);
    const data = await response.json() as { error: string };
    expect(data.error).toBeDefined();
  });

  it('updates existing content successfully', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API - file exists (returns SHA)
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const req = input instanceof Request ? input : new Request(typeof input === 'string' ? input : input.toString());
      const url = req.url;

      if (url === NOW_CONTENT_URL) {
        if (req.method === 'PUT') {
          return new Response(JSON.stringify({ content: {} }), { status: 200 });
        }
        // GET returns existing file with SHA
        return new Response(JSON.stringify({ sha: 'existing-sha-123' }), { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    });

    const request = makeSaveRequest({
      markdown: 'Updated content',
    }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('handles markdown with newlines and formatting', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const req = input instanceof Request ? input : new Request(typeof input === 'string' ? input : input.toString());
      const url = req.url;

      if (url.includes('api.github.com')) {
        if (req.method === 'PUT') {
          return new Response(JSON.stringify({ content: {} }), { status: 200 });
        }
        // GET returns existing SHA
        return new Response(JSON.stringify({ sha: 'test-sha' }), { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    });

    const markdownContent = '# Heading\n\n**Bold** and *italic* text.\n\n- List item 1\n- List item 2';
    const request = makeSaveRequest({
      markdown: markdownContent,
    }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });
});
