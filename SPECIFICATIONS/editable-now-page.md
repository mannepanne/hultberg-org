# Editable /now Page

**Status:** Draft
**Created:** 2026-03-30

## Implementation Plan

This feature will be built in **3 phased PRs** for clean, reviewable increments:

### PR #1: Foundation
- Extract `sanitizeHTML()` to `src/sanitize.ts`
- Update `updatePage.ts` to use shared sanitize
- Create `public/now/data/content.json` with placeholder
- Add tests for sanitize module

**Value:** Shared sanitization ready, data structure in place

### PR #2: Server-side rendering
- Create `src/routes/nowPage.ts` (GET /now route)
- Implement `renderNowPage()` function
- Register route in `src/index.ts`
- Add integration tests for /now rendering
- Verify widgets still work

**Value:** /now page working with server-side rendering (read-only)

### PR #3: Admin editor and save
- Create `src/routes/nowEditor.ts` (GET /admin/now/edit)
- Create `src/routes/saveNow.ts` (POST /admin/api/save-now)
- Add "Now" link to admin navigation
- Add rate limiting and validation
- Add integration tests for admin routes

**Value:** Complete feature - user can edit /now content

## Overview

Make the main "What I'm doing now" text block on the /now page editable through the admin interface, using the same Markdown editing experience as updates.

## Current State

The /now page (`public/now/index.html`) is a static HTML file with:
- Header and page title
- Main "What I'm doing now" text block (currently hardcoded HTML)
- Goodreads reading list widget
- GitHub activity widget
- Footer

The main text block is static and requires editing HTML files + deployment to update.

## Proposed Changes

### User Experience

1. **Admin Navigation**: Add "Now" link in admin top bar (after "Dashboard")
2. **Edit Form**: Single page at `/admin/now/edit` with:
   - Markdown editor (same component as update creation)
   - Same formatting toolbar (bold, italic, links, lists, code blocks)
   - "Save" and "Cancel" buttons
   - No preview needed
3. **Publishing**: Save commits to GitHub, triggers deployment (same workflow as updates)

### Technical Architecture

#### Data Storage

Store /now content as JSON file in GitHub repo:
- **Location**: `public/now/data/content.json`
- **Format**:
```json
{
  "markdown": "## Current focus\n\nI'm working on...",
  "lastUpdated": "2026-03-30T10:30:00Z"
}
```

#### Migration

**Development approach:**
1. Create `public/now/data/content.json` with placeholder content for development and testing
2. Implement and test all functionality (editor, save, rendering)
3. User manually converts current HTML content (lines 174-189) to Markdown via admin editor
4. Verify rendering matches current appearance
5. Deploy together: Worker route + content.json + preserved widgets

**Initial content.json for development:**
```json
{
  "markdown": "This is placeholder content for development.\n\n- Test bullet point\n- Another test\n\n(This will be replaced by user after editing functionality is working)",
  "lastUpdated": "2026-03-30T12:00:00Z"
}
```

**No automated migration script needed** - user will manually enter final content via admin interface once editing works.

#### Page Rendering

**Server-side rendering via Worker** (matches updates pattern):
1. Create Worker route `GET /now`
2. Fetch `public/now/data/content.json` via ASSETS binding
3. Parse Markdown to HTML using `marked` library
4. Sanitize HTML using existing `sanitizeHTML()` function from `src/routes/updatePage.ts`
5. Render complete page HTML with sanitized content
6. Return with proper CSP headers (prevent XSS)

**Why server-side rendering?**
- Consistent with updates feature (`/updates/{slug}` pattern)
- Reuses proven security patterns (`sanitizeHTML()`, CSP headers)
- Simpler to implement (~50 lines copying updatePage.ts)
- Follows defense-in-depth security principle
- Prevents XSS vulnerabilities by design

**Widgets remain unchanged:**
- Goodreads iframe and GitHub widget script work identically
- They don't care if HTML is static or dynamically generated
- Same structure, same positioning, same functionality

#### Admin Routes

Add new routes in Worker:
- `GET /admin/now/edit` - Edit form (server-side HTML response using EasyMDE)
- `POST /admin/api/save-now` - Save content API endpoint (commits to GitHub)

