// ABOUT: Route handler for /now page
// ABOUT: Renders markdown content from JSON with widgets and sanitizes HTML

import { marked } from 'marked';
import type { Env, NowContent } from '@/types';
import { sanitizeHTML } from '@/sanitize';

/**
 * Handles GET requests to /now
 * Fetches content JSON from static assets and renders the page
 */
export async function handleNowPage(request: Request, env: Env): Promise<Response> {
  try {
    // Fetch the content JSON via the ASSETS binding to avoid self-referential Worker routing
    const url = new URL(request.url);
    const contentUrl = `${url.origin}/now/data/content.json`;
    const contentResponse = await (env.ASSETS?.fetch(new Request(contentUrl)) ?? fetch(contentUrl));

    if (!contentResponse.ok) {
      return new Response('Error loading content', { status: 500 });
    }

    const content: NowContent = await contentResponse.json();

    return renderNowPage(content);
  } catch (error) {
    console.error('Error handling /now page:', error);
    return new Response('Error loading page', { status: 500 });
  }
}

/**
 * Renders the /now page with markdown content and widgets
 */
async function renderNowPage(content: NowContent): Promise<Response> {
  // Convert markdown to HTML
  const contentHTML = await marked(content.markdown);

  // Sanitize HTML to prevent XSS
  const sanitizedHTML = sanitizeHTML(contentHTML);

  // Render the page
  const html = renderNowPageHTML(sanitizedHTML);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.cloudflareinsights.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' https://i.gr-assets.net; connect-src 'self' https://www.google-analytics.com https://cloudflareinsights.com https://api.github.com; frame-src https://goodreads.com https://*.goodreads.com; frame-ancestors 'none'; base-uri 'self';",
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}

/**
 * Renders the full /now page HTML
 */
