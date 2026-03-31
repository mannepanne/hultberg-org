# /now Page Snapshots & Timeline

**Feature:** Interactive timeline for browsing historical /now page snapshots
**Completed:** 2026-03-31 (PRs #20, #21, #22)
**Files:** `public/now/timeline.js`, `src/routes/nowPage.ts`, snapshot management APIs

## Overview

The /now page includes a snapshot system that captures historical versions of content and an interactive timeline for browsing through them. The feature has two parts:

1. **Admin Snapshot Management** - Create, list, and delete snapshots via `/admin/now/edit`
2. **Public Timeline Display** - Browse snapshots via interactive timeline on `/now`

## Architecture

### Data Storage

**Snapshot files:** `public/now/snapshots/{YYYYMMDD}.json`
```json
{
  "markdown": "I live in London, work at...",
  "snapshotDate": "2026-03-30T15:30:00Z"
}
```

**Index file:** `public/now/snapshots/index.json`
```json
{
  "snapshots": [
    {
      "date": "20160926",
      "snapshotDate": "2016-09-26T11:00:00Z",
      "preview": "I live in London, go to Copenhagen..."
    }
  ]
}
```

**Current content:** `public/now/data/content.json`
```json
{
  "markdown": "Current /now content...",
  "lastUpdated": "2026-03-30T15:21:54.983Z"
}
```

### Timeline Component Flow

```
Page Load → timeline.js initializes
    ↓
1. Store original HTML (contentDiv.innerHTML)
2. Fetch /now/snapshots/index.json
3. Fetch /now/data/content.json (for lastUpdated)
4. Add "current" as latest timeline item
5. Sort snapshots by date
6. Check URL parameter (?date=YYYYMMDD)
7. Render timeline (7 nodes desktop, 5 mobile)
    ↓
User clicks snapshot
    ↓
1. Update selectedIndex
2. Update URL with pushState
3. Fetch /now/snapshots/{date}.json
4. Render markdown with marked.js
5. Sanitize HTML with DOMPurify
6. Replace content with contentDiv.innerHTML
7. Re-render timeline (center selected)
8. Smooth scroll to top
    ↓
User clicks "current" (2026-03)
    ↓
1. Restore contentDiv.innerHTML = originalContentHTML
2. Update URL (remove ?date parameter)
3. Re-render timeline
```

## Client-Side Rendering Pipeline

### Markdown Rendering

**Primary:** marked.js (CDN)
```javascript
if (typeof marked !== 'undefined') {
  html = await marked.parse(snapshotData.markdown);
}
```

**Fallback:** Basic regex-based rendering
```javascript
html = snapshotData.markdown
  .replace(/\n\n/g, '</p><p>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
html = `<p>${html}</p>`;
```

### HTML Sanitization

**DOMPurify sanitization before innerHTML:**
```javascript
if (typeof DOMPurify !== 'undefined') {
  html = DOMPurify.sanitize(html);
}
contentDiv.innerHTML = html;
```

**Why this approach:**
- Snapshots are admin-created (trusted) but sanitized for defense-in-depth
- Graceful degradation if DOMPurify CDN unavailable
- Consistent with server-side sanitization pattern (different layer)

### CDN Dependencies

**marked.js 11.1.1** - Markdown parsing
```html
<script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
```

**DOMPurify 3.0.9** - HTML sanitization
```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.9/dist/purify.min.js"></script>
```

**CSP allowlist:** `script-src 'self' 'unsafe-inline' ... https://cdn.jsdelivr.net`

## Timeline UI Component

### Responsive Node Count

**Desktop (>768px):** 7 visible nodes (center + 3 on each side)
```
[←] [◦] [◦] [2017-08] [2018-07] [2019-03] [◦] [→]
                      ^^^^^^^^^^
                    (center - large)
```

**Mobile/Tablet (≤768px):** 5 visible nodes (center + 2 on each side)
```
[←] [◦] [2018-07] [2019-03] [◦] [→]
            ^^^^^^^^^^
          (center - large)
```

### Three-Tier Node Sizing

**Distance from center determines size:**

- **Distance 0 (center):** `.timeline-node--large`
  - 11px/18px padding, 1em font, bold
  - Shows YYYY-MM date label

- **Distance 1 (adjacent):** `.timeline-node--medium`
  - 7px/14px padding, 0.81em font
  - Shows YYYY-MM date label

- **Distance 2+ (edge):** `.timeline-node--small`
  - 23x23px box, no label
  - ARIA label for accessibility

**Placeholder nodes ("?"):**
- Shown when index > total snapshots (future positions)
- 23x23px greyed-out box with "?"
- Not clickable (`cursor: not-allowed`)

### Visual Design

**Color scheme:**
- Primary: `#8AAED6` (pale blue)
- Hover: `#6B8FC0` (darker blue)
- Background: `#f9f9f9` (subtle gray)

**Timeline line:**
- 2px gray (#ddd) connecting line
- Right-pointing arrow indicator (future direction)
- Behind nodes (`z-index: 0`)

**Positioning:**
- Above content (between h1 and main content)
- Left-aligned (not centered)
- Minimal whitespace: 24px/12px margin/padding

## Admin Snapshot Management

### API Endpoints

**Create/Update Snapshot:**
```
POST /admin/api/create-now-snapshot
Content-Type: application/json
Cookie: auth_token={jwt}
Origin: {origin}

{
  "markdown": "I live in London...",
  "date": "20260330"  // Optional, defaults to today
}

Response: { success: true, date: "20260330", overwritten: false }
```

**List Snapshots:**
```
GET /admin/api/list-now-snapshots
Cookie: auth_token={jwt}
Origin: {origin}

Response: {
  snapshots: [
    { date: "20260330", snapshotDate: "...", preview: "..." }
  ]
}
```

**Delete Snapshot:**
```
DELETE /admin/api/delete-now-snapshot?date=20260330
Cookie: auth_token={jwt}
Origin: {origin}

Response: { success: true, message: "Snapshot deleted" }
```

### GitHub Workflow

**On snapshot create/delete:**
1. API validates request (auth, rate limit, date format)
2. Updates snapshot JSON file in `public/now/snapshots/`
3. Updates `index.json` with new snapshot list
4. Commits changes to GitHub via GitHub API
5. GitHub Actions triggers deployment
6. Changes live within ~2 minutes

**Commit messages:**
```
Create /now snapshot for [date]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Snapshot Date Behavior

**Admin creates snapshot:**
- Default: Uses current date (YYYYMMDD format)
- Optional: Can specify custom date for backdating historical snapshots
- Validation: Date must exist (not future), must be valid YYYYMMDD format

**Timeline displays current content:**
- Date label comes from `content.json` `lastUpdated` field
- NOT from `new Date()` (which would show viewing date)
- Ensures label reflects when content was actually updated

## URL Parameter Support

### Format

**View snapshot:** `/now?date=20170801`
**View current:** `/now` (no parameter)

### Behavior

**On page load:**
```javascript
const urlParams = new URLSearchParams(window.location.search);
const dateParam = urlParams.get('date');

if (dateParam && dateParam !== 'current') {
  const index = snapshots.findIndex(s => s.date === dateParam);
  if (index !== -1) {
    selectedIndex = index;
    await loadSnapshotContent(snapshots[selectedIndex]);
  }
}
```

**On snapshot selection:**
```javascript
const url = new URL(window.location);
if (snapshot.isCurrent) {
  url.searchParams.delete('date');
} else {
  url.searchParams.set('date', snapshot.date);
}
window.history.pushState({}, '', url);
```

**Browser back/forward:**
```javascript
window.addEventListener('popstate', async () => {
  // Parse URL parameter
  // Find matching snapshot index
  // Load content and re-render timeline
});
```

## Security Model

### Threat Model

**Trusted content:**
- Snapshots are admin-created (single trusted user)
- Version-controlled in GitHub (full audit trail)
- No user-generated content

**Defense-in-depth layers:**
1. **Authentication** - Admin endpoints require JWT token
2. **Rate limiting** - 10 req/min per IP on snapshot endpoints
3. **CSRF protection** - Origin header validation
4. **Content sanitization** - DOMPurify before innerHTML
5. **CSP** - Restricts script sources

### XSS Protection

**Client-side sanitization:**
```javascript
// After rendering markdown
if (typeof DOMPurify !== 'undefined') {
  html = DOMPurify.sanitize(html);
}
contentDiv.innerHTML = html;
```

**Why client-side for snapshots:**
- Snapshots rendered client-side with marked.js
- DOMPurify provides battle-tested XSS protection
- Graceful degradation if CDN unavailable
- Consistent with server-side pattern (different layer)

**Server-side sanitization (current content):**
- Current /now content still sanitized server-side
- Uses `sanitizeHTML()` from `src/sanitize.ts`
- Double protection: server + client sanitization

## Keyboard Navigation

**Supported keys:**
- **Tab** - Navigate between timeline nodes and arrows
- **Enter / Space** - Activate focused node or arrow
- **Shift+Tab** - Navigate backwards

**Not yet implemented:**
- Arrow keys for left/right navigation (potential Phase 5D enhancement)

**Accessibility:**
- All nodes have `role="button"` and `tabindex="0"`
- Small nodes have `aria-label` with date
- Arrow buttons have descriptive `aria-label`
- Focus visible on all interactive elements

## Migration of Historical Snapshots

### Migration Script

**Location:** `scripts/migrate-now-snapshots.js`

**Purpose:** Convert historical HTML snapshots to JSON format

**Process:**
1. Read HTML file from `public/now/index_{date}.CHANGED.html`
2. Extract content div (remove widgets, scripts)
3. Convert HTML to markdown
4. Strip leading whitespace from all lines (prevents list continuation)
5. Import via API with custom date parameter

**HTML to Markdown conversion:**
```javascript
function htmlToMarkdown(html) {
  // Convert headings: <h1> → #
  html = html.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');

  // Convert paragraphs: <p> → text\n\n
  html = html.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

  // Convert links: <a href="...">text</a> → [text](...)
  html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Convert lists: <ul><li> → \n-
  html = html.replace(/<ul[^>]*>/gi, '\n');
  html = html.replace(/<\/ul>/gi, '\n\n'); // Blank line after list
  html = html.replace(/\s*<li[^>]*>(.*?)<\/li>/gi, '\n- $1');

  // Strip leading whitespace (prevents markdown list continuation)
  html = html.split('\n').map(line => line.trimStart()).join('\n');

  return html.trim();
}
```

**Common migration issues:**

**Problem:** Post-list paragraphs appear indented
**Cause:** Leading spaces after `</ul>` → markdown list continuation
**Fix:** Strip leading whitespace from all lines

**Problem:** "What I'm doing now" heading appears in snapshots
**Cause:** Part of HTML template, not content
**Fix:** Remove heading after conversion: `markdown.replace(/^#\s*What I'm doing now\s*\n\n/i, '')`

### Running Migration

**Dry run (extract and display):**
```bash
node scripts/migrate-now-snapshots.js
```

**Import via API:**
```bash
node scripts/migrate-now-snapshots.js \
  --import \
  --token={jwt_token} \
  --origin=http://localhost:8787
```

**Rate limiting:** Script has 500ms delay between imports to avoid rate limits.

## Troubleshooting

### Timeline Not Loading

**Symptom:** "Loading timeline..." never disappears

**Possible causes:**
1. **No snapshots exist** - Timeline auto-hides if `snapshots.length === 0`
2. **index.json missing/malformed** - Check `/now/snapshots/index.json` exists and is valid JSON
3. **JavaScript error** - Check browser console for errors
4. **CDN failure** - marked.js or timeline.js failed to load

**Debug:**
```javascript
// In browser console
fetch('/now/snapshots/index.json')
  .then(r => r.json())
  .then(data => console.log('Snapshots:', data.snapshots.length));
```

### Snapshot Content Not Loading

**Symptom:** Timeline works but clicking snapshot shows error

**Possible causes:**
1. **Snapshot file missing** - Check `/now/snapshots/{date}.json` exists
2. **Invalid JSON** - Snapshot file malformed
3. **Network error** - Check browser network tab
4. **Sanitization removed all content** - DOMPurify too aggressive (unlikely)

**Debug:**
```javascript
// In browser console
fetch('/now/snapshots/20170801.json')
  .then(r => r.json())
  .then(data => console.log('Snapshot:', data));
```

### Current Content Not Restoring

**Symptom:** Clicking "2026-03" shows stale snapshot instead of current

**Cause:** Original HTML not captured correctly

**Fix implemented:** Store `originalContentHTML = contentDiv.innerHTML` before any modifications in `initTimeline()`

### Date Label Shows Viewing Date

**Symptom:** Current content shows today's date instead of last updated date

**Cause:** Using `new Date()` instead of `content.json` `lastUpdated`

**Fix implemented:** Fetch `content.json` and use `lastUpdated` field for current content date label

### List Formatting Indented

**Symptom:** Post-list paragraphs appear indented like list items

**Cause:** Leading whitespace in markdown → list continuation

**Fix:** Strip leading whitespace from all lines:
```javascript
html.split('\n').map(line => line.trimStart()).join('\n');
```

### Timeline Doesn't Update on Resize

**Symptom:** Resize window from mobile to desktop, still shows 5 nodes

**Fix implemented:** Resize listener with 250ms debounce:
```javascript
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => renderTimeline(), 250);
});
```

## Performance Considerations

### Optimization Strategies

**Initial load:**
- Single index fetch (`index.json` ~2KB)
- Single current content fetch (`content.json` ~1KB)
- No snapshot content loaded until selected

**Navigation:**
- Fetch-on-demand (only loads selected snapshot JSON)
- Small JSON files (~1-2KB each)
- Client-side markdown parsing (offloads server)
- Could add: In-memory caching of loaded snapshots

**Rendering:**
- Only 5-7 nodes rendered (not all snapshots)
- Smooth CSS transitions
- Minimal DOM manipulation

**Bundle size:**
- timeline.js: ~15KB (unminified)
- marked.js: ~50KB (from CDN)
- DOMPurify: ~45KB (from CDN)
- Total: ~110KB (CDN cached after first load)

## Testing Strategy

**Manual testing:**
- ✅ Timeline renders on `/now`
- ✅ 9 historical snapshots accessible
- ✅ Arrow navigation works
- ✅ Click centers and loads snapshot
- ✅ URL parameters work (`/now?date=20170801`)
- ✅ Browser back/forward navigation
- ✅ Responsive layout (7 desktop, 5 mobile)
- ✅ Keyboard Tab navigation
- ✅ No JavaScript errors

**No integration tests yet:**
- Timeline rendering logic
- URL parameter handling
- Responsive behavior
- Content loading

**Reasonable for UI/UX feature:** Timeline is primarily presentational, manual testing appropriate.

## Future Enhancements

**Potential improvements:**
- Arrow key navigation (Left/Right to navigate timeline)
- Loading spinner/skeleton screen (instead of opacity fade)
- In-memory cache for loaded snapshots (faster re-navigation)
- ARIA live regions (announce content changes to screen readers)
- Animated crossfade transitions (smoother than instant swap)
- Mobile swipe gestures (swipe left/right to navigate)
- Search snapshots by keyword
- Compare two snapshots side-by-side

## Related Files

**Timeline component:**
- `public/now/timeline.js` - Client-side component (380 lines)
- `src/routes/nowPage.ts` - Server-side HTML/CSS rendering

**Admin APIs:**
- `src/routes/createNowSnapshot.ts` - POST create/update
- `src/routes/listNowSnapshots.ts` - GET list
- `src/routes/deleteNowSnapshot.ts` - DELETE remove

**Migration:**
- `scripts/migrate-now-snapshots.js` - HTML to JSON converter

**Data:**
- `public/now/snapshots/{YYYYMMDD}.json` - Individual snapshots
- `public/now/snapshots/index.json` - Snapshot index
- `public/now/data/content.json` - Current content

**Specifications (archived):**
- `SPECIFICATIONS/ARCHIVE/now-page-snapshots.md` - Original planning
- `SPECIFICATIONS/ARCHIVE/now-page-timeline-display.md` - UI specification

## Key Decisions Made

1. **Timeline above content** (not below) - Better discoverability and serves as navigation
2. **7 nodes on desktop** (not 5) - More context visible based on user feedback
3. **Pale blue color** (#8AAED6) - Subtle, doesn't dominate page
4. **Client-side rendering** - Offloads server, uses marked.js for markdown
5. **DOMPurify sanitization** - Defense-in-depth XSS protection
6. **lastUpdated for current date** - Shows when content actually updated, not viewing date
7. **No snapshot editing** - Snapshots are immutable historical records
8. **One snapshot per day** - Prevents over-archiving, simplifies management
