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
        'Content-Security-Policy': "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self';",
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Updates from Magnus Hultberg" />

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
        <div style="max-width: 800px; margin: 0 auto; padding: 2em;">
            <p><a href="/">← Back to home</a></p>
            <h1>Updates</h1>

            ${updatesHTML}
        </div>
    </body>
</html>
`;
}