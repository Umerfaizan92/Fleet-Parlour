# Fleet Parlour — Project Guide & Change History

This single file consolidates the previous setup notes, backend notes, contact-form notes and SEO change logs. Duplicate documentation files were removed only for housekeeping; website functionality and visual styling were not removed.

## BACKEND-CHANGES.txt

Fleet Parlour - Own Enquiry Backend

Removed Formspree dependency from contact.html.
Added frontend fetch-based form submission and upload progress/status messaging.
Added Node.js/Express backend for structured enquiries and multiple photo uploads.
Added SQLite persistence and private photo records.
Added admin-only enquiry/photo API endpoints.
Added optional SMTP notification support.
Added security headers, CORS allow-list, rate limiting, validation, file size/count/type limits and honeypot spam field.
Added Docker support and setup instructions.
Prepared database fields for future AI Office Manager summary and quote-draft automation.

---

## BACKEND-SETUP-README.md

# Fleet Parlour Enquiry Backend

This package replaces Formspree for the Request a Quote form. The website sends enquiries and photo uploads to your own Node.js API.

## What is included

- POST `/api/enquiries` — accepts the complete quote form plus 1–10 photos.
- SQLite database — stores each lead in structured fields ready for the future AI Office Manager.
- Private photo storage — images are stored under the backend's data folder, not exposed as public URLs.
- Admin API — list/read enquiries and securely retrieve photos with an admin key.
- Optional SMTP email notification — the enquiry is still saved even if email is not configured.
- CORS, security headers, rate limiting, field validation, file limits and a spam honeypot.
- The website Contact form is already changed to use this backend instead of Formspree.

## Important hosting note

GitHub Pages can host the Fleet Parlour HTML/CSS/JS, but it cannot run this Node.js backend. The backend must run on an internet-accessible server/service. You do NOT need Formspree. Before the live launch, deploy the `backend` folder and then put that public API address in `js/api-config.js`.

Example:

```js
window.FLEET_PARLOUR_API_URL = 'https://api.fleetparlour.com.au';
```

## Local test on Windows

1. Install Node.js 20 or newer.
2. Open the `backend` folder in VS Code terminal.
3. Copy `.env.example` to `.env`.
4. Change `ADMIN_API_KEY` to a long random secret.
5. Run:

```bash
npm install
npm start
```

The backend will run at `http://localhost:3000`.

Open `contact.html` from the website package and submit a test enquiry with a photo. The form is currently configured for `http://localhost:3000` so local testing works immediately.

Health check:

`http://localhost:3000/api/health`

## Where data is saved

- Database: `backend/data/fleet-parlour.sqlite`
- Photos: `backend/data/uploads/<enquiry-id>/...`

Keep the `data` folder persistent and backed up on a production server.

## Admin API

Send your `ADMIN_API_KEY` in the `x-admin-key` request header.

- `GET /api/admin/enquiries`
- `GET /api/admin/enquiries/:id`
- `GET /api/admin/enquiries/:id/photos/:photoId`

These endpoints are intentionally not linked from the public website.

## Email notifications (optional)

The backend does not require a paid form service. If you want email notifications, add SMTP credentials to `.env`. If SMTP is left blank, enquiries and photos are still stored normally.

## AI Office Manager readiness

The database already reserves:

- `status`
- `ai_status`
- `ai_summary`
- `ai_quote_draft`

This lets the next phase add AI analysis, pricing rules, draft quotations and follow-up automation without rebuilding the website enquiry capture system.

## Production checklist

- Deploy backend to a persistent server/service.
- Use HTTPS.
- Set `ALLOWED_ORIGINS` to only Fleet Parlour domains.
- Set a strong `ADMIN_API_KEY`.
- Use persistent disk/object storage; do not rely on temporary server storage.
- Update `js/api-config.js` with the deployed API URL.
- Test a real submission and photo retrieval.
- Back up the database/uploads.

---

## BACKEND-V2-CHANGES.txt

FLEET PARLOUR OWN BACKEND V2 — FIXES

