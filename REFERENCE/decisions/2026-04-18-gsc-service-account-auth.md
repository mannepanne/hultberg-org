# ADR: Use a Google service account (not user OAuth) for GSC API access

**Date:** 2026-04-18
**Status:** Active
**Supersedes:** N/A

---

## Decision

The Worker authenticates to the Google Search Console API using a **Google service account** that's added as a user on the `sc-domain:hultberg.org` Search Console property. No human OAuth consent flow is involved.

## Context

We're building a scheduled Worker (daily cron) that polls GSC for sitemap status, indexing counts, and search performance. The poll runs unattended — there's no human in the loop to complete an OAuth consent flow or refresh tokens. The Worker needs a stable, non-interactive way to call the GSC API.

## Alternatives considered

- **User OAuth 2.0 flow:** Magnus logs in, grants the Worker permission, we store the refresh token.
  - Why not: Interactive consent needed at setup; refresh tokens can be revoked if the Google account password changes or the grant is revoked; Workers runtime has no good place to do the initial interactive dance; adds complexity for what is really a machine-to-machine call.

- **API key:** Simple string-based auth.
  - Why not: GSC data is private (tied to property ownership). API keys only authorise access to public data. This just does not work for Search Console.

- **Chosen: Google service account added as a Search Console property user:** Non-interactive JWT-bearer grant, no refresh-token plumbing.
  - Rationale below.

## Reasoning

**Service accounts are purpose-built for machine-to-machine access to private Google data.** The auth flow is stateless per invocation — sign a JWT with the private key, exchange for a 1-hour access token, call the API. No long-lived state to manage; no re-consent on password changes; no user-facing interruptions.

**Scope is narrow.** The service account has `siteFullUser` on exactly one Search Console property (`sc-domain:hultberg.org`) — nothing else in any Google Cloud project. If the key leaks, the blast radius is read-only GSC data for one property. No roles granted at the GCP project level.

**Tooling fits the Workers runtime.** RS256 JWT signing is straightforward with Web Crypto's `SubtleCrypto`. No Node `crypto` module required. Proven end-to-end with a local Node verification script before any Worker code was written.

## Trade-offs accepted

- **Key rotation is manual.** The private key has no automatic expiry; rotation requires generating a new key in GCP, updating the wrangler secret, and ideally deleting the old key. Documented as an operational step in `REFERENCE/environment-setup.md`.
- **Secret storage.** The service account JSON lives as `GSC_SERVICE_ACCOUNT_JSON` — a stringified JSON wrangler secret. Anyone with access to the Worker's secrets can act as the service account (within its narrow scope).
- **Service account visible on the property.** The account email shows up in Search Console's Users and permissions list. Cosmetic, not a problem.

## Implications

**Enables:**
- Unattended daily cron with no consent-flow failures
- Independent revocation — deleting the service account kills access without touching Magnus's personal Google account
- Easy testing via a throwaway local script (no web redirect)

**Prevents / complicates:**
- If we later want the Worker to *write* to GSC (submit a sitemap, request reindexing), the service account permission level and OAuth scope would need to be broadened.
- Quota is attached to the GCP project containing the service account, not to Magnus as a user. Not a constraint at our traffic.

---

## References

- Spec: [SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md](../../SPECIFICATIONS/ARCHIVE/gsc-insights-and-alerts.md)
- Google docs: [Using OAuth 2.0 for Server to Server Applications](https://developers.google.com/identity/protocols/oauth2/service-account)
- Related: `src/jwt.ts` (RS256 via Web Crypto), `src/gsc.ts` (API client)
