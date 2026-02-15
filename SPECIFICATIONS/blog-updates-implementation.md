# Blog Updates - Implementation Plan

**Related:** [Main Specification](./blog-style-updates-mvp.md) | [Security Details](./blog-updates-security.md)

This document provides a detailed, phase-by-phase implementation plan for building the blog updates feature.

---

## Implementation Overview

**Total Phases:** 9
**Total Steps:** 39
**Estimated Complexity:** Medium (MVP scope)

**Key Dependencies:**
- Cloudflare Workers & Assets (existing)
- Workers KV namespace (existing)
- GitHub repository access
- Resend.com account (existing)

---

## Phase 1: Storage & Data Structure

**Goal:** Set up the foundational file structure and data formats

### Step 1: Create Directory Structure

Create the following directories in the repository:

```bash
mkdir -p public/updates/data
mkdir -p public/images/updates
```

**Why:** Establishes where update JSON files and images will be stored

### Step 2: Create Sample Update JSON Files

Create `public/updates/data/test-update.json`:

```json
{
  "slug": "test-update",
  "title": "Test Update",
  "excerpt": "This is a test update to verify the structure",
  "content": "# Test Update\n\nThis is test content in **Markdown** format.",
  "status": "draft",
  "publishedDate": "",
  "editedDate": "2026-02-15T10:00:00Z",
  "author": "Magnus Hultberg",
  "images": []
}
```

**Why:** Provides a working example for development and testing

### Step 3: Create index.json Structure

Create `public/updates/data/index.json`:

```json
{
  "updates": []
}
```

**Why:** Initial empty index that will be populated during deployment

### Step 4: Add Utility Functions for Slug Generation

Create slug generation utility (in Worker code):

```typescript
function generateSlug(title: string, existingSlugs: string[]): string {
  // Convert to lowercase, replace spaces with hyphens
  let slug = title.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Handle reserved slugs
  if (slug === 'page') {
    slug = 'page-2';
  }

  // Check for duplicates
  let finalSlug = slug;
  let counter = 2;
  while (existingSlugs.includes(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
}
```

**Why:** Ensures unique, URL-safe slugs for all updates

---

## Phase 2: Public Pages

**Goal:** Implement the public-facing update pages

### Step 5: Implement `/updates` Listing Page

**Tasks:**
- Read `index.json` from static assets
- Filter for `status === "published"` updates only
- Sort by `publishedDate` descending (newest first)
- Implement pagination (10 per page)
- Render using `/now` page style as template

**Route handler:**
```typescript
if (url.pathname === '/updates' || url.pathname.startsWith('/updates/page/')) {
  return handleUpdatesListing(request);
}
```

**Why:** Provides the main entry point for browsing updates

### Step 6: Implement `/updates/{slug}` Individual Page

**Tasks:**
- Extract slug from URL path
- Read `public/updates/data/{slug}.json`
- Check status: if `draft`, return 404 to non-admin users
- Convert Markdown to HTML (server-side using `marked`)
- Sanitize HTML output
- Render with metadata (title, author, dates)
- Handle images inline
- Return 404 for missing updates

**Why:** Displays full content of individual updates

### Step 7: Implement RSS Feed

**Route:** `/updates/feed.xml`

**Tasks:**
- Read `index.json`
- Filter for published updates
- Generate RSS 2.0 XML format
- Convert relative image URLs to absolute
- Include full HTML content in feed items
- Set proper `Content-Type: application/rss+xml` header

**Why:** Standard feature for blog-style content

---

## Phase 3: Authentication

**Goal:** Implement magic link authentication system

### Step 8: Implement Magic Link Generation

**Tasks:**
- Generate cryptographically secure 32-byte token
- Store in Workers KV: `auth:token:{token}` → email
- Set 15-minute TTL

**Code pattern:**
```typescript
const token = crypto.randomUUID(); // or use crypto.getRandomValues
await env.MAGIC_LINK_TOKENS.put(
  `auth:token:${token}`,
  email,
  { expirationTtl: 900 }
);
```

### Step 9: Set Up Resend.com Email Sending

**Tasks:**
- Use `env.RESEND_API_KEY` to authenticate
- Send email with magic link
- Email template includes: greeting, link, expiry notice

**API call pattern:**
```typescript
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'noreply@hultberg.org',
    to: email,
    subject: 'Your admin login link',
    html: `<p>Click here to log in: <a href="https://hultberg.org/admin?token=${token}">Log in</a></p>`
  })
});
```

### Step 10: Implement Token Storage in Workers KV

Already covered in Step 8 (KV namespace binding configured in `wrangler.toml`)

### Step 11: Create Authentication Middleware

**Tasks:**
- Middleware function checks for valid auth cookie
- Verifies JWT signature using `env.JWT_SECRET`
- Checks expiration
- Returns 401 if invalid/missing

