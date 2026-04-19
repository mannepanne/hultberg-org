# GSC Insights — Layer 2 follow-ups

**Parent:** `SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md` (Layer 1, shipped as PRs #29 + #36)
**Status:** Active
**Tracks issues:** #37, #38, #39 (#30 deferred — see below)

---

## Why this spec exists

Layer 1 shipped the GSC widget core. Four issues were carved out as deliberate follow-ups during PR #29/#36 reviews:

| # | Title | Class |
|---|---|---|
| #38 | Snapshot `source: 'cron' \| 'manual'` field | small, foundational |
| #39 | "Last checked in GSC UI" tracking + indexed-pages 28d delta | small, two-part |
| #37 | Server-render initial view-model into dashboard HTML | architectural cleanup |
| #30 | Email body enrichment (top queries, deep-links, re-fire tags) | **deferred** |

Doing them as one bundled spec because they all touch the same widget + view-model surface and the sequencing matters.

---

## What's deferred and why

**#30 (email enrichment) stays open and untouched.** The issue itself says: *"Needs real alert data to calibrate. Land after ~30 days of Layer 1 monitoring so we're tuning against actual signal, not hypothetical."* Layer 1 went live with PR #36 on 2026-04-19 — earliest sensible date to revisit is **~2026-05-19**. Same calendar gate as #31. Both come back together.

When #30 lands, the trust-surface paragraph in the CF Email Sending ADR (added in PR #48) becomes load-bearing — that's the point at which user-typed search queries enter alert bodies. PR for #30 must explicitly re-evaluate against that ADR before merging.

---

## Sequencing

```
PR A (#38)  →  PR B (#39 both parts)  →  PR C (#37)
```

Reasoning:
- **#38 first** because it adds a new field to `GSCSnapshot` and a new `caveat` field to the view-model. Both #37 and #39 then build on the final view-model shape.
- **#39 next** because both parts are pure view-model / KV additions. Doing them before #37 means the view-model is fully settled when the server-render refactor lands.
- **#37 last** because it's the biggest structural change — eliminates the client/server view-model duplication. Easier to deduplicate against a finalised model than a moving one.

---

## PR A — Snapshot `source` field + `caveat` view-model

**Closes:** #38

**Scope:**
- Add `source: 'cron' | 'manual'` to `GSCSnapshot` in `src/types.ts`
- Set in `runDailyPoll` (`src/scheduled.ts` or wherever the poll runs): `source: opts.skipDispatch ? 'manual' : 'cron'`
- Add `caveat?: string` to `WidgetViewModel` in `src/gscWidgetViewModel.ts`
- When `snapshot.source === 'manual'` AND there's at least one alert with `emailSent === false`, set `caveat: 'Manual refresh — alerts emailed at next 08:00 UTC cron.'`
- Renderer (both server and current client copy) shows the caveat as a subtle line above the alerts strip
- Back-compat: snapshots written before this PR lack the field. Treat `undefined` as `'cron'` (the historic behaviour) in the view-model

**Files touched:**
- `src/types.ts` (add field)
- `src/scheduled.ts` and/or `src/gsc.ts` (set field on poll)
- `src/gscWidgetViewModel.ts` (caveat logic)
- `public/admin/gsc-widget.js` (mirror in client copy until PR C kills it)
- `tests/unit/gscWidgetViewModel.test.ts` (cases: cron with alerts → no caveat, manual with no alerts → no caveat, manual with unsent alert → caveat present, undefined source → cron behaviour)

**Estimate:** ~30–40 lines.

**Acceptance:**
- New field visible in snapshots written after merge
- Caveat appears in widget after a manual refresh that graduates an alert
- All existing GSC tests still pass; back-compat case covered

---

## PR B — "Last checked in GSC UI" tracking + indexed-pages delta

**Closes:** #39 (both parts)

### Part 1: GSC manual-check recency

**Goal:** Replace the static "Check Search Console ↗" footer link with a recency-aware nudge: *"Last checked in GSC UI: 12 days ago"* (or *"Never"*).

**Implementation:**
- New endpoint `POST /admin/api/gsc-manual-check-clicked` — auth-required, same Origin check as `/admin/api/refresh-gsc`, writes `manual-check:lastClicked` to `GSC_KV` with the current ISO timestamp. Returns `{ ok: true }` on success.
- Extend `GET /admin/api/gsc-status` to include `manualCheckLastClicked: string | null` in the response (read alongside `status:latest`).
- View-model gains `manualCheckRecency: { label: string, neverClicked: boolean }` derived from `manualCheckLastClicked` and `now`.
- Widget JS attaches a click handler to the GSC footer link that fires the POST (fire-and-forget, link still navigates).
- Renderer swaps the footer text from a static string to `manualCheckRecency.label`.

**Edge cases:**
- Clock skew between client and server — server is the source of truth; client click triggers but server timestamps.
- KV write failure → silent (recency nudge is non-critical; better to lose a tick than block the link).
- Reset on what? Never — the timestamp just rolls forward.

### Part 2: Indexed-pages 28d delta

**Goal:** The "Indexed pages" tile currently shows just the count with `deltaClass: 'flat'` and empty `sub`. Mockup expected `+2 vs 28d ago`.

**Implementation:**
- During `runDailyPoll`, after writing `status:latest`, also load `status:history:{YYYY-MM-DD}` for `now - 28 days`. If present, compute the delta and stash it into the snapshot as `indexing.priorPeriodIndexedCount: number | null`.
- Update `GSCSnapshot.indexing` shape: `{ indexedCount: number; priorPeriodIndexedCount: number | null }`. Back-compat: `null` for snapshots written before this PR.
- View-model: replace the hardcoded `flat` / empty `sub` for the Indexed tile with a real delta computation, mirroring the existing `Clicks (28d)` / `Impressions (28d)` pattern.

**Files touched (Part 1 + Part 2):**
- `src/types.ts` (extend `indexing` shape)
- `src/gsc.ts` and/or `src/scheduled.ts` (compute prior-period indexed count during poll)
- `src/gscWidgetViewModel.ts` (real delta for Indexed tile + manualCheckRecency)
- `src/routes/gscStatus.ts` (return `manualCheckLastClicked`)
- `src/routes/gscManualCheckClicked.ts` (NEW)
- `src/index.ts` (register new route)
- `public/admin/gsc-widget.js` (click handler + footer rendering, mirror until PR C)
- Tests: extend view-model tests for both pieces, add integration test for the new endpoint (auth, Origin check, KV write)

**Estimate:** ~50–70 lines + tests.

**Acceptance:**
- Footer renders "Never" when KV key absent, "X days ago" when present
- Clicking the GSC link writes the KV key (verified via integration test)
- Indexed tile shows a real delta, matches the mockup style

---

## PR C — Server-render initial view-model

**Closes:** #37

**Scope:**
- Move `renderViewModel` rendering from client-only into the server response in `src/routes/adminDashboard.ts`
- New module `src/gscWidgetRenderer.ts` (or extend `gscWidgetViewModel.ts`) that produces the widget's HTML string from a `WidgetViewModel`
- `adminDashboard.ts` reads `status:latest` (and `manual-check:lastClicked` from PR B) and embeds the rendered HTML directly into the page
- Also embed the snapshot JSON in a `<script type="application/json" id="gsc-snapshot">` tag so the client has it for refresh re-rendering
- `gsc-widget.js` shrinks dramatically: removes the duplicated view-model logic, removes `escapeHtml`, removes initial fetch/render. Keeps only:
  - Refresh button click handler
  - After refresh: re-fetch `/admin/api/gsc-status` and either re-render via embedded server-side fragment endpoint, OR receive `{snapshot, viewModelHtml}` and `innerHTML = ...`
- Decision needed during implementation: re-render after refresh by **(a)** server returning an HTML fragment, or **(b)** server returning JSON + client re-rendering. (a) keeps `escapeHtml` server-only; (b) reintroduces a small client surface. Recommend (a).

**Files touched:**
- `src/gscWidgetRenderer.ts` (NEW — pure HTML generation from view-model)
- `src/routes/adminDashboard.ts` (embed pre-rendered widget)
- `src/routes/gscStatus.ts` (consider: return HTML fragment instead of/alongside JSON)
- `src/routes/refreshGsc.ts` (return HTML fragment after refresh, or restructure)
- `public/admin/gsc-widget.js` (significant reduction, ~70% smaller)
- New unit tests for the HTML renderer (covers what was previously tested only via JSDOM in `gscWidgetDom.test.ts`)

**Estimate:** ~150–200 lines net change (lots of moves, modest new code). The JSDOM client tests get partly replaced with cleaner server-side string tests.

**Acceptance:**
- Cold load of `/admin/dashboard` renders the widget instantly with no loading flash
- Refresh button still works end-to-end
- Client `escapeHtml` is removed; only server-side `escapeHtml` (from `src/utils.ts` after PR #45) remains
- All existing widget behaviour preserved (verified by snapshot of rendered HTML in tests + manual)

---

## Cross-cutting concerns

**Back-compat:** Snapshots from Layer 1 are persisted in KV. PRs A and B both add fields. The view-model must treat missing fields as the historical behaviour (no caveat, no prior indexed count) rather than crash.

**Test coverage target:** 95%+ lines, matching project standard. Each PR adds tests; no PR should drop coverage on existing GSC code.

**Manual verification:** All three PRs have user-visible UI changes. Each PR-author should load `/admin/dashboard` after deploy and confirm:
- PR A: trigger a refresh that graduates an alert → caveat appears
- PR B: footer recency shows "Never" or a date; click triggers a re-render with updated date next load; Indexed tile shows a delta
- PR C: no loading flash on cold load; refresh button still works; visual is unchanged

**No new ADRs expected.** All three PRs are within the existing architecture (Workers + KV + same notifier). PR C's choice of "HTML fragment vs JSON" is a tactical implementation decision — document inline in the PR description, not as an ADR, unless we find a reason to revisit later.

---

## Open questions for Magnus

1. **PR B Part 1 — should the click handler require auth?** The endpoint should, but the click is from an already-authed admin page. Confirming we use the same JWT cookie + Origin check as `/admin/api/refresh-gsc`.
2. **PR C — fragment vs JSON for refresh response?** I recommend HTML fragment to keep `escapeHtml` server-only; you may prefer JSON for cacheability. Worth a 30-second discussion before PR C.
3. **#30 trigger date.** Spec assumes ~2026-05-19 for revisiting #30 and #31 together. Adjust if you'd prefer to wait longer / less.
