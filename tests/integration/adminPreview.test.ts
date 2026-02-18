// ABOUT: Integration tests for GET /admin/preview/:slug
// ABOUT: Tests authentication, GitHub fetch, and HTML rendering including drafts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';
import type { Update } from '@/types';

const GITHUB_UPDATES_BASE = 'https://api.github.com/repos/mannepanne/hultberg-org/contents/public/updates/data';

function makeExistingUpdateContent(update: Update): string {
  return btoa(JSON.stringify(update));
}

describe('GET /admin/preview/:slug', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('redirects to login when not authenticated', async () => {
    const request = new Request('http://localhost/admin/preview/my-update');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin');
  });

  it('redirects to dashboard when update is not found', async () => {
    global.fetch = vi.fn(async () => new Response('Not Found', { status: 404 }));

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/preview/nonexistent', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin/dashboard');
  });

  it('renders published update as HTML', async () => {
    const update: Update = {
      slug: 'published-post',
      title: 'My Published Post',
      excerpt: 'A published update for preview',
      content: '# Published\n\nThis is the **content**.',
      status: 'published',
      publishedDate: '2026-02-01T12:00:00Z',
      editedDate: '2026-02-01T12:00:00Z',
      author: 'Magnus Hultberg',
      images: [],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('published-post.json') && method === 'GET') {
        return new Response(JSON.stringify({
          sha: 'sha', content: makeExistingUpdateContent(update),
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/preview/published-post', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('My Published Post');
    expect(html).toContain('Magnus Hultberg');
  });

  it('renders draft update — admin can preview drafts', async () => {
    const draftUpdate: Update = {
      slug: 'draft-post',
      title: 'My Draft Post',
      excerpt: 'Still in progress',
      content: '# Draft\n\nWork in progress.',
      status: 'draft',
      publishedDate: '',
      editedDate: '2026-02-10T08:00:00Z',
      author: 'Magnus Hultberg',
      images: [],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('draft-post.json') && method === 'GET') {
        return new Response(JSON.stringify({
          sha: 'sha', content: makeExistingUpdateContent(draftUpdate),
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/preview/draft-post', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    // Admins should be able to preview drafts (unlike the public route which returns 404)
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('My Draft Post');
  });

  it('renders markdown content to HTML', async () => {
    const update: Update = {
      slug: 'markdown-post',
      title: 'Markdown Post',
      excerpt: '',
      content: '# Heading\n\nThis is **bold** and _italic_.',
      status: 'published',
      publishedDate: '2026-02-05T10:00:00Z',
      editedDate: '2026-02-05T10:00:00Z',
      author: 'Magnus Hultberg',
      images: [],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('markdown-post.json') && method === 'GET') {
        return new Response(JSON.stringify({
          sha: 'sha', content: makeExistingUpdateContent(update),
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/preview/markdown-post', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<h1');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders unpublished update — admin can preview unpublished content', async () => {
    const unpublishedUpdate: Update = {
      slug: 'hidden-post',
      title: 'Hidden Post',
      excerpt: 'Once published, now hidden',
      content: '# Hidden',
      status: 'unpublished',
      publishedDate: '2026-01-01T00:00:00Z',
      editedDate: '2026-01-15T00:00:00Z',
      author: 'Magnus Hultberg',
      images: [],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('hidden-post.json') && method === 'GET') {
        return new Response(JSON.stringify({
          sha: 'sha', content: makeExistingUpdateContent(unpublishedUpdate),
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/preview/hidden-post', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Hidden Post');
  });

  it('returns 500 when GitHub token is not configured', async () => {
    const envWithoutToken = createMockEnv({ GITHUB_TOKEN: undefined });
    const jwt = await generateJWT(envWithoutToken, 'test@example.com');
    const request = new Request('http://localhost/admin/preview/any-post', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, envWithoutToken, mockCtx);

    // fetchUpdateBySlug returns null when no token → redirect to dashboard
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin/dashboard');
  });
});
