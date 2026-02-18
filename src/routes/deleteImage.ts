// ABOUT: API endpoint for deleting individual images from updates
// ABOUT: DELETE /admin/api/delete-image - removes a single image from GitHub

import type { Env } from '@/types';
import { requireAuth } from '@/auth';
import { deleteImageFile } from '@/github';

/**
 * Handle DELETE /admin/api/delete-image
 * Deletes a single image file from GitHub for a given update slug.
 * Body: { slug: string, filename: string }
 */
export async function handleDeleteImage(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json() as { slug?: string; filename?: string };
    const slug = body.slug?.trim();
    const filename = body.filename?.trim();

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return new Response(JSON.stringify({ error: 'Valid slug is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!filename || !/^[a-z0-9._-]+$/i.test(filename)) {
      return new Response(JSON.stringify({ error: 'Valid filename is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await deleteImageFile(env, slug, filename);
    if (!result.success) {
      const status = result.error === 'Image not found' ? 404 : 500;
      return new Response(JSON.stringify({ error: result.error }), { status, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in handleDeleteImage:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
