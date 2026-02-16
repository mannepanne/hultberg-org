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

We are currently implementing a blog feature in the site, see specification in [blog-style-updates-mvp.md](./SPECIFICATIONS/blog-style-updates-mvp.md) 

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
│   ├── *-plan.md             # Feature / project specification core documents
│   ├── *-mvp.md              # Feature / project MVP specifications
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
- **Always provide context through naming** - Variable and parameter names should supply relevant context without needing additional documentation. Names like `AUTH_KV` and `RATE_LIMIT_KV` are preferable to generic names like `KV1` or `storage`.
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
  - Major architectural decisions and initial review of new feature / project plans

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

### Philosophy: Tests as Development Guardrails

**Critical Concept:** Tests in this project serve a dual purpose beyond traditional validation:

1. **Validation** - Verify code works correctly (traditional testing)
2. **Directional Context** - Guide AI agents on what to build and how to build it

Tests act as **executable specifications** that provide guardrails for agent-driven development. When an AI agent makes changes, tests should:
- Immediately signal if changes break existing functionality
- Provide clear context about what each component should do
- Make it obvious when a change is going in the wrong direction
- Serve as living documentation that agents can read and understand

**This approach is inspired by [OpenAI's Harness Engineering](https://openai.com/index/harness-engineering/)** and is essential for productive collaboration between human developers and AI agents.

**For complete testing strategy, philosophy, and implementation details:** [testing-strategy-plan.md](./SPECIFICATIONS/testing-strategy-plan.md)

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
└── mocks/         # Reusable mock implementations
```

**Test files mirror source structure:**
- `src/utils/slugGeneration.ts` → `tests/unit/slugGeneration.test.ts`
- `src/routes/updatesList.ts` → `tests/integration/updatesList.test.ts`

### Coverage Requirements

**Target:** 100% code coverage (every line should have a clear purpose)

**Enforced minimums:**
- 95% lines, functions, statements
- 90% branches

**Why 100%?** Untested code is unclear about its purpose and constraints. If we can't test it, maybe we don't need it. Agents need complete context about all code paths.

### Path Alias Configuration

Tests and source code use the `@/` path alias for clean imports:

```typescript
// Instead of: import { Env } from '../../src/types';
import { Env } from '@/types';
```

This improves readability and prevents brittle relative path imports.

### Clear Naming: Essential for Agent Context

**Critical principle:** Variable, parameter, function, and file names must communicate what they are about without needing additional documentation.

**Good naming examples:**
- `AUTH_KV` and `RATE_LIMIT_KV` (clear purpose) vs `KV1` and `KV2` (ambiguous)
- `generateSlugFromTitle()` vs `generate()`
- `isUserAuthenticated()` vs `check()`
- `tests/unit/slugGeneration.test.ts` vs `tests/test1.ts`

**Why this matters for agents:**
- Agents rely heavily on names to understand context and intent
- Descriptive names reduce the need for agents to read full implementations
- Clear names make tests self-documenting
- Good names prevent agents from making incorrect assumptions

**General naming conventions:**
- Use descriptive, meaningful names (not abbreviations unless standard)
- Follow TypeScript conventions (camelCase for variables/functions, PascalCase for types)
- Avoid temporal references (no "new", "improved", "old", etc.)
- Test files: `{module}.test.ts` format

### Test Principles

1. **Tests define expected behavior** - Living specifications
2. **Tests are self-contained** - Each test sets up and cleans up
3. **Tests fail fast with clear messages** - Explain what/where/why
4. **Tests are runnable in isolation** - No dependencies on other tests
5. **100% coverage goal** - Every line has clear purpose

### Mocking Strategy

**Reusable mocks in `tests/mocks/`:**
- `createMockKV()` - In-memory KVNamespace for testing
- `createMockEnv()` - Test environment configuration with sensible defaults

**What to mock:**
- External services (GitHub API, Resend API, Cloudflare KV)
- Static assets (file system reads)

**What NOT to mock:**
- Core logic (slug generation, markdown parsing, validation)
- These are the primary value of our code

### Pre-Commit Validation

Before committing, run:
```bash
npm test              # Verify all tests pass
npx tsc --noEmit      # Check TypeScript compilation
```

Future: Pre-commit hooks will automate this validation.

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

## Technical Debt

This section tracks known technical debt and decisions to accept certain risks for MVP, with plans for future improvement.

### HTML Sanitization (XSS Prevention)

**Status:** Accepted risk for MVP (February 2026)

**Current Implementation:**
- Regex-based HTML sanitization in `src/routes/updatePage.ts`
- Removes dangerous tags (`script`, `iframe`, `object`, `embed`, etc.)
- Removes dangerous protocols (`javascript:`, `data:`, `vbscript:`, etc.)
- Removes inline event handlers and style attributes
- Located in `sanitizeHTML()` function with TODO comment

**Known Limitations:**
- Regex-based approach can potentially be bypassed with edge cases
- Does not implement proper allowlist-based tag/attribute filtering
- Industry best practice would be allowlist parser, not regex filtering

**Why This Is Acceptable for MVP:**

1. **Threat Model:** Single trusted admin (Magnus) - no untrusted user input
2. **Defense-in-Depth:**
   - Content Security Policy (CSP) headers block XSS execution even if sanitization fails
   - Server-side rendering only (no client-side markdown parsing)
   - HTML escaping for all metadata (title, author, excerpt)
   - Content version-controlled in GitHub (easy rollback)
3. **Risk Assessment:**
   - Main risk: Admin accidentally pastes malicious content into own blog
   - Secondary risk: GitHub account compromise (but then bigger problems exist)
   - CSP headers provide strong secondary defense

**Future Improvement Plan:**

Monitor these libraries for Cloudflare Workers compatibility:
- `isomorphic-dompurify` - Currently fails in Workers (as of Dec 2025)
- `sanitize-html` - Requires node::process, not available in Workers
- `worker-tools/html` - Templating library with built-in sanitization (requires rewrite)

**Decision Made:** February 2026 by Magnus (project owner)

**When to Revisit:**
- Before adding multi-user admin access
- Before accepting any form of public user input (comments, submissions)
- When Workers-compatible sanitization library becomes available
- If CSP headers are removed for any reason

**Testing:**
Comprehensive XSS test suite in `tests/integration/updatePage.test.ts` covering:
- Script tags and event handlers
- Case variation attacks
- Alternative protocols (vbscript:, data:)
- Dangerous tags (iframe, object, embed)
- Event handlers with unusual spacing
- Style attribute expressions
