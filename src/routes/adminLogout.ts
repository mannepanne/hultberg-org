// ABOUT: Route handler for POST /admin/logout
// ABOUT: Clears the auth cookie and redirects to the login page

/**
 * Handle POST /admin/logout
 * Clears the auth_token cookie and redirects to /admin login page
 */
const ALLOWED_ORIGIN = 'https://hultberg.org';

export function handleAdminLogout(request: Request): Response {
  const origin = request.headers.get('Origin');
  if (origin !== ALLOWED_ORIGIN) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': new URL('/admin', request.url).toString(),
      'Set-Cookie': 'auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/admin',
    },
  });
}
