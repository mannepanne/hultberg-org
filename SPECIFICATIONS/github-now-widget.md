# GitHub /now Widget Specification

## Overview
Add a GitHub contribution history and recent repositories widget to the `/now` page, positioned to the right of the existing Goodreads widget.

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
- Display last 12 months rolling (not calendar year)
- Month labels across top (Mar, Apr, May, etc.)
- No weekday labels on left side
- Green contribution squares matching GitHub's visual style
- Total contribution count below graph (e.g., "2,826 contributions in the last year")

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

## Technical Considerations

### Security
- GitHub personal access token must be stored securely
- Consider using Cloudflare Worker to proxy requests and keep token server-side
- Never expose token in client-side JavaScript

### Performance
- Lazy-load widget (or load after main content)
- Consider debouncing/throttling if implementing auto-refresh
- Handle API rate limits gracefully (GitHub allows 60 req/hour unauthenticated, 5000/hour authenticated)

### Error Handling
- Gracefully handle API failures (show cached data or friendly error message)
- Handle missing contribution data
- Handle repos with no description

### Accessibility
- Ensure contribution graph has proper ARIA labels
- Link text is descriptive
- Color contrast meets WCAG guidelines
- Consider screen reader experience for graph visualization

## Implementation Files

Likely changes needed:
- `public/now/index.html` - Add container for GitHub widget
- New JavaScript file for GitHub API client and rendering logic
- Inline CSS or small stylesheet for widget-specific styles

## Future Enhancements (Not in Initial Scope)
- Hover tooltips on contribution squares showing exact count
- Filter repos by language or topic
- Link to specific contribution activity
- Animation/transitions when loading data
