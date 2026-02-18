// ABOUT: Integration tests for admin authentication routes
// ABOUT: Tests login flow, magic link, and token verification endpoints

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';

describe('GET /admin - Login Page', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('returns 200 and login form', async () => {
    const request = new Request('http://localhost/admin');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('Admin Login');
    expect(html).toContain('type="email"');
    expect(html).toContain('/admin/api/send-magic-link');
  });

  it('displays error message from query param', async () => {
    const request = new Request('http://localhost/admin?error=rate-limit');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    const html = await response.text();
    expect(html).toContain('Too many requests');
  });

  it('displays success message from query param', async () => {
    const request = new Request('http://localhost/admin?success=check-email');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    const html = await response.text();
    expect(html).toContain('Check your email');
  });

  it('includes CSP headers', async () => {
    const request = new Request('http://localhost/admin');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });
});

describe('POST /admin/api/send-magic-link', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv({ ADMIN_EMAIL: 'magnus.hultberg@gmail.com' });
    mockCtx = createMockContext();

    // Mock fetch for Resend API
    global.fetch = vi.fn(async (url: RequestInfo | URL | string) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      if (urlString.includes('api.resend.com')) {
        return new Response(JSON.stringify({ id: 'test-email-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });
  });

  it('returns 400 when email is missing', async () => {
    const request = new Request('http://localhost/admin/api/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const data = await response.json() as { error: string };
    expect(data.error).toContain('required');
  });

  it('returns 400 when email format is invalid', async () => {
    const request = new Request('http://localhost/admin/api/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const data = await response.json() as { error: string };
    expect(data.error).toContain('Invalid email');
  });

  it('returns success for admin email', async () => {
    const request = new Request('http://localhost/admin/api/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'magnus.hultberg@gmail.com' }),
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);

    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('returns success for non-admin email (prevents enumeration)', async () => {
    const request = new Request('http://localhost/admin/api/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'attacker@evil.com' }),
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);

    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('enforces rate limiting', async () => {
    const ip = '192.168.1.100';

    // Make 10 requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      const request = new Request('http://localhost/admin/api/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': ip,
        },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await worker.fetch(request, mockEnv, mockCtx);
      expect(response.status).toBe(200);
    }

    // 11th request should be rate limited
    const request = new Request('http://localhost/admin/api/send-magic-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': ip,
      },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(429);

    const data = await response.json() as { error: string };
    expect(data.error).toContain('Too many requests');
  });
});

describe('GET /admin/api/verify-token', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('redirects to login with error when token missing', async () => {
    const request = new Request('http://localhost/admin/api/verify-token');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin?error=invalid-link');
  });

  it('redirects to login when token is invalid', async () => {
    const request = new Request('http://localhost/admin/api/verify-token?token=invalid-token');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin?error=link-expired');
  });

  it('redirects to dashboard and sets cookie when token is valid', async () => {
    // Store a valid token with timestamp 6 seconds in the past to clear the reuse protection window
    const email = 'test@example.com';
    const token = 'valid-test-token';
    await mockEnv.AUTH_KV!.put(
      `auth:token:${token}`,
      JSON.stringify({ email, timestamp: Date.now() - 6000, used: false }),
      { expirationTtl: 900 }
    );

    const request = new Request(`http://localhost/admin/api/verify-token?token=${token}`);
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/admin/dashboard');

    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('auth_token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('prevents token reuse', async () => {
    // Store a valid token with timestamp 6 seconds in the past to clear the reuse protection window
    const email = 'test@example.com';
    const token = 'reuse-test-token';
    await mockEnv.AUTH_KV!.put(
      `auth:token:${token}`,
      JSON.stringify({ email, timestamp: Date.now() - 6000, used: false }),
      { expirationTtl: 900 }
    );

    // First use should succeed
    const request1 = new Request(`http://localhost/admin/api/verify-token?token=${token}`);
    const response1 = await worker.fetch(request1, mockEnv, mockCtx);
    expect(response1.status).toBe(302);
    expect(response1.headers.get('Location')).toBe('/admin/dashboard');

    // Second use should fail
    const request2 = new Request(`http://localhost/admin/api/verify-token?token=${token}`);
    const response2 = await worker.fetch(request2, mockEnv, mockCtx);
    expect(response2.status).toBe(302);
    expect(response2.headers.get('Location')).toContain('/admin?error=link-expired');
  });
});

describe('GET /admin/dashboard - Authenticated Access', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('redirects to login when not authenticated', async () => {
    const request = new Request('http://localhost/admin/dashboard');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin');
  });

  it('shows dashboard when authenticated', async () => {
    const email = 'test@example.com';
    const jwt = await generateJWT(mockEnv, email);

    // Mock GitHub API - dashboard fetches updates list
    global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.github.com')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not Found', { status: 404 });
    });

    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('Admin Dashboard');
    expect(html).toContain(email);
  });

  it('redirects to login with expired JWT', async () => {
    // Create a JWT with expired timestamp
    const expiredJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjEsImV4cCI6Mn0.invalid';

    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${expiredJwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin');
  });
});
