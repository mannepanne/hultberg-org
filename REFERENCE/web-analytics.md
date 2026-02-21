# Web Analytics

The site uses **two analytics solutions** for traffic monitoring.

## Google Analytics 4 (GA4)
- **Measurement ID**: `G-D1L22CCJTJ`
- Implemented site-wide via gtag.js snippet
- Tracks pageviews, user journeys, and referral sources
- Implemented in all static pages (`public/`) and Worker-rendered routes (`src/routes/`)

## Cloudflare Web Analytics
- **Token**: `f71c3c28b82c4c6991ec3d41b7f1496f`
- Privacy-first, cookie-free alternative to GA4
- Implemented site-wide via beacon.min.js snippet
- Provides pageviews, referrers, and visitor data without cookies or invasive tracking
- Located in Cloudflare dashboard under Analytics & Logs → Web Analytics

## Implementation Locations

Both analytics scripts are included in:
- Static HTML pages (`public/index.html`, `public/now/index.html`, `public/errors/not_found.html`, etc.)
- Worker-rendered pages via template strings in `src/routes/updatePage.ts`, `src/routes/updatesListing.ts`, and inline 404 handler in `src/index.ts`

## Future Consideration

Evaluate Cloudflare Web Analytics for 3-6 months, then consider consolidating to only Cloudflare to reduce tracking script overhead. See [TD-013 in technical-debt.md](./technical-debt.md) for details.
