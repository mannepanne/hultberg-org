# Technical Debt Tracker

Tracks known limitations, shortcuts, and deferred improvements in the codebase.
Items here are accepted risks or pragmatic choices made during development, not bugs.

---

## Active Items

### TD-001: Regex-Based HTML Sanitization
- **Location:** `src/routes/updatePage.ts` - `sanitizeHTML()`
- **Issue:** Uses regex pattern matching instead of a proper HTML parser for sanitizing markdown-rendered content. Regex cannot handle all XSS vectors (e.g. nested tags, obfuscated payloads).
- **Why accepted:** No HTML sanitization library is compatible with the Cloudflare Workers runtime (DOMPurify requires DOM, sanitize-html requires node::process). CSP headers provide defence-in-depth.
- **Risk:** Low-Medium. Content comes from admin-controlled GitHub repository, not untrusted user input. CSP mitigates most browser-side XSS.
- **Future fix:** Evaluate worker-tools/html or a WASM-based sanitizer when Workers runtime support improves. Alternatively, sanitize at write-time when saving updates (Phase 4+).
- **Phase introduced:** 2

---

### TD-002: Rate Limiting Race Condition
- **Location:** `src/auth.ts` - `checkRateLimit()`
- **Issue:** The get-increment-put pattern is not atomic. Under high concurrency, multiple requests could read the same counter value and each increment from the same base, allowing rate limit bypass.
- **Why accepted:** Single admin user, very low traffic. Workers execution model limits true concurrency per isolate.
- **Risk:** Very Low. This is a personal admin panel, not a high-traffic public endpoint.
- **Future fix:** Replace with Cloudflare Workers Rate Limiting API (`env.RATE_LIMITER`) or Durable Objects for atomic counters.
- **Phase introduced:** 3

---

### TD-003: Basic Email Validation Regex
- **Location:** `src/auth.ts` - `isValidEmail()`
- **Issue:** Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` allows technically invalid addresses like `"a"@domain.com` or `user@domain..com`.
- **Why accepted:** Sufficient for the single-user admin login flow. Invalid emails just silently fail to receive a link.
- **Risk:** Very Low. Email validation is a secondary check; the primary guard is admin email matching.
- **Future fix:** Use a more comprehensive RFC 5322 regex or a validation library if the email input surface expands.
- **Phase introduced:** 3

---

### TD-004: Admin Dashboard Returns Redirect Instead of 401
- **Location:** `src/routes/adminDashboard.ts:182-184`
- **Issue:** Unauthenticated requests to `/admin/dashboard` get a 302 redirect, while other admin API endpoints return 401. Inconsistency can mask auth failures during debugging.
- **Why accepted:** Redirect is correct UX for a browser-facing page; API endpoints returning 401 is correct for programmatic clients. The asymmetry is intentional.
- **Risk:** Very Low. Only affects debugging experience.
- **Future fix:** No code change needed — worth noting the pattern is intentional so future routes follow the same split.
- **Phase introduced:** 4

---

### TD-005: Silent Partial Image Delete Failures
- **Location:** `src/github.ts` - `deleteImagesDirectory()`
- **Issue:** Individual image deletion failures are caught and logged but swallowed. The caller has no way to know if images were orphaned after a delete operation.
- **Why accepted:** Cascade delete is documented as best-effort. The update JSON file is the primary record; orphaned images are minor storage waste with no functional impact on the site.
- **Risk:** Low. Could leave orphaned images in the GitHub repo.
- **Future fix:** Return a partial-failure summary from `deleteImagesDirectory` if orphaned images become a maintenance issue. A cleanup script against the GitHub repo would also suffice.
- **Phase introduced:** 4

---

### TD-006: `fetchAllUpdates` Conflates API Error with Empty Repo
- **Location:** `src/github.ts` - `fetchAllUpdates()`
- **Issue:** Both a GitHub API error and an empty repo return `[]`. Dashboard shows "No updates yet" in both cases — a failed API call is indistinguishable from an empty repo.
- **Why accepted:** GitHub API failures are rare for this use case. The admin can check GitHub directly if updates appear to be missing.
- **Risk:** Low. Could cause confusion when debugging missing updates.
- **Future fix:** Return a structured result like `{ updates: Update[], error?: string }` so the dashboard can show "Failed to load — check GITHUB_TOKEN" vs "No updates yet".
- **Phase introduced:** 4

---

### TD-007: `/admin/api/updates` Endpoint Unused by Dashboard
- **Location:** `src/routes/adminDashboard.ts`, `src/routes/listUpdates.ts`
- **Issue:** The spec (blog-updates-implementation.md:605) describes the dashboard fetching data via `/admin/api/updates`, but the implementation fetches directly from GitHub server-side at render time. The API endpoint exists but is not used by the dashboard itself.
- **Why accepted:** Server-side fetching is simpler and avoids an extra client-side round-trip. The API endpoint remains available for Phase 5's editor to use.
- **Risk:** Very Low. Conscious divergence from spec; no functional impact.
- **Future fix:** Update the spec to reflect the server-side rendering pattern once Phase 5 confirms the API endpoint's role.
- **Phase introduced:** 4

---

### TD-008: Logout Endpoint Accepts Unauthenticated Requests
- **Location:** `src/routes/adminLogout.ts`
- **Issue:** POST `/admin/logout` accepts any request with the correct Origin header, authenticated or not. An unauthenticated caller gets a `Set-Cookie: Max-Age=0` response — harmless since they have no cookie to clear.
- **Why accepted:** Logout is inherently non-privileged. The worst outcome is clearing a non-existent cookie. Origin validation already provides CSRF protection.
- **Risk:** Very Low. No practical security or functional impact.
- **Future fix:** Not recommended — the simplicity is a feature. Document as intentional.
- **Phase introduced:** 4

---

## Resolved Items

*(Move items here when addressed, with resolution notes)*

---

## Notes

- Items are prefixed TD-NNN for easy reference in code comments and PR reviews.
- When adding new debt, include: location, issue description, why it was accepted, risk level, and proposed future fix.
- Review this list at the start of each new phase to see if any items should be addressed.
