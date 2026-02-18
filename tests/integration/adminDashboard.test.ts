// ABOUT: Integration tests for the admin dashboard page
// ABOUT: Tests authenticated rendering, updates list, empty state, and logout

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';
import type { Update } from '@/types';

const MOCK_UPDATE: Update = {
  slug: 'test-update',
  title: 'Test Update',
  excerpt: 'Test excerpt',
  content: '# Test\n\nContent here.',
  status: 'published',
  publishedDate: '2026-02-16T10:00:00Z',
  editedDate: '2026-02-16T10:00:00Z',
  author: 'Magnus Hultberg',
  images: [],
};

const DRAFT_UPDATE: Update = {
  ...MOCK_UPDATE,
  slug: 'draft-update',
  title: 'Draft Update',
  status: 'draft',
  publishedDate: '',
};

function mockGitHubForDashboard(updates: Update[]) {
  global.fetch = vi.fn(async (input: RequestInfo | URL | string) => {
    const url = typeof input === 'string' ? input : input.toString();

    // GitHub directory listing
    if (url.includes('api.github.com') && url.includes('public/updates/data')) {
      const files = updates.map(u => ({
        name: `${u.slug}.json`,
        type: 'file',
        download_url: `https://raw.githubusercontent.com/test/${u.slug}.json`,
        url: `https://api.github.com/test/${u.slug}.json`,
        sha: 'abc123',
      }));
      return new Response(JSON.stringify(files), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Raw file content for each update
    for (const update of updates) {
      if (url.includes(`${update.slug}.json`)) {
        return new Response(JSON.stringify(update), { status: 200 });
      }
    }

    return new Response('Not Found', { status: 404 });
  });
}

describe('GET /admin/dashboard', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('redirects to login when not authenticated', async () => {
    mockGitHubForDashboard([]);
    const request = new Request('http://localhost/admin/dashboard');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin');
  });

  it('returns 200 with dashboard when authenticated', async () => {
    mockGitHubForDashboard([]);
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('shows the authenticated email in the header', async () => {
    const email = 'test@example.com';
    mockGitHubForDashboard([]);
    const jwt = await generateJWT(mockEnv, email);
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain(email);
  });

  it('shows empty state when no updates exist', async () => {
    mockGitHubForDashboard([]);
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('No updates yet');
  });

  it('displays all updates including drafts', async () => {
    mockGitHubForDashboard([MOCK_UPDATE, DRAFT_UPDATE]);
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('Test Update');
    expect(html).toContain('Draft Update');
    expect(html).toContain('published');
    expect(html).toContain('draft');
  });

  it('shows logout button', async () => {
    mockGitHubForDashboard([]);
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('Logout');
    expect(html).toContain('/admin/logout');
  });

  it('includes CSP headers', async () => {
    mockGitHubForDashboard([]);
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('escapes HTML special characters in update title', async () => {
    const xssUpdate = { ...MOCK_UPDATE, title: '<script>alert(1)</script>' };
    mockGitHubForDashboard([xssUpdate]);
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows empty state when GitHub token is not configured', async () => {
    const envWithoutToken = createMockEnv({ GITHUB_TOKEN: undefined });
    const jwt = await generateJWT(envWithoutToken, 'test@example.com');
    const request = new Request('http://localhost/admin/dashboard', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, envWithoutToken, mockCtx);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('No updates yet');
  });
});

describe('POST /admin/logout', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('redirects to /admin', async () => {
    const request = new Request('http://localhost/admin/logout', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin');
  });

  it('clears the auth_token cookie', async () => {
    const request = new Request('http://localhost/admin/logout', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toContain('auth_token=');
    expect(setCookie).toContain('Max-Age=0');
  });

  it('returns 403 when Origin header is missing', async () => {
    const request = new Request('http://localhost/admin/logout', { method: 'POST' });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });

  it('returns 403 when Origin header is wrong', async () => {
    const request = new Request('http://localhost/admin/logout', {
      method: 'POST',
      headers: { Origin: 'https://evil.com' },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(403);
  });
});
