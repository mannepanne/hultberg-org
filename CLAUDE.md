# CLAUDE.md

Navigation index and quick reference for working with this project.

## Rules of Engagement

Collaboration principles and ways of working: [@.claude/CLAUDE.md](./.claude/CLAUDE.md)

When asked to remember anything, add project memory in this CLAUDE.md (project root), not @.claude/CLAUDE.md.

## Project Overview

Personal website for Magnus Hultberg (hultberg.org), built as a Cloudflare Worker with:
- Homepage and static pages (`/now`, error pages) served via Cloudflare Assets
- Blog-style **Updates** feature (`/updates`) for publishing personal updates
- Password-protected **Admin** interface (`/admin`) for managing content
- Content stored as JSON in GitHub, deployed automatically via GitHub Actions

## Quick Start

```bash
# Install and run
npm install
npm run dev          # Starts at http://localhost:8787

# Test and deploy
npm test             # Run test suite
npx tsc --noEmit     # Type check
wrangler deploy      # Deploy (or auto-deploy via GitHub Actions on push to main)
```

## Architecture Overview

### Request Flow
- **Static assets** (homepage, `/now`, images) → Cloudflare Assets (Worker never runs)
- **Dynamic routes** (`/updates`, `/admin/*`) → Worker's fetch handler in `src/index.ts`

### Key Architectural Pattern
Worker reads static JSON files via `env.ASSETS.fetch()` (not plain `fetch()`) to avoid Worker routing loop:

```typescript
// Correct
const response = await (env.ASSETS?.fetch(new Request(url)) ?? fetch(url));

// Wrong - re-enters Worker routing
const response = await fetch(url);
```

### Deployment Pipeline
1. Admin publishes update via browser → Worker commits JSON to GitHub
2. GitHub Actions triggers → generates `index.json` → deploys Worker
3. Live in ~2 minutes

## Project Structure

```
hultberg-org/
├── .claude/              # Claude Code config and skills
├── public/               # Static assets (HTML, images, JSON data)
├── src/                  # TypeScript Worker code
│   ├── index.ts          # Main router
│   ├── types.ts          # Env, Update interfaces
│   ├── auth.ts           # Authentication middleware
│   ├── github.ts         # GitHub API client
│   └── routes/           # Route handlers
├── tests/                # Vitest test suite
├── SPECIFICATIONS/       # Active feature specs and plans
│   └── ARCHIVE/          # Completed specs
├── REFERENCE/            # Implementation documentation
└── scripts/              # Build scripts (generate-index.js)
```

## Key Files

- **`src/index.ts`** - Route registration
- **`src/types.ts`** - `Env`, `Update`, `UpdateIndex` interfaces
- **`src/github.ts`** - `GITHUB_REPO` constant and GitHub operations
- **`wrangler.toml`** - KV bindings and `binding = "ASSETS"` declaration

## Documentation Structure

This project uses a **lifecycle-based documentation pattern**:

### SPECIFICATIONS/
Forward-looking plans for features being built:
- Active specs remain here during planning and implementation
- Completed specs move to `SPECIFICATIONS/ARCHIVE/`

### REFERENCE/
How-it-works documentation for implemented features:
- **[testing-strategy.md](./REFERENCE/testing-strategy.md)** - Testing philosophy and approach
- **[technical-debt.md](./REFERENCE/technical-debt.md)** - Known issues and accepted risks
- **[blog-security.md](./REFERENCE/blog-security.md)** - Security implementation patterns
- **[environment-setup.md](./REFERENCE/environment-setup.md)** - Secrets and KV configuration
- **[troubleshooting.md](./REFERENCE/troubleshooting.md)** - Common issues and solutions
- **[web-analytics.md](./REFERENCE/web-analytics.md)** - GA4 and Cloudflare Web Analytics setup

## Code Conventions

### File Headers
```typescript
// ABOUT: Brief description of file purpose
// ABOUT: Key functionality or responsibility
```

### Naming
- Descriptive names: `AUTH_KV` not `KV1`
- TypeScript conventions: camelCase (variables), PascalCase (types)
- Avoid temporal references: no "new", "improved", "old"

### Comments
- Evergreen (describe what code does, not recent changes)
- Minimal (code should be self-documenting)
- Explain complex logic and non-obvious decisions

## Development Workflow

1. Create feature branch: `git checkout -b feature/feature-name`
2. Check `SPECIFICATIONS/` for relevant specs
3. Implement with tests: `npm test && npx tsc --noEmit`
4. Create PR for review:
   - **`/review-pr`** - Fast single-reviewer (regular PRs)
   - **`/review-pr-team`** - Multi-perspective (critical changes)

## TypeScript Configuration

- Target: ESNext for Cloudflare Workers runtime
- Strict mode enabled
- Path alias: `@/` maps to `./src/`
- Workers types included

## Testing

Tests serve dual purpose:
1. **Validation** - Verify code works
2. **Directional Context** - Guide AI development

**Commands:**
```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

**Coverage target:** 100% (enforced minimums: 95% lines/functions/statements, 90% branches)

**See:** [testing-strategy.md](./REFERENCE/testing-strategy.md) for complete details

## Quick Reference Links

- **Getting unstuck?** → [troubleshooting.md](./REFERENCE/troubleshooting.md)
- **Setting up environment?** → [environment-setup.md](./REFERENCE/environment-setup.md)
- **Security patterns?** → [blog-security.md](./REFERENCE/blog-security.md)
- **Known issues?** → [technical-debt.md](./REFERENCE/technical-debt.md)
- **Analytics setup?** → [web-analytics.md](./REFERENCE/web-analytics.md)
- **Testing strategy?** → [testing-strategy.md](./REFERENCE/testing-strategy.md)
- **Completed specs?** → [SPECIFICATIONS/ARCHIVE/](./SPECIFICATIONS/ARCHIVE/)
