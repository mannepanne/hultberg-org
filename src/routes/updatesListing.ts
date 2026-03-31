// ABOUT: Route handler for /updates listing page
// ABOUT: Displays published updates in reverse chronological order

import type { Env, UpdateIndex } from '@/types';
import { escapeHtml } from '@/utils';

const UPDATES_PER_PAGE = 5;

/**
 * Handles GET requests to /updates
 * Fetches index.json, filters published updates, and renders HTML
 */
export async function handleUpdatesListing(request: Request, env: Env): Promise<Response> {
  try {
    // Fetch the index.json via the ASSETS binding to avoid self-referential Worker routing
    const url = new URL(request.url);

    // Parse page parameter
    const pageParam = url.searchParams.get('page');
    let currentPage = 1;
    if (pageParam) {
      const parsed = parseInt(pageParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        currentPage = parsed;
      }
    }

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

    // Calculate pagination
    const totalUpdates = publishedUpdates.length;
    const totalPages = Math.max(1, Math.ceil(totalUpdates / UPDATES_PER_PAGE));

    // Clamp to valid range
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    // Slice for current page
    const startIndex = (currentPage - 1) * UPDATES_PER_PAGE;
    const endIndex = startIndex + UPDATES_PER_PAGE;
    const paginatedUpdates = publishedUpdates.slice(startIndex, endIndex);

    // Render HTML
    const html = renderUpdatesListingHTML(
      paginatedUpdates,
      currentPage,
      totalPages,
      url.pathname
    );

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
 * Generates pagination navigation HTML
 * Format: ‹ Prev | 1 2 [3] 4 5 | Next ›
 */
function renderPaginationNav(currentPage: number, totalPages: number, baseUrl: string): string {
  if (totalPages <= 1) {
    return ''; // No pagination needed
  }

  const parts: string[] = [];

  // Previous link (hide on page 1)
  if (currentPage > 1) {
    const prevUrl = currentPage === 2 ? baseUrl : `${baseUrl}?page=${currentPage - 1}`;
    parts.push(`<a href="${prevUrl}" aria-label="Previous page">‹ Prev</a>`);
  }

  // Page numbers
  const pageLinks: string[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      pageLinks.push(`<strong aria-current="page">[${i}]</strong>`);
    } else {
      const pageUrl = i === 1 ? baseUrl : `${baseUrl}?page=${i}`;
      pageLinks.push(`<a href="${pageUrl}" aria-label="Page ${i}">${i}</a>`);
    }
  }
  parts.push(pageLinks.join(' '));

  // Next link (hide on last page)
  if (currentPage < totalPages) {
    parts.push(`<a href="${baseUrl}?page=${currentPage + 1}" aria-label="Next page">Next ›</a>`);
  }

  return `<nav aria-label="Pagination" style="margin: 2em 0; text-align: center;">${parts.join(' | ')}</nav>`;
}

/**
 * Renders the updates listing page HTML
 * Based on /now page style for consistency
 */
function renderUpdatesListingHTML(
  updates: UpdateIndex['updates'],
  currentPage: number,
  totalPages: number,
  baseUrl: string
): string {
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
            <h2 style="font-size: 1.5em; font-weight: bold; line-height: 1.2; margin-bottom: 0.5em;"><a href="/updates/${update.slug}">${escapeHtml(update.title)}</a></h2>
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

        <link rel="alternate" type="application/rss+xml" title="Updates - Magnus Hultberg" href="/updates/feed.xml" />
        ${currentPage === 1 ? '<link rel="canonical" href="https://hultberg.org/updates" />' : ''}
        ${currentPage > 1 ? `<link rel="prev" href="https://hultberg.org${currentPage === 2 ? baseUrl : `${baseUrl}?page=${currentPage - 1}`}" />` : ''}
        ${currentPage < totalPages ? `<link rel="next" href="https://hultberg.org${baseUrl}?page=${currentPage + 1}" />` : ''}

        <script async src="https://www.googletagmanager.com/gtag/js?id=G-D1L22CCJTJ"></script>
        <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-D1L22CCJTJ');
        </script>

        <!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "f71c3c28b82c4c6991ec3d41b7f1496f"}'></script><!-- End Cloudflare Web Analytics -->
    </head>
    <body style="font-family: Georgia, serif; line-height: 1.5;">
        <div style="max-width: 800px; margin: 0 auto; padding: 2em;">
            <p>← <a href="/">Home</a> | <a href="/updates/feed.xml">RSS</a> | <a href="/now">Now</a> | <a href="https://www.linkedin.com/in/hultberg/" target="_blank" rel="noopener noreferrer">LinkedIn</a> | <a href="https://github.com/mannepanne" target="_blank" rel="noopener noreferrer">GitHub</a> | <a href="/use-of-ai">Use of AI</a></p>
            <h1 style="font-size: 1.5em; font-weight: bold; line-height: 1.2; margin-bottom: 0.5em;">Updates</h1>

            ${updatesHTML}

            ${renderPaginationNav(currentPage, totalPages, baseUrl)}

            <p>← <a href="/">Home</a> | <a href="/updates/feed.xml">RSS</a> | <a href="/now">Now</a> | <a href="https://www.linkedin.com/in/hultberg/" target="_blank" rel="noopener noreferrer">LinkedIn</a> | <a href="https://github.com/mannepanne" target="_blank" rel="noopener noreferrer">GitHub</a> | <a href="/use-of-ai">Use of AI</a></p>
        </div>
    </body>
</html>
`;
}