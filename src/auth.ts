// ABOUT: Authentication utilities for admin access
// ABOUT: Magic link generation, JWT handling, and authentication middleware

import type { Env } from './types';

// TTL and timing constants
const MAGIC_LINK_TTL_SECONDS = 900; // 15 minutes
const TOKEN_PROPAGATION_TTL_SECONDS = 60; // Keep used tokens to prevent reuse during KV propagation
const TOKEN_REUSE_PROTECTION_MS = 5000; // Reject tokens used within this window (ms) - see TD-002

const JWT_EXPIRY_SECONDS = 604800; // 7 days

const RATE_LIMIT_MAX_REQUESTS = 10; // Requests per window
const RATE_LIMIT_WINDOW_SECONDS = 60; // Rate limit window in seconds

/**
 * Encode a string as Base64URL (RFC 4648 §5)
 * Uses '-' and '_' instead of '+' and '/', with no padding
 * Required for JWT compliance
 */
function base64UrlEncode(data: string): string {
  return btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode a Base64URL string (RFC 4648 §5)
 * Re-adds padding before passing to atob
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Generate a cryptographically secure magic link token
 * Returns a random UUID v4
 */
export function generateMagicLinkToken(): string {
  return crypto.randomUUID();
}

/**
 * Store magic link token in KV with 15-minute TTL
 * Token format: auth:token:{token} → { email, timestamp, used }
 */
export async function storeMagicLinkToken(
  env: Env,
  token: string,
  email: string
): Promise<void> {
  if (!env.AUTH_KV) {
    throw new Error('AUTH_KV namespace not configured');
  }

  const tokenData = {
    email,
    timestamp: Date.now(),
    used: false,
  };

  await env.AUTH_KV.put(
    `auth:token:${token}`,
    JSON.stringify(tokenData),
    { expirationTtl: MAGIC_LINK_TTL_SECONDS }
  );
}

/**
 * Verify and consume a magic link token
 * Returns email if valid, null if invalid/expired/used
 * Marks token as used to prevent reuse, per security spec:
 * - Rejects if already marked used
 * - Rejects if token was created/updated within TOKEN_REUSE_PROTECTION_MS
 *   (defends against KV propagation delay allowing double-use)
 */
export async function verifyMagicLinkToken(
  env: Env,
  token: string
): Promise<string | null> {
  if (!env.AUTH_KV) {
    throw new Error('AUTH_KV namespace not configured');
  }

  const key = `auth:token:${token}`;
  const data = await env.AUTH_KV.get(key);

  if (!data) {
    return null; // Token not found or expired
  }

  const tokenData = JSON.parse(data);

  // Reject if already used OR if created/updated very recently (prevents reuse during KV propagation)
  const timeSinceTimestamp = Date.now() - tokenData.timestamp;
  if (tokenData.used || timeSinceTimestamp < TOKEN_REUSE_PROTECTION_MS) {
    return null;
  }

  // Mark as used and update with short TTL to prevent reuse during propagation
  await env.AUTH_KV.put(
    key,
    JSON.stringify({ ...tokenData, used: true, timestamp: Date.now() }),
    { expirationTtl: TOKEN_PROPAGATION_TTL_SECONDS }
  );

  return tokenData.email;
}

/**
 * Generate a JWT for authenticated sessions
 * Uses HS256 algorithm with JWT_SECRET, Base64URL encoded per RFC 7519
 * Token contains: email, issued timestamp, expiry (7 days)
 */
export async function generateJWT(env: Env, email: string): Promise<string> {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    email,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Create signature using Web Crypto API
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(unsignedToken)
  );

  const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Verify a JWT and return the email if valid
 * Returns null if invalid, expired, or malformed
 */
export async function verifyJWT(env: Env, token: string): Promise<string | null> {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Verify signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Uint8Array.from(base64UrlDecode(encodedSignature), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(unsignedToken)
    );

    if (!isValid) {
      return null;
    }

    // Decode and check payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) {
      return null; // Token expired
    }

    return payload.email;
  } catch (error) {
    return null; // Malformed token
  }
}

/**
 * Authentication middleware
 * Checks for valid JWT in cookie, returns email if authenticated
 * Returns 401 Response if not authenticated
 */
export async function requireAuth(request: Request, env: Env): Promise<string | Response> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Parse cookies (simple parsing, assumes no special characters in values)
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...values] = c.trim().split('=');
      return [key, values.join('=')];
    })
  );

  const authToken = cookies['auth_token'];
  if (!authToken) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const email = await verifyJWT(env, authToken);
  if (!email) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return email;
}

/**
 * Create Set-Cookie header for authentication token
 * Secure, HttpOnly, SameSite=Strict, 7-day expiry, /admin path only
 */
export function createAuthCookie(jwt: string): string {
  return `auth_token=${jwt}; HttpOnly; Secure; SameSite=Strict; Max-Age=${JWT_EXPIRY_SECONDS}; Path=/admin`;
}

/**
 * Validate email format
 * Basic validation - checks for @, domain, and reasonable structure
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email matches admin email (case-insensitive)
 * Returns false if ADMIN_EMAIL not configured
 */
export function isAdminEmail(env: Env, email: string): boolean {
  if (!env.ADMIN_EMAIL) {
    return false;
  }
  return email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
}

/**
 * Rate limiting check
 * Returns true if rate limit exceeded, false otherwise
 * Limit: RATE_LIMIT_MAX_REQUESTS requests per RATE_LIMIT_WINDOW_SECONDS per IP
 * Note: get-increment-put is not atomic; see TD-002 for known limitation
 */
export async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  if (!env.RATE_LIMIT_KV) {
    // If rate limiting not configured, allow request
    return false;
  }

  const key = `ratelimit:ip:${ip}`;
  const data = await env.RATE_LIMIT_KV.get(key);

  if (!data) {
    // First request, initialize counter
    await env.RATE_LIMIT_KV.put(key, '1', { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
    return false;
  }

  const count = parseInt(data, 10);
  if (count >= RATE_LIMIT_MAX_REQUESTS) {
    return true; // Rate limit exceeded
  }

  // Increment counter
  await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return false;
}
