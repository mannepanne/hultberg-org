// ABOUT: Integration tests for POST /admin/api/upload-image
// ABOUT: Tests Origin validation, authentication, file validation, and GitHub upload flow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';

const ORIGIN = 'http://localhost';
const GITHUB_IMAGES_BASE = 'https://api.github.com/repos/mannepanne/hultberg-org/contents/public/images/updates';

function makeUploadRequest(
  slug: string,
  file: File | null,
  jwt?: string,
  origin = ORIGIN
): Request {
  const formData = new FormData();
  formData.append('slug', slug);
  if (file) formData.append('image', file);

  return new Request('http://localhost/admin/api/upload-image', {
    method: 'POST',
    headers: {
      'Origin': origin,
      ...(jwt ? { Cookie: `auth_token=${jwt}` } : {}),
    },
    body: formData,
  });
}

function makeJpegFile(name = 'photo.jpg', sizeBytes = 1024): File {
  const bytes = new Uint8Array(sizeBytes).fill(0xff); // Minimal fake JPEG bytes
  return new File([bytes], name, { type: 'image/jpeg' });
}

describe('POST /admin/api/upload-image', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('returns 403 when Origin header is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const formData = new FormData();
    formData.append('slug', 'my-update');
    formData.append('image', makeJpegFile());

    const request = new Request('http://localhost/admin/api/upload-image', {
      method: 'POST',
      headers: { Cookie: `auth_token=${jwt}` },
      body: formData,
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 403 when Origin header is wrong', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeUploadRequest('my-update', makeJpegFile(), jwt, 'https://evil.com');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const request = makeUploadRequest('my-update', makeJpegFile());
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(401);
  });

  it('returns 400 when slug is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const formData = new FormData();
    formData.append('image', makeJpegFile());

    const request = new Request('http://localhost/admin/api/upload-image', {
      method: 'POST',
      headers: { 'Origin': ORIGIN, Cookie: `auth_token=${jwt}` },
      body: formData,
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('slug');
  });

  it('returns 400 when slug format is invalid', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeUploadRequest('../etc', makeJpegFile(), jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
  });

  it('returns 400 when image file is missing', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeUploadRequest('my-update', null, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('Image');
  });

  it('returns 400 when MIME type is not allowed', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const textFile = new File(['hello'], 'doc.txt', { type: 'text/plain' });
    const request = makeUploadRequest('my-update', textFile, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toMatch(/jpeg|png|gif|webp/i);
  });

  it('returns 400 when image exceeds 5MB', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const oversizedFile = makeJpegFile('big.jpg', 6 * 1024 * 1024);
    const request = makeUploadRequest('my-update', oversizedFile, jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toContain('5MB');
  });

  it('returns 500 when GitHub token is not configured', async () => {
    const envWithoutToken = createMockEnv({ GITHUB_TOKEN: undefined });
    const jwt = await generateJWT(envWithoutToken, 'test@example.com');
    const request = makeUploadRequest('my-update', makeJpegFile(), jwt);
    const response = await worker.fetch(request, envWithoutToken, mockCtx);

    expect(response.status).toBe(500);
  });

  it('successfully uploads an image and returns public path', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      // GET check for existing file → 404 (new file)
      if (url.includes(`${GITHUB_IMAGES_BASE}/my-update/photo.jpg`) && method === 'GET') {
        return new Response('Not Found', { status: 404 });
      }
      // PUT upload → success
      if (url.includes(`${GITHUB_IMAGES_BASE}/my-update/photo.jpg`) && method === 'PUT') {
        return new Response(JSON.stringify({ content: { sha: 'img-sha' } }), { status: 201 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = makeUploadRequest('my-update', makeJpegFile('photo.jpg'), jwt);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const data = await response.json() as { success: boolean; path: string };
    expect(data.success).toBe(true);
    expect(data.path).toBe('/images/updates/my-update/photo.jpg');
  });

  it('accepts webp, png, and gif file types', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ content: { sha: 'sha' } }), { status: 201 })
    );

    const jwt = await generateJWT(mockEnv, 'test@example.com');

    for (const [name, type] of [['img.webp', 'image/webp'], ['img.png', 'image/png'], ['img.gif', 'image/gif']]) {
      const file = new File([new Uint8Array(100)], name, { type });
      const request = makeUploadRequest('my-update', file, jwt);
      const response = await worker.fetch(request, mockEnv, mockCtx);
      expect(response.status).toBe(200);
    }
  });

  it('sanitizes unsafe characters from filename', async () => {
    let capturedUrl = '';
    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      capturedUrl = url;
      if (method === 'GET') return new Response('Not Found', { status: 404 });
      return new Response(JSON.stringify({ content: { sha: 'sha' } }), { status: 201 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    // Filename with spaces and mixed case — should be sanitized to lowercase with dashes
    const file = new File([new Uint8Array(100)], 'My Photo.jpg', { type: 'image/jpeg' });
    const request = makeUploadRequest('my-update', file, jwt);
    await worker.fetch(request, mockEnv, mockCtx);

    // The URL should contain the sanitized filename (lowercase, spaces→dashes)
    expect(capturedUrl).toContain('my-photo.jpg');
  });
});
