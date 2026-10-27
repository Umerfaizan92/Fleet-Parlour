import json
import tempfile
import unittest
from pathlib import Path
import importlib.util

spec = importlib.util.spec_from_file_location("seo_review_queue", str(Path(__file__).with_name("seo_review_queue.py")))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestQueue(unittest.TestCase):
    def test_no_invented_metrics(self):
        rows = mod.build({"pages": [{"url": "https://example.com/truck-polishing-perth.html", "review_flags": ["Missing title"]}]})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["verified_organic_clicks"], "NOT CONNECTED")
        self.assertIn("Missing title", rows[0]["seo_review"])
        self.assertIn("truck polishing perth", rows[0]["candidate_topic_from_url_not_keyword_research"])
    def test_empty_report(self):
        self.assertEqual(mod.build({"pages": []}), [])
    def test_fetch_error(self):
        rows = mod.build({"pages": [{"url": "https://example.com/", "error": "timeout"}]})
        self.assertEqual(rows[0]["review_priority"], "Check access/error")

if __name__ == "__main__":
    unittest.main()
