// ABOUT: Integration tests confirming the Worker applies security headers
// ABOUT: Verifies the withSecurityHeaders wrapper is wired into the default export

import { describe, it, expect } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { DEFAULT_CSP } from '@/securityHeaders';
import type { Env } from '@/types';

describe('Worker security headers', () => {
  const ctx = createMockContext();

  it('adds the base security headers and default CSP to a 404 response', async () => {
    const request = new Request('http://localhost/no-such-page');
    const response = await worker.fetch(request, createMockEnv(), ctx);

    expect(response.status).toBe(404);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(response.headers.get('Content-Security-Policy')).toBe(DEFAULT_CSP);
  });

  it('hardens the homepage served via env.ASSETS.fetch()', async () => {
    // The homepage scored D because "/" returns the raw Cloudflare Assets
    // response. Under run_worker_first the Worker sees that response, so the
    // wrapper must add headers to it. Mock ASSETS to assert exactly that.
    const env = createMockEnv({
      ASSETS: {
        fetch: async () =>
          new Response('<!doctype html><html></html>', {
            headers: { 'Content-Type': 'text/html' },
          }),
      } as unknown as Env['ASSETS'],
    });

    const response = await worker.fetch(new Request('http://localhost/'), env, ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/html');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(response.headers.get('Content-Security-Policy')).toBe(DEFAULT_CSP);
  });

  it('does not clobber a route that sets its own CSP', async () => {
    // /updates/feed.xml sets a route-specific CSP; the wrapper must keep it.
    const request = new Request('http://localhost/updates/feed.xml');
    const response = await worker.fetch(request, createMockEnv(), ctx);

    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    // ...while still gaining the base headers it previously lacked.
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
