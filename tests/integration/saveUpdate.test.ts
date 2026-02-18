// ABOUT: Integration tests for POST /admin/api/save-update
// ABOUT: Tests Origin validation, authentication, input validation, and GitHub save flow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';
import type { Update } from '@/types';

const ORIGIN = 'http://localhost';

function makeSaveRequest(
  body: Record<string, unknown>,
  jwt?: string,
  origin = ORIGIN
): Request {
  return new Request('http://localhost/admin/api/save-update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
      ...(jwt ? { Cookie: `auth_token=${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// GitHub API URL patterns used by saveUpdateFile and fetchAllUpdates
const GITHUB_UPDATES_DIR = 'https://api.github.com/repos/mannepanne/hultberg-org/contents/public/updates/data';

function githubFileUrl(slug: string): string {
  return `${GITHUB_UPDATES_DIR}/${slug}.json`;
}

function makeExistingUpdateContent(update: Update): string {
  // GitHub returns content as base64-encoded JSON
  return btoa(JSON.stringify(update));
}

describe('POST /admin/api/save-update', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('returns 403 when Origin header is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/save-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth_token=${jwt}`,
      },
      body: JSON.stringify({ title: 'Test', status: 'draft', content: '' }),
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 403 when Origin header is wrong', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest(
      { title: 'Test', status: 'draft', content: '' },
      jwt,
      'https://evil.com'
    );
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const request = makeSaveRequest({ title: 'Test', status: 'draft', content: '' });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(401);
  });

  it('returns 400 when title is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest({ status: 'draft', content: '' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('Title');
  });

  it('returns 400 when title is whitespace only', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest({ title: '   ', status: 'draft', content: '' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
  });

  it('returns 400 when status is invalid', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest({ title: 'Test', status: 'pending', content: '' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('Status');
  });

  it('returns 400 when content exceeds 100KB', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const oversizedContent = 'x'.repeat(101 * 1024);
    const request = makeSaveRequest({ title: 'Test', status: 'draft', content: oversizedContent }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('100KB');
  });

  it('returns 400 when slug format is invalid for existing update', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest(
      { slug: '../etc/passwd', title: 'Test', status: 'draft', content: '' },
      jwt
    );
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('slug');
  });

  it('returns 500 when GitHub token is not configured', async () => {
    const envWithoutToken = createMockEnv({ GITHUB_TOKEN: undefined });
    const jwt = await generateJWT(envWithoutToken, 'test@example.com');
    const request = makeSaveRequest({ title: 'Test', status: 'draft', content: '' }, jwt);
    const response = await worker.fetch(request, envWithoutToken, mockCtx);

    expect(response.status).toBe(500);
  });

  it('creates a new update with generated slug', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      // fetchAllUpdates: list directory (empty repo)
      if (url === GITHUB_UPDATES_DIR && method === 'GET') {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      // saveUpdateFile: GET → 404 (new file)
      if (url.includes('my-first-update.json') && method === 'GET') {
        return new Response('Not Found', { status: 404 });
      }
      // saveUpdateFile: PUT → success
      if (url.includes('my-first-update.json') && method === 'PUT') {
        return new Response(JSON.stringify({ content: { sha: 'new-sha' } }), { status: 201 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest(
      { title: 'My First Update', status: 'draft', content: '# Hello' },
      jwt
    );
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean; slug: string; isNew: boolean };
    expect(data.success).toBe(true);
    expect(data.slug).toBe('my-first-update');
    expect(data.isNew).toBe(true);
  });

  it('appends counter suffix when slug already exists', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      // fetchAllUpdates: list directory with an existing update
      if (url === GITHUB_UPDATES_DIR && method === 'GET') {
        return new Response(JSON.stringify([
          { name: 'test-update.json', type: 'file', download_url: 'https://raw.github.com/test-update.json', url: '', sha: 'abc' },
        ]), { status: 200 });
      }
      // fetchAllUpdates: fetch the individual update to get its slug
      if (url.includes('raw.github.com/test-update.json') && method === 'GET') {
        const update: Update = {
          slug: 'test-update', title: 'Test Update', excerpt: '', content: '',
          status: 'published', publishedDate: '2026-01-01T00:00:00Z',
          editedDate: '2026-01-01T00:00:00Z', author: 'Magnus Hultberg', images: [],
        };
        return new Response(JSON.stringify(update), { status: 200 });
      }
      // saveUpdateFile: GET → 404 (new file with suffix)
      if (url.includes('test-update-2.json') && method === 'GET') {
        return new Response('Not Found', { status: 404 });
      }
      // saveUpdateFile: PUT → success
      if (url.includes('test-update-2.json') && method === 'PUT') {
        return new Response(JSON.stringify({ content: { sha: 'new-sha' } }), { status: 201 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest(
      { title: 'Test Update', status: 'draft', content: '' },
      jwt
    );
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean; slug: string; isNew: boolean };
    expect(data.success).toBe(true);
    expect(data.slug).toBe('test-update-2');
  });

  it('preserves publishedDate when updating existing published update', async () => {
    const originalPublishedDate = '2026-01-10T12:00:00.000Z';
    const existingUpdate: Update = {
      slug: 'existing-slug', title: 'Old Title', excerpt: '',
      content: '# Old', status: 'published', publishedDate: originalPublishedDate,
      editedDate: '2026-01-10T12:00:00.000Z', author: 'Magnus Hultberg', images: [],
    };

    let savedContent: Update | null = null;

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      // fetchUpdateBySlug: GET file with base64 content
      if (url.includes('existing-slug.json') && method === 'GET' && !init?.body) {
        return new Response(JSON.stringify({
          sha: 'existing-sha',
          content: makeExistingUpdateContent(existingUpdate),
        }), { status: 200 });
      }
      // saveUpdateFile: GET → existing SHA
      if (url.includes('existing-slug.json') && method === 'GET') {
        return new Response(JSON.stringify({ sha: 'existing-sha' }), { status: 200 });
      }
      // saveUpdateFile: PUT → capture body and return success
      if (url.includes('existing-slug.json') && method === 'PUT') {
        const body = JSON.parse(init!.body as string) as { content: string };
        savedContent = JSON.parse(atob(body.content)) as Update;
        return new Response(JSON.stringify({ content: { sha: 'new-sha' } }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest(
      { slug: 'existing-slug', title: 'New Title', status: 'published', content: '# New' },
      jwt
    );
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean; isNew: boolean };
    expect(data.success).toBe(true);
    expect(data.isNew).toBe(false);
    // publishedDate must be preserved from original
    expect((savedContent as Update | null)?.publishedDate).toBe(originalPublishedDate);
  });

  it('sets publishedDate on first publish', async () => {
    let savedContent: Update | null = null;

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      // fetchUpdateBySlug: returns update with no publishedDate
      if (url.includes('my-draft.json') && method === 'GET' && !init?.body) {
        const draftUpdate: Update = {
          slug: 'my-draft', title: 'My Draft', excerpt: '', content: '# Draft',
          status: 'draft', publishedDate: '',
          editedDate: '2026-01-01T00:00:00Z', author: 'Magnus Hultberg', images: [],
        };
        return new Response(JSON.stringify({
          sha: 'draft-sha',
          content: makeExistingUpdateContent(draftUpdate),
        }), { status: 200 });
      }
      // saveUpdateFile: GET → existing SHA
      if (url.includes('my-draft.json') && method === 'GET') {
        return new Response(JSON.stringify({ sha: 'draft-sha' }), { status: 200 });
      }
      // saveUpdateFile: PUT → capture content
      if (url.includes('my-draft.json') && method === 'PUT') {
        const body = JSON.parse(init!.body as string) as { content: string };
        savedContent = JSON.parse(atob(body.content)) as Update;
        return new Response(JSON.stringify({ content: { sha: 'new-sha' } }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeSaveRequest(
      { slug: 'my-draft', title: 'My Draft', status: 'published', content: '# Draft' },
      jwt
    );
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    // publishedDate should now be set to a non-empty ISO string
    expect((savedContent as Update | null)?.publishedDate).toBeTruthy();
    expect((savedContent as Update | null)?.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
