# Blog-Style Updates Feature - MVP Specification

**Related Documents:**
- [blog-updates-security.md](./blog-updates-security.md)
- [blog-updates-implementation.md](./blog-updates-implementation.md)

---

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

---

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
- SEO meta tags (Open Graph, Twitter Cards, etc.)
- Google Analytics tracking
- Drafts return 404 to public visitors

### RSS Feed (`/updates/feed.xml`)

- Standard RSS 2.0 feed
- Includes all published updates
- Full content in feed items
- Absolute URLs for images

---

## Admin Features

### Authentication (`/admin`)

- **Magic link authentication** - Email sent to Magnus's personal email address
- Simple, secure, no password management
- See [blog-updates-security.md](./blog-updates-security.md) for complete authentication flow

### Updates Management Dashboard

- List view showing all updates (published AND drafts)
- Each update shows:
  - Title
  - Status (Draft/Published)
  - Published date (if published)
  - Last edited date
- Actions: Create New, Edit, Delete

### Update Editor

- **Fields:**
  - Title (required)
  - Excerpt (optional - if empty, first 150 chars generated at display time)
  - Content (Markdown editor using EasyMDE)
  - Status (Draft/Published/Unpublished toggle)

- **EasyMDE Editor Features:**
  - Split view (Markdown source + live preview side-by-side)
  - Visual toolbar with formatting buttons
  - Custom image upload button integrated into toolbar

- **Image Gallery:**
  - Shows all uploaded images for this update at bottom of editor
  - Click image to insert at cursor position in content
  - Images automatically resized to max 800x800px (maintaining aspect ratio)
  - Client-side resize before upload

- **Actions:**
  - Save as Draft
  - Publish (or Update if already published)
  - Preview
  - Cancel
  - Delete

### Preview

- Shows exactly how the update will appear when published
- Uses same rendering as public update page
- Can preview drafts before publishing

---

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
      index.json          # Generated at build time by GitHub Action
