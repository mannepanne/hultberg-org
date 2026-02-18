// ABOUT: API endpoint for deleting an update and its associated images
// ABOUT: DELETE /admin/api/delete-update - removes JSON file and images from GitHub

import type { Env } from '@/types';
import { requireAuth } from '@/auth';
import { deleteUpdateFile, deleteImagesDirectory } from '@/github';

/**
 * Handle DELETE /admin/api/delete-update
 * Deletes the update JSON file and associated images directory from GitHub
 * Authentication required
 */
export async function handleDeleteUpdate(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json() as { slug?: string };
    const slug = body.slug?.trim();

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'slug is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate slug format to prevent path traversal
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return new Response(
        JSON.stringify({ error: 'Invalid slug format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete the update JSON file
    const deleteResult = await deleteUpdateFile(env, slug);
    if (!deleteResult.success) {
      return new Response(
        JSON.stringify({ error: deleteResult.error }),
        { status: deleteResult.error === 'Update not found' ? 404 : 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete associated images (cascade delete, best-effort)
    await deleteImagesDirectory(env, slug);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting update:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
