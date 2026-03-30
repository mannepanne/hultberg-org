// ABOUT: API endpoint for saving /now page content
// ABOUT: POST /admin/api/save-now - validates, applies rate limiting, commits to GitHub

import type { Env, NowContent } from '@/types';
import { requireAuth, checkRateLimit } from '@/auth';
import { saveNowContent } from '@/github';

const MAX_CONTENT_BYTES = 100 * 1024; // 100KB

/**
 * Handle POST /admin/api/save-now
 * Updates /now page content in GitHub (public/now/data/content.json)
 * Applies rate limiting and validation
 */
export async function handleSaveNow(request: Request, env: Env): Promise<Response> {
  // CSRF protection
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Authentication
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const rateLimited = await checkRateLimit(env, clientIP);
  if (rateLimited) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json() as {
      markdown?: string;
    };

    // Validate markdown content
    const markdown = body.markdown?.trim();
    if (!markdown) {
      return new Response(JSON.stringify({ error: 'Content cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate content size
    const contentBytes = new TextEncoder().encode(markdown).length;
    if (contentBytes > MAX_CONTENT_BYTES) {
      return new Response(JSON.stringify({ error: 'Content exceeds maximum size of 100KB' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare content with updated timestamp
    const now = new Date().toISOString();
    const content: NowContent = {
      markdown,
      lastUpdated: now,
    };

    // Save to GitHub
    const result = await saveNowContent(env, content);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error ?? 'Failed to save' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleSaveNow:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
