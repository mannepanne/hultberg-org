# GSC Insights & Alerts

**Feature status:** Shipped in PRs #29 (plumbing) and PR 2 (UI + lint)
**Primary spec:** [`SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md`](../SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md)
**Related ADRs:** [service-account auth](./decisions/2026-04-18-gsc-service-account-auth.md) · [CF Email Sending + Resend fallback](./decisions/2026-04-18-cf-email-sending-with-resend-fallback.md) · [defer Layer 2](./decisions/2026-04-18-defer-gsc-auto-fix-layer.md)

## What this feature does

Daily monitoring of Google Search Console for hultberg.org:

- **Daily poll (cron)** — 08:00 UTC each day, the Worker signs a JWT, exchanges it for an OAuth token, fetches sitemap status + search analytics from GSC, and persists a snapshot to KV.
- **Dashboard widget** (`/admin/dashboard`) — shows sitemap status, indexed page count, 28-day clicks/impressions with deltas, top queries, and any active alerts. Includes a manual "Refresh" button.
- **Email alerts** for severe-only events (indexed-page drop, sitemap errors, new sitemap warnings, impressions drop). Sent via Cloudflare Email Sending (beta) with Resend fallback.
- **Pre-publish lint** in the update editor — non-blocking warnings for missing excerpt, thin content, duplicate title, poor social-preview potential.

## Architecture at a glance

```
Cron (daily 08:00 UTC)
   │
   ▼
handleScheduled()   ──────►  runDailyPoll(env, { skipDispatch: false })
                                  │
POST /admin/api/refresh-gsc   ►  runDailyPoll(env, { skipDispatch: true })
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   GSCClient (jwt.ts +   │
                    │   gsc.ts)               │
                    │   - sitemaps.list       │
                    │   - searchanalytics.query│
                    │   - sites.list (debug)  │
                    └────────────┬────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   resolveAlerts(...)    │
                    │   pure fn               │
                    │                         │
                    │   state machine:        │
                    │   not-seen → pending    │
                    │   pending → alert       │
                    │   alert → alert (cont.) │
                    │   any → drop (resolved) │
                    └────────────┬────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   dispatchAlerts (when  │
                    │   !skipDispatch):       │
                    │                         │
                    │   notifier.sendAlert()  │
                    │    CF → Resend fallback │
                    │   + 24h KV dedup        │
                    └────────────┬────────────┘
                                  │
                                  ▼
                         GSC_KV
                         - status:latest
                         - status:history:YYYY-MM-DD (35d TTL)
                         - alert:dedup:{type}:{discriminator} (24h TTL)
                         - manual-check:lastClicked
                                  │
                                  ▼
GET  /admin/dashboard         ►  loadWidgetHtml reads KV, builds
                                 view-model, embeds pre-rendered
                                 HTML directly in page response.

POST /admin/api/refresh-gsc   ►  runDailyPoll + renderWidget →
                                 { ok, widgetHtml }, client swaps
                                 #gsc-widget-root innerHTML.

POST /admin/api/gsc-manual-check-clicked
                              ►  writes manual-check:lastClicked
                                 (fire-and-forget from widget footer)
```

## Files

### Source