- Removed automatic form redirect after submission.
- Removed automatic form reset after submission.
- Added permanent visible success/error status under Request My Free Quote.
- Fixed the unsafe footer year JavaScript that caused `Cannot set properties of null`.
- Backend now serves the website locally itself, so only ONE terminal/server is required for testing.
- Local test URL is always http://localhost:3000/contact.html.
- Local API is same-origin when using port 3000, eliminating Live Server/CORS/temporary-port confusion.
- API config still supports Live Server fallback to localhost:3000 if needed.
- Added clear backend logs for incoming enquiries, upload rejection, validation failure, saved enquiry ID, photo count, and email result.
- Enquiries save successfully even if SMTP is blank or Zoho email fails.
- Zoho SMTP defaults are prefilled except SMTP_PASS, which remains blank for the user to add later.
- Added mail connection timeouts so a bad SMTP configuration cannot hang the form indefinitely.
- Updated Multer dependency to the maintained 2.x line.
- Added backend .gitignore so .env, node_modules and enquiry data are not committed accidentally.
- Preserved existing website visual theme and CSS.
- Local HTML asset/link scan: 525 references checked, 0 missing.

---

## BACKEND-V2-THANK-YOU-UPGRADE.txt

Fleet Parlour Backend v2 — Thank You Page Upgrade

- Quote form now redirects to a dedicated branded thank-you page after a successful save.
- Customer-facing reference codes are short: FP-XXXXXXXX.
- Internal UUID remains unchanged for database/storage integrity.
- Public reference_code is stored in the enquiries table and returned by the API.
- Existing databases auto-migrate and receive stable short reference codes.
- Zoho notification emails include the public reference code.
- Thank-you page uses the existing Fleet Parlour black/gold theme and existing truck hero image.
- Thank-you page accurately reports whether Fleet Parlour email notification was sent.

---

## CONTACT-FORM-UPGRADE.txt

Fleet Parlour Contact Form Upgrade

Updated the Request a Quote form to collect structured information useful for accurate quoting now and future AI Office Manager integration.

Added:
- Full name, phone, email
- Suburb/postcode and optional job address
- Vehicle/job type
- Make/model and optional registration
- Service required
- Parts/components to polish
- Current condition
- Preferred job date
- Detailed job notes
- Multiple image upload
- Power supply availability
- Covered/dry work area availability
- Privacy/contact consent
- Required field validation
- Structured field names suitable for later AI/CRM processing
- Dedicated thank-you.html page

The existing Fleet Parlour theme and visual identity were retained.

---

## README.md

# Fleet-Parlour
Mobile Metal Truck Polishing

---

## SEO-PRIORITY-1-CHANGES.txt

Fleet Parlour — SEO Priority 1 Changes

Theme/presentation:
- styles.css was not changed.
- Existing black/chrome/gold visual theme and Bootstrap structure were preserved.

Changes made:
1. about.html
   - Changed "Full Fleet Detailing" to "Truck & Fleet Metal Polishing".
   - Fixed broken "/services gallery.html" link to "/services-gallery.html".
   - Improved page title and meta description.
   - Added non-visual business structured data.

2. index.html
   - Kept existing design and service cards.
   - Added an internal SEO link to the new Truck Polishing Perth page.
   - Changed the first service-card link to the dedicated truck-polishing page.
   - Refined one services subtitle.
   - Added non-visual business structured data.

3. truck-polishing-perth.html (NEW)
   - Dedicated Perth commercial landing page.
   - Uses existing styles.css/classes only.
   - Includes service-focused content, Perth targeting, quote CTAs, canonical metadata, Open Graph metadata, and Service structured data.

4. contact.html
   - Added a unique contact/quote meta description.
   - Added non-visual business structured data.

5. services-gallery.html
   - Added a unique gallery meta description.
   - Corrected "aluminum" to Australian English "aluminium" in service wording.
   - Added non-visual business structured data.

6. policies - terms.html
   - Replaced generic truck-polishing title/description with Privacy & Terms-specific metadata.

7. sitemap.xml
   - Added https://fleetparlour.com.au/truck-polishing-perth.html

Recommended test before GitHub upload:
- Open index.html and all existing pages locally.
- Open truck-polishing-perth.html.
- Check desktop and mobile navbar, hero, cards, buttons, footer and WhatsApp button.
- Test Contact, Call and WhatsApp links.
- After publishing to GitHub Pages, test the live URL and then request indexing in Google Search Console.

---

## SEO-PRIORITY-2-CHANGES.txt

Fleet Parlour SEO Priority 2

Added dedicated service landing pages without changing styles.css or the existing visual theme:
- bull-bar-polishing-perth.html
- fuel-tank-polishing-perth.html
- truck-rim-polishing-perth.html
- aluminium-polishing-perth.html
- metal-polishing-perth.html
- stainless-steel-polishing-perth.html

