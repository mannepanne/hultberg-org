# CLAUDE.md

This file acts as project memory and provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Rules of Engagement

Claude collaboration and ways of working instructions: @.claude/CLAUDE.md

When asked to remember anything, always add project memory in this CLAUDE.md (in the project root), not @.claude/CLAUDE.md, leave @.claude/CLAUDE.md as it is.

## Project Overview

This is the personal website for Magnus Hultberg (hultberg.org), built as a Cloudflare Worker. The site includes:
- A homepage and static pages (`/now`, error pages) served directly from Cloudflare Assets
- A blog-style **Updates** feature (`/updates`) for publishing personal updates
- A password-protected **Admin** interface (`/admin`) for creating, editing, and managing updates
- Content stored as JSON files in the GitHub repository, deployed automatically via GitHub Actions

The blog feature is fully implemented and live in production. See [blog-style-updates-mvp.md](./SPECIFICATIONS/blog-style-updates-mvp.md) for the complete feature specification.

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

**Note:** `npm run dev` runs `predev` first, which generates `public/updates/data/index.json` from the individual update JSON files. This is required for the updates listing page to work locally.

### Commands

#### Development
```bash
npm run dev        # Generate index.json then start local dev server (Wrangler)
```

#### Deployment
```bash
wrangler deploy    # Deploy to Cloudflare Workers (requires Wrangler authentication)
```

Deployment also happens automatically via GitHub Actions on push to `main`.

#### Testing
```bash
npm test                  # Run all tests once
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report
npm run test:ui           # Interactive UI for test exploration
npm run test:changed      # Run tests for changed files only
```

## Architecture

### Cloudflare Worker Structure
- **Entry Point**: `src/index.ts` - Main Worker fetch handler; routes all requests
- **Asset Handling**: Cloudflare Workers Assets serves static files from `public/` **before** the Worker runs (`run_worker_first = false`)
- **Configuration**: `wrangler.toml` defines Worker settings, KV bindings, and asset handling
- **ASSETS binding**: `binding = "ASSETS"` in `wrangler.toml` exposes `env.ASSETS` (type `Fetcher`) in the Worker — **this must be explicitly declared or ****`env.ASSETS`**** will be undefined**

### Request Routing
- Static assets (homepage, `/now`, images) → served directly by Cloudflare, Worker never runs
- Dynamic routes → Worker's fetch handler in `src/index.ts`
  - `/updates` → updates listing page
  - `/updates/{slug}` → individual update page
  - `/updates/feed.xml` → RSS feed
  - `/images/updates/*` → proxied from GitHub raw content (so images are served without needing a full redeploy after each upload)
  - `/admin/*` → admin UI and API
  - Everything else → custom 404 page

### Static File Serving Gotcha
When the Worker needs to read JSON data files (like `index.json` or individual update files), it must use `env.ASSETS.fetch()` rather than plain `fetch()`. A plain `fetch()` on the same origin re-enters Worker routing and bypasses the static asset store, causing 404s.

```typescript
// Correct: goes directly to Cloudflare's asset store
const response = await (env.ASSETS?.fetch(new Request(url)) ?? fetch(url));

// Wrong: re-enters Worker routing, misses static files
const response = await fetch(url);
```

### Content Storage
Updates are stored as JSON files committed to the GitHub repository:
```
public/
  updates/
    data/
      {slug}.json      # Individual update data (committed by Worker via GitHub API)
      index.json       # Generated at build time — never commit this file
  images/
    updates/
      {slug}/          # Images for a specific update
        image1.jpg
```

`index.json` is gitignored and generated automatically:
- **Locally**: by `predev` script before `npm run dev`
- **On deploy**: by GitHub Actions before `wrangler deploy`

### Deployment Pipeline
1. Admin saves/publishes an update via the browser editor
2. Worker commits the update JSON to GitHub via the GitHub API (`env.GITHUB_TOKEN`)
3. GitHub Actions triggers on push to `main`
4. Action runs `node scripts/generate-index.js` to rebuild `index.json`
5. Action runs `wrangler deploy` — new content is live within ~2 minutes

## TypeScript Configuration
- Target: ESNext modules for Cloudflare Workers runtime
- Strict mode enabled
- Cloudflare Workers types included
- Source maps enabled for debugging
- Path alias `@/` maps to `./src/` for clean imports

## Project Structure

