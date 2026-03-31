# /now Page Snapshots

**Status:** ✅ Phase 4A & 4B Complete | 📋 Phase 5 (Public Display) Planned
**Created:** 2026-03-30
**Completed:** 2026-03-31 (Phase 4A & 4B)
**Depends on:** Editable /now page (completed in PRs #17, #18, #19)

## Overview

Add snapshot/archive functionality to the /now page, allowing Magnus to save historical versions of the content at different points in time. Snapshots will be stored as JSON data (matching the current content format) to enable future timeline/history visualization features on the public /now page.

## Motivation

Magnus has historically saved "snapshots" of the /now page before making updates - 9 existing files named `index_YYYYMMDD.CHANGED.html` exist in `public/now/`. This feature formalizes and enhances that workflow:

1. **Preserve history** - Capture what Magnus was working on at different points in time
2. **Enable future timeline feature** - Structured JSON data allows building interactive timeline views
3. **Simplify workflow** - One-click snapshot creation from admin editor instead of manual file copies

## Current State

Existing snapshot files in `public/now/`:
- `index_20160926.CHANGED.html`
- `index_20170521.CHANGED.html`
- `index_20170801.CHANGED.html`
- `index_20180727.CHANGED.html`
- `index_20190326.CHANGED.html`
- `index_20211124.CHANGED.html`
- `index_20220202.CHANGED.html`
- `index_20241125.CHANGED.html`
- `index_20260214.CHANGED.html`

These are full static HTML pages. We'll migrate the content to JSON format.

## Proposed Changes

### Phase 4A: Snapshot Management (Admin)

**Admin editor enhancements** (`/admin/now/edit`):

1. **"Archive Snapshot" button** - Next to "View Page" button
   - Creates snapshot of current editor content
   - Format: `YYYYMMDD.json` (e.g., `20260330.json`)
   - One snapshot per date (overwrites if same day)
   - Confirmation dialog if overwriting existing snapshot for today

2. **Snapshots list** - Below editor toolbar
   - Visual style matching `/admin/dashboard` updates list
   - Shows: date, first line of content preview, delete button
   - Sorted by date (newest first)
   - Delete button (no edit - snapshots are immutable historical records)

**API endpoints:**
- `POST /admin/api/create-now-snapshot` - Create snapshot from editor content
- `GET /admin/api/list-now-snapshots` - List all snapshots (for admin UI)
- `DELETE /admin/api/delete-now-snapshot?date=YYYYMMDD` - Delete snapshot by date

### Phase 4B: Data Structure

**Storage location:** `public/now/snapshots/`

**Snapshot file format:** `YYYYMMDD.json`
```json
{
  "markdown": "I live in London, work at char.gy...",
  "snapshotDate": "2026-03-30T15:30:00Z"
}
```

**Index file:** `public/now/snapshots/index.json`
```json
{
  "snapshots": [
    {
      "date": "20260330",
      "snapshotDate": "2026-03-30T15:30:00Z",
      "preview": "I live in London, work at char.gy..."
    }
  ]
}
```

**Why JSON format:**
- Same structure as `content.json` (markdown + timestamp)
- Can be rendered dynamically using existing `marked` + `sanitizeHTML` pipeline
- Enables future timeline/visualization features
- Easy to search, filter, and process programmatically

### Phase 5: Public Timeline Feature (Future)

**Out of scope for initial implementation** - documented here for context:

Potential features for public `/now` page:
- Timeline view showing snapshots chronologically
- "Step back in time" navigation
- Visual timeline with date markers
- Compare snapshots side-by-side
- Search across historical content

**Details TBD** when implementing Phase 5.

## Implementation Plan

### Phase 4A: Admin Snapshot Management

**Backend:**
- [ ] Create `src/routes/createNowSnapshot.ts` - POST handler for creating snapshots
- [ ] Create `src/routes/listNowSnapshots.ts` - GET handler for listing snapshots
- [ ] Create `src/routes/deleteNowSnapshot.ts` - DELETE handler for deleting snapshots
- [ ] Add GitHub commit logic for snapshots to `src/github.ts`
- [ ] Register routes in `src/index.ts`
- [ ] Add rate limiting to snapshot endpoints (reuse existing middleware)
- [ ] Add authentication checks (reuse `requireAuth`)

**Frontend:**
- [ ] Update `src/routes/nowEditor.ts` to include:
  - "Archive Snapshot" button
  - Snapshots list UI (styled like updates list)
  - Delete confirmation dialogs
  - Overwrite warning dialog
- [ ] Add client-side JavaScript for snapshot operations

**Data:**
- [ ] Create `public/now/snapshots/` directory
- [ ] Generate `index.json` for existing migrated snapshots

**Testing:**
- [ ] Integration tests for `POST /admin/api/create-now-snapshot`
- [ ] Integration tests for `GET /admin/api/list-now-snapshots`
- [ ] Integration tests for `DELETE /admin/api/delete-now-snapshot`
- [ ] Test overwrite protection (same date)
- [ ] Test rate limiting
- [ ] Manual testing of UI workflows

### Phase 4B: Migrate Existing Snapshots

**Migration strategy:**

Option 1: **Manual migration** (recommended for 9 files)
- Admin uses editor to create snapshots for each historical date
- Copy/paste content from old HTML files
- Preserves exact dates from filenames
- Simple, no risk of data loss

Option 2: **Automated migration script**
- Parse HTML from existing files
- Extract content section (between specific markers)
- Convert to markdown (reverse process)
- Create JSON snapshots
- More complex, risk of conversion errors

**Recommendation:** Manual migration via admin UI
- Only 9 files to migrate
- User controls what content is preserved
- Can review/edit before creating snapshot
- No risk of HTML parsing errors

## GitHub Commit Message Format

When creating/deleting snapshots, commit to GitHub with:

```
Create /now snapshot for [date]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

or

```
Delete /now snapshot for [date]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Security Considerations

**Reuse existing patterns:**
- Authentication via `requireAuth` middleware
- Rate limiting (10 req/min per IP)
- Origin header validation (CSRF protection)
- Content size validation (100KB limit like current content)
- HTML sanitization when displaying snapshots

**New considerations:**
- Validate date format (YYYYMMDD) on snapshot operations
- Prevent directory traversal in delete operations
- Limit total number of snapshots (e.g., 100 max?)

## User Experience Flow

### Creating a Snapshot

1. User edits `/now` content in admin editor
2. Clicks "Archive Snapshot" button
3. If snapshot exists for today: Shows confirmation dialog
   - "A snapshot for 2026-03-30 already exists. Overwrite?"
   - Cancel / Overwrite buttons
4. If confirmed or no existing snapshot: Creates snapshot
5. Shows success message
6. Snapshot appears in list below

### Deleting a Snapshot

1. User clicks delete icon next to snapshot in list
2. Shows confirmation dialog
   - "Delete snapshot from 2026-03-30?"
   - Cancel / Delete buttons
3. If confirmed: Deletes snapshot from GitHub
4. Shows success message
5. Snapshot removed from list

## Future Enhancements (Phase 5+)

**Public timeline visualization:**
- Interactive timeline on `/now` page
- Click date markers to view historical content
- Smooth transitions between snapshots
- Visual indicators of content changes

**Advanced features:**
- Search across all snapshots
- Tag snapshots with themes/topics
- Compare two snapshots side-by-side
- Export snapshot as PDF/markdown
- Snapshot scheduling (auto-snapshot monthly)
- Analytics: "You've tracked your progress for X years"

## Technical Notes

**Deployment pipeline:**
- Creating/deleting snapshots commits to GitHub
- GitHub Actions triggers deployment
- Snapshots available within ~2 minutes
- Same workflow as current /now content updates

**Backward compatibility:**
- Keep existing `index_[date].CHANGED.html` files as reference
- New snapshots use JSON format in `snapshots/` directory
- No breaking changes to current /now functionality

**File naming:**
- Snapshots: `YYYYMMDD.json` (e.g., `20260330.json`)
- One per day limit prevents accidental over-archiving
- Simple alphabetical sorting = chronological order

## Testing Strategy

**Backend tests:**
- Create snapshot: auth, rate limiting, validation, GitHub commit
- List snapshots: auth, returns correct data, sorts by date
- Delete snapshot: auth, rate limiting, actually removes file
- Edge cases: same date overwrite, malformed dates, missing files

**Frontend tests:**
- Buttons render correctly
- Snapshot list displays with correct data
- Confirmation dialogs work
- Error messages display properly

**Manual testing:**
- Create snapshot workflow
- Overwrite confirmation
- Delete workflow
- UI responsiveness
- Error handling (network failures, GitHub API errors)

## Dependencies

**Existing features:**
- Editable /now page (PR #19)
- GitHub commit logic (`src/github.ts`)
- Admin authentication (`src/auth.ts`)
- Rate limiting (`checkRateLimit`)

**Libraries:**
- `marked` for markdown rendering (when displaying snapshots)
- Existing sanitization (`sanitizeHTML`)

## Open Questions

1. **Snapshot limit:** Should there be a maximum number of snapshots? (e.g., 100 total)
2. **Bulk operations:** Should we allow bulk delete? (probably not needed)
3. **Export:** Should snapshots be exportable as a single archive? (future enhancement)
4. **Preview length:** How many characters to show in snapshot preview? (150 chars like updates?)

## Success Criteria

**Phase 4A (Admin Management) is complete when:**
- [x] User can create snapshots from admin editor
- [x] User can view list of all snapshots
- [x] User can delete snapshots
- [x] Overwrite confirmation works
- [x] All tests passing
- [x] Manual testing confirms workflows work

**Phase 4B (Migration) is complete when:**
- [x] All 9 historical snapshots migrated to JSON format
- [x] Existing HTML files kept as reference
- [x] No data loss during migration

## Completed Implementation (Phase 4A & 4B)

### What Was Built

**Completed:** 2026-03-31 in PR #20 and #21

**Admin snapshot management** (`/admin/now/edit`):
- ✅ "Archive Snapshot" button creates snapshots of current editor content
- ✅ Snapshots list shows all archived snapshots (date, preview, delete button)
- ✅ Delete functionality with confirmation dialog
- ✅ Overwrite detection when creating snapshot for same date

**API endpoints:**
- ✅ `POST /admin/api/create-now-snapshot` - Create/update snapshot
  - Accepts optional `date` parameter (YYYYMMDD format) for backdating
  - Validates date format, checks date exists, prevents future dates
  - Returns `{ success, date, overwritten }` response
- ✅ `GET /admin/api/list-now-snapshots` - List all snapshots
- ✅ `DELETE /admin/api/delete-now-snapshot?date=YYYYMMDD` - Delete snapshot

**Data structure:**
- ✅ Storage: `public/now/snapshots/`
- ✅ Format: `YYYYMMDD.json` (e.g., `20260330.json`)
- ✅ Index: `public/now/snapshots/index.json` (managed automatically)
- ✅ GitHub commits for all snapshot operations

**Testing:**
- ✅ Full integration test coverage (325 tests total)
- ✅ Tests for create, list, delete operations
- ✅ Edge case coverage (overwrite, validation, rate limiting)

**Historical migration:**
- ✅ Created `scripts/migrate-now-snapshots.js` for automated migration
- ✅ Extracts markdown content from HTML files
- ✅ Imports via API with custom dates
- ✅ All 9 historical snapshots migrated successfully:
  - 20160926 - Planday era
  - 20170521 - WINNOW, learning Python
  - 20170801 - WINNOW, data science
  - 20180727 - WINNOW, slipped disc diagnosis
  - 20190326 - WINNOW, Vue.js interest
  - 20211124 - WINNOW, lockdown gardening
  - 20220202 - WINNOW to Ocado transition
  - 20241125 - Ocado Technology
  - 20260214 - Claude Code experiments

### Known Issues from PR Review

**From PR #20 review (addressed in PR #21):**
- ✅ Optional `date` parameter implemented for backdating snapshots
- ✅ JavaScript syntax error in delete button onclick handler (fixed with event delegation)
- ✅ Debug code cleanup completed

## Phase 5: Public Snapshot Display (Next)

**Status:** 📋 Planned

Now that snapshots are captured and managed, the next phase is displaying them on the public `/now` page.

### Potential Approaches

**Option A: Timeline View**
- Add a "History" or "Timeline" section at the bottom of `/now` page
- Show snapshots chronologically with date markers
- Click to expand/view historical content
- Visual timeline UI with dots/markers for each snapshot

**Option B: Dropdown/Selector**
- Add a date selector at the top: "View /now page as of: [Date dropdown]"
- Selecting a date replaces page content with snapshot
- "Current" option shows latest content
- URL parameter support: `/now?date=20160926`

**Option C: Separate Archive Page**
- Keep `/now` showing only current content
- Add `/now/archive` or `/now/history` page
- Lists all snapshots with previews
- Click to view full snapshot content

**Option D: Minimal "Previous Updates" Link**
- Add simple link: "See previous versions →"
- Links to minimal archive page
- Focus stays on current content

### Design Considerations

**User Experience:**
- Should historical content be prominently displayed or tucked away?
- How do we indicate "this is old content" vs current?
- Should we show comparison/diff between snapshots?
- Do we want search/filter across historical content?

**Technical:**
- Fetch snapshots client-side or server-side render?
- Use existing page template or create new layout?
- Support deep-linking to specific snapshot dates?
- Cache strategy for snapshot data?

**Content Strategy:**
- Are snapshots interesting enough for public display?
- Does showing history add value for visitors?
- Should snapshots have commentary/reflection added?

### Questions to Resolve

Before implementing Phase 5:

1. **Primary use case:** Is this for Magnus to reflect on his journey, or for visitors to understand his evolution?
2. **Visibility:** Should historical snapshots be prominent or subtle?
3. **Interaction:** Read-only view, or interactive exploration?
4. **Scope:** All snapshots public, or curated selection?

### Next Steps

1. **Decide on approach** - Which option (A/B/C/D) or hybrid?
2. **Design mockup** - What should it look like?
3. **Implement display** - Build the UI components
4. **Test with real data** - Use the 9 migrated snapshots
5. **Iterate based on feedback**

---

**Note:** No code changes needed yet for Phase 5. This is purely a product/design decision about how to present the captured snapshot data to visitors.
