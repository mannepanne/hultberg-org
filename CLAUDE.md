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
The Worker currently returns a hardcoded 404 response for all requests. This appears to be a migration in progress, as the `public/` directory contains a full website structure that should be served through proper asset handling.

## TypeScript Configuration
- Target: ESNext modules for Cloudflare Workers runtime
- Strict mode enabled
- Cloudflare Workers types included
- Source maps enabled for debugging
