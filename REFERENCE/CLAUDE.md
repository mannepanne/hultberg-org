# Reference Documentation Library

Auto-loaded when working with files in this directory. How-it-works documentation for implemented features.

## Files in this directory

### [testing-strategy.md](./testing-strategy.md)
**When to read:** Writing tests, setting up test coverage, or implementing TDD workflow.

Complete testing philosophy, framework setup (Vitest), test categories, coverage requirements, and CI/CD integration.

### [technical-debt.md](./technical-debt.md)
**When to read:** Planning refactors, reviewing known issues, or documenting accepted shortcuts.

Tracker for known limitations, accepted risks, and deferred improvements with risk assessments.

### [environment-setup.md](./environment-setup.md)
**When to read:** Setting up local development, configuring secrets, or deploying to production.

Environment variables, API key configuration, third-party service setup (Supabase, Readwise, Perplexity, Resend).

### [troubleshooting.md](./troubleshooting.md)
**When to read:** Debugging issues, fixing deployment problems, or resolving API integration errors.

Common issues and solutions for local development, deployment, and API integrations.

### [pr-review-workflow.md](./pr-review-workflow.md)
  **When to read:** Creating PRs or running code reviews.

  How to use `/review-pr` and `/review-pr-team` skills for automated code review.

### [blog-security.md](./blog-security.md)
**When to read:** Working on the `/updates` blog feature, the `/admin` interface, authentication flows, or anything that touches stored update data.

Security measures, authentication flows, and data protection strategies for the blog updates feature.

### [web-analytics.md](./web-analytics.md)
**When to read:** Modifying the analytics setup, adding event tracking, or troubleshooting traffic data.

Google Analytics 4 (GA4) and Cloudflare Web Analytics setup — what each one tracks, how they're wired in, and where the IDs live.

### [now-page-snapshots-timeline.md](./now-page-snapshots-timeline.md)
**When to read:** Working on the `/now` page, its snapshot system, or the historical timeline UI.

How the /now page snapshots system works (capture, storage, retrieval) and how the interactive timeline displays them.

### [gsc-insights.md](./gsc-insights.md)
**When to read:** Working on Google Search Console integration, the insights dashboard, the email alerts pipeline, or related plumbing.

How GSC insights and alerts are wired up — service-account auth, daily polling, alert generation, and email delivery via Cloudflare Email Sending with Resend fallback.

### [safety-harness.md](./safety-harness.md)
**When to read:** A safety-harness block or ask dialog fired and you want to understand what's going on, you want to add a pattern, or you want to bypass the hook for a legitimate use.

What's caught at block / ask tier, what's deliberately not caught, how the inline `SAFETY_HARNESS_OFF=1` bypass works (and its limits), how the hook composes with the allowlist, how to extend patterns + tests.

### [scratch-write-hook.md](./scratch-write-hook.md)
**When to read:** Reviewing or extending the `Write` auto-approval for `<project>/SCRATCH/`, debugging a SCRATCH/ Write prompt that fired unexpectedly, or removing the hook if upstream Claude Code fixes the underlying matcher.

What the hook approves and why, where it sits in the call path alongside `safety-harness.sh`, what's deliberately out of scope (symlinks, exotic filenames), how to extend, and the rollback path if the upstream defect is fixed. Decision rationale at [`decisions/2026-04-26-scratch-write-pretooluse-hook.md`](./decisions/2026-04-26-scratch-write-pretooluse-hook.md).

### [decisions/](./decisions/)
**When to read:** Making architectural decisions, choosing between alternatives, or looking up why something was built the way it was.

Architecture Decision Records (ADRs) — permanent log of significant technical choices, alternatives considered, and trade-offs accepted.
