// ABOUT: Route handler for POST /admin/logout
// ABOUT: Clears the auth cookie and redirects to the login page

/**
 * Handle POST /admin/logout
 * Clears the auth_token cookie and redirects to /admin login page
 */
export function handleAdminLogout(request: Request): Response {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': new URL('/admin', request.url).toString(),
      'Set-Cookie': 'auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/admin',
    },
  });
}
