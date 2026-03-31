# /now Page Timeline Display (Phase 5)

**Status:** 📋 Planned
**Created:** 2026-03-31
**Depends on:** Phase 4A & 4B - Snapshot Management (completed)

## Overview

Add an interactive timeline component to the public `/now` page that allows visitors to navigate through historical snapshots. The timeline shows the current content plus archived snapshots, positioned between the main content and the Reading/GitHub widgets.

## Design Goals

1. **Subtle but accessible** - Timeline is visible but doesn't dominate the page
2. **Personal reflection tool** - Primarily for Magnus to reflect on his journey
3. **Public transparency** - Visitors can explore Magnus's evolution over time
4. **Intuitive navigation** - Clear interaction model for stepping through time

## User Experience

### Timeline Position

The timeline component sits between:
- **Above:** Current /now content (or selected snapshot content)
- **Below:** Reading updates widget and GitHub activity widget

### Timeline Structure

Visual representation (5 snapshots visible at once):

```
[←] [◦] [2016-09] [2017-08] [2018-07] [◦] [→]
                  ^^^^^^^^
              (selected - large)
```

**Elements:**
- **Center position** - Selected snapshot (large), shows "YYYY-MM" format
- **±1 positions** - Adjacent snapshots (medium), show "YYYY-MM" format
- **±2 positions** - Edge snapshots (small), shape only (no label)
- **Arrow buttons** - Navigate timeline left (earlier) / right (later)
- **Connecting line** - Horizontal line connecting all elements

**Sizing:**
- Center (selected): Large box with prominent date label
- Adjacent (±1): Medium boxes with date labels
- Edge (±2): Small circular shapes (no text)

### Interaction Model

**Clicking a snapshot:**
1. Centers that snapshot in timeline
2. Updates content area above with snapshot's markdown
3. Updates URL: `/now?date=20170801`
4. Smooth visual transition

**Clicking arrows:**
- **Left arrow (←):** Shift timeline right (reveal earlier snapshots)
- **Right arrow (→):** Shift timeline left (reveal later snapshots)
- Arrows disabled when no more snapshots in that direction

**Current content:**
- Latest /now content (not a snapshot) appears as the rightmost date in timeline
- Labeled with current year-month (e.g., "2026-03")
- Selected by default on page load (unless URL has `?date=` parameter)

### Example Navigation Flow

**Initial state (showing current /now):**
```
[←] [◦] [2024-11] [2026-02] [2026-03]
                            ^^^^^^^^
                          (current - selected)
```

**Click left arrow to reveal earlier snapshots:**
```
[←] [2021-11] [2022-02] [2024-11] [2026-02] [◦] [→]
              ^^^^^^^^
           (2022-02 now selected)
```

**Click on 2021-11:**
```
[←] [◦] [2019-03] [2021-11] [2022-02] [◦] [→]
                  ^^^^^^^^
              (2021-11 selected)
```

**Click right arrow twice to return to current:**
```
[←] [◦] [2024-11] [2026-02] [2026-03]
                            ^^^^^^^^
                        (back to current)
```

## Technical Implementation

### Data Source

**Snapshots index:** Fetch from `/now/snapshots/index.json`

```json
{
  "snapshots": [
    {
      "date": "20160926",
      "snapshotDate": "2016-09-26T12:00:00Z",
      "preview": "I live in London, go to Copenhagen..."
    },
    {
      "date": "20170521",
      "snapshotDate": "2017-05-21T12:00:00Z",
      "preview": "I live in London, work at WINNOW..."
    }
  ]
}
```

**Current content:** Fetch from `/now/data/content.json` (treated as latest timeline item)

### Timeline Component

**JavaScript module:** `public/now/timeline.js`

**Key functions:**
- `initTimeline(snapshots, currentContent)` - Initialize timeline component
- `renderTimeline(selectedIndex)` - Render timeline with 5 visible snapshots
- `selectSnapshot(index)` - Center and display selected snapshot
- `shiftTimeline(direction)` - Navigate with arrow buttons
- `loadSnapshotContent(date)` - Fetch and render snapshot markdown

### URL Parameter Support

**Format:** `/now?date=YYYYMMDD`

**Behavior:**
- On page load, check for `?date=` parameter
- If present and valid: Load that snapshot and center in timeline
- If missing or invalid: Show current content (default state)
- Update URL when user clicks snapshots (using `history.pushState`)

**Examples:**
- `/now` - Shows current content
- `/now?date=20170801` - Shows snapshot from Aug 1, 2017
- `/now?date=current` - Alias for current content (optional)

### Content Rendering