Also:
- Added all new URLs to sitemap.xml
- Updated homepage service-card links to dedicated service pages
- Added internal links from Truck Polishing Perth page to key service pages
- Added unique titles, meta descriptions, canonical URLs, Open Graph metadata and Service structured data to each new page
- Reused existing Fleet Parlour CSS/classes/images to preserve the approved black/chrome/gold design

---

## SEO-PRIORITY-2-CONSISTENCY-FIXES.txt

Fleet Parlour SEO Priority 2 - Consistency & Public Access Fixes

1. Standardised the three cards in What We Can Help With across all dedicated SEO service pages.
2. Added full-width photos to Surface Restoration and Mobile Perth Service cards.
3. Standardised card image heights and card layout.
4. Standardised the service description/story section across all SEO pages.
5. Added premium gold-glow framed story card with circular Fleet Parlour logo badge.
6. Standardised story images to consistent dimensions using object-fit.
7. Added a public Explore Our Perth Polishing Services link grid to Services Gallery linking all dedicated SEO pages.
8. Kept the existing black/chrome/gold visual identity and mobile navbar behaviour.

---

## SEO-PRIORITY-2-FIXES.txt

Fleet Parlour — Priority 2 Fixes

1. Fixed local testing of links/images:
   - Converted root-absolute local href/src/action references (for example /images/Logo.png and /contact.html) to relative references (images/Logo.png and contact.html).
   - This keeps them valid on the live root-level website and also allows them to work when HTML files are opened directly from an extracted folder on a laptop.

2. Fixed desktop navbar duplicate menu circle:
   - The custom CSS was forcing the circular hamburger button to display even at desktop widths, overriding Bootstrap's desktop hide behavior.
   - Added a desktop media rule at min-width: 992px to hide the hamburger/toggler.
   - Mobile behavior is unchanged: the circular three-bar menu remains visible and functional below 992px.

3. No theme redesign:
   - Existing black/chrome/gold visual design retained.

---

## START-HERE-BACKEND-v2.txt

FLEET PARLOUR — OWN BACKEND V2 (CLEAN TEST VERSION)

IMPORTANT: Delete/ignore the previous test folder and use this package as a fresh folder.

ONE-TERMINAL LOCAL TEST
1. Extract the ZIP to a new folder.
2. Open the extracted folder in VS Code.
3. Open /backend in the terminal.
4. Copy .env.example to .env:
   PowerShell: Copy-Item .env.example .env
5. Do NOT add an SMTP password yet. Leave SMTP_PASS blank for the first test.
6. Run: npm install
7. Run: npm start
8. Open ONLY this URL in Chrome:
   http://localhost:3000/contact.html
9. Fill the form, attach at least one JPG/PNG photo and submit.
10. The page will NOT redirect and will NOT blank/reset. It will show a permanent success message with an enquiry reference.
11. The terminal will also print whether the enquiry was saved and whether email was sent.

ZOHO EMAIL — ADD AFTER THE FORM TEST WORKS
Open backend/.env and enter your Zoho app-specific password only here:
SMTP_PASS=YOUR_ZOHO_APP_PASSWORD

Never send that password to anyone or paste it into chat.
Save .env, stop the server with Ctrl+C, then run npm start again.

If Zoho email works, the contact page success message will say the email notification was sent.
If Zoho email fails, the enquiry is still saved safely and the backend terminal will show the mail reason.

LOCAL DATA
Database: backend/data/fleet-parlour.sqlite
Photos: backend/data/uploads/<enquiry-id>/

PRODUCTION NOTE
The public GitHub Pages site cannot run Node.js by itself. After local testing is approved, deploy /backend separately and point api.fleetparlour.com.au to it. The included api-config.js is already prepared to use https://api.fleetparlour.com.au on the public website.

---

## v2.2 Clean Package

- Consolidated the scattered root README/change-log TXT/MD files into this single PROJECT-GUIDE.md.
- Left functional website, SEO, image, manifest, robots, sitemap, backend and configuration files untouched except for the specific items below.
- Updated Zoho Australia SMTP defaults to smtp.zoho.com.au, port 465, SSL/secure true.
- Added backend/.env with the correct non-secret defaults and a blank SMTP_PASS so only the private App Password needs to be entered locally.
- Added cache-version query strings to the contact form JavaScript to prevent an older quote-form.js from remaining in the browser cache.
- Made the successful submission redirect explicit to /thank-you.html on the same local site origin.
- The dedicated Thank You page and short FP reference code remain enabled.
