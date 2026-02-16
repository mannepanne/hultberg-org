// ABOUT: Route handler for /updates/feed.xml RSS feed
// ABOUT: Generates RSS 2.0 XML with published updates

import type { UpdateIndex } from '@/types';

/**
 * Handles GET requests to /updates/feed.xml
 * Fetches index, filters published updates, and generates RSS 2.0 XML
 */
export async function handleRSSFeed(request: Request): Promise<Response> {
  try {
    // Fetch the index.json from static assets
    const url = new URL(request.url);
    const indexUrl = `${url.origin}/updates/data/index.json`;
    const indexResponse = await fetch(indexUrl);

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

    // Generate RSS XML
    const xml = generateRSSXML(publishedUpdates, url.origin);

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
}

/**
 * Generates RSS 2.0 XML from updates
 */
function generateRSSXML(updates: UpdateIndex['updates'], siteOrigin: string): string {
  const items = updates.map(update => {
    const pubDate = formatRFC822Date(new Date(update.publishedDate));
    const link = `${siteOrigin}/updates/${update.slug}`;

    return `
    <item>
      <title>${escapeXML(update.title)}</title>
      <link>${link}</link>
      <description>${escapeXML(update.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${link}</guid>
    </item>`;
  }).join('\n');

  const buildDate = formatRFC822Date(new Date());

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Magnus Hultberg - Updates</title>
    <link>${siteOrigin}/updates</link>
    <description>Updates from Magnus Hultberg</description>
    <language>en-GB</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${siteOrigin}/updates/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

/**
 * Format date as RFC 822 (required for RSS pubDate)
 * Example: "Sat, 15 Feb 2026 10:00:00 GMT"
 */
function formatRFC822Date(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const day = days[date.getUTCDay()];
  const dayNum = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${day}, ${dayNum} ${month} ${year} ${hours}:${minutes}:${seconds} GMT`;
}

/**
 * Escape special XML characters
 */
function escapeXML(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