**Pattern:**
```typescript
async function requireAuth(request: Request, env: Env): Promise<string | Response> {
  const cookie = request.headers.get('Cookie');
  // Parse JWT, verify signature, check expiry
  // Return email if valid, otherwise return 401 Response
}
```

### Step 12: Build Login Page UI

**Route:** `/admin` (when not authenticated)

**UI Elements:**
- Email input field
- "Send magic link" button
- Simple, clean styling matching site aesthetic
- Success message: "Check your email for login link"

---

## Phase 4: Admin Dashboard

**Goal:** Build the admin interface for managing updates

### Step 13: Create Admin Layout and Navigation

**Components:**
- Header with site branding and logout button
- Navigation: Dashboard | New Update
- Footer with deploy status timestamp

**Styling:** Light structure, clean forms, minimal but polished

### Step 14: Build Updates List View

**Display:**
- Table/list showing all updates (drafts + published)
- Columns: Title, Status badge, Published date, Last edited, Actions
- Actions: Edit, Delete buttons

**Data source:** Fetch from `/admin/api/updates` endpoint

### Step 15: Implement Delete Functionality

**Tasks:**
- Confirm dialog: "Are you sure you want to delete this update?"
- Call `DELETE /admin/api/delete-update` endpoint
- Remove from UI on success
- Show error message on failure

---

## Phase 5: Update Editor

**Goal:** Build the editor interface for creating/editing updates

### Step 16: Integrate EasyMDE Library

**Installation:**
```bash
npm install easymde
```

**Integration:**
- Load EasyMDE CSS and JS
- Initialize editor on content textarea
- Configure toolbar with standard Markdown options

### Step 17: Build Editor Form UI

**Form fields:**
- Title (text input, required)
- Excerpt (textarea, optional)
- Content (EasyMDE editor)
- Status toggle (Draft/Published)

**Styling:** Clean forms with clear labels and spacing

### Step 18: Add Custom Image Upload Button to EasyMDE Toolbar

**Tasks:**
- Add custom toolbar button
- On click: open file picker
- Upload via `/admin/api/upload-image` endpoint
- Insert Markdown image syntax at cursor: `![alt text](image-path)`

### Step 19: Implement Client-Side Image Resize

**Tasks:**
- Use Canvas API to resize image before upload
- Max dimensions: 800x800px (maintain aspect ratio)
- Convert to Blob
- Fallback: if resize fails, allow original upload with warning

### Step 20: Create Image Gallery Component

**Display:**
- Shows all images for current update at bottom of editor
- Grid layout with thumbnails
- Click to insert at cursor position
- Delete button on each image

### Step 21: Wire Up Editor to Call Worker API Endpoints

**On save:**
- Gather form data (title, excerpt, content, status)
- POST to `/admin/api/save-update`
- Show success/error message
- Update UI with response (e.g., new slug if created)

### Step 22: Build Preview Functionality

**Route:** `/admin/preview/{slug}`

**Behavior:**
- Renders update exactly as it will appear when published
- Uses same rendering logic as public page
- Works for drafts (authentication required)

---

## Phase 6: Worker Backend API Endpoints

**Goal:** Implement server-side API for all admin operations

### Step 23: Implement `POST /admin/api/save-update`

**Request body:**
```json
{
  "slug": "existing-slug", // optional for new updates
  "title": "Update Title",
  "excerpt": "Optional excerpt",
  "content": "Markdown content",
  "status": "published"
}
```

**Tasks:**
- Validate authentication (middleware)
- Validate input (title required, status enum, etc.)
- Generate slug if new update
- Parse and sanitize Markdown
- Commit JSON file to GitHub using `env.GITHUB_TOKEN`
- Return success response with slug

**GitHub API call pattern:**
```typescript
await fetch(`https://api.github.com/repos/mannepanne/hultberg-org/contents/public/updates/data/${slug}.json`, {
  method: 'PUT',
  headers: {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: `Update: ${title}`,
    content: btoa(JSON.stringify(updateData)), // Base64 encode
    sha: existingSha // if updating existing file
  })
});
```

**Note:** index.json is generated at build time, not updated here

### Step 24: Implement `POST /admin/api/upload-image`

**Tasks:**
- Validate authentication
- Receive multipart/form-data image upload
- Validate file type and size
- Optionally resize server-side (or validate client-side resize)
- Commit to `public/images/updates/{slug}/` in GitHub
- Return image path

### Step 25: Implement `DELETE /admin/api/delete-update`

**Tasks:**
- Validate authentication
- Receive slug in request
- Delete JSON file from GitHub using DELETE API
- Return success/error response
- Note: index.json regenerated at build time

### Step 26: Implement `DELETE /admin/api/delete-image`

**Tasks:**
- Validate authentication
- Receive image path in request
- Delete image file from GitHub
- Return success/error response

### Step 27: Implement `GET /admin/api/updates`

**Tasks:**
- Validate authentication
- Read and return `index.json` (includes drafts)
- Used by admin dashboard to list all updates

---

## Phase 7: Auto-Deployment with Build-Time Index Generation

**Goal:** Set up GitHub Actions to auto-deploy and generate index.json

### Step 28: Create GitHub Action Workflow File

Create `.github/workflows/deploy-updates.yml`:

```yaml
name: Deploy Updates

