# ADR: Use Cloudflare Email Sending (beta) for alerts with Resend fallback

**Date:** 2026-04-18
**Status:** Active
**Supersedes:** N/A

---

## Decision

GSC alert emails are sent via **Cloudflare Email Sending** (currently in private beta, announced Nov 2025) as the primary provider. If the CF binding fails or is unavailable, the notifier falls back to **Resend** (already used for magic-link auth emails). This applies *only* to alert notifications — **magic-link authentication emails continue to go directly through Resend**.

## Context

While building the GSC insights feature, Cloudflare's new Email Sending service became available on the account. This is a lighter-touch option than Resend — Workers-native binding, no API key, Cloudflare auto-configures SPF/DKIM/DMARC. Tempting to "go Cloudflare-native" for all outbound mail. But CF Email Sending is in private beta with unfinalised pricing and no published SLA, and the magic-link email is auth-critical (if it doesn't deliver, admin login breaks).

## Alternatives considered

- **All-in on CF Email Sending (including auth):** One provider, less surface area.
  - Why not: Beta service + auth-critical path = unacceptable risk. One outage or breaking change and admin access is gone. Resend already works for auth and deliverability reputation on the domain is established.

- **Stay on Resend for everything:** Known-good, paid tier has generous limits.
  - Why not: Misses the chance to exercise the new CF service on a low-stakes feature. Deferring all experimentation means we never learn whether CF is ready for the auth path either.

- **Chosen: CF for alerts (low stakes), Resend for auth (high stakes), Resend as fallback for alerts.**
  - Rationale below.

## Reasoning

**Match provider to stakes.** Alerts are high-signal low-frequency — if one is delayed by a provider hiccup, Magnus finds out on the next cron run or via the dashboard widget. Auth emails are single-point-of-failure — one bad delivery and Magnus can't log in.

**The fallback gives a real-world A/B comparison.** Every alert send logs `provider: 'cf' | 'resend'`. Over time that telemetry tells us whether CF Email Sending is reliable enough to promote to the auth path. Concrete data beats speculation.

**Workers binding keeps MIME semantics familiar.** `@cloudflare/workers-types` types the binding as `send(message: EmailMessage): Promise<void>` — the MIME-based API that's been shipping since 2022. The object-style API from the announcement blog post appears to be the REST/SMTP surface, not the Worker binding. We target the typed Worker binding; if types update to include an object shape, we migrate the notifier only (no caller changes).

**Abstraction contains the blast radius.** All email sending for alerts funnels through `src/notifier.ts`. Swapping providers, changing fallback logic, or rewriting the MIME builder all happen in one file.

## Trade-offs accepted

- **Beta service risk.** CF Email Sending may introduce breaking changes or have undocumented outages. Mitigated by the automatic Resend fallback — a failed CF send logs a warning and retries via Resend in the same invocation.
- **Unknown CF pricing.** The service "will require a paid Workers subscription" with charges "based on messages sent." Pricing not finalised at adoption time. Magnus accepted the unknown for this limited engagement.
- **Two provider configurations to maintain.** Two DNS/DKIM setups, two observability paths. Accepted because the magic-link path must stay reliable and the comparison data has independent value.
- **Sender reputation split.** The `alerts@hultberg.org` sender via CF is brand-new; the `noreply@hultberg.org` sender via Resend has history. Different addresses, so no direct interference, but worth being aware of.
- **Trust surface widening.** Falling back to Resend when CF Email Sending fails means alert content passes through both providers' systems. Alert content is system-generated and non-sensitive at adoption time. If future features add user-typed content to alert bodies (e.g. top search queries, update titles), re-evaluate against this trust model — see issue #30.

## Implications

**Enables:**
- Real-world evaluation of CF Email Sending on a low-risk surface before any migration of the auth path
- Provider-independent notifier: future alert channels (Slack, Discord, etc.) can slot in without restructuring

**Prevents / complicates:**
- Cannot yet declare "all outbound email on Cloudflare" — we'll revisit once CF is GA and we have delivery telemetry
- The notifier cannot know for *certain* that Resend fallback succeeded, only that its API returned 2xx. Actual delivery depends on downstream

## Re-evaluation trigger

Revisit this ADR when **any** of:
- CF Email Sending exits private beta (GA announcement)
- Pricing is published and surprises us either way (much cheaper → push harder; much more expensive → pull back)
- We see CF failures requiring Resend fallback in more than ~5% of sends over a 30-day window
- A month passes with clean CF delivery — candidate for migrating the auth path next

---

## References

- Spec: [SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md](../../SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md)
- [Cloudflare Email Sending announcement (Nov 2025)](https://blog.cloudflare.com/email-service/)
- Related: `src/notifier.ts`, `src/email.ts` (`sendViaResend` helper)
