// ABOUT: API endpoint for listing all updates (drafts + published)
// ABOUT: GET /admin/api/updates - returns all update metadata for the admin dashboard

import type { Env } from '@/types';
import { requireAuth } from '@/auth';
import { fetchAllUpdates } from '@/github';

/**
 * Handle GET /admin/api/updates
 * Returns all updates (draft + published) sorted by editedDate descending
 * Authentication required
 */
export async function handleListUpdates(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  try {
    const updates = await fetchAllUpdates(env);

    return new Response(JSON.stringify({ updates }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching updates:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch updates' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