function renderNowPageHTML(contentHTML: string): string {
  return `<!doctype html>
<html class="no-js" lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>What I'm doing now | Magnus Hultberg - hultberg.org</title>
  <meta name="description" content="What Magnus Hultberg is doing now">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <meta property="og:title" content="What I'm doing now | Magnus Hultberg">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://hultberg.org/now">
  <meta property="og:image" content="https://hultberg.org/now/magnus_hultberg_juggling.png">
  <meta property="og:description" content="What Magnus Hultberg is doing now">
  <meta property="og:site_name" content="Magnus Hultberg">
  <meta name="twitter:card" content="summary_large_image">

  <link rel="alternate" type="application/rss+xml" title="Updates - Magnus Hultberg" href="/updates/feed.xml">

<!-- Global site tag (gtag.js) - Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-D1L22CCJTJ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-D1L22CCJTJ');
</script>

<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "f71c3c28b82c4c6991ec3d41b7f1496f"}'></script><!-- End Cloudflare Web Analytics -->

<!-- Marked.js for client-side markdown rendering (timeline snapshots) -->
<script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>

<!-- DOMPurify for XSS protection on snapshot content -->
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.9/dist/purify.min.js"></script>

<style>
  /* Goodreads widget styles */
  #customize-list{
    float: left;
    list-style: none;
  }
  #gr_updates_widget{
    float: left;
    background-color: #fff;
    border: 0;
  }
  #gr_footer{
    display: none;
  }
  #gr_updates_widget p{
    padding: 0;
    margin: 0;
  }
  #gr_footer img{
    display: none;
  }

  /* Two-column layout for widgets */
  .widgets-container {
    display: flex;
    gap: 1em;
    margin-top: 2em;
    flex-wrap: wrap;
  }

  .widget-column {
    flex: 1;
    min-width: 300px;
  }

  /* GitHub widget styles */
  .github-widget h2 {
    font-size: 1.5em;
    font-weight: bold;
    line-height: 1.2;
    margin-bottom: 0.5em;
  }

  .github-widget h3 {
    font-size: 1em;
    font-weight: normal;
    margin: 1em 0 0.5em 0;
    font-style: italic;
  }

  /* Contribution graph */
  .contribution-graph {
    margin: 1em 0;
  }

  .month-labels {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 10px;
    gap: 3px;
    font-size: 0.75em;
    color: #666;
    margin-bottom: 4px;
  }

  .contribution-grid {
    display: flex;
    gap: 3px;
  }

  .contribution-grid .week {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .contribution-grid .day {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .contribution-total {
    margin-top: 0.5em;
    font-size: 0.9em;
    color: #666;
  }

  /* Repository list */
  .repo-list {
    margin-top: 1em;
  }

  .repo-item {
    margin-bottom: 1.5em;
  }

  .repo-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.25em;
  }

  .repo-name {
    font-weight: bold;
    text-decoration: none;
  }

  .repo-name:hover {
    text-decoration: underline;
  }

  .repo-activity {
    font-size: 0.85em;
    color: #666;
    font-style: italic;
  }

  .repo-description {
    font-size: 0.9em;
    color: #333;
    line-height: 1.4;
  }

  /* Responsive layout */
  @media (max-width: 768px) {
    .widgets-container {
      flex-direction: column;
    }
  }

  /* Timeline styles */
  .timeline-container {
    margin: 24px 0;
    padding: 12px 0;
  }

  .timeline-bar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    position: relative;
    min-height: 60px;
  }

  .timeline-loading {
    font-size: 0.9em;
    color: #999;
  }

  .timeline-line {
    position: absolute;
    height: 2px;
    background: #ddd;
    z-index: 0;
    left: 0;
    right: 10%;
  }

  .timeline-line::after {
    content: '';
    position: absolute;
    right: -7px;
    top: -3px;
    width: 0;
    height: 0;
    border-left: 7px solid #ddd;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }

  .timeline-node {
    position: relative;
    z-index: 1;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #fff;
  }

  .timeline-node--small {
    width: 23px;
    height: 23px;
    background: #fff;
    border: 2px solid #8AAED6;
    border-radius: 4px;
  }

  .timeline-node--small:hover {
    background: #f5f5f5;
    transform: scale(1.1);
  }

  .timeline-node--medium {
    padding: 7px 14px;
    border: 2px solid #8AAED6;
    border-radius: 4px;
    font-size: 0.81em;
    color: #8AAED6;
  }

  .timeline-node--medium:hover {
    border-color: #6B8FC0;
    color: #6B8FC0;
    transform: translateY(-2px);
  }

  .timeline-node--large {
    padding: 11px 18px;
    border: 3px solid #8AAED6;
    border-radius: 4px;
    font-weight: 600;
    font-size: 1em;
    background: #f9f9f9;
    color: #8AAED6;
  }

  .timeline-node--placeholder {
    width: 23px;
    height: 23px;
    background: #fff;
    border: 2px solid #ddd;
    border-radius: 4px;
    font-size: 0.81em;
    color: #999;
    cursor: not-allowed;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .timeline-arrow {
    width: 36px;
    height: 36px;
    border: 2px solid #8AAED6;
    border-radius: 4px;
    background: #fff;
    color: #8AAED6;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-size: 1.1em;
    flex-shrink: 0;
    position: relative;
    z-index: 2;
  }

  .timeline-arrow:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: #6B8FC0;
    color: #6B8FC0;
  }

  .timeline-arrow:disabled {
    border-color: #ddd;
    color: #ddd;
    cursor: not-allowed;
  }

  /* Timeline responsive */
  /* Desktop (>768px): 7 visible nodes (center + 3 on each side) */
  /* Mobile/Tablet (≤768px): 5 visible nodes (center + 2 on each side) */
  @media (max-width: 480px) {
    .timeline-node--medium,
    .timeline-node--large {
      font-size: 0.72em;
      padding: 5px 11px;
    }

    .timeline-arrow {
      width: 32px;
      height: 32px;
      font-size: 0.9em;
    }

    .timeline-bar {
      gap: 12px;
    }
  }
</style>

</head>
<body id="now" style="font-family: Georgia, serif; line-height: 1.5;">

<div id="content" style="max-width: 800px; margin: 0 auto; padding: 2em;">

  <p>← <a href="/">Home</a> | <a href="/updates">Updates</a> | <a href="https://www.linkedin.com/in/hultberg/" target="_blank" rel="noopener noreferrer">LinkedIn</a> | <a href="https://github.com/mannepanne" target="_blank" rel="noopener noreferrer">GitHub</a></p>

  <h1 style="font-size: 1.5em; font-weight: bold; line-height: 1.2; margin-bottom: 0.5em;">What I'm doing now</h1>

  <!-- Timeline Navigation -->
  <div class="timeline-container">
    <div id="timeline-bar" class="timeline-bar">
      <!-- Timeline will be rendered here by timeline.js -->
      <div class="timeline-loading">Loading timeline...</div>
    </div>
  </div>

  <div id="now-content">
    ${contentHTML}
  </div>

  <div class="widgets-container">

    <div class="widget-column">
      <h2 style="font-size: 1.5em; font-weight: bold; line-height: 1.2; margin-bottom: 0.5em;">Reading updates</h2>

      <div id="gr_updates_widget">
        <iframe id="the_iframe" src="https://goodreads.com/widgets/user_update_widget?height=500&num_updates=4&user=3011094&width=325" width="323" height="500" frameborder="0"></iframe>
      </div>
    </div>

    <div class="widget-column github-widget">
      <h2>GitHub activity</h2>

      <div id="github-contributions" data-username="mannepanne"></div>

      <h3>Projects I have been working on recently</h3>

      <div id="github-repos"></div>
    </div>

  </div>

  <p style="clear: both; margin-top: 2em;">← <a href="/">Home</a> | <a href="/updates">Updates</a> | <a href="https://www.linkedin.com/in/hultberg/" target="_blank" rel="noopener noreferrer">LinkedIn</a> | <a href="https://github.com/mannepanne" target="_blank" rel="noopener noreferrer">GitHub</a></p>

  <script src="/now/github-widget.js"></script>
  <script src="/now/timeline.js"></script>

</div>

</body>
</html>
`;
}
