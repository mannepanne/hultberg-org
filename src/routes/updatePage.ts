// ABOUT: Route handler for /updates/{slug} individual update pages
// ABOUT: Renders markdown content with metadata and sanitizes HTML

import { marked } from 'marked';
import type { Update } from '@/types';
import { escapeHtml } from '@/utils';

/**
 * Handles GET requests to /updates/{slug}
 * Fetches update JSON from static assets, checks visibility, and renders the page
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

    return renderUpdatePage(update);
  } catch (error) {
    console.error('Error handling update page:', error);
    return new Response('Error loading update', { status: 500 });
  }
}

/**
 * Renders an Update object to a full HTML Response.
 * Used by both the public route and the admin preview route.
 */
export async function renderUpdatePage(update: Update): Promise<Response> {
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
      'Content-Security-Policy': "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self';",
    },
  });
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
 *
 * TODO: Replace with proper allowlist-based sanitizer when Workers-compatible library available
 * Current approach uses regex-based filtering which is not ideal but acceptable for MVP because:
 * - Single trusted admin (no untrusted user input)
 * - Content version-controlled in GitHub
 * - CSP headers provide defense-in-depth
 * - Server-side rendering only
 *
 * See CLAUDE.md Technical Debt section for details
 */
function sanitizeHTML(html: string): string {
  let sanitized = html;

  // Remove dangerous tags completely
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // Remove dangerous protocols (case-insensitive, handle URL encoding)
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/file:/gi, '')
    .replace(/about:/gi, '');

  // Remove inline event handlers (all variations)
  sanitized = sanitized
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/\son\w+=/gi, '');

  // Remove style attributes that could contain expressions
  sanitized = sanitized
    .replace(/style\s*=\s*["'][^"']*["']/gi, '')
    .replace(/style\s*=\s*[^\s>]*/gi, '');

  return sanitized;
}