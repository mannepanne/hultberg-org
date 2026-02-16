// ABOUT: Unit tests for authentication utilities
// ABOUT: Tests magic link generation, JWT handling, and middleware

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMagicLinkToken,
  storeMagicLinkToken,
  verifyMagicLinkToken,
  generateJWT,
  verifyJWT,
  requireAuth,
  createAuthCookie,
  isValidEmail,
  isAdminEmail,
  checkRateLimit,
} from '@/auth';
import { createMockEnv } from '../mocks/env';
import type { Env } from '@/types';

describe('Magic Link Token Generation', () => {
  it('generates a valid UUID token', () => {
    const token = generateMagicLinkToken();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates unique tokens', () => {
    const token1 = generateMagicLinkToken();
    const token2 = generateMagicLinkToken();
    expect(token1).not.toBe(token2);
  });
});

describe('Magic Link Token Storage and Verification', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('stores and retrieves a token', async () => {
    const token = 'test-token-123';
    const email = 'test@example.com';

    await storeMagicLinkToken(env, token, email);
    const retrievedEmail = await verifyMagicLinkToken(env, token);

    expect(retrievedEmail).toBe(email);
  });

  it('returns null for non-existent token', async () => {
    const email = await verifyMagicLinkToken(env, 'non-existent-token');
    expect(email).toBeNull();
  });

  it('marks token as used after verification', async () => {
    const token = 'test-token-456';
    const email = 'test@example.com';

    await storeMagicLinkToken(env, token, email);

    // First verification succeeds
    const firstVerify = await verifyMagicLinkToken(env, token);
    expect(firstVerify).toBe(email);

    // Second verification fails (token already used)
    const secondVerify = await verifyMagicLinkToken(env, token);
    expect(secondVerify).toBeNull();
  });
});

describe('JWT Generation and Verification', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv({ JWT_SECRET: 'test-secret-key-12345' });
  });

  it('generates and verifies a valid JWT', async () => {
    const email = 'test@example.com';
    const jwt = await generateJWT(env, email);

    expect(jwt).toBeDefined();
    expect(typeof jwt).toBe('string');
    expect(jwt.split('.')).toHaveLength(3); // header.payload.signature

    const verifiedEmail = await verifyJWT(env, jwt);
    expect(verifiedEmail).toBe(email);
  });

  it('rejects JWT with invalid signature', async () => {
    const email = 'test@example.com';
    const jwt = await generateJWT(env, email);

    // Tamper with the signature
    const parts = jwt.split('.');
    const tamperedJwt = `${parts[0]}.${parts[1]}.invalidsignature`;

    const verifiedEmail = await verifyJWT(env, tamperedJwt);
    expect(verifiedEmail).toBeNull();
  });

  it('rejects malformed JWT', async () => {
    const malformedJwt = 'not.a.valid.jwt.with.too.many.parts';
    const verifiedEmail = await verifyJWT(env, malformedJwt);
    expect(verifiedEmail).toBeNull();
  });

  it('rejects JWT signed with different secret', async () => {
    const email = 'test@example.com';
    const jwt = await generateJWT(env, email);

    // Change the secret
    const differentEnv = createMockEnv({ JWT_SECRET: 'different-secret' });
    const verifiedEmail = await verifyJWT(differentEnv, jwt);

    expect(verifiedEmail).toBeNull();
  });
});

describe('Authentication Middleware', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv({ JWT_SECRET: 'test-secret-key-12345' });
  });

  it('returns 401 when no cookie header present', async () => {
    const request = new Request('http://localhost/admin/dashboard');
    const result = await requireAuth(request, env);

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });

  it('returns 401 when auth_token cookie missing', async () => {
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: 'other_cookie=value' },
    });
    const result = await requireAuth(request, env);

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });

  it('returns 401 when JWT is invalid', async () => {
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: 'auth_token=invalid.jwt.token' },
    });
    const result = await requireAuth(request, env);

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });

  it('returns email when JWT is valid', async () => {
    const email = 'test@example.com';
    const jwt = await generateJWT(env, email);

    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const result = await requireAuth(request, env);

    expect(result).toBe(email);
  });

  it('parses auth_token from multiple cookies', async () => {
    const email = 'test@example.com';
    const jwt = await generateJWT(env, email);

    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `other=value; auth_token=${jwt}; another=data` },
    });
    const result = await requireAuth(request, env);

    expect(result).toBe(email);
  });
});

describe('Auth Cookie Creation', () => {
  it('creates cookie with correct attributes', () => {
    const jwt = 'test.jwt.token';
    const cookie = createAuthCookie(jwt);

    expect(cookie).toContain('auth_token=test.jwt.token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=604800'); // 7 days
    expect(cookie).toContain('Path=/admin');
  });
});

describe('Email Validation', () => {
  it('accepts valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
    expect(isValidEmail('first.last@sub.domain.com')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('no-at-sign.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('Admin Email Check', () => {
  it('returns true for admin email (case-insensitive)', () => {
    const env = createMockEnv({ ADMIN_EMAIL: 'magnus.hultberg@gmail.com' });

    expect(isAdminEmail(env, 'magnus.hultberg@gmail.com')).toBe(true);
    expect(isAdminEmail(env, 'Magnus.Hultberg@gmail.com')).toBe(true);
    expect(isAdminEmail(env, 'MAGNUS.HULTBERG@GMAIL.COM')).toBe(true);
  });

  it('returns false for non-admin email', () => {
    const env = createMockEnv({ ADMIN_EMAIL: 'magnus.hultberg@gmail.com' });

    expect(isAdminEmail(env, 'other@example.com')).toBe(false);
    expect(isAdminEmail(env, 'magnus@otherdomain.com')).toBe(false);
  });

  it('returns false when ADMIN_EMAIL not configured', () => {
    const env = createMockEnv({ ADMIN_EMAIL: undefined });

    expect(isAdminEmail(env, 'anyone@example.com')).toBe(false);
  });
});

describe('Rate Limiting', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('allows first request', async () => {
    const isLimited = await checkRateLimit(env, '192.168.1.1');
    expect(isLimited).toBe(false);
  });

  it('allows requests under limit', async () => {
    const ip = '192.168.1.2';

    for (let i = 0; i < 9; i++) {
      const isLimited = await checkRateLimit(env, ip);
      expect(isLimited).toBe(false);
    }
  });

  it('blocks requests at limit (10th request)', async () => {
    const ip = '192.168.1.3';

    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(env, ip);
    }

    // 11th request should be blocked
    const isLimited = await checkRateLimit(env, ip);
    expect(isLimited).toBe(true);
  });

  it('tracks different IPs separately', async () => {
    const ip1 = '192.168.1.4';
    const ip2 = '192.168.1.5';

    // Exhaust limit for ip1
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(env, ip1);
    }

    // ip1 should be blocked
    expect(await checkRateLimit(env, ip1)).toBe(true);

    // ip2 should still be allowed
    expect(await checkRateLimit(env, ip2)).toBe(false);
  });

  it('allows requests when RATE_LIMIT_KV not configured', async () => {
    const envWithoutKV = createMockEnv({ RATE_LIMIT_KV: undefined });

    const isLimited = await checkRateLimit(envWithoutKV, '192.168.1.6');
    expect(isLimited).toBe(false);
  });
});
