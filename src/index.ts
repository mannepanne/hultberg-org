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
import { GITHUB_REPO } from './github';

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
      return handleRSSFeed(request, env);
    }

    // Route: /updates listing page
    if (url.pathname === '/updates') {
      return handleUpdatesListing(request, env);
    }

    // Route: /updates/{slug} individual page
    const updateSlugMatch = url.pathname.match(/^\/updates\/([a-z0-9-]+)$/);
    if (updateSlugMatch) {
      const slug = updateSlugMatch[1];
      return handleUpdatePage(request, env, slug);
    }

    // Route: /images/updates/* - proxy uploaded images from GitHub raw content
    // Images are stored in GitHub via the admin API; this route serves them without
    // requiring a full site redeploy after each upload.
    const imagesMatch = url.pathname.match(/^\/images\/updates\/(.+)$/);
    if (imagesMatch) {
      const imagePath = imagesMatch[1];
      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/images/updates/${imagePath}`;
      const imageResponse = await fetch(rawUrl);
      if (!imageResponse.ok) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(imageResponse.body, {
        status: 200,
        headers: {
          'Content-Type': imageResponse.headers.get('Content-Type') ?? 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Default 404 handler for unmatched routes
    const notFoundHtml = `<!doctype html>
<html class="no-js" lang="en-GB">
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Magnus Hultberg - hultberg.org</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <script async src="https://www.googletagmanager.com/gtag/js?id=G-D1L22CCJTJ"></script>
        <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-D1L22CCJTJ');
        </script>
    </head>
    <body>
        <div style="max-width: 800px; margin: 0 auto; padding: 2em;">
            <p>← <a href="/">Home</a> | <a href="/updates">Updates</a></p>
            <img src="/errors/bazinga.gif" alt="bazinga!" /><br /><br />
            sorry, the page or file you are looking for isn't here...<br />
            <a href="/" onclick="history.back(); return false;">go back from whence you came</a>, or tell me what a klutz I am by messaging me on
            <a href="https://uk.linkedin.com/in/hultberg">LinkedIn</a>
            <p>← <a href="/">Home</a> | <a href="/updates">Updates</a></p>
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