**Display logic:**
1. Fetch snapshot JSON (e.g., `/now/snapshots/20170801.json`)
2. Extract markdown content
3. Render using `marked.js` (existing dependency)
4. Sanitize HTML (using existing `DOMPurify` or inline sanitization)
5. Replace content div with rendered snapshot
6. Add visual indicator: "Viewing snapshot from August 2017" (subtle banner)

**Snapshot indicator:**
```html
<div class="snapshot-banner">
  📸 Viewing snapshot from August 2017 · <a href="/now">View current</a>
</div>
```

### Responsive Design

**Desktop (width > 768px):**
- Show 5 snapshots: [←] [◦] [date] [date] [date] [◦] [→]
- Full date labels on 3 center positions

**Tablet (width 481-768px):**
- Show 3 snapshots: [←] [date] [date] [date] [→]
- Slightly smaller boxes
- No edge shapes (◦), just arrows

**Mobile (width ≤ 480px):**
- Show 3 snapshots: [←] [date] [date] [date] [→]
- Compact date format: "17-08" instead of "2017-08"
- Smaller touch targets (min 44x44px)

## Visual Design

### Styling Guidelines

**Match existing aesthetic:**
- Minimal, clean design
- Monochrome color scheme (black text, gray accents)
- No heavy borders or shadows
- Subtle hover states

**Timeline element styles:**

```css
/* Container */
.timeline-container {
  margin: 48px 0;
  padding: 24px 0;
  border-top: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
}

/* Timeline bar */
.timeline-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  position: relative;
}

/* Connecting line */
.timeline-line {
  position: absolute;
  height: 2px;
  background: #ddd;
  z-index: 0;
}

/* Snapshot nodes */
.timeline-node {
  position: relative;
  z-index: 1;
  cursor: pointer;
  transition: all 0.3s ease;
}

.timeline-node--small {
  width: 12px;
  height: 12px;
  background: #999;
  border-radius: 50%;
}

.timeline-node--medium {
  padding: 8px 16px;
  border: 2px solid #333;
  border-radius: 4px;
  font-size: 0.9em;
}

.timeline-node--large {
  padding: 12px 20px;
  border: 3px solid #000;
  border-radius: 4px;
  font-weight: 600;
  font-size: 1.1em;
  background: #f9f9f9;
}

.timeline-node:hover {
  border-color: #555;
}

/* Arrow buttons */
.timeline-arrow {
  width: 40px;
  height: 40px;
  border: 2px solid #333;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.timeline-arrow:hover {
  background: #f5f5f5;
}

.timeline-arrow:disabled {
  border-color: #ddd;
  color: #ddd;
  cursor: not-allowed;
}

/* Snapshot indicator banner */
.snapshot-banner {
  background: #f0f0f0;
  padding: 12px 24px;
  text-align: center;
  font-size: 0.9em;
  color: #555;
  margin-bottom: 24px;
  border-radius: 4px;
}

.snapshot-banner a {
  color: #333;
  text-decoration: underline;
}
```

### Animation

**Transitions:**
- Fade in/out when switching content (300ms)
- Smooth position changes when timeline shifts (300ms ease)
- Scale hover effect on nodes (subtle, 0.2s)

**Loading states:**
- Show loading spinner/skeleton while fetching snapshot
- Prevent clicks during transition

## Implementation Plan

### Phase 5A: Timeline UI Component

**Files to create:**
- `public/now/timeline.js` - Timeline component logic
- `public/now/timeline.css` - Timeline styles

**Files to modify:**
- `public/now/index.html` - Add timeline container and script includes

**Tasks:**
- [ ] Create timeline HTML structure
- [ ] Implement JavaScript timeline component
  - [ ] Fetch and parse snapshots index
  - [ ] Render timeline with 5 visible nodes
  - [ ] Handle node clicks (select and center)
  - [ ] Handle arrow clicks (shift timeline)
  - [ ] Calculate which snapshots are visible based on selection
- [ ] Add CSS styling (desktop first)
- [ ] Implement responsive design (tablet, mobile)
- [ ] Add smooth transitions/animations

### Phase 5B: Content Loading

**Tasks:**
- [ ] Implement snapshot content fetching
- [ ] Integrate marked.js for markdown rendering
- [ ] Add content sanitization
- [ ] Replace main content area with snapshot
- [ ] Add snapshot indicator banner with "View current" link
- [ ] Handle loading states (spinner/skeleton)
- [ ] Error handling (snapshot not found, network errors)

### Phase 5C: URL Integration

