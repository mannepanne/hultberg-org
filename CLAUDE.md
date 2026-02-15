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

## Getting Started

### Prerequisites
- Node.js (v18 or later)
- npm (comes with Node.js)
- Wrangler CLI (installed as dev dependency)
- Git
- GitHub CLI (`gh`) for PR operations

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd hultberg-org

# Install dependencies
npm install

# Start local development server
npm run dev
```

The site will be available at `http://localhost:8787`

### Commands

#### Development
```bash
npm run dev        # Start local development server using Wrangler
```

#### Deployment
```bash
wrangler deploy    # Deploy to Cloudflare Workers (requires Wrangler authentication)
```

#### Testing
Note: The project currently has a placeholder test script that needs implementation.

```bash
npm test           # Currently exits with placeholder message
```

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

## Project Structure

```
hultberg-org/
├── .claude/                  # Claude Code configuration
│   └── skills/               # Custom Claude Code skills
│       ├── review-pr/        # Single-reviewer PR review skill
│       └── review-pr-team/   # Multi-reviewer PR review skill
├── public/                   # Static assets (served by Cloudflare)
│   ├── images/               # Site images
│   ├── now/                  # Historical /now pages
│   ├── errors/               # Error pages (404, etc.)
│   └── index.html            # Homepage
├── src/                      # TypeScript source code
│   ├── index.ts              # Main Worker entry point
│   ├── types.ts              # TypeScript type definitions
│   └── utils.ts              # Utility functions
├── SPECIFICATIONS/           # Feature specifications and requirements
│   ├── *-mvp.md              # Feature MVP specifications
│   ├── *-security.md         # Security requirements
│   └── *-implementation.md   # Implementation plans
├── CLAUDE.md                 # This file - project documentation
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── wrangler.toml             # Cloudflare Workers configuration
```

### Key Files

- **`src/index.ts`** - Main Worker fetch handler, processes requests not matched by static assets
- **`src/types.ts`** - TypeScript interfaces for Worker environment and data structures
- **`src/utils.ts`** - Shared utility functions (slug generation, etc.)
- **`public/index.html`** - Homepage, served directly by Cloudflare
- **`wrangler.toml`** - Worker configuration including routes and asset handling
- **`SPECIFICATIONS/`** - Contains detailed feature specs, security requirements, and implementation plans

## Code Conventions

### File Comments
All TypeScript files should start with `// ABOUT:` comments explaining the file's purpose:

```typescript
// ABOUT: Brief description of file purpose
// ABOUT: Key functionality or responsibility
```

### Naming Conventions
- Use descriptive, meaningful names for variables and functions
- Follow TypeScript naming conventions (camelCase for variables/functions, PascalCase for types/interfaces)
- Avoid temporal references in names (no "new", "improved", "old", etc.)

### Comments
- Keep comments evergreen (describe what code does, not recent changes)
- Avoid over-commenting - code should be self-documenting where possible
- Add comments for complex logic or non-obvious decisions

## Development Workflow

### Creating Features
1. Create a feature branch from `main`: `git checkout -b feature/feature-name`
2. Check `SPECIFICATIONS/` for relevant feature specs
3. Implement following the specification and code conventions
4. Test locally with `npm run dev`
5. Create a PR when ready for review

### Pull Request Review
This project has two PR review skills available:

- **`/review-pr`** - Fast single full-stack developer review (~1-2 min)
  - Use for regular implementation PRs
  - Quick sanity checks
  - Standard feature work

- **`/review-pr-team`** - Comprehensive multi-perspective review (~3-5 min)
  - Use for critical infrastructure changes
  - Security-sensitive features
  - Major architectural decisions

### Deployment
Deployment to Cloudflare Workers happens via:
- Manual: `wrangler deploy`
- Automated: GitHub Actions (if configured)

## Environment & Secrets

Cloudflare Workers use secrets for sensitive configuration:

- Secrets are configured via `wrangler secret put <SECRET_NAME>`
- Never commit secrets to the repository
- Secrets are accessed via the `env` parameter in the Worker's fetch handler

Common secrets (check `src/types.ts` for the `Env` interface):
- API keys
- Authentication tokens
- Service credentials

## Testing

**Current State:** Test infrastructure is not yet implemented.

**Future:** Tests should cover:
- Unit tests for utility functions
- Integration tests for Worker endpoints
- TypeScript compilation validation

## Troubleshooting

### Local Development Issues

**Port already in use:**
```bash
# Kill existing Wrangler process
pkill -f wrangler
# Or specify a different port
wrangler dev --port 8788
```

**TypeScript errors:**
```bash
# Check TypeScript compilation
npx tsc --noEmit
```

**Dependency issues:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Deployment Issues

**Authentication errors:**
```bash
# Re-authenticate with Cloudflare
wrangler login
```

**Build failures:**
- Check TypeScript compilation with `npx tsc --noEmit`
- Ensure all dependencies are in `package.json`
- Verify `wrangler.toml` configuration is valid
