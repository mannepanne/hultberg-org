# GSC Insights & Alerts (Layer 1)

**Status:** 📝 Draft — pending review
**Created:** 2026-04-18
**Depends on:** `/sitemap.xml` route (PR #27, merged 2026-04-18)

## Overview

Add daily Google Search Console (GSC) monitoring to hultberg.org, with status surfaced on the `/admin/dashboard`, email alerts for severe issues, and lightweight pre-publish lint warnings in the update editor. Email delivery uses **Cloudflare Email Sending** (currently in beta) with **Resend as a documented fallback**, giving us a real-world test of the new CF service without putting auth emails at risk.

This is **Layer 1** of a two-layer plan agreed during discovery on 2026-04-18:

- **Layer 1 (this spec):** read-only monitoring + alerts + pre-publish lint. Always on, zero risk.
- **Layer 2 (deferred, placeholder section below):** bounded auto-fix for a narrow allowlist of operations. Will be specced separately once Layer 1 has produced enough real data to know which fixers are actually worth building.

## Motivation

Google Search Console flagged hultberg.org for not having a sitemap (now fixed). Beyond that one-off, regular GSC issues will keep cropping up (sitemap entries that 404 after a slug change, indexing decisions, performance dips), and Magnus doesn't want to manually visit Search Console to find out. A small monitoring layer surfaces what matters and quietly ignores noise.

The Cloudflare Email Sending service just opened up to Magnus's account (private beta, announced Nov 2025). This feature is the right low-stakes use case to try it on: if an alert is delayed or lost, no harm done. Magic-link auth emails stay on Resend.

## Non-goals

Explicitly **out of scope** for Layer 1:

- Layer 2 autonomous fixers — deferred until we have real data
- Migrating magic-link auth emails off Resend
- Bulk URL Inspection across all pages (rate-limited to ~2,000/day per property; we'll spot-check, not sweep)
- Indexing API (officially JobPosting/BroadcastEvent only — won't help us reindex updates anyway)
- Real-time monitoring (daily cron is plenty for a personal site)
- Historical performance dashboards beyond a 28-day rolling window

## Architecture

### High-level flow

```
Cron (daily 08:00 UTC)
   ↓
scheduled() handler
   ↓
GSC API client
   ├─ sitemaps.get  (sitemap status, errors)
   ├─ searchanalytics.query  (clicks, impressions, top queries)
   └─ urlInspection.index.inspect  (spot-check homepage + newest 3 updates)
   ↓
Compare against previous snapshot in KV
   ↓
   ├─ Persist new snapshot to GSC_KV
   ├─ Render dashboard payload
   └─ Detect severe events → notifier
                                ↓
                        env.SEND_EMAIL.send(...)
                                ↓ (on failure)
                        Resend fallback
```

### Authentication to GSC

**Choice:** Google service account, added as a user on the Search Console property.

- No human OAuth flow, no refresh-token plumbing.
- Service account JSON stored as a wrangler secret (`GSC_SERVICE_ACCOUNT_JSON`) — single-line stringified JSON.
- Worker signs a JWT with RS256 using Web Crypto (`SubtleCrypto.sign`), exchanges it for an OAuth access token at `https://oauth2.googleapis.com/token`, caches the token in memory for its 1h lifetime.
- **Setup ceremony** (one-time, documented in `REFERENCE/environment-setup.md`):
  1. Create service account in a Google Cloud project, generate JSON key.
  2. Enable the Search Console API on the project.
  3. Add the service account email as a user (with Owner or Full permissions) on the `https://hultberg.org/` property in Search Console.
  4. `wrangler secret put GSC_SERVICE_ACCOUNT_JSON` (paste the JSON).

### Storage

New KV namespace: **`GSC_KV`**.

| Key pattern | Contents | TTL |
|---|---|---|
| `status:latest` | Most recent full snapshot (sitemap status, indexed count, top queries, alert flags) | none |
| `status:history:{YYYYMMDD}` | Daily snapshot for trend lines | 35 days |
| `alert:dedup:{type}:{key}` | Prevents repeated alerts for the same issue within 24h | 24h |
| `lint:rules` | Cached lint rule config (future-proofing; static for v1) | none |

### Scheduling

Cloudflare Workers Cron Triggers — native, free, no external scheduler.

- Schedule: `0 8 * * *` (08:00 UTC daily)
- Trigger registered in `wrangler.toml`
- New `scheduled(event, env, ctx)` export added alongside existing `fetch` handler in `src/index.ts`

### Email delivery

A new `src/notifier.ts` module abstracts email sending behind a single `sendAlert(env, alert)` function:

1. If `env.SEND_EMAIL` binding is available, call `env.SEND_EMAIL.send(...)`.
2. On thrown error or non-success response, fall back to Resend via the existing `src/email.ts` pattern (extracted into a reusable `sendViaResend(env, ...)` helper).
3. Log which path was used (`provider:cf` / `provider:resend-fallback`) so we can monitor CF Email Sending reliability over time.

The magic-link auth email in `src/email.ts` is **not migrated** — it continues to call Resend directly. Documented decision (see ADR below).

## Surface areas

### 1. Admin dashboard widget

A new card on `/admin/dashboard` showing:

- **Sitemap status:** last submitted, last downloaded, errors/warnings count, indexed-vs-submitted ratio
- **Indexing health:** current indexed count + 7/28-day delta
- **Top queries (last 28 days):** top 5 by clicks, with impressions and CTR
- **Recent alerts:** last 3 alerts (severity, message, timestamp), dismissable
- **Data freshness:** "Last refreshed: X hours ago" — turns red if >36h
- **Manual refresh button:** triggers the same code path as the cron, useful during development and when Magnus is curious

Implementation:
- Server-side: `GET /admin/api/gsc-status` returns `status:latest` from KV (auth-gated like other admin APIs)
- Server-side: `POST /admin/api/refresh-gsc` re-runs the GSC poll on demand
- Client-side: `public/admin/gsc-widget.js` fetches and renders into a container in `adminDashboard.ts`

### 2. Email alerts

Sent only for **severe** events (high signal, low frequency):

| Event | Trigger | Severity |
|---|---|---|
| Indexed-page count drop ≥20% | Two consecutive daily observations both show the drop (avoids data-lag false positives) | 🟠 High |
| Sitemap fetch failure | Two consecutive cron runs see a sitemap error | 🟠 High |
| New crawl error category appears | First time we see a previously-absent error type | 🟡 Medium |
| Sudden impressions drop ≥50% (28d rolling) | Indirect proxy for manual actions / penalties — Google may have suppressed the site | 🟡 Medium |

> **Note on manual actions and security issues:** The GSC v1 API does **not** expose `manualActions` or `securityIssues` resources. When these occur, Google emails the verified property owner directly. The dashboard surfaces a "Last manual-actions check in GSC UI: X days ago" reminder rather than trying to duplicate Google's notification. The "sudden impressions drop" alert above is a weak indirect proxy.

Deduplication: `alert:dedup:{type}:{key}` prevents spamming. Same alert will not re-send within 24h.

### 3. Pre-publish lint (in update editor)

Before publishing an update (`status: draft → published`), display non-blocking warnings if:

- No meta description (we'll auto-fill from `excerpt` if present, otherwise warn)
- Title duplicates an existing published update's title (case-insensitive)
- Content shorter than 300 characters (likely too thin for indexing)
- No images and excerpt is empty (poor social/preview rendering)

Warnings appear in the editor; they do not block publish. Magnus can publish through them deliberately.

## Files

### New files

```
src/
  ├── gsc.ts                    GSC API client (auth + endpoints)
  ├── jwt.ts                    RS256 JWT signing via Web Crypto
  ├── scheduled.ts              Cron handler — orchestrates daily poll
  ├── notifier.ts               Email abstraction (CF + Resend fallback)
  ├── lint.ts                   Pre-publish lint rules (pure functions)
  └── routes/
      ├── gscStatus.ts          GET /admin/api/gsc-status
      └── refreshGsc.ts         POST /admin/api/refresh-gsc

public/
  └── admin/
      └── gsc-widget.js         Client-side rendering of dashboard widget

tests/
  ├── unit/
  │   ├── jwt.test.ts
  │   ├── lint.test.ts
  │   └── notifier.test.ts
  └── integration/
      ├── scheduled.test.ts
      ├── gscStatus.test.ts
      └── refreshGsc.test.ts
```

### Modified files

```
src/index.ts                  Add `scheduled` export, register new admin routes
src/types.ts                  Add SEND_EMAIL binding to Env, new GSC* interfaces
src/email.ts                  Extract sendViaResend helper for reuse from notifier
src/routes/adminDashboard.ts  Add widget container + script include
src/routes/saveUpdate.ts      Surface lint warnings in response (non-blocking)
src/routes/adminEditor.ts     Render lint warnings in editor UI on save
wrangler.toml                 Add GSC_KV namespace, SEND_EMAIL binding, cron trigger
.dev.vars.example             Document GSC_SERVICE_ACCOUNT_JSON
```

## Data structures

```typescript
// In src/types.ts

export interface GSCSnapshot {
  capturedAt: string;          // ISO 8601
  sitemap: {
    lastSubmitted: string | null;
    lastDownloaded: string | null;
    errors: number;
    warnings: number;
    submitted: number;
    indexed: number;
  };
  indexing: {
    indexedCount: number;
    deltaVs7d: number;
    deltaVs28d: number;
  };
  performance: {
    period: '28d';
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
    topQueries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  };
  alerts: GSCAlert[];
  emailDelivery: {
    lastProvider: 'cf' | 'resend-fallback' | null;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
  };
}

export interface GSCAlert {
  type: 'indexed-drop' | 'sitemap-error' | 'new-crawl-error' | 'impressions-drop';
  severity: 'high' | 'medium';
  message: string;
  detectedAt: string;
  emailSent: boolean;
}
```

## Architecture decisions to record as ADRs

Per `.claude/CLAUDE.md`, decisions that shape future architecture should become ADRs in `REFERENCE/decisions/`. Proposing three:

1. **ADR — Use service account auth (not OAuth) for GSC.** Rationale: cron-driven, no human in the loop. Trade-off: must keep service account JSON as a secret; rotation is a manual step.
2. **ADR — Cloudflare Email Sending as default with Resend fallback.** Rationale: try CF native on a low-stakes feature. Trade-off: beta service, unknown pricing, but we have a fallback. Bounded scope: this decision applies only to non-auth notifications; auth emails stay on Resend until CF is GA + has a clean track record on alerts.
3. **ADR — Defer Layer 2 auto-fix.** Rationale: most GSC "issues" aren't code-fixable; want real data before building fixers. Trade-off: Magnus has to action some issues manually.

## Testing strategy

Following `REFERENCE/testing-strategy.md`:

**Unit:**
- `jwt.ts` — sign known input, verify output decodes correctly with public key
- `lint.ts` — each rule tested independently with passing and failing examples
- `notifier.ts` — mock `env.SEND_EMAIL` and Resend; verify fallback on each failure mode (binding missing, send throws, send returns non-success)

**Integration:**
- `scheduled.test.ts` — full cron run with mocked GSC API, assert KV writes, alert generation, email path selection
- `gscStatus.test.ts` — auth required, returns latest snapshot, handles missing snapshot
- `refreshGsc.test.ts` — auth required, triggers the same code as scheduled

**Coverage target:** 95%+ lines/functions/statements, 90%+ branches (project standard).

**Manual:**
- Trigger cron via `wrangler triggers cron` and observe email
- Force CF Email Sending failure (e.g., bad `from` domain) and verify Resend fallback
- Submit a draft update with no meta description, observe lint warning in editor
- Visit `/admin/dashboard`, observe widget renders with real data

## Edge cases & risks

- **GSC quota exhaustion.** Daily baseline is ~5 calls (sitemaps + searchanalytics + a handful of inspections). Well under any quota. Manual refresh adds a few more — guard against rapid clicking with a simple in-memory rate limit.
- **Service account JSON rotation.** Document the steps in `environment-setup.md`. Risk: rotation gets forgotten and tokens expire silently. Mitigation: dashboard widget shows freshness; >36h stale turns red.
- **CF Email Sending outage / beta breakage.** Resend fallback handles it. If both fail, log + skip (next cron run will retry). Failures don't crash the cron handler.
- **GSC data lag (1–2 days).** Mitigated by requiring 2 consecutive observations before triggering "indexed drop" or "sitemap error" alerts.
- **KV write failure.** Tolerate; next cron run retries. Don't fail the whole run because one write blipped.
- **Cron didn't run** (Cloudflare incident). Dashboard widget surfaces "stale" state if `status:latest` is >36h old.
- **Service account leaked.** It only has Search Console read access for one property — blast radius is read-only GSC data, not the site. Still, rotate immediately if leaked.

## PR plan

Likely two PRs to keep reviews tractable:

**PR 1 — Plumbing (no UI):**
- `gsc.ts`, `jwt.ts`, `scheduled.ts`, `notifier.ts`
- KV namespace, cron trigger, secrets in wrangler.toml
- Tests for the above
- ADRs in `REFERENCE/decisions/`
- After merge: configure secrets, verify cron runs, verify email arrives

**PR 2 — UI surfaces:**
- `gscStatus.ts`, `refreshGsc.ts`, `gsc-widget.js`
- Pre-publish lint integrated into editor
- Tests
- `REFERENCE/gsc-insights.md` how-it-works doc

Branch naming: `feature/gsc-insights-plumbing` and `feature/gsc-insights-ui`.

## Open questions

1. **Email recipient.** Use existing `ADMIN_EMAIL` env var (currently `magnus.hultberg@gmail.com`)? Assumption: yes.
2. **Manual refresh rate limit.** One per minute via in-memory map? Or skip rate limiting for v1? Assumption: skip — it's a single-admin endpoint behind auth.
3. **Indexed-drop threshold.** Defaulting to 20% / 2 consecutive observations. Magnus to confirm.
4. **Lint warning UI.** Toast / banner / inline next to fields? Assumption: a yellow banner above the editor's publish button.
5. **CF Email Sending cost.** Pricing not finalized as of Apr 2026. We accept this — re-evaluate if billing surprises us.
6. **Search Analytics property URL form.** GSC supports both URL-prefix and Domain properties. Which is configured for hultberg.org? (Will check during PR 1 setup.)

## Future work — Layer 2 placeholder

Once Layer 1 has produced ~3 months of real data, evaluate whether to build a bounded auto-fix layer for a narrow allowlist:

- **Sitemap pruning:** exclude URLs GSC reports as 404 / redirected from the next sitemap regen.
- **Auto-canonical:** add `<link rel="canonical">` to update pages that lack one (always self-referential — deterministic).
- **Auto-fill meta description:** populate empty meta descriptions from `excerpt` at render time.

**Explicitly NOT in scope without further discovery:**

- Anything touching robots.txt, redirects, page templates, or layout
- Anything that "improves content" (rewriting titles/excerpts/copy)
- Anything that requires judgment about why Google chose not to index something
- Bulk operations across many URLs without per-item review

A separate spec (`gsc-auto-fix-layer-2.md`) will be drafted at that point, informed by what Layer 1 actually surfaced.

## Related documentation

- [Root CLAUDE.md](../CLAUDE.md) — project navigation
- [environment-setup.md](../REFERENCE/environment-setup.md) — to be updated with `GSC_SERVICE_ACCOUNT_JSON` instructions
- [testing-strategy.md](../REFERENCE/testing-strategy.md)
- [Google Search Console API docs](https://developers.google.com/webmaster-tools/v1/api_reference_index)
- [URL Inspection API docs](https://developers.google.com/webmaster-tools/v1/urlInspection.index)
- [Cloudflare Email Sending announcement](https://blog.cloudflare.com/email-service/)
