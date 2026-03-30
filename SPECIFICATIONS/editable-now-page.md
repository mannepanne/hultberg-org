# Editable /now Page

**Status:** Draft
**Created:** 2026-03-30

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

Convert existing HTML content in `public/now/index.html` to Markdown:
1. Extract the "What I'm doing now" text block
2. Convert HTML to Markdown format
3. Create initial `content.json` file
4. Update `index.html` to load content from JSON

#### Page Rendering

The `/now` page remains static HTML served via Cloudflare Assets. Add client-side JavaScript:
1. Fetches `public/now/data/content.json`
2. Uses `marked` library (same as server-side updates) to parse Markdown to HTML
3. Injects rendered HTML into `#now-content` div
4. Preserves existing widgets (Goodreads, GitHub) unchanged

**Why client-side rendering?**
- Simpler (no Worker route needed)
- Updates use server-side rendering with `sanitizeHTML` function
- /now content is fully trusted (single admin author)
- Client-side is acceptable for this use case

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

### Layout Preservation

Current `/now` page structure (`public/now/index.html`):
```html
<!-- Lines 1-172: Static (head, styles, navigation) -->
<h1>What I'm doing now</h1>

<!-- Lines 174-189: EDITABLE SECTION (convert to dynamic) -->
<p>I live in London, work at char.gy...</p>
<p>(in order of time spent)</p>
<ul>
  <li>working full time as product manager...</li>
  <!-- ... more list items ... -->
</ul>
<p>also see LinkedIn and GitHub</p>
<p>(list last updated: February 2026...)</p>

<!-- Lines 191+: Static widgets (unchanged) -->
<div class="widgets-container">
  <div class="widget-column">
    <h2>Reading updates</h2>
    <!-- Goodreads widget -->
  </div>
  <div class="widget-column">
    <!-- GitHub widget -->
  </div>
</div>
```

**Implementation:** Replace lines 174-189 with:
```html
<div id="now-content">
  <p>Discombobulating recent eventings...</p>
</div>
```

## Implementation Checklist

**Backend:**
- [ ] Create `src/routes/nowEditor.ts` for `GET /admin/now/edit` route
- [ ] Create `src/routes/saveNow.ts` for `POST /admin/api/save-now` route
- [ ] Add routes to `src/index.ts` router
- [ ] Add "Now" navigation link in admin header (update `adminEditor.ts`, `adminDashboard.ts`)
- [ ] Implement GitHub commit functionality for /now content

**Frontend:**
- [ ] Create `public/now/data/` directory
- [ ] Create empty `public/now/data/content.json` with initial structure
- [ ] Add client-side rendering script to `public/now/index.html`
- [ ] Load `marked` library in `/now` page via CDN
- [ ] Update `public/now/index.html` structure to inject content into `#now-content` div

**Testing:**
- [ ] Add integration tests for `GET /admin/now/edit` (auth required, renders form)
- [ ] Add integration tests for `POST /admin/api/save-now` (auth, validation, GitHub commit)
- [ ] Manual testing: Edit form, save, page rendering, widget preservation

## Future Enhancements (Out of Scope)

- Preview before publishing
- Version history and revert capability
- Edit other sections (reading list, project list)
- Scheduling updates
- Markdown template snippets

## Testing Strategy

- **Unit tests**: Content saving, GitHub commit
- **Integration tests**: Admin routes, authentication
- **Manual testing**: Edit form, page rendering, widget preservation
- **Migration testing**: Verify existing content converts correctly

## Security Considerations

- Reuse existing admin authentication
- Sanitize Markdown rendering (prevent XSS)
- Validate JSON structure on save
- Rate limiting already in place for admin routes

## Dependencies

- **marked** v17.0.2 (already installed) - Markdown parser
- **EasyMDE** v2.18.0 (via CDN) - Markdown editor
- Existing GitHub commit logic in `src/github.ts`
- Existing admin authentication in `src/auth.ts`
- Existing admin layout pattern from `src/routes/adminEditor.ts`

## Technical Implementation Notes

### Client-side Rendering Script

Add to `public/now/index.html`:
```html
<div id="now-content">
  <p>Loading...</p>
</div>

<script src="https://cdn.jsdelivr.net/npm/marked@17.0.2/marked.min.js"></script>
<script>
  fetch('/now/data/content.json')
    .then(r => r.json())
    .then(data => {
      const html = marked.parse(data.markdown);
      document.getElementById('now-content').innerHTML = html;
    })
    .catch(err => {
      document.getElementById('now-content').innerHTML =
        '<p>Unable to load content.</p>';
    });
</script>
```

### Admin Editor Simplifications

Compared to updates editor (`adminEditor.ts`), the /now editor will:
- Remove: slug field, excerpt field, status dropdown, published date, image uploads
- Keep: title field (optional, could be fixed as "What I'm doing now"), content textarea with EasyMDE
- Simplify: Single "Save" button, no preview button needed

## Decisions Made

✅ **Markdown library**: Use `marked` (v17.0.2) - same library as updates, already in package.json
✅ **Rendering approach**: Client-side rendering via CDN (simpler, no Worker route needed)
✅ **Migration**: Manual content entry by user once editing functionality is working (no migration script needed)
✅ **Editor**: EasyMDE (same as updates) - simplified version without slug/status/images
✅ **Storage**: JSON file at `public/now/data/content.json` (matches updates pattern)
