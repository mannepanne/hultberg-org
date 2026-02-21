# Blog Updates - Security Implementation

**Related:** [blog-style-updates-mvp.md](./blog-style-updates-mvp.md) | [blog-updates-implementation.md](./blog-updates-implementation.md)

This document details all security measures, authentication flows, and data protection strategies for the blog updates feature.
See also:
- [CLAUDE.md](./CLAUDE.md)  for general project structure and developer onboarding notes

---

## Authentication

### Magic Link Flow

1. User enters email address at `/admin`
2. Worker generates cryptographically secure random token (32 bytes)
3. Token stored in Workers KV with 15-minute TTL and timestamp
4. Email sent via Resend.com with link: `/admin?token={token}`
5. User clicks link, Worker validates token from KV
6. **Token reuse prevention:** Check if token was used recently (< 5 seconds ago)
7. On success, token is deleted from KV (single use)
8. Worker sets authentication cookie

**Token reuse prevention (addresses KV eventual consistency):**

Due to Workers KV eventual consistency (up to 60-second global propagation), there's a window where a deleted token might still appear valid in different regions. To prevent this:

```typescript
// Token value structure in KV
{
  "email": "user@example.com",
  "timestamp": 1234567890000,  // When token was created/last used
  "used": false
}

// On verification
const tokenData = JSON.parse(await env.MAGIC_LINK_TOKENS.get(`auth:token:${token}`));
if (!tokenData) {
  return new Response('Invalid or expired token', { status: 403 });
}

// Check if token was recently used (< 5 seconds)
const timeSinceCreation = Date.now() - tokenData.timestamp;
if (tokenData.used || timeSinceCreation < 5000) {
  return new Response('This link has already been used', { status: 403 });
}

// Mark as used and update timestamp
await env.MAGIC_LINK_TOKENS.put(
  `auth:token:${token}`,
  JSON.stringify({ ...tokenData, used: true, timestamp: Date.now() }),
  { expirationTtl: 60 }  // Keep for 60s to prevent reuse during propagation
);
```

This prevents the same token from being used twice, even during KV propagation delays.

### Authentication Cookie Configuration

```
Name: auth_token
Value: JWT signed with secret key
HttpOnly: true (prevents JavaScript access)
Secure: true (HTTPS only)
SameSite: Strict (CSRF protection)
Max-Age: 604800 (7 days)
Path: /admin
```

**Why these settings?**
- `HttpOnly`: Prevents XSS attacks from stealing the cookie
- `Secure`: Cookie only sent over HTTPS
- `SameSite=Strict`: Prevents CSRF attacks (cookie not sent on cross-origin requests)
- `Path=/admin`: Cookie only sent to admin routes

---

## Workers KV Configuration

### Namespace Setup

**Namespace name:** `MAGIC_LINK_TOKENS`

**Binding:** Configure in `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "MAGIC_LINK_TOKENS"
id = "your_kv_namespace_id"
```

### Key Naming Scheme

- **Magic link tokens:** `auth:token:{random_token}` → value: `{email_address}`
- **Rate limiting:** `ratelimit:ip:{ip_address}` → value: `{request_count}`

### TTL Strategy

- **Magic link tokens:** 900 seconds (15 minutes)
  - Set via `expirationTtl` parameter on KV put operation
  - Ensures tokens expire automatically
- **Rate limit counters:** 60 seconds (1 minute window)
  - Rolling window for rate limiting
  - Auto-cleanup via TTL

### Token Invalidation

**Single-use tokens:**
- Token deleted from KV immediately after successful authentication
- Prevents token reuse

**Expired tokens:**
- Auto-deleted by KV TTL mechanism
- No manual cleanup needed

### Eventual Consistency Handling

**KV Propagation:**
- Global propagation within 60 seconds
- Magic links are short-lived (15 min) and single-use
- Consistency delay is acceptable for this use case

**Failure scenarios:**
- Token already used/deleted: Subsequent attempts fail gracefully (token not found)
- User receives error: "This link has expired or already been used"

