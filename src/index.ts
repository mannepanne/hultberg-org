// ABOUT: The main entry point for the Cloudflare Worker.
// ABOUT: This file handles all incoming requests and routes them accordingly.

import type { Env } from './types';
import { handleUpdatesListing } from './routes/updatesListing';
import { handleUpdatePage } from './routes/updatePage';
import { handleRSSFeed } from './routes/rssFeed';
import { handleAdminLogin } from './routes/adminLogin';
import { handleAdminLogout } from './routes/adminLogout';
import { handleSendMagicLink } from './routes/sendMagicLink';
import { handleVerifyTokenGet, handleVerifyTokenPost } from './routes/verifyToken';
import { handleAdminDashboard } from './routes/adminDashboard';
import { handleListUpdates } from './routes/listUpdates';
import { handleDeleteUpdate } from './routes/deleteUpdate';
import { handleNewUpdate, handleEditUpdate } from './routes/adminEditor';
import { handleAdminPreview } from './routes/adminPreview';
import { handleSaveUpdate } from './routes/saveUpdate';
import { handleUploadImage } from './routes/uploadImage';
import { handleDeleteImage } from './routes/deleteImage';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Admin routes
    // API endpoint: POST /admin/api/send-magic-link
    if (url.pathname === '/admin/api/send-magic-link' && request.method === 'POST') {
      return handleSendMagicLink(request, env);
    }

    // Verify token: GET shows confirmation page, POST consumes token and sets cookie
    if (url.pathname === '/admin/api/verify-token' && request.method === 'GET') {
      return handleVerifyTokenGet(request, env);
    }
    if (url.pathname === '/admin/api/verify-token' && request.method === 'POST') {
      return handleVerifyTokenPost(request, env);
    }

    // Dashboard: GET /admin/dashboard (authenticated)
    if (url.pathname === '/admin/dashboard' && request.method === 'GET') {
      return handleAdminDashboard(request, env);
    }

    // Logout: POST /admin/logout
    if (url.pathname === '/admin/logout' && request.method === 'POST') {
      return handleAdminLogout(request);
    }

    // API: GET /admin/api/updates (authenticated, returns all updates as JSON)
    if (url.pathname === '/admin/api/updates' && request.method === 'GET') {
      return handleListUpdates(request, env);
    }

    // API: DELETE /admin/api/delete-update (authenticated)
    if (url.pathname === '/admin/api/delete-update' && request.method === 'DELETE') {
      return handleDeleteUpdate(request, env);
    }

    // API: POST /admin/api/save-update (authenticated)
    if (url.pathname === '/admin/api/save-update' && request.method === 'POST') {
      return handleSaveUpdate(request, env);
    }

    // API: POST /admin/api/upload-image (authenticated)
    if (url.pathname === '/admin/api/upload-image' && request.method === 'POST') {
      return handleUploadImage(request, env);
    }

    // API: DELETE /admin/api/delete-image (authenticated)
    if (url.pathname === '/admin/api/delete-image' && request.method === 'DELETE') {
      return handleDeleteImage(request, env);
    }

    // Editor: GET /admin/updates/new
    if (url.pathname === '/admin/updates/new' && request.method === 'GET') {
      return handleNewUpdate(request, env);
    }

    // Editor: GET /admin/updates/:slug/edit
    const editSlugMatch = url.pathname.match(/^\/admin\/updates\/([a-z0-9-]+)\/edit$/);
    if (editSlugMatch && request.method === 'GET') {
      return handleEditUpdate(request, env, editSlugMatch[1]);
    }

    // Preview: GET /admin/preview/:slug
    const previewSlugMatch = url.pathname.match(/^\/admin\/preview\/([a-z0-9-]+)$/);
    if (previewSlugMatch && request.method === 'GET') {
      return handleAdminPreview(request, env, previewSlugMatch[1]);
    }

    // Login page: GET /admin
    if (url.pathname === '/admin' && request.method === 'GET') {
      return handleAdminLogin(request);
    }

    // Public routes
    // Route: /updates/feed.xml RSS feed
    if (url.pathname === '/updates/feed.xml') {
      return handleRSSFeed(request);
    }

    // Route: /updates listing page
    if (url.pathname === '/updates') {
      return handleUpdatesListing(request);
    }

    // Route: /updates/{slug} individual page
    const updateSlugMatch = url.pathname.match(/^\/updates\/([a-z0-9-]+)$/);
    if (updateSlugMatch) {
      const slug = updateSlugMatch[1];
      return handleUpdatePage(request, slug);
    }

    // Default 404 handler for unmatched routes
    const notFoundHtml = `<!doctype html>
<html class="no-js" lang="en-GB">
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Magnus Hultberg - hultberg.org</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <script>
            (function (i, s, o, g, r, a, m) {
                i["GoogleAnalyticsObject"] = r;
                ((i[r] =
                    i[r] ||
                    function () {
                        (i[r].q = i[r].q || []).push(arguments);
                    }),
                    (i[r].l = 1 * new Date()));
                ((a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]));
                a.async = 1;
                a.src = g;
                m.parentNode.insertBefore(a, m);
            })(
                window,
                document,
                "script",
                "//www.google-analytics.com/analytics.js",
                "ga",
            );

            ga("create", "UA-291574-7", "auto");
            ga("send", "pageview");
        </script>
    </head>
    <body>
        <div>
            <img src="/errors/bazinga.gif" alt="bazinga!" /><br /><br />
            sorry, the page or file you are looking for isn't here...<br />
            <a href="/" onclick="history.back(); return false;">go back from whence you came</a>, or tell me what a klutz I am by messaging me on
            <a href="https://uk.linkedin.com/in/hultberg">LinkedIn</a>
        </div>
    </body>
</html>
`;
    return new Response(notFoundHtml, {
      status: 404,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  },
};
