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

## Resolved Items

*(Move items here when addressed, with resolution notes)*

---

## Notes

- Items are prefixed TD-NNN for easy reference in code comments and PR reviews.
- When adding new debt, include: location, issue description, why it was accepted, risk level, and proposed future fix.
- Review this list at the start of each new phase to see if any items should be addressed.
