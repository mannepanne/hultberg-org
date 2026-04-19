// ABOUT: Integration tests for POST /admin/api/gsc-manual-check-clicked.
// ABOUT: Covers auth, Origin check, and KV write of the last-clicked timestamp.

import { describe, it, expect, beforeEach } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';

describe('POST /admin/api/gsc-manual-check-clicked', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv({
      ADMIN_EMAIL: 'magnus@example.com',
    });
    mockCtx = createMockContext();
  });

  async function authedRequest(overrides: RequestInit = {}) {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    return new Request('http://localhost/admin/api/gsc-manual-check-clicked', {
      method: 'POST',
      headers: {
        Cookie: `auth_token=${jwt}`,
        Origin: 'http://localhost',
        ...(overrides.headers as Record<string, string> ?? {}),
      },
      ...overrides,
    });
  }

  it('redirects unauthenticated requests', async () => {
    const request = new Request('http://localhost/admin/api/gsc-manual-check-clicked', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect([302, 401]).toContain(response.status);
  });

  it('rejects cross-origin requests', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/gsc-manual-check-clicked', {
      method: 'POST',
      headers: {
        Cookie: `auth_token=${jwt}`,
        Origin: 'http://evil.example.com',
      },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(403);
  });

  it('rejects missing Origin header', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/api/gsc-manual-check-clicked', {
      method: 'POST',
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(403);
  });

  it('writes manual-check:lastClicked to KV with the current ISO timestamp', async () => {
    const before = Date.now();
    const response = await worker.fetch(await authedRequest(), mockEnv, mockCtx);
    const after = Date.now();

    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    const written = await mockEnv.GSC_KV.get('manual-check:lastClicked');
    expect(written).not.toBeNull();
    const parsed = new Date(written!).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it('overwrites an existing value on subsequent clicks', async () => {
    await mockEnv.GSC_KV.put('manual-check:lastClicked', '2026-01-01T00:00:00Z');
    const response = await worker.fetch(await authedRequest(), mockEnv, mockCtx);
    expect(response.status).toBe(200);

    const written = await mockEnv.GSC_KV.get('manual-check:lastClicked');
    expect(written).not.toBe('2026-01-01T00:00:00Z');
  });

  it('returns 500 when GSC_KV is not bound', async () => {
    const bareEnv = createMockEnv({
      ADMIN_EMAIL: 'magnus@example.com',
      GSC_KV: undefined,
    });
    const response = await worker.fetch(await authedRequest(), bareEnv, mockCtx);
    expect(response.status).toBe(500);
  });
});
