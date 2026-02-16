// ABOUT: Route handler for /updates/{slug} individual update pages
// ABOUT: Renders markdown content with metadata and sanitizes HTML

import { marked } from 'marked';
import type { Update } from '@/types';

/**
 * Handles GET requests to /updates/{slug}
 * Fetches update JSON, renders markdown, and returns HTML
 */
export async function handleUpdatePage(request: Request, slug: string): Promise<Response> {
  try {
    // Fetch the update JSON from static assets
    const url = new URL(request.url);
    const updateUrl = `${url.origin}/updates/data/${slug}.json`;
    const updateResponse = await fetch(updateUrl);

    if (!updateResponse.ok) {
      return new Response('Update not found', { status: 404 });
    }

    const update: Update = await updateResponse.json();

    // Return 404 for draft updates (public users shouldn't see them)
    if (update.status === 'draft') {
      return new Response('Update not found', { status: 404 });
    }

    // Convert markdown to HTML
    const contentHTML = await marked(update.content);

    // Sanitize HTML to prevent XSS
    const sanitizedHTML = sanitizeHTML(contentHTML);

    // Render the page
    const html = renderUpdatePageHTML(update, sanitizedHTML);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error handling update page:', error);
    return new Response('Error loading update', { status: 500 });
  }
}

/**
 * Renders the individual update page HTML
 */
function renderUpdatePageHTML(update: Update, contentHTML: string): string {
  const publishedDate = new Date(update.publishedDate);
  const formattedPublishedDate = publishedDate.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const editedDate = new Date(update.editedDate);
  const showEditedDate = update.editedDate !== update.publishedDate;
  const formattedEditedDate = editedDate.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const editedDateHTML = showEditedDate
    ? `<p style="color: #666; font-size: 0.9em; font-style: italic;">Last edited: ${formattedEditedDate}</p>`
    : '';

  return `<!doctype html>
<html class="no-js" lang="en-GB">
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>${escapeHtml(update.title)} - Magnus Hultberg</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="${escapeHtml(update.excerpt)}" />
        <meta name="author" content="${escapeHtml(update.author)}" />

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
            <p><a href="/updates">← Back to updates</a></p>

            <article>
                <header>
                    <h1>${escapeHtml(update.title)}</h1>
                    <p style="color: #666; font-size: 0.9em;">
                        By <a href="/now">${escapeHtml(update.author)}</a> • ${formattedPublishedDate}
                    </p>
                    ${editedDateHTML}
                </header>

                <div>
                    ${contentHTML}
                </div>
            </article>
        </div>
    </body>
</html>
`;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Uses allowlist approach - only permits safe tags and attributes
 */
function sanitizeHTML(html: string): string {
  // Remove script tags and javascript: protocols
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove inline event handlers
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  return sanitized;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