```

### Update JSON Format

```json
{
  "slug": "using-claude-code-to-implement-a-blog-feature",
  "title": "Using Claude Code to implement a blog feature",
  "excerpt": "",
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

**Note on excerpt field:**
- Stored as empty string `""` if user doesn't provide custom excerpt
- First 150 characters of content generated at display time (listing page, RSS feed)
- This preserves user intent and allows changing excerpt generation logic later

**Note on status field:**
- `draft` - Not visible to public, work in progress
- `published` - Live on site, visible to all
- `unpublished` - Previously published but now hidden (soft delete for rollback)

### Index JSON Format

Generated automatically by GitHub Action during deployment:

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
- Reserved slugs: `page` (used for pagination)

**Important: Slugs are immutable after creation**
- Once an update is created, its slug cannot be changed
- This prevents broken links and simplifies image storage
- To "rename" an update, delete and recreate it (or just change the title display text)
- Slug generation happens server-side during first save

### Implementation Details

**Admin Email Configuration:**
- Admin email stored as Cloudflare Secret: `ADMIN_EMAIL`
- Magic links only sent to this address

**Bootstrap & Initial Setup:**
- Directory structure created manually or via script
- Empty `index.json` with `{"updates": []}` committed to repo
- First update creates the pattern for subsequent updates

**Empty State Handling:**
- `/updates` with no published updates: Shows "No updates yet. Check back soon!"
- Admin dashboard with no updates: Shows "Create your first update" button

**RSS Feed Absolute URLs:**
- Worker constructs absolute URLs using request hostname
- Example: `/images/updates/slug/image.jpg` → `https://hultberg.org/images/updates/slug/image.jpg`

### Deployment Workflow

1. **User creates/edits update in admin** → Browser POSTs to Worker API endpoint
2. **Worker backend** → Commits to GitHub via GitHub API using `env.GITHUB_TOKEN` (token never exposed to browser)
3. **GitHub receives commit** → Triggers GitHub Action
4. **GitHub Action runs:**
  - Scans `public/updates/data/*.json` files
  - Generates `index.json` automatically (filtered to published updates only)
  - Executes `wrangler deploy`
5. **Cloudflare Workers updated** → New content live (~2 min total)

**Security Note:** All GitHub API calls happen server-side in the Worker. The GitHub token is stored as a Cloudflare Secret and never sent to the browser.

**Architectural Decision: GitHub API Latency**

The Worker makes direct GitHub API calls for all save operations, which introduces ~200-500ms latency per save. This is an **intentional design decision** based on the following:

**Why we accept this latency:**
- Personal blog with single admin user (not a team collaboration tool)
- Save operations are infrequent (a few per day at most)
- Simplicity: no need for additional storage layer (Workers KV buffer, queuing system)
- Direct git commits provide immediate version control benefits
- Preview mode allows instant viewing without waiting for deployment

**Alternatives considered and rejected:**
- Workers KV as write buffer: Adds complexity, eventual consistency issues, requires sync job
- Queue-based batching: Over-engineered for single-user MVP
- Direct file writes to R2: Would lose git version control benefits

**For MVP scope:** The ~500ms save latency is acceptable and significantly simpler than alternatives.

**If requirements change:** Future reviews should not revisit this decision unless there is a material change in usage patterns (e.g., multiple concurrent authors, high-frequency updates).

### Race Conditions & Eventual Consistency

**The Challenge:**
- GitHub Action deploy takes ~2 minutes
- User might save multiple updates during this window
- User might try to view update before deploy completes

**Mitigation Strategies:**
- User feedback: "Update saved! Changes will be live in ~2 minutes."
- **Per-update deploy status tracking:**
  - Admin dashboard polls GitHub Actions API every 30 seconds
  - Visual indicators: "Deploying..." (animated), "Live ✓", "Deploy failed ✗"
  - Link to GitHub Action logs on failure
  - Status persists in dashboard until deploy completes
- Preview mode for immediate viewing (no deploy needed)
- GitHub Actions queue handles multiple rapid saves automatically

See [blog-updates-implementation.md](./blog-updates-implementation.md) for detailed deployment strategy.

---

## Cloudflare Worker Routes

### Public Routes
- `GET /updates` → List updates (paginated)
- `GET /updates/page/{n}` → Paginated listing
- `GET /updates/{slug}` → Individual update (404 if draft)
- `GET /updates/feed.xml` → RSS feed

### Admin UI Routes (authentication required)
- `GET /admin` → Admin dashboard (with deploy status polling)
- `GET /admin/edit/{slug}` → Edit update form
- `GET /admin/new` → Create new update form
- `GET /admin/preview/{slug}` → Preview update

### Admin API Routes (authentication required)
- `POST /admin/api/send-magic-link` → Send authentication email
- `GET /admin/api/verify-token` → Verify magic link token and set cookie
- `GET /admin/api/updates` → List all updates (including drafts)
- `GET /admin/api/deploy-status` → Get latest GitHub Actions deploy status
- `POST /admin/api/save-update` → Save or publish an update (commits to GitHub)
- `POST /admin/api/upload-image` → Upload image (commits to GitHub)
- `DELETE /admin/api/delete-update` → Delete an update AND associated images (commits to GitHub)
- `DELETE /admin/api/delete-image` → Delete an image (commits to GitHub)

### Fallback
- All other routes → Existing 404 handler

---

## Dependencies

### NPM Packages (to be added)
- `easymde` - Markdown editor (~50KB)
- `marked` - Markdown to HTML conversion (server-side in Worker)
- `sanitize-html` or custom allowlist-based sanitizer - HTML sanitization (Workers-compatible)

### Cloudflare Services
- **Workers** (existing) - Main application runtime
- **Workers Assets** (existing) - Serve static files
- **Workers KV** (existing) - Store magic link tokens and rate limit data
  - See [Security Details](./blog-updates-security.md#workers-kv-configuration) for namespace configuration

### External Services
- **Resend.com** (existing account) - Send magic link emails
- **GitHub API** - Commit updates from admin interface

---

## Configuration & Secrets

All sensitive credentials are stored as **Cloudflare Secrets** (encrypted, never committed to repository).

**Required secrets:**
- `RESEND_API_KEY` - Resend.com API key
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

See [Security Details](./blog-updates-security.md#secrets-management) for complete configuration.

---

## Security

This feature implements comprehensive security measures including:
- Magic link authentication with single-use tokens
- HttpOnly, Secure, SameSite=Strict cookies
- CSRF protection via SameSite + Origin validation
- XSS prevention with server-side Markdown parsing and HTML sanitization
- Rate limiting on admin endpoints (10 req/min per IP)
- Input validation on all API endpoints

**For complete security implementation details, see:** [blog-updates-security.md](./blog-updates-security.md)

---

## Implementation

The implementation is organized into 9 phases with 39 detailed steps:

1. **Storage & Data Structure** - Set up files and formats
2. **Public Pages** - Listing, individual updates, RSS feed
3. **Authentication** - Magic link system
4. **Admin Dashboard** - Management interface
5. **Update Editor** - EasyMDE integration and image handling
6. **Worker Backend API** - Server-side endpoints for all operations
7. **Auto-Deployment** - GitHub Actions with build-time index generation
8. **Testing & Polish** - Comprehensive testing and validation
9. **Documentation** - Update project docs and create admin guide

**For detailed phase-by-phase instructions, see:** [blog-updates-implementation.md](./blog-updates-implementation.md)

---

## Success Criteria

Before considering the MVP complete, verify:

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

---

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

---

**Last Updated:** February 2026
**Status:** Specification complete, ready for implementation
**Reviewed By:** Independent agent review (ID: ad0e372)
