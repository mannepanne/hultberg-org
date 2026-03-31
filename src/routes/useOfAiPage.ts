// ABOUT: Route handler for /use-of-ai page
// ABOUT: Renders static content explaining Magnus's use of AI tools

import type { Env } from '@/types';

/**
 * Handles GET requests to /use-of-ai
 */
export async function handleUseOfAiPage(request: Request, env: Env): Promise<Response> {
  const html = renderUseOfAiPageHTML();

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

/**
 * Renders the full /use-of-ai page HTML
 */
function renderUseOfAiPageHTML(): string {
  return `<!doctype html>
<html class="no-js" lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Use of AI | Magnus Hultberg - hultberg.org</title>
  <meta name="description" content="How Magnus Hultberg uses AI tools for writing and building">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <meta property="og:title" content="Use of AI | Magnus Hultberg">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://hultberg.org/use-of-ai">
  <meta property="og:description" content="How Magnus Hultberg uses AI tools for writing and building">
  <meta property="og:site_name" content="Magnus Hultberg">
  <meta name="twitter:card" content="summary">

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

</head>
<body style="font-family: Georgia, serif; line-height: 1.5;">

<div style="max-width: 800px; margin: 0 auto; padding: 2em;">

  <p>← <a href="/">Home</a> | <a href="/updates">Updates</a> | <a href="/now">Now</a> | <a href="https://www.linkedin.com/in/hultberg/" target="_blank" rel="noopener noreferrer">LinkedIn</a> | <a href="https://github.com/mannepanne" target="_blank" rel="noopener noreferrer">GitHub</a> | <a href="/use-of-ai">Use of AI</a></p>

  <h1 style="font-size: 1.5em; font-weight: bold; line-height: 1.2; margin-bottom: 0.5em;">Use of AI</h1>

  <p>I use AI extensively. For writing, for building the tools and projects you find on this site, and for the thinking that connects the two. This page explains how.</p>

  <p>I think transparency here matters, not because AI involvement diminishes the work, but because the opposite claim would be dishonest. I'd rather tell you exactly what I do.</p>

  <h2 style="font-size: 1.2em; font-weight: bold; line-height: 1.2; margin-top: 1.5em; margin-bottom: 0.5em;">The tools</h2>

  <p>My primary AI tools are Claude.ai and Claude Code, both from Anthropic. For writing, I work inside dedicated Claude.ai projects that carry context across sessions. For building, I use Claude Code, an agentic coding environment, running locally on my machine.</p>

  <h2 style="font-size: 1.2em; font-weight: bold; line-height: 1.2; margin-top: 1.5em; margin-bottom: 0.5em;">Writing</h2>

  <p>Nothing I publish is AI-generated output, dropped straight onto a page.</p>

  <p>Every piece starts with me: the observation, the argument, the thing I actually think. I bring that into a conversation with Claude, along with context about my voice, my reader, and what I'm trying to say. We draft together. Then I edit, sometimes heavily, until the piece sounds like me and says what I mean.</p>

  <p>More recently I've started using <a href="https://marker.page/" target="_blank" rel="noopener noreferrer">Marker</a> as part of that editing process, which I find valuable for tightening and refining. The final pass is always mine, in a text editor, before anything goes anywhere.</p>

  <p>The writing on this site and on my LinkedIn profile is my thinking. Claude helps me get it out of my head and onto the page in a useful and readable format. That's the collaboration. The ideas, the judgements, and the responsibility for what I've said are mine.</p>

  <h2 style="font-size: 1.2em; font-weight: bold; line-height: 1.2; margin-top: 1.5em; margin-bottom: 0.5em;">Code and projects</h2>

  <p>The sites you're visiting, hultberg.org, restaurants.hultberg.org, ansible.hultberg.org, are built almost entirely with AI-generated code. I do not write code myself, in any meaningful sense.</p>

  <p>What I do instead: I use <a href="https://github.com/mannepanne/useful-assets-template" target="_blank" rel="noopener noreferrer">an opinionated workflow</a> based on my extensive experience as a Product Manager mimicking collaboration with a team of engineers. I work through requirements in conversation with Claude until we've agreed a clear specification in writing. Claude Code then implements against that specification using a test-driven approach. Separately invoked sub-agents review every pull request before anything is merged; a security-minded reviewer, an architect, and others, depending on the phase.</p>

  <p>Can I be certain the code is production-grade? No. Can I feel reasonably confident it's better than anything I'd have produced myself? Absolutely. I contribute ideas, product sense, validation, and quality judgement from the outside. Claude contributes the rest.</p>

  <p>I would not use this approach for anything I expected other people to pay for, rely on for anything important, or trust with sensitive data. These are personal projects, built for my own use and curiosity.</p>

  <h2 style="font-size: 1.2em; font-weight: bold; line-height: 1.2; margin-top: 1.5em; margin-bottom: 0.5em;">The bottom line</h2>

  <p>All of this is for me. If something on these sites is broken, wrong, or behaves unexpectedly, I am the one who bears the consequence. I try to make sure that's true, that no one else is exposed to whatever imperfection the process inevitably produces.</p>

  <p>That's the deal I've made with myself. I think it's a reasonable one.</p>

  <p style="font-style: italic; margin-top: 1.5em;"><em>Last updated: March 2026</em></p>

  <p style="margin-top: 2em;">← <a href="/">Home</a> | <a href="/updates">Updates</a> | <a href="/now">Now</a> | <a href="https://www.linkedin.com/in/hultberg/" target="_blank" rel="noopener noreferrer">LinkedIn</a> | <a href="https://github.com/mannepanne" target="_blank" rel="noopener noreferrer">GitHub</a> | <a href="/use-of-ai">Use of AI</a></p>

</div>

</body>
</html>
`;
}
