// ABOUT: Integration tests for DELETE /admin/api/delete-now-snapshot
// ABOUT: Tests authentication, rate limiting, validation, and GitHub delete flow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';

const ORIGIN = 'http://localhost';

function makeDeleteRequest(
  date: string,
  jwt?: string,
  origin = ORIGIN
): Request {
  return new Request(`http://localhost/admin/api/delete-now-snapshot?date=${date}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
      'CF-Connecting-IP': '203.0.113.1',
      ...(jwt ? { Cookie: `auth_token=${jwt}` } : {}),
    },
  });
}

describe('DELETE /admin/api/delete-now-snapshot', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('returns 403 when Origin header is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/delete-now-snapshot?date=20260330', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth_token=${jwt}`,
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 403 when Origin header is wrong', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest('20260330', jwt, 'https://evil.com');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const request = makeDeleteRequest('20260330');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(401);
  });

  it('returns 400 when date parameter is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/delete-now-snapshot', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ORIGIN,
        Cookie: `auth_token=${jwt}`,
        'CF-Connecting-IP': '203.0.113.1',
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('required');
  });

  it('returns 400 when date format is invalid', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest('2026-03-30', jwt); // Wrong format
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('Invalid date format');
  });

  it('returns 400 when date is too short', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest('2026033', jwt); // 7 digits instead of 8
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('Invalid date format');
  });

  it('returns 400 when date contains non-digits', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest('2026033a', jwt); // Contains letter
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('Invalid date format');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API to succeed
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      const req = input instanceof Request ? input : new Request(typeof input === 'string' ? input : url);

      if (url.includes('api.github.com')) {
        if (req.method === 'DELETE') {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        // GET for index or snapshot file
        if (url.includes('index.json')) {
          const index = { snapshots: [{ date: '20260330', snapshotDate: '2026-03-30T15:00:00Z', preview: 'Test' }] };
          const encoded = Buffer.from(JSON.stringify(index)).toString('base64');
          return new Response(JSON.stringify({ content: encoded, sha: 'index-sha' }), { status: 200 });
        }
        // GET for snapshot file SHA
        return new Response(JSON.stringify({ sha: 'test-sha' }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    // Make 10 successful requests to hit rate limit
    for (let i = 0; i < 10; i++) {
      const request = makeDeleteRequest('20260330', jwt);
      await worker.fetch(request, mockEnv, mockCtx);
    }

    // 11th request should be rate limited
    const request = makeDeleteRequest('20260330', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(429);
  });

  it('deletes snapshot successfully', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      const req = input instanceof Request ? input : new Request(typeof input === 'string' ? input : url);

      if (url.includes('api.github.com')) {
        if (req.method === 'DELETE') {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        // GET for SHA or index
        if (url.includes('index.json')) {
          const index = { snapshots: [{ date: '20260330', snapshotDate: '2026-03-30T15:00:00Z', preview: 'Test' }] };
          const encoded = Buffer.from(JSON.stringify(index)).toString('base64');
          return new Response(JSON.stringify({ content: encoded, sha: 'index-sha' }), { status: 200 });
        }
        return new Response(JSON.stringify({ sha: 'file-sha' }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = makeDeleteRequest('20260330', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('returns 500 when snapshot does not exist', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API - file not found
    global.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    });

    const request = makeDeleteRequest('20260330', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(500);
    const data = await response.json() as { error: string };
    expect(data.error).toBeDefined();
  });

  it('returns 500 when GitHub API fails', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API to fail
    global.fetch = vi.fn(async () => {
      return new Response('Server Error', { status: 500 });
    });

    const request = makeDeleteRequest('20260330', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(500);
    const data = await response.json() as { error: string };
    expect(data.error).toBeDefined();
  });

  it('handles deletion of old snapshot', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      const req = input instanceof Request ? input : new Request(typeof input === 'string' ? input : url);

      if (url.includes('api.github.com')) {
        if (req.method === 'DELETE') {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        // GET for SHA or index
        if (url.includes('index.json')) {
          const index = { snapshots: [{ date: '20160926', snapshotDate: '2016-09-26T10:00:00Z', preview: 'Old snapshot' }] };
          const encoded = Buffer.from(JSON.stringify(index)).toString('base64');
          return new Response(JSON.stringify({ content: encoded, sha: 'index-sha' }), { status: 200 });
        }
        return new Response(JSON.stringify({ sha: 'file-sha' }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = makeDeleteRequest('20160926', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });
});
