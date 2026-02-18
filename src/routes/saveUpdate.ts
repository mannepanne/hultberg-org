// ABOUT: API endpoint for creating and editing updates
// ABOUT: POST /admin/api/save-update - validates, generates slug if new, commits to GitHub

import type { Env } from '@/types';
import type { UpdateStatus } from '@/types';
import { requireAuth } from '@/auth';
import { fetchAllUpdates, fetchUpdateBySlug, saveUpdateFile } from '@/github';
import { generateSlugFromTitle } from '@/utils';

const MAX_CONTENT_BYTES = 100 * 1024; // 100KB
const VALID_STATUSES: UpdateStatus[] = ['draft', 'published', 'unpublished'];

/**
 * Handle POST /admin/api/save-update
 * Creates a new update or overwrites an existing one in GitHub.
 * Slug is generated server-side for new updates and is immutable after creation.
 */
export async function handleSaveUpdate(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json() as {
      slug?: string;
      title?: string;
      excerpt?: string;
      content?: string;
      status?: string;
    };

    // Validate required fields
    const title = body.title?.trim();
    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (title.length > 200) {
      return new Response(JSON.stringify({ error: 'Title must be 200 characters or fewer' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const content = body.content ?? '';
    const excerpt = body.excerpt?.trim() ?? '';
    if (excerpt.length > 300) {
      return new Response(JSON.stringify({ error: 'Excerpt must be 300 characters or fewer' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const status = body.status as UpdateStatus;

    if (!VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Validate content size before GitHub API call
    const contentBytes = new TextEncoder().encode(content).length;
    if (contentBytes > MAX_CONTENT_BYTES) {
      return new Response(JSON.stringify({ error: `Content exceeds maximum size of 100KB` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const now = new Date().toISOString();
    let slug = body.slug?.trim();
    let publishedDate = '';
    let existingImages: string[] = [];
    let isNew = false;

    if (!slug) {
      // New update: generate slug from title
      isNew = true;
      const existing = await fetchAllUpdates(env);
      const existingSlugs = existing.map(u => u.slug);
      slug = generateSlugFromTitle(title, existingSlugs);
      publishedDate = status === 'published' ? now : '';
    } else {
      // Existing update: validate slug format and preserve publishedDate and images
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return new Response(JSON.stringify({ error: 'Invalid slug format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // Fetch existing to preserve publishedDate (only set once, when first published)
      // and images (managed separately via upload/delete endpoints)
      const existing = await fetchUpdateBySlug(env, slug);
      if (existing?.publishedDate) {
        publishedDate = existing.publishedDate;
      } else if (status === 'published') {
        publishedDate = now;
      }
      existingImages = existing?.images ?? [];
    }

    const update = {
      slug,
      title,
      excerpt,
      content,
      status,
      publishedDate,
      editedDate: now,
      author: 'Magnus Hultberg',
      images: existingImages,
    };

    const result = await saveUpdateFile(env, slug, update);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error ?? 'Failed to save' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, slug, isNew }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in handleSaveUpdate:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