---

## CSRF Protection

### Strategy

**Dual protection:** SameSite cookie + Origin header validation

### Implementation

**1. SameSite=Strict Cookie**
- Prevents cookie from being sent on cross-origin requests
- Most effective CSRF protection

**2. Origin Header Validation**
- Applied to all admin POST/DELETE endpoints
- Example implementation:

```typescript
const origin = request.headers.get('Origin');
if (origin !== 'https://hultberg.org') {
  return new Response('Forbidden', { status: 403 });
}
```

**3. No Explicit CSRF Tokens**
- Not needed due to SameSite=Strict
- Simplifies implementation

---

## XSS Prevention

### Content Sanitization Strategy

**Server-Side Rendering:**
- Markdown content parsed and rendered **server-side in the Worker**
- HTML output sanitized before storage
- Never trust user input

### Why Not DOMPurify?

- `dompurify` is browser-only (requires DOM API)
- `isomorphic-dompurify` may not work in Cloudflare Workers runtime

### Sanitization Approach

**1. Markdown to HTML Conversion**
- Use `marked` library in Worker
- Converts Markdown → HTML

**2. Allowlist-Based Sanitization**
- Use `sanitize-html` library or custom implementation
- Only allow safe HTML tags:
  - `p, h1, h2, h3, h4, h5, h6`
  - `a, img`
  - `ul, ol, li`
  - `blockquote, code, pre`
  - `em, strong, br`

**3. Attribute Filtering**
- Strip all attributes except:
  - `href` on `<a>` tags
  - `src` and `alt` on `<img>` tags

**4. URL Validation**
- All URLs must be:
  - `https://` protocol
  - OR relative paths (starting with `/`)
- Block `javascript:`, `data:`, and other dangerous protocols

### HTML Escaping

**User Input Fields:**
- Title and excerpt are HTML-escaped when rendered
- Prevents injection via these fields
- Use proper escaping functions for the templating system

---

## Content Security Policy (CSP)

### Purpose

Content Security Policy headers provide defense-in-depth against XSS attacks, even if sanitization fails.

### CSP Headers for Admin Pages

**Admin interface** (`/admin/*` routes):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' cdn.jsdelivr.net;
  img-src 'self' data:;
  connect-src 'self';
  font-src 'self' cdn.jsdelivr.net;
  frame-ancestors 'none';
  base-uri 'self';
