// ABOUT: Route handler for /updates listing page
// ABOUT: Displays published updates in reverse chronological order

import type { Env, UpdateIndex } from '@/types';
import { escapeHtml } from '@/utils';

/**
 * Handles GET requests to /updates
 * Fetches index.json, filters published updates, and renders HTML
 */
export async function handleUpdatesListing(request: Request, env: Env): Promise<Response> {
  try {
    // Fetch the index.json via the ASSETS binding to avoid self-referential Worker routing
    const url = new URL(request.url);
    const indexUrl = `${url.origin}/updates/data/index.json`;
    const indexResponse = await (env.ASSETS?.fetch(new Request(indexUrl)) ?? fetch(indexUrl));

    if (!indexResponse.ok) {
      throw new Error('Failed to fetch updates index');
    }

    const indexData: UpdateIndex = await indexResponse.json();

    // Filter for published updates only and sort by date (newest first)
    const publishedUpdates = indexData.updates
      .filter(update => update.status === 'published')
      .sort((a, b) => {
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      });

    // Render HTML
    const html = renderUpdatesListingHTML(publishedUpdates);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' https://www.google-analytics.com https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self';",
      },
    });
  } catch (error) {
    console.error('Error handling updates listing:', error);
    return new Response('Error loading updates', { status: 500 });
  }
}

/**
 * Renders the updates listing page HTML
 * Based on /now page style for consistency
 */
function renderUpdatesListingHTML(updates: UpdateIndex['updates']): string {
  const updatesHTML = updates.length > 0
    ? updates.map(update => {
        // Format date for display
        const date = new Date(update.publishedDate);
        const formattedDate = date.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        return `
          <article style="margin-bottom: 2em;">
            <h2><a href="/updates/${update.slug}">${escapeHtml(update.title)}</a></h2>
            <p style="color: #666; font-size: 0.9em;">${formattedDate}</p>
            <p>${escapeHtml(update.excerpt)}</p>
          </article>
        `;
      }).join('\n')
    : '<p>No updates yet. Check back soon!</p>';

  return `<!doctype html>
<html class="no-js" lang="en-GB">
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Updates - Magnus Hultberg</title>
        <meta name="description" content="Updates from Magnus Hultberg" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:title" content="Updates | Magnus Hultberg" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hultberg.org/updates" />
        <meta property="og:image" content="https://hultberg.org/now/magnus_hultberg_juggling.png" />
        <meta property="og:description" content="Updates from Magnus Hultberg" />
        <meta property="og:site_name" content="Magnus Hultberg" />
        <meta name="twitter:card" content="summary" />

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
            <p>← <a href="/">Home</a></p>
            <h1>Updates</h1>

            ${updatesHTML}
        </div>
    </body>
</html>
`;
}