**Reuse existing patterns:**
- EasyMDE editor (same toolbar as updates: bold, italic, headings, lists, links)
- GitHub commit logic from `src/github.ts`
- Admin authentication middleware from `src/auth.ts`
- Header/navigation layout from `adminEditor.ts`

**Differences from updates editor:**
- No slug field (fixed content location)
- No excerpt field (not needed)
- No status dropdown (always published)
- No published date (uses lastUpdated timestamp)
- No image uploads (keep it simple)

### GitHub Commit Message Format

When saving /now content, commit to GitHub with this message format (matches updates pattern):

```
Update /now page content

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Layout Preservation

Current `/now` page structure (`public/now/index.html`):
```html
<!-- Lines 1-172: Static (head, styles, navigation) -->
<h1>What I'm doing now</h1>

<!-- Lines 174-189: EDITABLE SECTION (will be server-side rendered from content.json) -->
<p>I live in London, work at char.gy...</p>
<p>(in order of time spent)</p>
<ul>
  <li>working full time as product manager...</li>
  <!-- ... more list items ... -->
</ul>
<p>also see LinkedIn and GitHub</p>
<p>(list last updated: February 2026...)</p>

<!-- Lines 191+: Static widgets (unchanged, will be preserved in server-rendered HTML) -->
<div class="widgets-container">
  <div class="widget-column">
    <h2>Reading updates</h2>
    <div id="gr_updates_widget">
      <iframe id="the_iframe" src="https://goodreads.com/widgets/..." ...></iframe>
    </div>
  </div>
  <div class="widget-column">
    <h2>GitHub Activity</h2>
    <div id="github-contributions" data-username="mannepanne"></div>
    <div id="github-repos"></div>
  </div>
