// ABOUT: Integration tests for the admin update editor
// ABOUT: GET /admin/updates/new and GET /admin/updates/:slug/edit

import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';
import { generateJWT } from '@/auth';
import type { Env } from '@/types';
import type { Update } from '@/types';

const GITHUB_UPDATES_BASE = 'https://api.github.com/repos/mannepanne/hultberg-org/contents/public/updates/data';
const GITHUB_IMAGES_BASE = 'https://api.github.com/repos/mannepanne/hultberg-org/contents/public/images/updates';

function makeExistingUpdateContent(update: Update): string {
  return btoa(JSON.stringify(update));
}

describe('GET /admin/updates/new', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('redirects to login when not authenticated', async () => {
    const request = new Request('http://localhost/admin/updates/new');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin');
  });

  it('returns 200 with editor HTML when authenticated', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/new', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('renders empty form for new update', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/new', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('New Update');
    expect(html).toContain('id="title"');
    expect(html).toContain('id="content"');
    expect(html).toContain('id="status"');
  });

  it('includes EasyMDE editor script', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/new', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('easymde');
    expect(html).toContain('cdn.jsdelivr.net');
  });

  it('shows "save first" message for image section on new updates', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/new', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('images-disabled');
    expect(html.toLowerCase()).toContain('save');
  });

  it('includes saveUpdate function for AJAX save', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/new', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('saveUpdate');
    expect(html).toContain('/admin/api/save-update');
  });

  it('sets Content-Security-Policy header including cdn.jsdelivr.net', async () => {
    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/new', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    const csp = response.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain('cdn.jsdelivr.net');
  });
});

describe('GET /admin/updates/:slug/edit', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
    vi.restoreAllMocks();
  });

  it('redirects to login when not authenticated', async () => {
    const request = new Request('http://localhost/admin/updates/my-update/edit');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin');
  });

  it('redirects to dashboard when update is not found', async () => {
    global.fetch = vi.fn(async () => new Response('Not Found', { status: 404 }));

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/nonexistent/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin/dashboard');
  });

  it('returns 200 with pre-filled editor for existing update', async () => {
    const existingUpdate: Update = {
      slug: 'my-update',
      title: 'My Existing Update',
      excerpt: 'A test update',
      content: '# Hello World\n\nThis is content.',
      status: 'published',
      publishedDate: '2026-01-15T10:00:00Z',
      editedDate: '2026-01-15T10:00:00Z',
      author: 'Magnus Hultberg',
      images: [],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes(`${GITHUB_UPDATES_BASE}/my-update.json`) && method === 'GET') {
        return new Response(JSON.stringify({
          sha: 'update-sha',
          content: makeExistingUpdateContent(existingUpdate),
        }), { status: 200 });
      }
      // fetchImages → no images
      if (url.includes(`${GITHUB_IMAGES_BASE}/my-update`) && method === 'GET') {
        return new Response('Not Found', { status: 404 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/my-update/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('My Existing Update');
    expect(html).toContain('A test update');
  });

  it('pre-selects the correct status option', async () => {
    const draftUpdate: Update = {
      slug: 'draft-post', title: 'Draft Post', excerpt: '', content: '# Draft',
      status: 'draft', publishedDate: '', editedDate: '2026-01-01T00:00:00Z',
      author: 'Magnus Hultberg', images: [],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('draft-post.json') && method === 'GET') {
        return new Response(JSON.stringify({
          sha: 'sha', content: makeExistingUpdateContent(draftUpdate),
        }), { status: 200 });
      }
      if (url.includes(`${GITHUB_IMAGES_BASE}/draft-post`) && method === 'GET') {
        return new Response('Not Found', { status: 404 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/draft-post/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('value="draft" selected');
  });

  it('renders image gallery when update has images', async () => {
    const updateWithImages: Update = {
      slug: 'photo-post', title: 'Photo Post', excerpt: '', content: '# Photos',
      status: 'published', publishedDate: '2026-01-20T00:00:00Z',
      editedDate: '2026-01-20T00:00:00Z', author: 'Magnus Hultberg', images: [],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('photo-post.json') && method === 'GET') {
        return new Response(JSON.stringify({
          sha: 'sha', content: makeExistingUpdateContent(updateWithImages),
        }), { status: 200 });
      }
      if (url.includes(`${GITHUB_IMAGES_BASE}/photo-post`) && method === 'GET') {
        return new Response(JSON.stringify([
          { name: 'sunset.jpg', type: 'file', download_url: 'https://raw.github.com/sunset.jpg', url: 'https://api.github.com/img1', sha: 'img-sha' },
        ]), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/photo-post/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('sunset.jpg');
    expect(html).toContain('/images/updates/photo-post/sunset.jpg');
  });

  it('shows preview link for existing update', async () => {
    const existingUpdate: Update = {
      slug: 'linkable-post', title: 'Linkable Post', excerpt: '', content: '# Post',
      status: 'published', publishedDate: '2026-01-01T00:00:00Z',
      editedDate: '2026-01-01T00:00:00Z', author: 'Magnus Hultberg', images: [],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.includes('linkable-post.json') && method === 'GET') {
        return new Response(JSON.stringify({
          sha: 'sha', content: makeExistingUpdateContent(existingUpdate),
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const jwt = await generateJWT(mockEnv, 'test@example.com');
    const request = new Request('http://localhost/admin/updates/linkable-post/edit', {
      headers: { Cookie: `auth_token=${jwt}` },
    });
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('/admin/preview/linkable-post');
  });
});
