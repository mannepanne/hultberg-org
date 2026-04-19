// ABOUT: Integration tests for /use-of-ai page
// ABOUT: Tests static page rendering, navigation, and analytics inclusion

import { describe, it, expect, beforeEach } from 'vitest';
import worker from '@/index';
import { createMockEnv } from '../mocks/env';
import { createMockContext } from '../mocks/context';

describe('GET /use-of-ai', () => {
  let mockEnv: any;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockCtx = createMockContext();
  });

  it('returns 200 for /use-of-ai page', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
  });

  it('returns HTML content type', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('displays page title', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<title>Use of AI | Magnus Hultberg - hultberg.org</title>');
    expect(html).toContain('<h1 style="font-size: 1.5em; font-weight: bold; line-height: 1.2; margin-bottom: 0.5em;">Use of AI</h1>');
  });

  it('handles /use-of-ai/ with trailing slash', async () => {
    const request = new Request('http://localhost/use-of-ai/');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('Use of AI');
  });

  it('includes navigation links', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<a href="/">Home</a>');
    expect(html).toContain('<a href="/updates">Updates</a>');
    expect(html).toContain('<a href="/now">Now</a>');
    expect(html).toContain('linkedin.com/in/hultberg');
    expect(html).toContain('github.com/mannepanne');
    expect(html).toContain('<a href="/use-of-ai">Use of AI</a>');
  });

  it('includes Cache-Control header with 1 hour cache', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);

    const cacheControl = response.headers.get('Cache-Control');
    expect(cacheControl).toBe('public, max-age=3600, s-maxage=3600');
  });

  it('includes Cloudflare Web Analytics', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('cloudflareinsights.com/beacon.min.js');
    expect(html).toContain('f71c3c28b82c4c6991ec3d41b7f1496f');
  });

  it('includes external link to Marker with proper rel attributes', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<a href="https://marker.page/" target="_blank" rel="noopener noreferrer">Marker</a>');
  });

  it('includes external link to GitHub template with proper rel attributes', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<a href="https://github.com/mannepanne/useful-assets-template" target="_blank" rel="noopener noreferrer">an opinionated workflow</a>');
  });

  it('includes all content sections', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    // Main intro
    expect(html).toContain('I use AI extensively');

    // The tools section
    expect(html).toContain('<h2 style="font-size: 1.2em; font-weight: bold; line-height: 1.2; margin-top: 1.5em; margin-bottom: 0.5em;">The tools</h2>');
    expect(html).toContain('Claude.ai and Claude Code');

    // Writing section
    expect(html).toContain('<h2 style="font-size: 1.2em; font-weight: bold; line-height: 1.2; margin-top: 1.5em; margin-bottom: 0.5em;">Writing</h2>');
    expect(html).toContain('Nothing I publish is AI-generated output');

    // Code and projects section
    expect(html).toContain('<h2 style="font-size: 1.2em; font-weight: bold; line-height: 1.2; margin-top: 1.5em; margin-bottom: 0.5em;">Code and projects</h2>');
    expect(html).toContain('hultberg.org, restaurants.hultberg.org, ansible.hultberg.org');

    // The bottom line section
    expect(html).toContain('<h2 style="font-size: 1.2em; font-weight: bold; line-height: 1.2; margin-top: 1.5em; margin-bottom: 0.5em;">The bottom line</h2>');
    expect(html).toContain('All of this is for me');

    // Last updated
    expect(html).toContain('<em>Last updated: March 2026</em>');
  });

  it('includes meta description for SEO', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<meta name="description" content="How Magnus Hultberg uses AI tools for writing and building">');
  });

  it('includes Open Graph meta tags', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<meta property="og:title" content="Use of AI | Magnus Hultberg">');
    expect(html).toContain('<meta property="og:url" content="https://hultberg.org/use-of-ai">');
    expect(html).toContain('<meta property="og:description" content="How Magnus Hultberg uses AI tools for writing and building">');
  });

  it('includes RSS feed link in head', async () => {
    const request = new Request('http://localhost/use-of-ai');
    const response = await worker.fetch(request, mockEnv, mockCtx);
    const html = await response.text();

    expect(html).toContain('<link rel="alternate" type="application/rss+xml" title="Updates - Magnus Hultberg" href="/updates/feed.xml">');
  });
});