- **`src/jwt.ts`** — RS256 JWT signing via Web Crypto's `SubtleCrypto`. PEM → PKCS#8 binary → signed assertion.
- **`src/gsc.ts`** — GSC API client. Service-account auth, in-invocation token cache, typed method per endpoint.
- **`src/notifier.ts`** — Email abstraction. `sendAlert(env, {subject, body})` tries `env.SEND_EMAIL` first, falls back to Resend on any failure. `buildMimeMessage` sanitises CR/LF in header fields.
- **`src/scheduled.ts`** — Orchestrator. `runDailyPoll` does the full cycle; `resolveAlerts` is the pure-function core; `handleScheduled` is the cron entry point (wraps in `ctx.waitUntil`).
- **`src/gscHelpers.ts`** — Pure helpers: `sanitiseUpstreamError` (caps + strips multi-line errors), `mergeEmailDelivery` (dedup-aware state merger).
- **`src/gscWidgetViewModel.ts`** — Pure `renderViewModel(snapshot, now, manualCheckLastClicked)` that flattens a snapshot into the flat shape the renderer consumes. Fully unit-testable.
- **`src/gscWidgetRenderer.ts`** — Pure `renderWidget(vm)` that produces the widget's HTML fragment from a view-model. Every dynamic field escaped at the boundary via `src/utils.ts`'s `escapeHtml`.
- **`src/lint.ts`** — Pre-publish lint rules. Pure functions, no I/O.
- **`src/routes/gscDebug.ts`** — `GET /admin/api/gsc-debug`. Auth-gated smoke-test; lists sites + sitemaps. Use post-secret-rotation or after deploy to verify credentials.
- **`src/routes/refreshGsc.ts`** — `POST /admin/api/refresh-gsc`. Auth-gated, rate-limited (1/60s), CSRF-checked. Calls `runDailyPoll` with `skipDispatch: true`, then returns `{ok, widgetHtml}` — the client innerHTML-swaps the fragment.
- **`src/routes/gscManualCheckClicked.ts`** — `POST /admin/api/gsc-manual-check-clicked`. Auth-gated, CSRF-checked. Writes `manual-check:lastClicked` timestamp to KV. Fire-and-forget from the widget footer click handler.
- **`src/routes/adminDashboard.ts`** — `loadWidgetHtml(env, now)` helper reads `status:latest` + `manual-check:lastClicked` from KV, builds the view-model, renders HTML, embeds it directly in the dashboard page. Falls back to the empty-state widget on KV unbound / parse error.
- **`public/admin/gsc-widget.js`** — Behaviour only (~115 lines). Wires the refresh button, the manual-check link, and the refresh-error banner. Does NOT build HTML: initial widget is server-rendered, refresh response is already-rendered HTML, error banner uses `textContent` + `createElement`. No client-side `escapeHtml`.

### Config

- **`wrangler.toml`** — `[[kv_namespaces]] GSC_KV`, `[[send_email]] SEND_EMAIL`, `[triggers] crons = ["0 8 * * *"]`.
- **`.dev.vars.example`** — documents `GSC_SERVICE_ACCOUNT_JSON` secret.

## Key data shapes

See [`src/types.ts`](../src/types.ts):