```
hultberg-org/
├── .claude/                  # Claude Code configuration
│   └── skills/               # Custom Claude Code skills
│       ├── review-pr/        # Single-reviewer PR review skill
│       └── review-pr-team/   # Multi-reviewer PR review skill
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions: generate index, deploy to Cloudflare
├── public/                   # Static assets (served by Cloudflare Assets)
│   ├── images/               # Site images (including /images/updates/ for blog images)
│   ├── now/                  # Historical /now pages
│   ├── errors/               # Error pages (404 etc.)
│   ├── index.html            # Homepage
│   └── updates/
│       └── data/             # Update JSON files (index.json gitignored, others committed)
├── scripts/
│   └── generate-index.js     # Builds index.json from individual update files
├── src/                      # TypeScript source code (Cloudflare Worker)
│   ├── index.ts              # Main Worker entry point and request router
│   ├── types.ts              # TypeScript interfaces (Env, Update, UpdateIndex)
│   ├── utils.ts              # Shared utilities (slug generation, HTML escaping)
│   ├── auth.ts               # JWT-based authentication middleware
│   ├── email.ts              # Resend.com email sending (magic links)
│   ├── github.ts             # GitHub API client (read/write update files)
│   └── routes/               # Route handlers (one file per route)
│       ├── adminDashboard.ts # GET /admin/dashboard
│       ├── adminEditor.ts    # GET /admin/updates/new and /admin/updates/{slug}/edit
│       ├── adminLogin.ts     # GET /admin (login page)
│       ├── adminLogout.ts    # POST /admin/logout
│       ├── adminPreview.ts   # GET /admin/preview/{slug}
│       ├── deleteImage.ts    # DELETE /admin/api/delete-image
│       ├── deleteUpdate.ts   # DELETE /admin/api/delete-update
│       ├── listUpdates.ts    # GET /admin/api/updates
│       ├── rssFeed.ts        # GET /updates/feed.xml
│       ├── saveUpdate.ts     # POST /admin/api/save-update
│       ├── sendMagicLink.ts  # POST /admin/api/send-magic-link
│       ├── updatePage.ts     # GET /updates/{slug}
│       ├── updatesListing.ts # GET /updates
│       ├── uploadImage.ts    # POST /admin/api/upload-image
│       └── verifyToken.ts    # GET|POST /admin/api/verify-token
├── tests/                    # Test suite (Vitest)
│   ├── unit/                 # Unit tests for individual functions
│   ├── integration/          # Integration tests for routes and APIs
│   ├── e2e/                  # End-to-end workflow tests
│   ├── fixtures/             # Test data and fixtures
│   └── mocks/                # Reusable mocks (KVNamespace, Env, GitHub API)
├── SPECIFICATIONS/           # Feature specifications and requirements
│   ├── blog-style-updates-mvp.md       # Blog feature MVP spec
│   ├── blog-updates-implementation.md  # Phase-by-phase implementation plan
│   ├── blog-updates-security.md        # Security design and requirements
│   ├── technical-debt.md               # Known tech debt and accepted risks
│   └── testing-strategy-plan.md        # Testing philosophy and approach
├── CLAUDE.md                 # This file — project documentation and onboarding
├── package.json              # Dependencies and npm scripts
├── tsconfig.json             # TypeScript configuration
├── vitest.config.ts          # Vitest test runner configuration
└── wrangler.toml             # Cloudflare Workers configuration
```

### Key Files

- **`src/index.ts`** - All routes registered here; add new routes to the appropriate section
- **`src/types.ts`** - `Env`, `Update`, `UpdateIndex`, `UpdateStatus` interfaces; update when adding new bindings or data fields
- **`src/github.ts`** - `GITHUB_REPO` constant and all GitHub API operations (fetch, save, delete updates and images)
- **`src/auth.ts`** - `requireAuth()` middleware; returns the authed email string or a 401/302 Response
- **`wrangler.toml`** - KV namespace bindings and `binding = "ASSETS"` declaration

## Code Conventions

### File Comments
All TypeScript files start with `// ABOUT:` comments explaining the file's purpose:

```typescript
// ABOUT: Brief description of file purpose
// ABOUT: Key functionality or responsibility
```

### Naming Conventions
- **Always provide context through naming** — `AUTH_KV` and `RATE_LIMIT_KV` over `KV1` or `storage`
- Use descriptive, meaningful names for variables and functions
- Follow TypeScript naming conventions (camelCase for variables/functions, PascalCase for types/interfaces)
- Avoid temporal references in names (no "new", "improved", "old", etc.)

