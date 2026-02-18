// ABOUT: Endpoints for verifying magic link tokens
// ABOUT: GET shows a confirmation page; POST consumes the token and sets the auth cookie

import type { Env } from '@/types';
import { peekMagicLinkToken, verifyMagicLinkToken, generateJWT, createAuthCookie } from '@/auth';

const CSP = "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self';";
const ALLOWED_ORIGIN = 'https://hultberg.org';

function renderConfirmPage(token: string): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Log In - hultberg.org</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f8f9fa; color: #333;
    }
    .card {
      background: #fff; border-radius: 8px; padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,.1); max-width: 380px; width: 100%;
      text-align: center;
    }
    h1 { font-size: 1.4em; margin: 0 0 12px; }
    p { color: #6c757d; font-size: 0.95em; margin: 0 0 28px; }
    button {
      background: #212529; color: #fff; border: none;
      padding: 12px 32px; border-radius: 5px; font-size: 1em;
      cursor: pointer; width: 100%;
    }
    button:hover { background: #343a40; }
  </style>
</head>
<body>
  <div class="card">
    <h1>hultberg.org</h1>
    <p>You're about to log in to the admin dashboard.</p>
    <form method="POST" action="/admin/api/verify-token">
      <input type="hidden" name="token" value="${token}">
      <button type="submit">Log In to Admin</button>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Handle GET /admin/api/verify-token?token=xxx
 * Shows a confirmation page without consuming the token.
 * Prevents email security scanners from consuming the token on link prefetch.
 */
export async function handleVerifyTokenGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.redirect(`${url.origin}/admin?error=invalid-link`, 302);
  }

  const tokenExists = await peekMagicLinkToken(env, token);
  if (!tokenExists) {
    return Response.redirect(`${url.origin}/admin?error=link-expired`, 302);
  }

  return new Response(renderConfirmPage(token), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP,
    },
  });
}

/**
 * Handle POST /admin/api/verify-token
 * Consumes the magic link token and sets the auth cookie.
 * Origin header required as CSRF protection.
 */
export async function handleVerifyTokenPost(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  const origin = request.headers.get('Origin');
  if (origin !== ALLOWED_ORIGIN) {
    return Response.redirect(`${url.origin}/admin?error=invalid-link`, 302);
  }

  try {
    const formData = await request.formData();
    const token = formData.get('token') as string | null;

    if (!token) {
      return Response.redirect(`${url.origin}/admin?error=invalid-link`, 302);
    }

    const email = await verifyMagicLinkToken(env, token);
    if (!email) {
      return Response.redirect(`${url.origin}/admin?error=link-expired`, 302);
    }

    const jwt = await generateJWT(env, email);
    const cookieHeader = createAuthCookie(jwt);

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin/dashboard',
        'Set-Cookie': cookieHeader,
      },
    });
  } catch (error) {
    console.error('Error in handleVerifyTokenPost:', error);
    return Response.redirect(`${url.origin}/admin?error=server-error`, 302);
  }
}