- **`GSCSnapshot`** — one daily sample. Persisted to `status:latest` and `status:history:YYYY-MM-DD`.
- **`GSCAlert`** — a graduated/continuing alert; carries `firstDetectedAt` (preserved through state transitions) and `detectedAt` (this run's observation time).
- **`GSCPendingAlert`** — a first-observed condition that hasn't graduated yet.
- **`GSCEmailDelivery`** — `lastProvider` is `null` (never tried), `'cf'` / `'resend'` (success via that provider), or `'none'` (both failed).

## Alert thresholds (current, tunable)

Defined as constants in `src/scheduled.ts`:

| Alert type | Trigger | Severity |
|---|---|---|
| `indexed-drop` | current < 80% of 7-day-ago indexed count | high |
| `sitemap-error` | any sitemap reports errors > 0 | high |
| `new-crawl-warning` | current total warnings > previous snapshot's total | medium |
| `impressions-drop` | current 28d impressions < 50% of prior 28d | medium |

All drop alerts use **two-consecutive-observation graduation** — first observation marks `pending`, second fires the real alert. Reduces false positives from GSC's 1–2 day data lag.

Dedup: 24h per alert type. See [issue #31](https://github.com/mannepanne/hultberg-org/issues/31) for threshold tuning plans once ~30 days of data accumulate.

## Email delivery

Alerts use `sendAlert` in `src/notifier.ts`:

1. Try `env.SEND_EMAIL.send(new EmailMessage(from, to, mimeString))` — Cloudflare Email Sending (beta).
2. If it throws or the binding is absent, fall back to Resend (`sendViaResend` in `src/email.ts`).
3. Log which path was used for delivery-reliability telemetry.

**Magic-link auth emails do NOT use this path.** They call `sendViaResend` directly, to keep auth on a stable proven provider until CF Email Sending is GA. See the [CF Email Sending ADR](./decisions/2026-04-18-cf-email-sending-with-resend-fallback.md) for re-evaluation triggers.

## Ops tasks

### Smoke-test credentials

```
GET /admin/api/gsc-debug
```

(signed in as admin, in a browser). Returns sites + sitemap status. Use this after any of:
- Deploy that touched `src/jwt.ts`, `src/gsc.ts`, or the wrangler service-account secret
- Rotating the service-account key
- Adding/removing the service account from GSC properties

### Rotate the service-account key

1. In Google Cloud Console → IAM → Service Accounts → hultberg-org-search-console → Keys → Add Key → Create new key (JSON).
2. Save the new JSON outside the repo (e.g. `~/Documents/secrets/hultberg-gsc-YYYY-MM-DD.json`, chmod 600).
3. `npx wrangler secret put GSC_SERVICE_ACCOUNT_JSON < path/to/new.json` — pipes the new JSON into the Worker secret.
4. Hit `/admin/api/gsc-debug` to confirm the new key works.
5. Delete the old key in Google Cloud Console.

### Trigger a manual refresh

Either click the **Refresh** button on `/admin/dashboard`, or `POST /admin/api/refresh-gsc` directly. Refresh computes + persists the snapshot but does **not** send emails or write dedup keys — email is cron-only.

### Add a new alert type

1. Add the literal to `GSCAlertType` in `src/types.ts`.
2. Add a case in `resolveAlerts` (`src/scheduled.ts`) that pushes a condition with `type`, `severity`, `subject`, `message`, optional `discriminator`.
3. If it needs unit test coverage, extend `tests/unit/scheduled-resolveAlerts.test.ts`.
4. Update this doc's threshold table.
5. Consider whether the alert's trust-surface implications require an ADR amendment (see [issue #33](https://github.com/mannepanne/hultberg-org/issues/33)).

### Manual actions & security issues

**Not API-accessible.** The GSC v1 API does not expose `manualActions` or `securityIssues` resources. Google emails the verified property owner directly when these occur. The dashboard widget surfaces a "Check Search Console" reminder link — Magnus should visit Search Console directly to review these if prompted by Google's email.

## Known gaps / follow-up issues

- [#30](https://github.com/mannepanne/hultberg-org/issues/30) — Email body enrichment (top queries, deep-links, re-fire tags)
- [#31](https://github.com/mannepanne/hultberg-org/issues/31) — Threshold tuning after 30 days of data
- [#33](https://github.com/mannepanne/hultberg-org/issues/33) — CF Email Sending ADR trust-surface note

## Testing strategy

- **Unit**: `jwt.test.ts`, `gsc.test.ts`, `gscHelpers.test.ts`, `lint.test.ts`, `notifier.test.ts`, `gscWidgetViewModel.test.ts`, `gscWidgetRenderer.test.ts`, `scheduled-resolveAlerts.test.ts`. Pure-function surface; no I/O. Renderer tests include an explicit XSS-defence block covering every dynamic field.
- **Integration**: `scheduled.test.ts`, `refreshGsc.test.ts`, `gscManualCheckClicked.test.ts`. End-to-end orchestrator behaviour with mocked GSC API + KV.
- **Workerd runtime**: not exercised in CI (Vitest runs under Node). The `gsc-debug` endpoint is the de-facto post-deploy smoke test — **do not remove it without adding a miniflare/workerd-runner JWT round-trip test**.
