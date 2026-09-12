# Fleet Parlour — Final Stabilisation Build

Date: 11 September 2026

## Fixed
- Consolidated Helmet/CSP into one correctly ordered middleware before static files.
- Allowed required YouTube thumbnail, Bootstrap, Google Fonts and Font Awesome resources on the Node/Express localhost server.
- Removed the duplicate late Helmet middleware that could not correctly govern already-served static files.
- Fixed the broken index JavaScript reference (`js/index-page.js` did not exist); index now uses `js/index.js`.
- Kept mobile navigation on the home page independent of Bootstrap JS to avoid collapse-handler conflicts.
- Kept YouTube thumbnail fallback logic in external JavaScript rather than inline image event handlers.
- Preserved the original black/chrome/gold visual theme, layout, service cards, buttons and customer-facing design.
- Preserved the three Home service-card links as `View Gallery →` to `services-gallery.html`.
- Preserved all dedicated SEO service pages.
- Preserved the enquiry API, SQLite storage, photo upload, Zoho email notification and public `FP-XXXXXXXX` reference flow.
- Updated copyright year to 2026.
- Corrected the Privacy/Terms canonical URL.
- Added `noindex, nofollow` to the Thank You confirmation page.
- Corrected the XML sitemap namespace, added last-modified dates and included the Privacy/Terms page.
- Added CSS cache-busting versioning without changing the theme.

## Local testing
Run the Node server from the `backend` folder and use only:

`http://localhost:3000/`

Do not use VS Code Go Live/port 5500 for full-system testing because the form/backend/reference flow belongs to the Node server on port 3000.


## Live social followers + likes upgrade (12 Sep 2026)
- Added server-side `/api/social-stats` endpoint.
- Added 30-minute cached follower/like refresh with last-successful snapshot storage.
- Added Facebook, Instagram, TikTok and YouTube adapters.
- Added live follower/subscriber and like metrics to the existing Follow Fleet Parlour section.
- Added Total Social Community and Total Likes summary cards.
- Kept API tokens and keys backend-only via `.env`.
- Added `SOCIAL-STATS-SETUP.md` with connection instructions and metric definitions.
- Unconfigured services display `—`; the site never invents follower/like figures.
