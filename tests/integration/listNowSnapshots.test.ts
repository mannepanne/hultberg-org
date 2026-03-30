// ABOUT: Integration tests for GET /admin/api/list-now-snapshots
// ABOUT: Tests authentication, rate limiting, and snapshot listing

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';

describe('GET /admin/api/list-now-snapshots', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost/admin/api/list-now-snapshots');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(401);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API to return empty snapshots
    global.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    });

    // Make 10 successful requests to hit rate limit
    for (let i = 0; i < 10; i++) {
      const request = new Request('http://localhost/admin/api/list-now-snapshots', {
        headers: {
          Cookie: `auth_token=${jwt}`,
          'CF-Connecting-IP': '203.0.113.1',
        },
      });
      await worker.fetch(request, mockEnv, mockCtx);
    }

    // 11th request should be rate limited
    const request = new Request('http://localhost/admin/api/list-now-snapshots', {
      headers: {
        Cookie: `auth_token=${jwt}`,
        'CF-Connecting-IP': '203.0.113.1',
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(429);
  });

  it('returns empty snapshots array when no snapshots exist', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API - index doesn't exist
    global.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/admin/api/list-now-snapshots', {
      headers: {
        Cookie: `auth_token=${jwt}`,
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { snapshots: unknown[] };
    expect(data.snapshots).toEqual([]);
  });

  it('returns list of snapshots when they exist', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API - return snapshots index
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('snapshots/index.json')) {
        const index = {
          snapshots: [
            {
              date: '20260330',
              snapshotDate: '2026-03-30T15:00:00Z',
              preview: 'I live in London, work at char.gy...'
            },
            {
              date: '20260214',
              snapshotDate: '2026-02-14T10:00:00Z',
              preview: 'Working on exciting projects...'
            }
          ]
        };
        const encoded = Buffer.from(JSON.stringify(index)).toString('base64');
        return new Response(JSON.stringify({ content: encoded }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/admin/api/list-now-snapshots', {
      headers: {
        Cookie: `auth_token=${jwt}`,
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { snapshots: Array<{ date: string; snapshotDate: string; preview: string }> };
    expect(data.snapshots).toHaveLength(2);
    expect(data.snapshots[0].date).toBe('20260330');
    expect(data.snapshots[1].date).toBe('20260214');
  });

  it('returns snapshots sorted by date descending', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API - return snapshots index (already sorted)
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('snapshots/index.json')) {
        const index = {
          snapshots: [
            { date: '20260330', snapshotDate: '2026-03-30T15:00:00Z', preview: 'Newest' },
            { date: '20260215', snapshotDate: '2026-02-15T10:00:00Z', preview: 'Middle' },
            { date: '20260101', snapshotDate: '2026-01-01T08:00:00Z', preview: 'Oldest' }
          ]
        };
        const encoded = Buffer.from(JSON.stringify(index)).toString('base64');
        return new Response(JSON.stringify({ content: encoded }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/admin/api/list-now-snapshots', {
      headers: {
        Cookie: `auth_token=${jwt}`,
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { snapshots: Array<{ date: string }> };
    expect(data.snapshots[0].date).toBe('20260330');
    expect(data.snapshots[1].date).toBe('20260215');
    expect(data.snapshots[2].date).toBe('20260101');
  });

  it('handles GitHub API errors gracefully', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');

    // Mock GitHub API to return error
    global.fetch = vi.fn(async () => {
      return new Response('Server Error', { status: 500 });
    });

    const request = new Request('http://localhost/admin/api/list-now-snapshots', {
      headers: {
        Cookie: `auth_token=${jwt}`,
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    // Should return empty snapshots on error
    expect(response.status).toBe(200);
    const data = await response.json() as { snapshots: unknown[] };
    expect(data.snapshots).toEqual([]);
  });
});