### Comments
- Keep comments evergreen (describe what the code does, not recent changes)
- Avoid over-commenting — code should be self-documenting where possible
- Add comments for complex logic or non-obvious decisions

## Development Workflow

### Creating Features
1. Create a feature branch from `main`: `git checkout -b feature/feature-name`
2. Check `SPECIFICATIONS/` for relevant feature specs
3. Implement following the specification and code conventions
4. Write tests alongside implementation
5. Run `npm test && npx tsc --noEmit` before committing
6. Create a PR when ready for review

### Pull Request Review
This project has two PR review skills available:

- **`/review-pr`** - Fast single full-stack developer review (~1-2 min)
  - Use for regular implementation PRs
  - Quick sanity checks
  - Standard feature work

- **`/review-pr-team`** - Comprehensive multi-perspective review (~3-5 min)
  - Use for critical infrastructure changes
  - Security-sensitive features
  - Major architectural decisions and initial review of new feature/project plans

### Deployment
- **Manual**: `wrangler deploy`
- **Automated**: GitHub Actions deploys on every push to `main`

## Environment & Secrets

Cloudflare Workers use secrets for sensitive configuration. Secrets are configured via `wrangler secret put <SECRET_NAME>` and accessed via the `env` parameter in the Worker's fetch handler.

### Required Secrets

#### ADMIN_EMAIL
Email address authorized for admin access (single admin user).
```bash
npx wrangler secret put ADMIN_EMAIL
# Enter: magnus.hultberg@gmail.com
```

#### JWT_SECRET
Secret key for signing authentication JWTs. Must be a strong random string (32+ characters).
```bash
npx wrangler secret put JWT_SECRET
# Generate a strong value with: openssl rand -base64 32
```

#### RESEND_API_KEY
API key for Resend.com email service (magic link emails).
```bash
npx wrangler secret put RESEND_API_KEY
# Enter: re_xxxxxxxxx (your Resend API key)
```

#### GITHUB_TOKEN
GitHub Personal Access Token for committing updates via API.
- Scope: fine-grained token, Contents (Read and write) for the `hultberg-org` repository
```bash
npx wrangler secret put GITHUB_TOKEN
# Enter: github_pat_xxxxxxxxx (your GitHub token)
```

### Verifying Secrets
```bash
npx wrangler secret list    # List configured secrets
npx wrangler secret delete SECRET_NAME  # Remove a secret
```

### Local Development with Secrets

Create a `.dev.vars` file (already in `.gitignore`):
```
ADMIN_EMAIL=magnus.hultberg@gmail.com
JWT_SECRET=local-dev-secret-key-not-for-production
RESEND_API_KEY=re_your_resend_api_key
GITHUB_TOKEN=github_pat_your_token
```

Wrangler automatically loads `.dev.vars` during `npm run dev`.

### KV Namespaces

Two KV namespaces are declared in `wrangler.toml` and automatically available in the Worker:

- **AUTH\_KV** (`env.AUTH_KV`) - Stores magic link tokens (15-minute TTL)
- **RATE\_LIMIT\_KV** (`env.RATE_LIMIT_KV`) - Stores rate limiting counters (1-minute TTL)

