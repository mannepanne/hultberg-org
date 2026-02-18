// ABOUT: Integration tests for DELETE /admin/api/delete-image
// ABOUT: Tests Origin validation, authentication, input validation, and GitHub delete flow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';

const ORIGIN = 'http://localhost';
const GITHUB_IMAGES_BASE = 'https://api.github.com/repos/mannepanne/hultberg-org/contents/public/images/updates';

function makeDeleteRequest(
  body: Record<string, unknown>,
  jwt?: string,
  origin = ORIGIN
): Request {
  return new Request('http://localhost/admin/api/delete-image', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
      ...(jwt ? { Cookie: `auth_token=${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('DELETE /admin/api/delete-image', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('returns 403 when Origin header is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/delete-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: `auth_token=${jwt}` },
      body: JSON.stringify({ slug: 'my-update', filename: 'photo.jpg' }),
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 403 when Origin header is wrong', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest(
      { slug: 'my-update', filename: 'photo.jpg' },
      jwt,
      'https://evil.com'
    );
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const request = makeDeleteRequest({ slug: 'my-update', filename: 'photo.jpg' });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(401);
  });

  it('returns 400 when slug is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest({ filename: 'photo.jpg' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('slug');
  });

  it('returns 400 when slug format is invalid', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest({ slug: '../etc', filename: 'photo.jpg' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
  });

  it('returns 400 when filename is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest({ slug: 'my-update' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('filename');
  });

  it('returns 400 when filename contains path traversal', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest({ slug: 'my-update', filename: '../secrets.txt' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
  });

  it('returns 404 when image does not exist on GitHub', async () => {
    global.fetch = vi.fn(async () => new Response('Not Found', { status: 404 }));

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest({ slug: 'my-update', filename: 'missing.jpg' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(404);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('not found');
  });

  it('returns 500 when GitHub token is not configured', async () => {
    const envWithoutToken = createMockEnv({ GITHUB_TOKEN: undefined });
    const jwt = await generateJWT(envWithoutToken, 'test@example.com');
    const request = makeDeleteRequest({ slug: 'my-update', filename: 'photo.jpg' }, jwt);
    const response = await worker.fetch(request, envWithoutToken, mockCtx);

    expect(response.status).toBe(500);
  });

  it('successfully deletes an image', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      // GET to retrieve SHA
      if (url === `${GITHUB_IMAGES_BASE}/my-update/photo.jpg` && method === 'GET') {
        return new Response(JSON.stringify({ sha: 'img-sha-123' }), { status: 200 });
      }
      // DELETE the file
      if (url === `${GITHUB_IMAGES_BASE}/my-update/photo.jpg` && method === 'DELETE') {
        return new Response(JSON.stringify({ commit: { sha: 'new-sha' } }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest({ slug: 'my-update', filename: 'photo.jpg' }, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('sends the correct SHA in the delete request', async () => {
    let capturedDeleteBody: { sha?: string } | null = null;

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (method === 'GET') {
        return new Response(JSON.stringify({ sha: 'known-sha-456' }), { status: 200 });
      }
      if (method === 'DELETE') {
        capturedDeleteBody = JSON.parse(init!.body as string) as { sha?: string };
        return new Response(JSON.stringify({ commit: {} }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest({ slug: 'my-update', filename: 'photo.jpg' }, jwt);
    await worker.fetch(request, mockEnv, mockCtx);

    expect((capturedDeleteBody as { sha?: string } | null)?.sha).toBe('known-sha-456');
  });
});
