#!/usr/bin/env python3
"""Offline GSC/GA4 CSV export analysis. No credentials, network calls, or production writes."""
import csv
import json
import os
from collections import defaultdict
from pathlib import Path

INPUT = Path("seo-analytics-input")
OUTPUT = Path("seo-analytics-report")
def number(v):
    try: return float(str(v or "0").replace(",", "").replace("%", "").strip())
    except ValueError: return 0.0

def load_csv(path):
    if not path.is_file(): return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def analyse(gsc, ga4):
    issues = []
    pages = []
    if gsc:
        keys = set(gsc[0])
        if not {"Clicks", "Impressions", "CTR", "Position"}.issubset(keys):
            issues.append("GSC export columns not recognised. Expected Clicks, Impressions, CTR, Position.")
        else:
            for row in gsc:
                impressions = number(row.get("Impressions"))
                clicks = number(row.get("Clicks"))
                pos = number(row.get("Position"))
                label = row.get("Top pages") or row.get("Page") or row.get("Top queries") or row.get("Query") or "(unlabelled)"
                if impressions >= 100 and clicks / max(impressions, 1) < 0.02:
                    opportunity = "Review search snippet and intent (low observed CTR)"
                elif impressions >= 100 and 5 <= pos <= 20:
                    opportunity = "Review relevance and on-page quality (position 5–20)"
                else:
                    opportunity = "Monitor"
                pages.append({"dimension": label, "clicks": clicks, "impressions": impressions, "position": pos, "review": opportunity})
    else:
        issues.append("No GSC CSV provided; search performance is unverified.")
    if not ga4:
        issues.append("No GA4 CSV provided; conversion performance is unverified.")
    return {"gsc_rows": len(gsc), "ga4_rows": len(ga4), "opportunities": pages, "limitations": issues, "note": "Offline export review only. CSV rows may represent queries or pages; no causal or ranking claims. GA4 values are not interpreted until schema and conversions are verified."}

def main():
    gsc = load_csv(INPUT / "gsc.csv")
    ga4 = load_csv(INPUT / "ga4.csv")
    result = analyse(gsc, ga4)
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / "analytics-opportunities.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    with (OUTPUT / "analytics-opportunities.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["dimension", "clicks", "impressions", "position", "review"])
        w.writeheader(); w.writerows(result["opportunities"])
    print(json.dumps({"gsc_rows": result["gsc_rows"], "ga4_rows": result["ga4_rows"], "limitations": result["limitations"]}, indent=2))
if __name__ == "__main__": main()