The ASSETS binding (`env.ASSETS`) is also declared in `wrangler.toml` — this is required to access static files from the Worker (see [Static File Serving Gotcha](#static-file-serving-gotcha) above).

See `src/types.ts` for the complete `Env` interface.

## Testing

### Philosophy: Tests as Development Guardrails

Tests in this project serve a dual purpose beyond traditional validation:

1. **Validation** — Verify code works correctly
2. **Directional Context** — Guide AI agents on what to build and how to build it

Tests act as **executable specifications** that provide guardrails for agent-driven development. When an AI agent makes changes, tests should immediately signal if changes break existing functionality.

**For the complete testing strategy:** [testing-strategy-plan.md](./SPECIFICATIONS/testing-strategy-plan.md)

### Test-Driven Development Workflow

**For new features:**
1. Write tests first that describe expected behavior
2. Implement minimum code to make tests pass
3. Refactor while keeping tests green
4. Verify 100% coverage of new code

**For bug fixes:**
1. Write failing test that reproduces the bug
2. Fix the bug to make test pass
3. Add edge case tests to prevent regression

### Running Tests

```bash
npm test                  # Run all tests once
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report
npm run test:ui           # Interactive UI for test exploration
npm run test:changed      # Run tests for changed files only
```

### Test Structure

```
tests/
├── unit/          # Unit tests for individual functions
├── integration/   # Integration tests for routes and APIs
├── e2e/           # End-to-end workflow tests
├── fixtures/      # Test data (sample update JSON, etc.)
└── mocks/         # Reusable mock implementations
```

**Test files mirror source structure:**
- `src/utils.ts` → `tests/unit/utils.test.ts`
- `src/routes/updatePage.ts` → `tests/integration/updatePage.test.ts`

### Coverage Requirements

**Target:** 100% code coverage (every line should have a clear purpose)

**Enforced minimums:**
- 95% lines, functions, statements
- 90% branches

### Path Alias Configuration

Tests and source code use the `@/` path alias for clean imports:

```typescript
// Instead of: import { Env } from '../../src/types';
import { Env } from '@/types';
```

### Mocking Strategy

**Reusable mocks in ****`tests/mocks/`****:**
- `createMockKV()` - In-memory KVNamespace for testing
- `createMockEnv()` - Test environment configuration with sensible defaults
- GitHub API responses mocked via `vi.stubGlobal('fetch', ...)` or similar

**What to mock:**
- External services (GitHub API, Resend API, Cloudflare KV, ASSETS binding)
- `fetch()` calls to external URLs

**What NOT to mock:**
- Core logic (slug generation, markdown parsing, validation)

### Pre-Commit Validation

Before committing, run:
```bash
npm test              # Verify all tests pass
npx tsc --noEmit      # Check TypeScript compilation
```

## Troubleshooting

### Local Development Issues

**Port already in use:**
```bash
pkill -f wrangler
# Or specify a different port
wrangler dev --port 8788
```

**TypeScript errors:**
```bash
npx tsc --noEmit
```

**Updates listing shows no content locally:**
```bash
node scripts/generate-index.js   # Regenerate index.json from local update files
```

**Dependency issues:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Deployment Issues

**Authentication errors:**
```bash
wrangler login
```

**Build failures:**
- Check TypeScript compilation with `npx tsc --noEmit`
- Ensure all dependencies are in `package.json`
- Verify `wrangler.toml` configuration is valid

**Images not loading after upload:**
- Images are served via the Worker's image proxy route (`/images/updates/*`)
- The proxy fetches from `raw.githubusercontent.com` — newly committed images may take a few minutes to propagate
- Check that the `GITHUB_REPO` constant in `src/github.ts` matches your actual repo path

**`env.ASSETS`**** is undefined:**
- Ensure `wrangler.toml` has `binding = "ASSETS"` under `[assets]`
- Without this, `env.ASSETS?.fetch()` silently falls back to `fetch()`, which re-enters Worker routing

## Web Analytics

The site uses **two analytics solutions** for traffic monitoring:

### Google Analytics 4 (GA4)
- **Measurement ID**: `G-D1L22CCJTJ`
- Implemented site-wide via gtag.js snippet
- Tracks pageviews, user journeys, and referral sources
- Implemented in all static pages (`public/`) and Worker-rendered routes (`src/routes/`)

### Cloudflare Web Analytics
- **Token**: `f71c3c28b82c4c6991ec3d41b7f1496f`
- Privacy-first, cookie-free alternative to GA4
- Implemented site-wide via beacon.min.js snippet
- Provides pageviews, referrers, and visitor data without cookies or invasive tracking
- Located in Cloudflare dashboard under Analytics & Logs → Web Analytics

**Future consideration:** Evaluate Cloudflare Web Analytics for 3-6 months, then consider consolidating to only Cloudflare to reduce tracking script overhead. See [TD-013 in technical-debt.md](./SPECIFICATIONS/technical-debt.md) for details.

Both analytics scripts are included in:
- Static HTML pages (`public/index.html`, `public/now/index.html`, `public/errors/not_found.html`, etc.)
- Worker-rendered pages via template strings in `src/routes/updatePage.ts`, `src/routes/updatesListing.ts`, and inline 404 handler in `src/index.ts`

## Technical Debt

Known technical debt and accepted risks are tracked in [technical-debt.md](./SPECIFICATIONS/technical-debt.md).

Key items:
- **HTML Sanitization**: Regex-based XSS prevention in `src/routes/updatePage.ts` — acceptable for single trusted admin, defended in depth by CSP headers. Replace when a Workers-compatible allowlist sanitizer becomes available.
- **No pagination on /updates**: The listing page renders all published updates. Not an issue at low volume, but will need pagination as content grows.
- **Dual analytics setup**: Both Google Analytics and Cloudflare Web Analytics are implemented. Evaluate consolidating to Cloudflare-only after a trial period.