```

**Explanation:**
- `default-src 'self'`: Default to same-origin only
- `script-src`: Allow EasyMDE from CDN (jsdelivr.net) + inline scripts for editor
- `style-src`: Allow EasyMDE CSS from CDN + inline styles
- `img-src 'self' data:`: Allow images from site + data URLs (for image preview)
- `connect-src 'self'`: XHR/fetch only to same origin
- `frame-ancestors 'none'`: Prevent clickjacking
- `base-uri 'self'`: Prevent base tag injection

**Why ****`'unsafe-inline'`**** for admin?**
- EasyMDE requires inline scripts/styles
- Admin is single authenticated user (Magnus), not public-facing
- Trade-off: usability over strict CSP for admin interface
- Still blocks external script injection

### CSP Headers for Public Pages

**Public pages** (`/updates/*` routes):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
```

**Stricter policy for public:**
- No external CDNs
- No inline scripts
- Only inline styles (for simple formatting)
- Blocks all XSS attempts via CSP layer

### Implementation

Add CSP headers in Worker response:

```typescript
// Admin pages
return new Response(html, {
  headers: {
    'Content-Type': 'text/html',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; ..."
  }
});

// Public pages
return new Response(html, {
  headers: {
    'Content-Type': 'text/html',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; ..."
  }
});
```

---

## Rate Limiting

### Admin API Endpoints

**Limit:** 10 requests per minute per IP address

**Purpose:**
- Prevents brute force attempts on magic links
- Mitigates DoS attacks on admin endpoints

### Implementation

**1. Track Request Counts in KV**
- Key: `ratelimit:ip:{ip_address}`
- Value: Request count (integer)
- TTL: 60 seconds

**2. Rate Limit Logic**

```typescript
const ip = request.headers.get('CF-Connecting-IP');
const key = `ratelimit:ip:${ip}`;
const count = await env.MAGIC_LINK_TOKENS.get(key);

if (count && parseInt(count) >= 10) {
  return new Response('Rate limit exceeded', { status: 429 });
}

// Increment counter
await env.MAGIC_LINK_TOKENS.put(
  key,
  count ? (parseInt(count) + 1).toString() : '1',
  { expirationTtl: 60 }
);
```

### Exemptions

- Public routes (`/updates`, `/updates/{slug}`, RSS feed) are NOT rate limited
- Only admin API endpoints are protected

---

## Input Validation

### All Admin API Endpoints Validate

**Authentication:**
- Cookie is present and valid
- JWT signature verified
- Token not expired

**Request Origin:**
- Origin header matches expected domain (`https://hultberg.org`)
- Prevents cross-origin attacks

**Data Types & Formats:**
- Title: String, max 200 characters
- Excerpt: String, max 300 characters (optional)
- Content: String, max 100KB (102,400 bytes)
  - **CRITICAL:** Enforce this limit BEFORE GitHub API call
  - Reject requests with clear error: "Content exceeds 100KB limit"
  - Validate on both client (for UX) and server (for security)
  - Calculate size in bytes, not characters: `new TextEncoder().encode(content).length`
- Status: Enum (`draft`, `published`, or `unpublished`)
- Slug: Alphanumeric + hyphens only, validated with regex

**File Uploads:**
- Image file sizes: Max 5MB before resize
- File types: Only `image/jpeg`, `image/png`, `image/webp`
- Validate MIME type AND file extension

**Slug Validation:**
- Pattern: `/^[a-z0-9-]+$/`
- Reject special characters
- Check for reserved slugs (`page`)

---

## Secrets Management

### Cloudflare Secrets

All sensitive credentials stored as Cloudflare Secrets (encrypted, never committed to repository):

**Required Secrets:**
- `RESEND_API_KEY` - Resend.com API key for sending emails
- `GITHUB_TOKEN` - GitHub Personal Access Token (fine-grained)
  - Repository: `hultberg-org`
  - Permission: **Contents** (Read and write)
- `ADMIN_EMAIL` - Email address for admin access
- `JWT_SECRET` - Secret key for signing authentication JWTs

**Setup:**
```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put JWT_SECRET
```

**Access in Worker:**
```typescript
env.RESEND_API_KEY
env.GITHUB_TOKEN
env.ADMIN_EMAIL
env.JWT_SECRET
```

---

## Security Checklist

Before deploying to production, verify:

- [ ] All secrets configured in Cloudflare
- [ ] Authentication cookies use HttpOnly, Secure, SameSite=Strict
- [ ] CSRF protection enabled (Origin header check)
- [ ] XSS prevention (server-side sanitization)
- [ ] Rate limiting configured for admin endpoints
- [ ] Input validation on all API endpoints
- [ ] GitHub token never exposed to browser
- [ ] Magic links are single-use and expire in 15 minutes
- [ ] HTTPS enforced (Cloudflare handles this)
- [ ] No secrets in git repository or logs

---

## Threat Model

### What We Protect Against

✅ **CSRF attacks** - SameSite cookies + Origin validation
✅ **XSS attacks** - Server-side sanitization + HTML escaping
✅ **Brute force** - Rate limiting on admin endpoints
✅ **Token replay** - Single-use magic links
✅ **Session hijacking** - HttpOnly + Secure cookies
✅ **Unauthorized access** - JWT authentication required

### What's Out of Scope for MVP

❌ **DDoS protection** - Rely on Cloudflare's DDoS protection
❌ **SQL injection** - No database in MVP
❌ **Account enumeration** - Single admin user, not applicable
❌ **Password attacks** - No passwords (magic links only)

---

**Last Updated:** February 2026
**Reviewed By:** Independent agent review (ID: ad0e372)
