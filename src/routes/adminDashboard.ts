// ABOUT: Route handler for /admin/dashboard (placeholder for Phase 4)
// ABOUT: Simple authenticated dashboard showing login success

import type { Env } from '@/types';
import { requireAuth } from '@/auth';

/**
 * Handle GET /admin/dashboard
 * Placeholder dashboard - will be fully implemented in Phase 4
 */
export async function handleAdminDashboard(request: Request, env: Env): Promise<Response> {
  // Check authentication
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    // Not authenticated, redirect to login
    return Response.redirect(new URL('/admin', request.url).toString(), 302);
  }

  const email = authResult; // Email of authenticated user

  const html = `
<!DOCTYPE html>
<html class="no-js" lang="en-GB">
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Admin Dashboard - Magnus Hultberg</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />

        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
            }
            h1 {
                color: #212529;
            }
            .success {
                background-color: #d4edda;
                color: #155724;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
            }
            .info {
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 4px;
                margin: 20px 0;
            }
            a {
                color: #007bff;
                text-decoration: none;
            }
            a:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <h1>Admin Dashboard</h1>

        <div class="success">
            ✅ Successfully authenticated as: <strong>${email}</strong>
        </div>

        <div class="info">
            <h2>Phase 3 Complete!</h2>
            <p>Magic link authentication is working. You've successfully:</p>
            <ul>
                <li>Requested a magic link</li>
                <li>Received it via email</li>
                <li>Verified the token</li>
                <li>Received a secure JWT cookie</li>
            </ul>

            <p><strong>Next up: Phase 4</strong> - Admin dashboard with updates management</p>

            <p>
                <a href="/">← Back to site</a>
            </p>
        </div>
    </body>
</html>
  `.trim();

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self';",
    },
  });
}
