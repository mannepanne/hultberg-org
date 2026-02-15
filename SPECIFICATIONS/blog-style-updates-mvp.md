# Blog-Style Updates Feature - MVP Specification

## What is this feature?

A simple, lightweight blog feature for hultberg.org that allows Magnus to publish updates without requiring a database. Updates are stored as JSON files in the GitHub repository, with automatic deployment to Cloudflare Workers when changes are made. The feature includes a password-protected admin interface for creating, editing, and managing updates.

## Key Design Principles

- **No database required** - Content stored as JSON files in the repository
- **Version controlled** - All updates backed up in Git with full history
- **Simple and fast** - Minimal dependencies, clean HTML based on existing /now page style
- **Auto-deployment** - GitHub Actions automatically deploy changes when updates are published

## Current Site Architecture

**Important:** The existing site at hultberg.org is fully functional. For complete architecture details, see [CLAUDE.md](../CLAUDE.md#current-implementation-notes).

**Key points:**
- Cloudflare Workers Assets serves static files from `public/` **before** the Worker's fetch handler runs
- The Worker (`src/index.ts`) only executes for requests that don't match static files
- The Worker currently provides a custom 404 page for missing resources
- This updates feature will add new routes to the Worker for `/updates/*` and `/admin/*`

## User-Facing Features

### Updates Listing Page (`/updates`)

- Shows all published updates in reverse chronological order (newest first)
- Each update displays:
  - Title (linked to individual update page)
  - Excerpt (custom excerpt if provided, otherwise first 150 characters)
  - Published date
- Pagination: 10 updates per page
- Design based on `/now` page template (simple, clean HTML)

### Individual Update Page (`/updates/{slug}`)

- Full update content rendered from Markdown **server-side in Worker** (not browser)
- HTML is sanitized and cached for performance
- Metadata displayed:
  - Title
  - Author: Magnus Hultberg (linked to `/now` page)
  - Published date
  - Last edited date (if different from published)
- Images displayed inline in content
- Click to enlarge images
- SEO meta tags (Open Graph, Twitter Cards, etc.)
- Google Analytics tracking
- Drafts return 404 to public visitors

### RSS Feed (`/updates/feed.xml`)

- Standard RSS 2.0 feed
- Includes all published updates
- Full content in feed items

## Admin Features

### Authentication (`/admin`)

- Magic link authentication
- Email sent to Magnus's personal email address
- Simple, secure, no password management

### Updates Management Dashboard

- List view showing all updates (published AND drafts)
- Each update shows:
  - Title
  - Status (Draft/Published)
  - Published date (if published)
  - Last edited date
- Actions: Create New, Edit, Delete

### Update Editor

- Fields:
  - **Title** (required)
  - **Excerpt** (optional - if empty, first 150 chars used automatically)
  - **Content** (Markdown editor using EasyMDE - actively maintained fork of SimpleMDE)
  - **Status** (Draft/Published toggle)
- **EasyMDE Editor Features**:
  - Split view (Markdown source + live preview side-by-side)
  - Visual toolbar with icons for:
    - Headers (H1, H2, H3)
    - Bold, Italic
    - Links
    - Bullet lists, Numbered lists
    - And standard EasyMDE features
  - Custom image upload button integrated into toolbar
- **Image Gallery**:
  - Shows all uploaded images for this update at bottom of editor
  - Click image to insert at cursor position in content
  - Images automatically resized to max 800x800px (maintaining aspect ratio)
  - Client-side resize before upload
- **Styling**:
  - Light structure with clean forms
  - Basic styling for better usability
  - Clear buttons and inputs
  - Simple grid layout for dashboard
  - Minimal but polished aesthetic
- **Actions**:
  - Save as Draft
  - Publish (or Update if already published)
  - Preview
  - Cancel
  - Delete

### Preview

- Shows exactly how the update will appear when published
- Uses same rendering as public update page
- Can preview drafts before publishing

## Technical Implementation

### Storage Structure

```
public/
  images/
    updates/
      {slug}/
        image1.jpg
        image2.png
  updates/
    data/
      {slug}.json
      index.json          # Metadata for all updates (for listing page)
```

### Update JSON Format

```json
{
  "slug": "using-claude-code-to-implement-a-blog-feature",
  "title": "Using Claude Code to implement a blog feature",
  "excerpt": "A custom excerpt if provided, otherwise empty string",
  "content": "Full markdown content here...",
  "status": "published",
  "publishedDate": "2026-02-14T14:30:00Z",
  "editedDate": "2026-02-14T15:45:00Z",
  "author": "Magnus Hultberg",
  "images": [
    "/images/updates/using-claude-code-to-implement-a-blog-feature/image1.jpg",
    "/images/updates/using-claude-code-to-implement-a-blog-feature/image2.png"
  ]
}
```

### Index JSON Format

```json
{
  "updates": [
    {
      "slug": "update-slug",
      "title": "Update Title",
      "excerpt": "Excerpt or first 150 chars",
      "publishedDate": "2026-02-14T14:30:00Z",
      "status": "published"
    }
  ]
}
```

### Slug Generation

- Convert title to lowercase
- Replace spaces with hyphens
- Remove special characters (keep alphanumeric and hyphens)
- If duplicate slug exists, append `-2`, `-3`, etc.

### Deployment Workflow

1. **User creates/edits update in admin** → Browser POSTs to Worker API endpoint
2. **Worker backend** → Commits to GitHub via GitHub API using `env.GITHUB_TOKEN` (token never exposed to browser)
3. **GitHub receives commit** → Triggers GitHub Action
4. **GitHub Action runs** → Executes `wrangler deploy`
5. **Cloudflare Workers updated** → New content live (~2 min total)

**Security Note:** All GitHub API calls happen server-side in the Worker. The GitHub token is stored as a Cloudflare Secret and never sent to the browser.

### Authentication Flow

1. User visits `/admin`
2. If not authenticated, show email input form
3. Submit email → Worker sends magic link via email service (Resend.com)
4. User clicks link → Sets authentication cookie
5. Cookie valid for 7 days
6. Admin dashboard loads

## Cloudflare Worker Routes

- `GET /updates` → List updates (paginated)
- `GET /updates/page/{n}` → Paginated listing
- `GET /updates/{slug}` → Individual update (404 if draft)
- `GET /updates/feed.xml` → RSS feed
- `GET /admin` → Admin dashboard (auth required)
- `GET /admin/preview/{slug}` → Preview update (auth required)
- `POST /admin/api/send-magic-link` → Send authentication email
- `GET /admin/api/verify-token` → Verify magic link token
- All other routes → Existing 404 handler

## Dependencies

### NPM Packages (to be added)
- `easymde` - Markdown editor (actively maintained fork of SimpleMDE, ~50KB)
- `marked` - Markdown to HTML conversion (server-side in Worker)
- `sanitize-html` or custom allowlist-based sanitizer - HTML sanitization (Workers-compatible)
  - Note: `dompurify` is browser-only and won't work in Workers runtime

### Cloudflare Services
- **Workers** (existing) - Main application runtime
- **Workers Assets** (existing) - Serve static files
- **Workers KV** (existing) - Store magic link tokens and rate limit data

**KV Namespace Configuration:**
- Namespace name: `MAGIC_LINK_TOKENS`
- Bind to Worker via `wrangler.toml`

**Key Naming Scheme:**
- Magic link tokens: `auth:token:{random_token}` → value: `{email_address}`
- Rate limiting: `ratelimit:ip:{ip_address}` → value: `{request_count}`

**TTL Strategy:**
- Magic link tokens: 900 seconds (15 minutes) - set via `expirationTtl` on put
- Rate limit counters: 60 seconds (1 minute window) - set via `expirationTtl` on put

**Token Invalidation:**
- Single-use: Token deleted from KV immediately after successful authentication
- Expired tokens: Auto-deleted by KV TTL mechanism

**Eventual Consistency Handling:**
- KV propagates globally within 60 seconds
- Magic links are short-lived (15 min) and single-use, so consistency delay is acceptable
- If token already used/deleted, subsequent attempts fail gracefully (token not found)

### External Services
- **Resend.com** (existing account) - Send magic link emails
- **GitHub API** - Commit updates from admin interface

## Configuration & Secrets

All sensitive credentials are stored as **Cloudflare Secrets** (encrypted, never committed to repository):

- `RESEND_API_KEY` - Resend.com API key for sending magic link emails
- `GITHUB_TOKEN` - GitHub Personal Access Token (fine-grained) with:
  - Repository: `hultberg-org`
  - Permission: **Contents** (Read and write)

**Setup commands:**
```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put GITHUB_TOKEN
```

**Access in Worker:**
```typescript
env.RESEND_API_KEY
env.GITHUB_TOKEN
```

## Security

### Authentication

**Magic Link Flow:**
1. User enters email address at `/admin`
2. Worker generates cryptographically secure random token (32 bytes)
3. Token stored in Workers KV with 15-minute TTL
4. Email sent via Resend.com with link: `/admin?token={token}`
5. User clicks link, Worker validates token from KV
6. On success, token is deleted from KV (single use)
7. Worker sets authentication cookie

**Authentication Cookie:**
```
Name: auth_token
Value: JWT signed with secret key
HttpOnly: true (prevents JavaScript access)
Secure: true (HTTPS only)
SameSite: Strict (CSRF protection)
Max-Age: 604800 (7 days)
Path: /admin
```

### CSRF Protection

**Strategy:** SameSite=Strict cookie + Origin header validation

1. **SameSite=Strict** prevents cookie from being sent on cross-origin requests
2. **Origin header check** on all admin POST/DELETE endpoints:
```typescript
   const origin = request.headers.get('Origin');
   if (origin !== 'https://hultberg.org') {
     return new Response('Forbidden', { status: 403 });
   }
```
3. **No explicit CSRF tokens needed** due to SameSite=Strict

### XSS Prevention

**Content Sanitization:**
- Markdown content is parsed and rendered **server-side in the Worker**
- HTML output is sanitized before storage using a Workers-compatible library
- Images are validated (file type, size) before upload
- User input (title, excerpt) is HTML-escaped when rendered

**Why not dompurify?**
- `dompurify` is browser-only (DOM API dependency)
- `isomorphic-dompurify` may not work in Workers runtime

**Alternative approach:**
1. Use `marked` to convert Markdown → HTML in Worker
2. Use a simple allowlist-based sanitizer for Workers (custom or library like `sanitize-html`)
3. Only allow safe HTML tags: `p, h1-h6, a, img, ul, ol, li, blockquote, code, pre, em, strong, br`
4. Strip all attributes except: `href` (on `a`), `src`/`alt` (on `img`)
5. Validate all URLs (must be https:// or relative paths)

### Rate Limiting

**Admin API endpoints:**
- Maximum 10 requests per minute per IP address
- Prevents brute force attempts on magic links
- Uses Workers KV to track request counts

### Input Validation

**All admin API endpoints validate:**
- Authentication cookie is present and valid
- Request origin matches expected domain
- Input data types and formats
- Image file sizes (max 5MB before resize)
- Slug format (alphanumeric + hyphens only)

## Future Enhancements (Not in MVP)

- Tags/categories for updates
- Manual date editing (backdate posts, fix mistakes, migrate old content)
- Search functionality
- Comments system
- Social sharing buttons
- Analytics dashboard in admin
- Scheduled publishing
- Image optimization using Cloudflare Images
- Markdown import/export
- Multiple authors

## Implementation Steps

### Phase 1: Storage & Data Structure
1. Create directory structure (`public/updates/data/`, `public/images/updates/`)
2. Create sample update JSON files for testing
3. Create index.json structure
4. Add utility functions for slug generation and duplicate detection

### Phase 2: Public Pages
5. Implement `/updates` listing page
  - Read index.json
  - Filter published updates only
  - Implement pagination
  - Render using `/now` page style as template
6. Implement `/updates/{slug}` individual page
  - Read update JSON
  - Convert Markdown to HTML
  - Sanitize output
  - Render with metadata and images
  - Handle 404 for drafts and missing updates
7. Implement RSS feed (`/updates/feed.xml`)

### Phase 3: Authentication
8. Implement magic link generation
9. Set up Resend.com email sending
10. Implement token storage in Workers KV
11. Create authentication middleware
12. Build login page UI

### Phase 4: Admin Dashboard
13. Create admin layout and navigation
14. Build updates list view (show all updates with status)
15. Implement delete functionality

### Phase 5: Update Editor
16. Integrate EasyMDE library
17. Build editor form UI with fields and light styling
18. Add custom image upload button to EasyMDE toolbar
19. Implement client-side image resize before upload
20. Create image gallery component
21. Wire up editor to call Worker API endpoints (not GitHub directly)
22. Build preview functionality

### Phase 6: Worker Backend API Endpoints
23. Implement `POST /admin/api/save-update` endpoint:
    - Receive update data from browser
    - Validate and sanitize input
    - Use `env.GITHUB_TOKEN` to commit JSON file to GitHub
    - Update index.json atomically
    - Return success/error response
24. Implement `POST /admin/api/upload-image` endpoint:
    - Receive image from browser
    - Optionally resize server-side (or validate client-side resize)
    - Commit to `public/images/updates/{slug}/` in GitHub
    - Return image path
25. Implement `DELETE /admin/api/delete-update` endpoint:
    - Remove update JSON file via GitHub API
    - Update index.json
    - Return success/error response
26. Implement `DELETE /admin/api/delete-image` endpoint:
    - Remove image file via GitHub API
    - Return success/error response
27. Implement `GET /admin/api/updates` endpoint:
    - Return all updates (including drafts) from index.json
    - Used by admin dashboard to list updates

### Phase 7: Auto-Deployment
27. Create GitHub Action workflow file
28. Configure Cloudflare API token for deployment
29. Test automatic deployment on commit

### Phase 8: Testing & Polish
30. Test full workflow end-to-end
31. Add error handling and validation
32. Test image upload and resize
33. Verify RSS feed validity
34. Test pagination edge cases
35. Security audit (XSS, CSRF, authentication)
36. Performance testing

### Phase 9: Documentation
37. Update CLAUDE.md with new routes and functionality
38. Document admin workflow
39. Add comments to complex code sections

## Success Criteria

- ✅ Can create, edit, and delete updates via admin interface
- ✅ Drafts are private, published updates are public
- ✅ Updates display correctly with Markdown formatting
- ✅ Multiple images can be uploaded and inserted
- ✅ Images resize correctly to 800x800 max
- ✅ Pagination works correctly
- ✅ RSS feed is valid and includes all published updates
- ✅ Magic link authentication works reliably
- ✅ Changes auto-deploy within ~2 minutes
- ✅ All content version controlled in GitHub
- ✅ No errors in console or logs
- ✅ Site maintains existing design aesthetic
