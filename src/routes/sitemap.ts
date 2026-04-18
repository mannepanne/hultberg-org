// ABOUT: Route handler for /sitemap.xml
// ABOUT: Generates a sitemaps.org-compliant XML sitemap of public pages

import type { Env, NowContent, UpdateIndex } from '@/types';

/**
 * Handles GET requests to /sitemap.xml
 * Builds a urlset from static pages + the published updates index + /now lastmod
 */
export async function handleSitemap(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const origin = url.origin;

    const [updatesIndex, nowContent] = await Promise.all([
      fetchUpdatesIndex(env, origin),
      fetchNowContent(env, origin),
    ]);

    const publishedUpdates = updatesIndex.updates
      .filter(update => update.status === 'published' && update.publishedDate)
      .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());

    const xml = generateSitemapXML(origin, publishedUpdates, nowContent);

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
}

async function fetchUpdatesIndex(env: Env, origin: string): Promise<UpdateIndex> {
  const indexUrl = `${origin}/updates/data/index.json`;
  const response = await (env.ASSETS?.fetch(new Request(indexUrl)) ?? fetch(indexUrl));
  if (!response.ok) {
    return { updates: [] };
  }
  return response.json();
}

async function fetchNowContent(env: Env, origin: string): Promise<NowContent | null> {
  const contentUrl = `${origin}/now/data/content.json`;
  const response = await (env.ASSETS?.fetch(new Request(contentUrl)) ?? fetch(contentUrl));
  if (!response.ok) {
    return null;
  }
  return response.json();
}

/**
 * Generates the sitemap XML per https://www.sitemaps.org/protocol.html
 */
function generateSitemapXML(
  origin: string,
  publishedUpdates: UpdateIndex['updates'],
  nowContent: NowContent | null,
): string {
  const newestUpdateDate = publishedUpdates[0]?.publishedDate;

  const entries: string[] = [];

  entries.push(buildUrl(`${origin}/`, undefined, '1.0'));
  entries.push(buildUrl(`${origin}/now`, toW3CDate(nowContent?.lastUpdated), '0.9'));
  entries.push(buildUrl(`${origin}/updates`, toW3CDate(newestUpdateDate), '0.8'));

  for (const update of publishedUpdates) {
    entries.push(buildUrl(
      `${origin}/updates/${update.slug}`,
      toW3CDate(update.publishedDate),
      '0.7',
    ));
  }

  entries.push(buildUrl(`${origin}/use-of-ai`, undefined, '0.5'));
  entries.push(buildUrl(`${origin}/2005/11/recipe_sharing_.html`, undefined, '0.3'));

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;
}

function buildUrl(loc: string, lastmod: string | undefined, priority: string): string {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
  return `  <url>
    <loc>${escapeXML(loc)}</loc>${lastmodTag}
    <priority>${priority}</priority>
  </url>`;
}

/**
 * Convert an ISO 8601 timestamp to a W3C Datetime sitemap-friendly form.
 * Returns undefined for missing or unparseable input so callers can omit
 * the <lastmod> entirely rather than emit malformed XML.
 */
function toW3CDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? undefined : date.toISOString();
}

function escapeXML(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
