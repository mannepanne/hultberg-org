// ABOUT: API endpoint for deleting /now page snapshots
// ABOUT: DELETE /admin/api/delete-now-snapshot - validates, applies rate limiting, deletes from GitHub

import type { Env } from '@/types';
import { requireAuth, checkRateLimit } from '@/auth';
import { deleteNowSnapshot } from '@/github';

/**
 * Handle DELETE /admin/api/delete-now-snapshot?date=YYYYMMDD
 * Deletes a snapshot from GitHub (public/now/snapshots/)
 * Applies rate limiting and validation
 */
export async function handleDeleteNowSnapshot(request: Request, env: Env): Promise<Response> {
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
    // Get date from query parameter
    const url = new URL(request.url);
    const date = url.searchParams.get('date');

    if (!date) {
      return new Response(JSON.stringify({ error: 'Date parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate date format (YYYYMMDD)
    if (!/^\d{8}$/.test(date)) {
      return new Response(JSON.stringify({ error: 'Invalid date format. Expected YYYYMMDD' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete from GitHub
    const result = await deleteNowSnapshot(env, date);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error ?? 'Failed to delete snapshot' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleDeleteNowSnapshot:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
