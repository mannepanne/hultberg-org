# GitHub /now Widget Specification

**Status:** ✅ Completed and Deployed
**PR:** [#11](https://github.com/mannepanne/hultberg-org/pull/11)
**Completion Date:** March 28, 2026

## Overview
Add a GitHub contribution history and recent repositories widget to the `/now` page, positioned to the right of the existing Goodreads widget.

**Implementation:** Fully completed with comprehensive test coverage, username validation, accessibility features, and secure server-side token handling.

## Layout Structure

```
---------------------------
| What I'm doing now list |
---------------------------
| Goodreads | GitHub      |
---------------------------
```

## GitHub Widget Components

### 1. Contribution Graph
- **API fetches:** Last 12 months rolling contribution data (not calendar year)
- **Display shows:** Last 6 months (26 weeks) for compact layout
- Month labels across top (Mar, Apr, May, etc.)
- No weekday labels on left side
- Green contribution squares matching GitHub's visual style
- Total contribution count below graph shows full 12-month total (e.g., "2,826 contributions in the last 12 months")

**Rationale:** Fetching 12 months of data ensures accurate total count, but displaying only 6 months keeps the graph width manageable and visually balanced with the Goodreads widget.

### 2. Recent Repositories List
**Header:** "Projects I have been working on recently"

**Each repository entry shows:**
- **Repository name** (bold, linked to GitHub repo)
- **Time since last contribution** (right-aligned)
  - Show "today" if < 24 hours
  - Show "X days ago" if 1-21 days
  - Show nothing if > 21 days
- **Repository description** (on separate line below)

## Data Source & Fetching

### GitHub APIs
1. **Public Repositories** - REST API
   - Endpoint: `GET /users/{username}/repos`
   - Filter: All public repos (owner + collaborator)
   - Sort: By recent activity/push date
   - No authentication required

2. **Contribution History** - GraphQL API
   - Query: `contributionsCollection`
   - Timeframe: Last 365 days rolling
   - Requires: Personal access token (read-only, public_repo scope)
   - Returns: Daily contribution counts

### Fetch Strategy
- **Client-side JavaScript** - Fetch data when page loads
- Ensures freshness without requiring rebuild/redeploy
- Cache responses in browser if desired (consider 1-hour cache)

## Styling Requirements

### Visual Design
- Match existing hultberg.org aesthetic (Georgia serif, simple, clean)
- **Not** styled like Goodreads widget
- Maintain consistent font sizing and spacing with rest of page
- Responsive layout consideration (may need to stack on mobile)

### Contribution Graph Styling
- Square cells with border/spacing like GitHub
- Green color scale matching GitHub's palette:
  - No contributions: light gray (#ebedf0)
  - Low: light green (#9be9a8)
  - Medium-low: medium green (#40c463)
  - Medium-high: darker green (#30a14e)
  - High: darkest green (#216e39)
- Compact layout, no weekday labels

### Repository List Styling
- Repository name: Bold, linked, standard link color
- Time indicator: Right-aligned, lighter gray color
- Description: Normal weight, standard text color
- Spacing between entries for readability

## Technical Implementation

### Security ✅
- **Server-side proxy:** `src/routes/githubProxy.ts` keeps GitHub token secure
- **Endpoint:** `/api/github/contributions?username={username}`
- Token accessed via `env.GITHUB_TOKEN` (Cloudflare Worker secret)
- Client never sees the token
- **Username validation:** Regex pattern prevents invalid API calls
  - Pattern: `/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/`
  - Validates GitHub username format before API call

### Performance ✅
- **Client-side fetching:** Parallel requests for contributions and repos
- **Caching:** 1-hour cache on proxy endpoint (`Cache-Control: max-age=3600`)
- **CORS enabled:** Proper headers for client-side access
- **Error handling:** Graceful degradation on API failures (empty arrays, error messages)
- Rate limits: 5000 requests/hour with authentication

### Accessibility ✅
- Contribution grid has `role="img"` and descriptive `aria-label`
- Each square has individual `aria-label` with contribution count and date
- Proper singular/plural handling ("1 contribution" vs "2 contributions")
- All links open in new tabs with `rel="noopener noreferrer"` for security
- Color contrast meets WCAG guidelines (GitHub's standard palette)

### Configuration
- **Configurable username:** Set via HTML data attribute
  - `<div id="github-contributions" data-username="mannepanne"></div>`
  - Fallback to 'mannepanne' if not specified
  - Separation of content (HTML) from logic (JavaScript)

## Implemented Files

### New Files Created
- **`src/routes/githubProxy.ts`** - Server-side GitHub GraphQL API proxy (115 lines)
- **`public/now/github-widget.js`** - Client-side widget logic (209 lines)
- **`tests/integration/githubProxy.test.ts`** - Comprehensive test suite (14 tests, 100% coverage)

### Modified Files
- **`public/now/index.html`**
  - Added two-column widget layout with flexbox
  - Added GitHub widget containers with data attributes
  - Embedded CSS for contribution graph and repository list
  - Added GitHub profile link to navigation

- **`src/index.ts`**
  - Registered `/api/github/contributions` route
  - Added GitHub import and handler
  - Updated 404 page navigation with GitHub link

- **Navigation updates across all pages:**
  - `public/index.html` - Homepage
  - `public/2005/11/recipe_sharing_.html` - Flying Jacob recipe
  - `public/errors/not_found.html` - 404 page
  - `src/routes/updatesListing.ts` - Updates listing
  - `src/routes/updatePage.ts` - Individual update pages
  - All LinkedIn and GitHub links now open in new tabs

### Test Coverage
- **14 new tests** for `githubProxy.ts`
- **100% coverage:** statements, functions, lines
- **91.66% branch coverage**
- All 199 tests passing
- Tests cover: validation, CORS, caching, error handling, API interaction

## Deployment

### Requirements
- **GitHub Token:** Must be configured as Cloudflare Worker secret
  ```bash
  npx wrangler secret put GITHUB_TOKEN
  # Enter: github_pat_xxxxxxxxx
  ```
- **Scope:** Public repositories read access (already configured for admin functionality)
- **Auto-deploy:** GitHub Actions workflow deploys on push to main

### Verification Steps
1. Navigate to https://hultberg.org/now
2. Verify contribution graph displays with last 6 months
3. Verify repository list shows recent activity
4. Check total contribution count is accurate
5. Test responsive layout on mobile
6. Verify all GitHub links open in new tabs

## Future Enhancements (Not Implemented)

These were identified during development but deemed low priority:

**Visual Polish:**
- Dynamic color thresholds (currently hardcoded at 0, <3, <6, <9, 9+)
- Loading animation instead of plain text "Loading..."
- "Last Updated" timestamp to indicate 1-hour cache freshness

**Functionality:**
- Hover tooltips on contribution squares (currently title attribute only)
- Filter repos by language or topic
- Link to specific contribution activity
- Month label improvements (first month currently hidden by design)

**Developer Experience:**
- JSDoc type definitions for better IDE autocomplete
- More granular error messages

These can be revisited in future iterations based on user feedback.