**Tasks:**
- [ ] Parse `?date=YYYYMMDD` URL parameter on load
- [ ] Load and display specified snapshot on page load
- [ ] Update URL when user clicks snapshots (`history.pushState`)
- [ ] Support back/forward browser navigation
- [ ] Validate date parameter (must exist in snapshots index)

### Phase 5D: Polish & Testing

**Tasks:**
- [ ] Test all interaction flows
- [ ] Test responsive design on real devices
- [ ] Test URL parameter edge cases
- [ ] Accessibility review (keyboard navigation, ARIA labels)
- [ ] Performance check (lazy load snapshots?)
- [ ] Cross-browser testing
- [ ] Add analytics events (optional: track which snapshots viewed)

## Accessibility Considerations

**Keyboard navigation:**
- Arrow buttons focusable and activatable with Enter/Space
- Timeline nodes focusable (tab through them)
- Visible focus indicators
- Skip to timeline / Skip past timeline links

**Screen readers:**
- ARIA labels for buttons: "Previous snapshots", "Next snapshots"
- ARIA label for selected node: "Current snapshot: August 2017"
- Announce content changes when switching snapshots
- Role="navigation" for timeline component

**Visual indicators:**
- High contrast for selected vs unselected states
- Don't rely on color alone (use size, border weight)
- Sufficient touch target sizes (44x44px minimum)

## Edge Cases & Error Handling

**No snapshots:**
- Hide timeline component entirely if `snapshots.length === 0`
- Show only current content (existing behavior)

**Only 1-2 snapshots:**
- Show timeline with fewer nodes
- Disable arrows if no scrolling needed
- Center available snapshots

**Snapshot fetch fails:**
- Show error message: "Could not load snapshot"
- Provide retry button
- Keep timeline interactive (allow selecting other snapshots)

**Invalid date parameter:**
- Redirect to `/now` (current content)
- Optional: Show message "Snapshot not found"

**Very old browsers (no JavaScript):**
- Timeline doesn't render (progressive enhancement)
- Page still shows current content
- Consider adding fallback: list of snapshot links

## Performance Considerations

**Optimization strategies:**
- Lazy load snapshot content (don't fetch until selected)
- Cache fetched snapshots in memory (session storage?)
- Only render visible timeline nodes (not all 9+)
- Preload adjacent snapshots (±1) for faster navigation

**Bundle size:**
- Timeline JS ~5KB (estimated)
- Timeline CSS ~3KB (estimated)
- Uses existing marked.js (already loaded for current content)

## Testing Strategy

**Manual testing:**
- [ ] Navigate through all 9 historical snapshots
- [ ] Test URL parameter loading
- [ ] Test browser back/forward
- [ ] Test responsive layouts (mobile, tablet, desktop)
- [ ] Test with JavaScript disabled (graceful degradation)
- [ ] Test keyboard navigation

**Automated testing:**
- Not critical for initial version (mostly UI/interaction)
- Consider adding in future if timeline logic becomes complex

## Future Enhancements (Post-Phase 5)

**Potential additions:**
- Search snapshots by keyword
- Filter timeline by year/period
- Compare two snapshots side-by-side
- Snapshot tags/categories
- Visual timeline graph (years with activity markers)
- Social sharing: "Share this snapshot" button
- Animated transitions between snapshots (crossfade)
- Mobile swipe gestures (swipe left/right to navigate)

## Open Questions

1. **Loading indicator:** Spinner, skeleton, or instant swap?
2. **Animation speed:** 300ms feels right, or faster/slower?
3. **Mobile gestures:** Support swipe to navigate? (requires touch library)
4. **Analytics:** Track which snapshots are viewed most? (privacy consideration)
5. **Default view:** Always show current, or remember last viewed snapshot? (probably always current)

## Success Criteria

**Phase 5 is complete when:**
- [ ] Timeline component displays correctly on `/now` page
- [ ] User can navigate through all snapshots using timeline
- [ ] Clicking snapshots loads and displays their content
- [ ] URL parameters work (`/now?date=20170801`)
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Current content accessible via timeline (latest position)
- [ ] Visual design matches hultberg.org aesthetic
- [ ] Keyboard navigation and screen readers work
- [ ] No JavaScript errors or console warnings
- [ ] Page performs well (no lag when navigating)

## Timeline

**Estimated effort:** 8-12 hours
- Phase 5A (UI Component): 3-4 hours
- Phase 5B (Content Loading): 2-3 hours
- Phase 5C (URL Integration): 1-2 hours
- Phase 5D (Polish & Testing): 2-3 hours

**Target completion:** TBD (pending Magnus's schedule/priorities)
