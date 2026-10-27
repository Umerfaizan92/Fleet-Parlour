# Optional SEO analytics exports (read-only)

This repository contains an offline analysis utility. **No Google credentials or analytics access is configured.**

To use, export Google Search Console Performance data as CSV and save it locally at `seo-analytics-input/gsc.csv`. Accepted columns: `Clicks`, `Impressions`, `CTR`, `Position`, plus `Top pages` or `Top queries` (or `Page`/`Query`). The report will label opportunities for **manual review**, not make changes.

Optionally save a GA4 export as `seo-analytics-input/ga4.csv`. GA4 rows are counted but **not interpreted** until the chosen report schema and conversion events are agreed.

Run `python3 scripts/seo_analytics_report.py`. Outputs are written to `seo-analytics-report/` and should not be committed if they contain customer or business analytics.

To automate this with verified data later, use a dedicated least-privilege Google connection and approved workflow. Never commit tokens, client secrets, raw customer identifiers or analytics exports.

This is separate from all existing website and SaaS functionality. It does not deploy, change metadata, write to Google services, or publish content.
