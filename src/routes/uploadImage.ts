// ABOUT: API endpoint for uploading images to updates
// ABOUT: POST /admin/api/upload-image - validates, stores image in GitHub, returns public path

import type { Env } from '@/types';
import { requireAuth } from '@/auth';
import { uploadImageFile } from '@/github';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB (post-resize, should be well under this)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const FILENAME_PATTERN = /^[a-z0-9._-]+$/i;

/**
 * Handle POST /admin/api/upload-image
 * Receives multipart/form-data with 'slug' and 'image' fields.
 * Uploads the image to GitHub at public/images/updates/{slug}/{filename}.
 * Returns the public path to the uploaded image.
 */
export async function handleUploadImage(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  try {
    const formData = await request.formData();
    const slug = (formData.get('slug') as string | null)?.trim();
    const imageFile = formData.get('image') as File | null;

    if (!slug || !SLUG_PATTERN.test(slug)) {
      return new Response(JSON.stringify({ error: 'Valid slug is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!imageFile || !(imageFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Image file is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
      return new Response(JSON.stringify({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const imageBytes = new Uint8Array(await imageFile.arrayBuffer());

    if (imageBytes.length > MAX_IMAGE_BYTES) {
      return new Response(JSON.stringify({ error: 'Image exceeds maximum size of 5MB' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Sanitise filename: lowercase, replace spaces, keep only safe characters
    const rawName = imageFile.name.replace(/\s+/g, '-').toLowerCase();
    const filename = rawName.replace(/[^a-z0-9._-]/g, '');
    if (!filename || !FILENAME_PATTERN.test(filename)) {
      return new Response(JSON.stringify({ error: 'Invalid filename' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await uploadImageFile(env, slug, filename, imageBytes);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error ?? 'Upload failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, path: result.path }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in handleUploadImage:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
