# Environment & Secrets Setup

Configuration guide for Cloudflare Workers secrets and local development environment.

## Cloudflare Secrets

Secrets are configured via `wrangler secret put <SECRET_NAME>` and accessed via the `env` parameter in the Worker's fetch handler.

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

## Local Development with Secrets

Create a `.dev.vars` file (already in `.gitignore`):
```
ADMIN_EMAIL=magnus.hultberg@gmail.com
JWT_SECRET=local-dev-secret-key-not-for-production
RESEND_API_KEY=re_your_resend_api_key
GITHUB_TOKEN=github_pat_your_token
```

Wrangler automatically loads `.dev.vars` during `npm run dev`.

## KV Namespaces

Two KV namespaces are declared in `wrangler.toml` and automatically available in the Worker:

- **AUTH_KV** (`env.AUTH_KV`) - Stores magic link tokens (15-minute TTL)
- **RATE_LIMIT_KV** (`env.RATE_LIMIT_KV`) - Stores rate limiting counters (1-minute TTL)

The ASSETS binding (`env.ASSETS`) is also declared in `wrangler.toml` — this is required to access static files from the Worker.

See `src/types.ts` for the complete `Env` interface.
