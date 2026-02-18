// ABOUT: Integration tests for GET /admin/api/updates
// ABOUT: Tests authenticated listing of all updates including drafts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';
import type { Update } from '@/types';

const PUBLISHED: Update = {
  slug: 'published-update',
  title: 'Published Update',
  excerpt: 'Published excerpt',
  content: '# Published',
  status: 'published',
  publishedDate: '2026-02-15T10:00:00Z',
  editedDate: '2026-02-15T10:00:00Z',
  author: 'Magnus Hultberg',
  images: [],
};

const DRAFT: Update = {
  slug: 'draft-update',
  title: 'Draft Update',
  excerpt: 'Draft excerpt',
  content: '# Draft',
  status: 'draft',
  publishedDate: '',
  editedDate: '2026-02-16T10:00:00Z',
  author: 'Magnus Hultberg',
  images: [],
};

describe('GET /admin/api/updates', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('returns 401 when not authenticated', async () => {
    const request = new Request('http://localhost/admin/api/updates');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(401);
  });

  it('returns 200 with updates array when authenticated', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.github.com') && url.includes('public/updates/data')) {
        return new Response(JSON.stringify([
          { name: 'published-update.json', type: 'file', download_url: 'https://raw.test/published-update.json', url: '', sha: '' },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('published-update.json')) {
        return new Response(JSON.stringify(PUBLISHED), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/updates', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { updates: Update[] };
    expect(data.updates).toHaveLength(1);
    expect(data.updates[0].slug).toBe('published-update');
  });

  it('includes draft updates in the response', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.github.com')) {
        return new Response(JSON.stringify([
          { name: 'published-update.json', type: 'file', download_url: 'https://raw.test/published-update.json', url: '', sha: '' },
          { name: 'draft-update.json', type: 'file', download_url: 'https://raw.test/draft-update.json', url: '', sha: '' },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('published-update.json')) return new Response(JSON.stringify(PUBLISHED), { status: 200 });
      if (url.includes('draft-update.json')) return new Response(JSON.stringify(DRAFT), { status: 200 });
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/updates', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const data = await response.json() as { updates: Update[] };

    expect(data.updates).toHaveLength(2);
    const statuses = data.updates.map(u => u.status);
    expect(statuses).toContain('published');
    expect(statuses).toContain('draft');
  });

  it('excludes index.json from the results', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.github.com')) {
        return new Response(JSON.stringify([
          { name: 'index.json', type: 'file', download_url: 'https://raw.test/index.json', url: '', sha: '' },
          { name: 'published-update.json', type: 'file', download_url: 'https://raw.test/published-update.json', url: '', sha: '' },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('published-update.json')) return new Response(JSON.stringify(PUBLISHED), { status: 200 });
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/updates', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const data = await response.json() as { updates: Update[] };

    expect(data.updates).toHaveLength(1);
    expect(data.updates[0].slug).toBe('published-update');
  });

  it('returns empty array when no updates exist', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.github.com')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/updates', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const data = await response.json() as { updates: Update[] };

    expect(data.updates).toHaveLength(0);
  });

  it('returns empty array when GITHUB_TOKEN is not configured', async () => {
    const envWithoutToken = createMockEnv({ GITHUB_TOKEN: undefined });
    const jwt = await generateJWT(envWithoutToken, 'test@example.com');
    const request = new Request('http://localhost/admin/api/updates', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, envWithoutToken, mockCtx);
    const data = await response.json() as { updates: Update[] };

    expect(response.status).toBe(200);
    expect(data.updates).toHaveLength(0);
  });
});
