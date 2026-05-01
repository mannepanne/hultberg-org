# ADR: Defer autonomous GSC issue auto-fix ("Layer 2") until Layer 1 data informs it

**Date:** 2026-04-18
**Status:** Active
**Supersedes:** N/A

---

## Decision

The initial GSC feature ships as **Layer 1 only** — daily monitoring, dashboard widget, severe-event alerts, and pre-publish lint warnings. A bounded autonomous auto-fix layer ("Layer 2") is explicitly **deferred** until Layer 1 has produced real data on what GSC actually flags for this site.

## Context

While scoping the feature, Magnus asked whether the Worker could autonomously fix issues GSC surfaces, within limits. Tempting, because "find and fix" is more valuable than "find and report." But most GSC "issues" are Google's editorial judgments about content quality and are **not** fixable by code. Only a small category — boring hygiene — is genuinely automatable. Building an autonomous fixer before we know which fixers actually matter risks over-engineering for conditions that never arise in practice.

## Alternatives considered

- **Build Layer 2 now alongside Layer 1.** Ship both together.
  - Why not: We don't yet know which issues GSC will actually flag for this site in the real world. Building fixers for hypothetical issues risks wrong abstractions, wasted effort, and the harder-to-reverse problem of autonomous code touching the live site. Real data first, fixers second.

- **Ship a manual "one-click fix" UI** instead of autonomous fixing.
  - Why not: This is actually a good Layer 1 extension and may emerge naturally from the dashboard widget. But it's still premature without concrete cases. Keep it as a possible future expansion of Layer 1, not a Layer 2 thing.

- **Chosen: Layer 1 only, with a placeholder section in the spec for Layer 2.**
  - Rationale below.

## Reasoning

**Most GSC issues aren't code-fixable.** "Crawled – currently not indexed," "Discovered – currently not indexed," duplicate handling, soft 404s — these are Google's judgments about content quality. The remedy is a human writing better content, not automation.

**Cascading SEO risk is high.** A wrongly-added canonical tag, a misplaced `noindex`, or an over-eager robots.txt change can silently deindex parts of the site. "Without the user seeing it" + "takes days to detect because GSC data lags 1–2 days" is a bad combination for autonomous operation.

**Data-driven scope beats speculative design.** After ~3 months of Layer 1 data we'll know which issues recur often enough to justify a fixer. The candidate list is likely small (maybe: sitemap pruning for reported-404 URLs, auto-canonical for update pages missing one, auto-fill meta descriptions from `excerpt`). Build only what the data justifies.

**KISS alignment.** Project principles (`.claude/CLAUDE.md`) favour simple solutions over clever ones. Autonomous fixers in a personal site are clever; a well-curated daily dashboard is simple and sufficient.

## Trade-offs accepted

- **Some issues stay manual.** Magnus actions some things himself via Search Console instead of the Worker fixing them. For a site with fewer than ~30 updates, this is negligible overhead.
- **Potential re-work later.** If we do build Layer 2, we may need to refactor parts of Layer 1 (e.g., widen the sitemap-generation pipeline to accept a fix-list). Accepted — the Layer 1 code is small enough that refactoring won't be painful.
- **Magnus may build pressure to add fixers ad-hoc.** Discipline required: if a fixer is requested, first check whether Layer 1 data supports it as a recurring need, and write an ADR if proceeding.

## Implications

**Enables:**
- Faster, safer Layer 1 ship
- Real data to inform Layer 2 scope when we get there
- Clear non-goals statement in the spec — easier PR reviews (reviewers can't ask "why didn't you add auto-fix for X?")

**Prevents / complicates:**
- No autonomous remediation — some effort stays with the human
- Extra calendar time between "see the problem" and "fix the problem" for any fixable issue

## Re-evaluation trigger

Revisit when **any** of:
- ~3 months of Layer 1 data show a specific fix pattern recurring ≥3 times
- A single GSC issue type generates repeated manual work for Magnus
- A Layer 2-shaped feature becomes the right shape for some other requirement (e.g., pre-publish lint graduates to auto-fix)

At that point, draft `SPECIFICATIONS/gsc-auto-fix-layer-2.md` referencing this ADR and the Layer 1 data that justifies each proposed fixer. Keep the allowlist tight: the "explicitly NOT" list from the spec is load-bearing.

---

## References

- Spec: [SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md](../../SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md) — "Future work — Layer 2 placeholder" section
- Project principles: `.claude/CLAUDE.md` (KISS, YAGNI)
