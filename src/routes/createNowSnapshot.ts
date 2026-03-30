// ABOUT: API endpoint for creating /now page snapshots
// ABOUT: POST /admin/api/create-now-snapshot - validates, applies rate limiting, commits to GitHub

import type { Env, NowSnapshot } from '@/types';
import { requireAuth, checkRateLimit } from '@/auth';
import { saveNowSnapshot } from '@/github';

const MAX_CONTENT_BYTES = 100 * 1024; // 100KB

/**
 * Handle POST /admin/api/create-now-snapshot
 * Creates a snapshot of /now page content in GitHub (public/now/snapshots/)
 * Applies rate limiting and validation
 */
export async function handleCreateNowSnapshot(request: Request, env: Env): Promise<Response> {
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

    // Generate date string (YYYYMMDD format for today)
    const now = new Date();
    const date = now.toISOString().substring(0, 10).replace(/-/g, '');

    // Prepare snapshot
    const snapshot: NowSnapshot = {
      markdown,
      snapshotDate: now.toISOString(),
    };

    // Save to GitHub
    const result = await saveNowSnapshot(env, date, snapshot);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error ?? 'Failed to save snapshot' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      date,
      overwritten: result.overwritten
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleCreateNowSnapshot:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
