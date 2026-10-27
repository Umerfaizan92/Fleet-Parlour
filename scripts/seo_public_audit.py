#!/usr/bin/env python3
"""Read-only SEO/AEO/GEO/AIO/SXO public-page audit. No external dependencies."""
import datetime
import html.parser
import json
import os
import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

BASE = os.environ["SEO_SITE_URL"].rstrip("/")
MAX_PAGES = min(int(os.environ.get("SEO_MAX_PAGES", "15")), 30)
class PageParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""; self.title_on = False
        self.h1 = []; self.h1_on = False
        self.description = ""; self.canonical = ""
        self.lang = ""; self.images = 0; self.images_missing_alt = 0
        self.links = []; self.jsonld = 0; self.questions = 0
        self.meta_robots = ""
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html": self.lang = a.get("lang", "")
        if tag == "title": self.title_on = True
        if tag == "h1":
            self.h1_on = True
            self.h1.append("")
        if tag == "img":
            self.images += 1
            if not a.get("alt", "").strip(): self.images_missing_alt += 1
        if tag == "a" and a.get("href"): self.links.append(a["href"])
        if tag == "script" and "ld+json" in a.get("type", "").lower(): self.jsonld += 1
        if tag == "link" and "canonical" in a.get("rel", "").lower(): self.canonical = a.get("href", "")
        if tag == "meta":
            name = a.get("name", "").lower()
            if name == "description": self.description = a.get("content", "")
            if name == "robots": self.meta_robots = a.get("content", "")
    def handle_endtag(self, tag):
        if tag == "title": self.title_on = False
        if tag == "h1": self.h1_on = False
    def handle_data(self, data):
        if self.title_on: self.title += data
        if self.h1_on and self.h1: self.h1[-1] += data

def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "PublicSEOAudit/1.0 (read-only)"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.status, response.headers.get("Content-Type", ""), response.read(700000).decode("utf-8", "replace")

def main():
    report = {"site": BASE, "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "pages": [], "warnings": [], "limits": "Public pages only; no Search Console, analytics, AI citations or conversion data. Heuristic findings require human verification."}
    urls = [BASE + "/"]
    try:
        _, _, sitemap = fetch(BASE + "/sitemap.xml")
        root = ET.fromstring(sitemap)
        found = [e.text.strip() for e in root.iter() if e.tag.endswith("}loc") or e.tag == "loc" if e.text]
        for url in found:
            p = urllib.parse.urlsplit(url)
            if p.netloc.lower() == urllib.parse.urlsplit(BASE).netloc.lower() and url not in urls and not url.lower().endswith(".xml"):
                urls.append(url)
    except Exception as e:
        report["warnings"].append("Sitemap unavailable or invalid: " + str(e)[:150])
    for url in urls[:MAX_PAGES]:
        item = {"url": url}
        try:
            status, content_type, body = fetch(url)
            item["status"] = status
            if "html" not in content_type.lower():
                item["warning"] = "Non-HTML response"
            else:
                p = PageParser(); p.feed(body)
                host = urllib.parse.urlsplit(BASE).netloc.lower()
                internal = [link for link in p.links if urllib.parse.urlsplit(urllib.parse.urljoin(url, link)).netloc.lower() == host and not link.startswith("#")]
                item.update(title=p.title.strip(), description_present=bool(p.description.strip()), h1_count=len(p.h1), canonical=p.canonical, html_lang=p.lang, images=p.images, images_missing_alt=p.images_missing_alt, jsonld_blocks=p.jsonld, internal_link_count=len(internal), meta_robots=p.meta_robots)
                issues = []
                if not p.title.strip(): issues.append("Missing title")
                if not p.description.strip(): issues.append("Missing meta description")
                if len(p.h1) != 1: issues.append("H1 count is not 1")
                if not p.lang: issues.append("Missing HTML lang")
                if p.images_missing_alt: issues.append("Images with missing or empty alt (decorative images may be intentional)")
                if not p.canonical: issues.append("No canonical link (not necessarily an error)")
                if "noindex" in p.meta_robots.lower(): issues.append("Page has noindex directive; verify intentional")
                item["review_flags"] = issues
        except Exception as e:
            item["error"] = str(e)[:200]
        report["pages"].append(item)
    os.makedirs("seo-audit-report", exist_ok=True)
    with open("seo-audit-report/report.json", "w") as f: json.dump(report, f, indent=2)
    print(json.dumps({"site": BASE, "pages_checked": len(report["pages"]), "pages_with_flags": sum(bool(x.get("review_flags") or x.get("error")) for x in report["pages"]), "report": "seo-audit-report/report.json"}, indent=2))

if __name__ == "__main__": main()
