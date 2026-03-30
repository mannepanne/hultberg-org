// ABOUT: API endpoint for listing /now page snapshots
// ABOUT: GET /admin/api/list-now-snapshots - returns list of all snapshots

import type { Env } from '@/types';
import { requireAuth, checkRateLimit } from '@/auth';
import { listNowSnapshots } from '@/github';

/**
 * Handle GET /admin/api/list-now-snapshots
 * Returns list of all /now page snapshots sorted by date (newest first)
 * Applies rate limiting and authentication
 */
export async function handleListNowSnapshots(request: Request, env: Env): Promise<Response> {
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
    const index = await listNowSnapshots(env);

    return new Response(JSON.stringify(index), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleListNowSnapshots:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
