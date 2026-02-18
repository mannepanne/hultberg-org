// ABOUT: Integration tests for DELETE /admin/api/delete-update
// ABOUT: Tests authentication, slug validation, GitHub API interaction, and cascade delete

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';

function makeDeleteRequest(slug: string, jwt?: string): Request {
  return new Request('http://localhost/admin/api/delete-update', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Cookie: `auth_token=${jwt}` } : {}),
    },
    body: JSON.stringify({ slug }),
  });
}

describe('DELETE /admin/api/delete-update', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('returns 401 when not authenticated', async () => {
    const request = makeDeleteRequest('test-update');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(401);
  });

  it('returns 400 when slug is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/delete-update', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: `auth_token=${jwt}` },
      body: JSON.stringify({}),
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('slug');
  });

  it('returns 400 for invalid slug format', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest('../etc/passwd', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('Invalid slug');
  });

  it('returns 404 when update does not exist on GitHub', async () => {
    global.fetch = vi.fn(async () => new Response('Not Found', { status: 404 }));

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest('non-existent-update', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(404);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('not found');
  });

  it('successfully deletes an update', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      // GET to retrieve SHA
      if (url.includes('test-update.json') && method === 'GET') {
        return new Response(JSON.stringify({ sha: 'abc123def456' }), { status: 200 });
      }
      // DELETE the file
      if (url.includes('test-update.json') && method === 'DELETE') {
        return new Response(JSON.stringify({ commit: { sha: 'new-sha' } }), { status: 200 });
      }
      // Images directory check (no images for this update)
      if (url.includes('images/updates/test-update')) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest('test-update', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('also deletes associated images on successful update delete', async () => {
    const deletedUrls: string[] = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('updates/data/update-with-images.json') && method === 'GET') {
        return new Response(JSON.stringify({ sha: 'abc123' }), { status: 200 });
      }
      if (url.includes('updates/data/update-with-images.json') && method === 'DELETE') {
        deletedUrls.push(url);
        return new Response(JSON.stringify({ commit: {} }), { status: 200 });
      }
      if (url.includes('images/updates/update-with-images') && method === 'GET') {
        return new Response(JSON.stringify([
          { name: 'photo.jpg', url: 'https://api.github.com/image1', sha: 'img-sha-1' },
        ]), { status: 200 });
      }
      if (url.includes('api.github.com/image1') && method === 'DELETE') {
        deletedUrls.push(url);
        return new Response(JSON.stringify({ commit: {} }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeDeleteRequest('update-with-images', jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    // Both the JSON file and the image should have been deleted
    expect(deletedUrls.some(u => u.includes('update-with-images.json'))).toBe(true);
    expect(deletedUrls.some(u => u.includes('image1'))).toBe(true);
  });

  it('returns error when GITHUB_TOKEN is not configured', async () => {
    const envWithoutToken = createMockEnv({ GITHUB_TOKEN: undefined });
    const jwt = await generateJWT(envWithoutToken, 'test@example.com');
    const request = makeDeleteRequest('test-update', jwt);
    const response = await worker.fetch(request, envWithoutToken, mockCtx);

    expect(response.status).toBe(500);
    const data = await response.json() as { error: string };
    expect(data.error).toBeTruthy();
  });
});
