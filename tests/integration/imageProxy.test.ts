// ABOUT: Integration tests for the /images/updates/* image proxy route
// ABOUT: Tests that uploaded images are proxied from GitHub raw content

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import type { Env } from '@/types';

const RAW_GITHUB_BASE = 'https://raw.githubusercontent.com/mannepanne/hultberg-org/main/public/images/updates';

describe('GET /images/updates/*', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('proxies an existing image from GitHub raw content', async () => {
    const fakeImageBytes = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG magic bytes

    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = input.toString();
      if (url === `${RAW_GITHUB_BASE}/my-update/photo.jpg`) {
        return new Response(fakeImageBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/images/updates/my-update/photo.jpg');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('returns 404 when image does not exist in GitHub', async () => {
    global.fetch = vi.fn(async () => new Response('Not Found', { status: 404 }));

    const request = new Request('http://localhost/images/updates/my-update/missing.jpg');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(404);
  });

  it('fetches from the correct GitHub raw URL', async () => {
    let fetchedUrl = '';

    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      fetchedUrl = input.toString();
      return new Response(new Uint8Array([0]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    });

    const request = new Request('http://localhost/images/updates/slug-123/banner.png');
    await worker.fetch(request, mockEnv, mockCtx);

    expect(fetchedUrl).toBe(`${RAW_GITHUB_BASE}/slug-123/banner.png`);
  });
});
