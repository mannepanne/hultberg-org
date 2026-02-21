# Troubleshooting Guide

Common issues and solutions for local development and deployment.

## Local Development Issues

### Port already in use
```bash
pkill -f wrangler
# Or specify a different port
wrangler dev --port 8788
```

### TypeScript errors
```bash
npx tsc --noEmit
```

### Updates listing shows no content locally
```bash
node scripts/generate-index.js   # Regenerate index.json from local update files
```

### Dependency issues
```bash
rm -rf node_modules package-lock.json
npm install
```

## Deployment Issues

### Authentication errors
```bash
wrangler login
```

### Build failures
- Check TypeScript compilation with `npx tsc --noEmit`
- Ensure all dependencies are in `package.json`
- Verify `wrangler.toml` configuration is valid

### Images not loading after upload
- Images are served via the Worker's image proxy route (`/images/updates/*`)
- The proxy fetches from `raw.githubusercontent.com` — newly committed images may take a few minutes to propagate
- Check that the `GITHUB_REPO` constant in `src/github.ts` matches your actual repo path

### `env.ASSETS` is undefined
- Ensure `wrangler.toml` has `binding = "ASSETS"` under `[assets]`
- Without this, `env.ASSETS?.fetch()` silently falls back to `fetch()`, which re-enters Worker routing
