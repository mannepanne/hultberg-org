# /now Page Snapshots

**Status:** 📋 Planned
**Created:** 2026-03-30
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