on:
  push:
    branches: [main]
    paths:
      - 'public/updates/**'
      - 'src/**'
      - 'wrangler.toml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Generate index.json
        run: node scripts/generate-index.js

      - name: Deploy to Cloudflare Workers
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Generate index script** (`scripts/generate-index.js`):
```javascript
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../public/updates/data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'index.json');

const updates = files.map(file => {
  const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  return {
    slug: content.slug,
    title: content.title,
    excerpt: content.excerpt || content.content.substring(0, 150),
    publishedDate: content.publishedDate,
    status: content.status
  };
});

// Sort by publishedDate descending
updates.sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));

fs.writeFileSync(
  path.join(dataDir, 'index.json'),
  JSON.stringify({ updates }, null, 2)
);
```

**Why build-time generation?**
- Prevents sync issues between individual files and index
- index.json always reflects current state
- No manual index commits from admin

### Step 29: Configure Cloudflare API Token

**Setup:**
1. Generate Cloudflare API token with Workers edit permission
2. Add as GitHub secret: `CLOUDFLARE_API_TOKEN`

**Verify:** Token has access to deploy Workers

### Step 30: Test Automatic Deployment

**Test steps:**
1. Create new update via admin
2. Verify GitHub Action triggers
3. Check Action logs for success
4. Verify index.json was generated
5. Verify Worker deployed
6. Check public site shows new update (~2 min)

---

## Phase 8: Testing & Polish

**Goal:** Comprehensive testing and refinement

### Step 31: Test Full Workflow End-to-End

**Scenario 1: Create and publish update**
1. Log in via magic link
2. Create new update with title, content, image
3. Save as draft
4. Preview draft
5. Publish
6. Wait for deploy
7. Verify appears on public `/updates`

**Scenario 2: Edit existing update**
1. Edit published update
2. Change content
3. Save
4. Verify changes appear after deploy

**Scenario 3: Delete update**
1. Delete an update
2. Verify removed after deploy

### Step 32: Add Error Handling and Validation

**Add to all endpoints:**
- Try/catch blocks
- Meaningful error messages
- Proper HTTP status codes (400, 401, 403, 500)
- Logging for debugging

### Step 33: Test Image Upload and Resize

**Test cases:**
- Upload large image (>5MB) - should fail
- Upload various formats (JPG, PNG, WebP)
- Verify resize to 800x800 max
- Test multiple images per update

### Step 34: Verify RSS Feed Validity

**Tools:**
- https://validator.w3.org/feed/
- RSS reader (Feedly, etc.)

**Checks:**
- Valid XML
- Absolute URLs for images
- Correct pub dates
- Full content included

### Step 35: Test Pagination Edge Cases

**Test cases:**
- Exactly 10 updates (no pagination)
- 11 updates (pagination appears)
- Last page with <10 updates
- Page number out of range (404)

### Step 36: Security Audit

**Checklist:**
- XSS: Try injecting `<script>` in title, excerpt, content
- CSRF: Try cross-origin POST to admin endpoints
- Authentication: Try accessing admin without cookie
- Rate limiting: Send 15 rapid requests, verify blocked
- SQL injection: N/A (no database)

### Step 37: Performance Testing

**Metrics:**
- Time to first byte (TTFB) for `/updates`
- Time to render individual update
- Admin dashboard load time
- Image upload/resize time

**Targets:**
- Public pages: <200ms TTFB
- Admin: <500ms load time

---

## Phase 9: Documentation

**Goal:** Document the implementation for future reference

### Step 38: Update CLAUDE.md

**Add sections:**
- New routes (`/updates/*`, `/admin/*`)
- Worker environment variables
- KV namespace binding
- Deployment workflow
- Common tasks (create update, edit, delete)

### Step 39: Document Admin Workflow

**Create admin guide** (in SPECIFICATIONS or README):
- How to log in
- How to create an update
- How to upload images
- How to publish vs. save as draft
- How to preview
- Understanding deploy delay
- Troubleshooting common issues

### Step 40: Add Code Comments

**Focus areas:**
- Slug generation logic
- Markdown parsing and sanitization
- GitHub API commit logic
- Authentication middleware
- Complex routing logic

---

## Success Criteria

Before considering the MVP complete, verify all of these:

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

## Notes

**Estimated Timeline:** Implementation can proceed phase-by-phase, with each phase building on the previous.

**Testing Strategy:** Test each phase thoroughly before moving to the next.

**Deployment Strategy:** Use feature branch and PRs for each phase, merge to main when stable.

**Last Updated:** February 2026
