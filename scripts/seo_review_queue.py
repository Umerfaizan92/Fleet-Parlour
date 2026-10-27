#!/usr/bin/env python3
"""Build an evidence-limited SEO/AEO/GEO/AIO/SXO review queue from public audit JSON."""
import csv
import json
import os
from urllib.parse import urlsplit, unquote

SOURCE = "seo-audit-report/report.json"
DEST = "seo-audit-report"
def build(report):
    rows = []
    for p in report.get("pages", []):
        url = p.get("url", "")
        path = unquote(urlsplit(url).path)
        candidate = path.strip("/").replace(".html", "").replace("-", " ") or "homepage"
        flags = list(p.get("review_flags", []))
        if p.get("error"): flags.append("Page fetch failed: " + p["error"])
        rows.append({
            "url": url,
            "candidate_topic_from_url_not_keyword_research": candidate,
            "seo_review": "; ".join(flags) or "No basic HTML flags detected",
            "aeo_review": "Manually verify answer usefulness, customer questions and FAQ accuracy",
            "geo_review": "Manually verify brand identity, citations and supporting evidence",
            "aio_review": "AI search visibility not measurable from public HTML audit",
            "sxo_review": "Verify user journey, contact CTA and conversion tracking manually",
            "verified_organic_clicks": "NOT CONNECTED",
            "verified_conversions": "NOT CONNECTED",
            "review_priority": "Check access/error" if p.get("error") else ("Review flagged metadata" if flags else "Routine manual review")
        })
    return rows

def main():
    with open(SOURCE, encoding="utf-8") as f: report = json.load(f)
    rows = build(report)
    os.makedirs(DEST, exist_ok=True)
    with open(os.path.join(DEST, "review-queue.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ["url"])
        writer.writeheader()
        writer.writerows(rows)
    summary = [
        "# Public-site SEO review queue",
        "",
        "This is a read-only prioritisation aid, **not** a ranking or AI citation report.",
        "URL-derived topics are guesses for editorial review, not researched keywords.",
        "Google Search Console, GA4, AI visibility and conversions are not connected.",
        "",
        "| Page | Review priority |",
        "|---|---|"
    ]
    for r in rows:
        summary.append("| " + r["url"].replace("|", "%7C") + " | " + r["review_priority"] + " |")
    summary += ["", "## Before any change", "Verify search intent, existing business functionality and page purpose. Prepare a separate approved pull request; do not auto-publish, rewrite or deploy.", ""]
    with open(os.path.join(DEST, "review-queue.md"), "w", encoding="utf-8") as f: f.write("\n".join(summary))
    print("Generated", len(rows), "read-only review rows")

if __name__ == "__main__":
    main()
