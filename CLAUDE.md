# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules of Engagement

Claude collaboration and ways of working instructions: @.claude/CLAUDE.md

When asked to remember anything, always add project memory in this CLAUDE.md (in the project root), not @.claude/CLAUDE.md, leave @.claude/CLAUDE.md as it is.

## Project Overview
This is a personal website for Magnus Hultberg (hultberg.org) built as a Cloudflare Worker. The architecture consists of:
- A TypeScript-based Cloudflare Worker (`src/index.ts`) that serves as the main entry point
- Static assets in the `public/` directory served through Cloudflare's asset handling
- Historical content including "now" pages with timestamped updates

## Commands

### Development
```bash
npm run dev        # Start local development server using Wrangler
```

### Deployment
```bash
wrangler deploy    # Deploy to Cloudflare Workers (requires Wrangler authentication)
```

Note: The project currently has a placeholder test script that needs implementation.

## Architecture

### Cloudflare Worker Structure
- **Entry Point**: `src/index.ts` - Main Worker export with fetch handler
- **Asset Handling**: Uses `@cloudflare/kv-asset-handler` for serving static files from `public/`
- **Configuration**: `wrangler.toml` defines Worker settings, compatibility date, and asset directory

### Static Content Organization
- **Public Directory**: Contains all static assets served by the Worker
- **Now Pages**: Historical snapshots in `public/now/` with timestamped filenames (format: `index_YYYYMMDD.CHANGED.html`)
- **Error Pages**: Custom 404 handling with `public/errors/not_found.html` and assets
- **SEO Files**: Standard web files like `sitemap_base.xml`, `foaf.rdf`, verification files

### Current Implementation Notes
Cloudflare Workers Assets serves static files from `public/` **before** the Worker's fetch handler runs (default `run_worker_first = false`). This means:
- Static assets (index.html, /now pages, images, etc.) are served directly by Cloudflare
- The Worker's fetch handler (`src/index.ts`) only executes for requests that don't match static files
- The Worker provides a custom 404 page with branding and helpful navigation for missing resources

The site is fully functional - there's no KV asset handler code needed in the Worker itself.

## TypeScript Configuration
- Target: ESNext modules for Cloudflare Workers runtime
- Strict mode enabled
- Cloudflare Workers types included
- Source maps enabled for debugging
