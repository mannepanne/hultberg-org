// ABOUT: Route handler for previewing updates in the admin
// ABOUT: GET /admin/preview/:slug - renders draft or published update, authentication required

import type { Env } from '@/types';
import { requireAuth } from '@/auth';
import { fetchUpdateBySlug } from '@/github';
import { renderUpdatePage } from '@/routes/updatePage';

/**
 * Handle GET /admin/preview/:slug
 * Renders the update exactly as the public page would, but authentication is required.
 * Works for drafts as well as published updates.
 */
export async function handleAdminPreview(request: Request, env: Env, slug: string): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return Response.redirect(new URL('/admin', request.url).toString(), 302);
  }

  const update = await fetchUpdateBySlug(env, slug);
  if (!update) {
    return Response.redirect(new URL('/admin/dashboard', request.url).toString(), 302);
  }

  return renderUpdatePage(update);
}