</div>
<script src="/now/github-widget.js"></script>
```

**Server-side implementation approach:**
1. Use current `index.html` as template reference
2. Worker route generates full HTML dynamically
3. Inject sanitized markdown content where lines 174-189 currently are
4. Preserve exact widget structure and positioning
5. Include github-widget.js script (loads data client-side as before)
6. Goodreads iframe works identically (browsers load it regardless of HTML source)

## Implementation Checklist

**Backend:**
- [ ] Extract `sanitizeHTML()` from `updatePage.ts` to `src/sanitize.ts` (for reuse)
- [ ] Update `updatePage.ts` to import `sanitizeHTML` from `src/sanitize.ts`
- [ ] Create `src/routes/nowPage.ts` for `GET /now` route (server-side rendering)
- [ ] Import `sanitizeHTML` in `nowPage.ts` from `src/sanitize.ts`
- [ ] Create `src/routes/nowEditor.ts` for `GET /admin/now/edit` route
- [ ] Create `src/routes/saveNow.ts` for `POST /admin/api/save-now` route
- [ ] Add rate limiting to save endpoint (reuse `checkRateLimit` from `auth.ts`)
- [ ] Add content size validation (100KB limit like updates)
- [ ] Add routes to `src/index.ts` router
- [ ] Verify `/now/*` static assets (github-widget.js, images, data/) still accessible after Worker route added
- [ ] Add "Now" navigation link in admin header (update `adminEditor.ts`, `adminDashboard.ts`)
- [ ] Implement GitHub commit functionality for /now content (see commit message format below)
- [ ] Add proper CSP headers to /now route (allow Goodreads iframe, github-widget.js, api.github.com)

**Frontend:**
- [ ] Create `public/now/data/` directory
- [ ] Create `public/now/data/content.json` with placeholder content for development
- [ ] Keep current `public/now/index.html` as template reference (will be replaced by Worker route)
- [ ] Preserve exact widget structure (Goodreads iframe, GitHub script) in rendered HTML

**Testing:**
- [ ] Add integration tests for `GET /now` (renders page, sanitizes HTML, proper CSP headers)
- [ ] Add integration tests for `GET /admin/now/edit` (auth required, renders form, loads content)
- [ ] Add integration tests for `POST /admin/api/save-now` (auth, rate limiting, validation, GitHub commit)
- [ ] Manual testing: Edit form, save, page rendering, widget functionality, XSS prevention

## Future Enhancements (Out of Scope for MVP)

- **Preview before publishing** - With server-side rendering, this would be simple (add `/admin/preview/now` route reusing pattern from updates). Low cost, high user value. Not included in MVP to keep scope minimal.
- Version history and revert capability
- Edit other sections (reading list, project list)
- Scheduling updates
- Markdown template snippets
- Track edit history (add `editedDate` field to match updates pattern)

## Testing Strategy

Follow pattern from `tests/integration/updatePage.test.ts` and `tests/integration/adminEditor.test.ts`.

**GET /now route tests:**
- Renders page successfully with valid content.json
- Sanitizes HTML (prevents XSS from malicious markdown)
- Returns 404 when content.json missing
- Applies proper CSP headers
- Handles errors gracefully (server-side logging, generic client message)

**GET /admin/now/edit route tests:**
- Redirects to login when not authenticated
- Renders form with loaded content when authenticated
- Loads existing content from content.json
- Shows appropriate error if content.json missing

**POST /admin/api/save-now route tests:**
- Redirects to login when not authenticated
- Validates content size (rejects >100KB)
- Rate limiting (rejects after 10 req/min)
- Commits to GitHub successfully
- Updates content.json with lastUpdated timestamp
- Returns success response with appropriate data

**Manual testing:**
- Edit form: loads content, saves changes, shows status messages
- Page rendering: markdown renders correctly, widgets work, no layout breakage
- XSS prevention: try malicious markdown (script tags, onclick handlers)
- Widget preservation: Goodreads iframe loads, GitHub widget fetches data
- **Migration testing**: Verify existing content converts correctly

## Security Considerations

**Defense-in-depth approach:**

1. **XSS Prevention (Server-side)**
   - Reuse `sanitizeHTML()` function from `src/routes/updatePage.ts:172-226`
   - Parse markdown → sanitize HTML → render (never use innerHTML)
   - Apply CSP headers to prevent inline script execution
   - Follow exact pattern from updates feature

2. **Authentication**
   - Reuse existing admin authentication middleware (`requireAuth` from `src/auth.ts`)
   - Both editor and save routes require valid session

3. **Rate Limiting**
   - Apply rate limiting to `POST /admin/api/save-now` endpoint
   - Reuse `checkRateLimit` function from `src/auth.ts`
   - 10 requests per minute per IP (matches other admin routes)

4. **Input Validation**
   - Content size limit: 100KB (matches updates pattern)
   - Validate JSON structure on save
   - Sanitize all content before GitHub commit

5. **Error Handling**
   - Log detailed errors server-side (console.error)
   - Return generic errors to client (don't leak implementation details)
   - Graceful degradation for /now page load failures

6. **CSP Headers**
   - Allow Goodreads iframe: `frame-src https://goodreads.com`
   - Allow GitHub widget script: `script-src 'self' ... https://goodreads.com` (for widget script)
   - Allow GitHub API calls: `connect-src 'self' ... https://api.github.com` (for github-widget.js REST API calls)
   - Prevent inline scripts and unsafe eval
   - Match CSP pattern from `updatePage.ts` with additions for widgets

## Dependencies

- **marked** v17.0.2 (already installed) - Markdown parser
- **EasyMDE** v2.18.0 (via CDN) - Markdown editor
- Existing GitHub commit logic in `src/github.ts`
- Existing admin authentication in `src/auth.ts`
- Existing admin layout pattern from `src/routes/adminEditor.ts`

## Technical Implementation Notes

### Server-side Route Handler

Create `src/routes/nowPage.ts` following `updatePage.ts` pattern:

```typescript
// src/routes/nowPage.ts
import { marked } from 'marked';
import type { Env } from '@/types';

export async function handleNowPage(request: Request, env: Env): Promise<Response> {
  try {
    // Fetch content.json via ASSETS binding (avoid Worker routing loop)
    const url = new URL(request.url);
    const contentUrl = `${url.origin}/now/data/content.json`;
    const response = await (env.ASSETS?.fetch(new Request(contentUrl)) ?? fetch(contentUrl));

    if (!response.ok) {
      return fetchNotFoundPage(request, env);
    }

    const data = await response.json();

    // Parse markdown and sanitize (reuse from updatePage.ts)
    const contentHTML = await marked(data.markdown);
    const sanitizedHTML = sanitizeHTML(contentHTML);

    // Render full page HTML programmatically (like renderUpdatePageHTML in updatePage.ts)
    const html = renderNowPage(sanitizedHTML);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com https://goodreads.com; style-src 'self' 'unsafe-inline'; img-src 'self' https://hultberg.org; frame-src https://goodreads.com; connect-src 'self' https://www.google-analytics.com https://cloudflareinsights.com https://api.github.com; frame-ancestors 'none'; base-uri 'self';",
      },
    });
  } catch (error) {
    console.error('Error loading /now page:', error);
    return new Response('Error loading page', { status: 500 });
  }
}
```

### renderNowPage Implementation

**Programmatic HTML generation** (recommended, matches `renderUpdatePageHTML` pattern):

```typescript
function renderNowPage(contentHTML: string): string {
  return `<!doctype html>
<html class="no-js" lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>What I'm doing now | Magnus Hultberg - hultberg.org</title>
  <!-- Copy remaining head content from current index.html -->
  <!-- Include: meta tags, og tags, analytics, styles -->
</head>
<body id="now" style="font-family: Georgia, serif; line-height: 1.5;">
  <div id="content" style="max-width: 800px; margin: 0 auto; padding: 2em;">
    <!-- Copy navigation links -->
    <p>← <a href="/">Home</a> | <a href="/updates">Updates</a> | ...</p>

    <h1 style="...">What I'm doing now</h1>

    <!-- INJECT SANITIZED MARKDOWN CONTENT HERE -->
    ${contentHTML}

    <!-- PRESERVE WIDGET SECTIONS (copy from current index.html lines 191+) -->
    <div class="widgets-container">
      <div class="widget-column">
        <h2>Reading updates</h2>
        <div id="gr_updates_widget">
          <iframe id="the_iframe" src="https://goodreads.com/widgets/..." ...></iframe>
        </div>
      </div>
      <div class="widget-column">
        <h2>GitHub Activity</h2>
        <div id="github-contributions" data-username="mannepanne"></div>
        <div id="github-repos"></div>
      </div>
    </div>
  </div>

  <!-- CRITICAL: Include github-widget.js for client-side data loading -->
  <script src="/now/github-widget.js"></script>
</body>
</html>`;
}
```

**Why programmatic over template-based?**
- Explicit structure (no HTML parsing needed)
- Matches pattern from `updatePage.ts` (`renderUpdatePageHTML`)
- Less fragile to changes
- Clear injection point for content

**Alternative (not recommended):** Fetch `/now/index.html` as template, parse string, inject content at lines 174-189. This is more complex and error-prone.

### Admin Editor Simplifications

Compared to updates editor (`adminEditor.ts`), the /now editor will:
- Remove: slug field, excerpt field, status dropdown, published date, image uploads, preview button
- Keep: content textarea with EasyMDE (same toolbar: bold, italic, links, lists)
- Simplify: Single "Save" button

## Decisions Made

✅ **Rendering approach**: Server-side rendering via Worker route (matches updates pattern, better security)
✅ **Markdown library**: Use `marked` (v17.0.2) - same library as updates, already in package.json
✅ **Sanitization**: Reuse `sanitizeHTML()` function from `updatePage.ts` (defense-in-depth)
✅ **Migration**: Manual content entry by user once editing functionality is working (no migration script needed)
✅ **Editor**: EasyMDE (same as updates) - simplified version without slug/status/images/preview
✅ **Storage**: JSON file at `public/now/data/content.json` (matches updates pattern)
✅ **Rate limiting**: Apply to save endpoint (10 req/min per IP, matches admin routes)
✅ **Content size limit**: 100KB (matches updates)
✅ **CSP headers**: Include on /now route (allow Goodreads iframe and GitHub widget script)
