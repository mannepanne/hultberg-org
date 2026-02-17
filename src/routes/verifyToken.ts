// ABOUT: API endpoint for verifying magic link tokens
// ABOUT: GET /admin/api/verify-token?token=xxx - verifies token and sets auth cookie

import type { Env } from '@/types';
import { verifyMagicLinkToken, generateJWT, createAuthCookie } from '@/auth';

/**
 * Handle GET /admin/api/verify-token
 * Verifies magic link token and sets authentication cookie
 * Redirects to admin dashboard on success, login page on failure
 */
export async function handleVerifyToken(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      // No token provided, redirect to login with error
      return Response.redirect(`${url.origin}/admin?error=invalid-link`, 302);
    }

    // Verify and consume the magic link token
    const email = await verifyMagicLinkToken(env, token);

    if (!email) {
      // Invalid or expired token
      return Response.redirect(`${url.origin}/admin?error=link-expired`, 302);
    }

    // Generate JWT for session
    const jwt = await generateJWT(env, email);

    // Create Set-Cookie header
    const cookieHeader = createAuthCookie(jwt);

    // Redirect to admin dashboard (which we'll build in Phase 4)
    // For now, redirect to a placeholder
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin/dashboard',
        'Set-Cookie': cookieHeader,
      },
    });
  } catch (error) {
    console.error('Error in handleVerifyToken:', error);
    return Response.redirect(new URL('/admin?error=server-error', request.url).toString(), 302);
  }
}
