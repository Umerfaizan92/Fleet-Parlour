"""Offline tests for the public HTML parser; no live network needed."""
import importlib.util
import os
from pathlib import Path
import unittest
os.environ.setdefault("SEO_SITE_URL","https://example.com")
spec=importlib.util.spec_from_file_location("seo_public_audit",Path(__file__).with_name("seo_public_audit.py"))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class ParserTests(unittest.TestCase):
    def test_nested_h1_counts_once(self):
        p=mod.PageParser()
        p.feed('<html lang="en"><h1>Truck <span>polishing</span> Perth</h1></html>')
        self.assertEqual(len(p.h1),1)
        self.assertEqual(p.h1[0],"Truck polishing Perth")
    def test_two_h1_elements(self):
        p=mod.PageParser()
        p.feed("<h1>First</h1><h1>Second</h1>")
        self.assertEqual(len(p.h1),2)
    def test_metadata_and_alt(self):
        p=mod.PageParser()
        p.feed('<html lang="en"><head><title>Page</title><meta name="description" content="Summary"><link rel="canonical" href="https://example.com/"></head><body><img src="a.jpg" alt="A truck"><img src="b.jpg"></body></html>')
        self.assertEqual(p.title,"Page")
        self.assertEqual(p.images_missing_alt,1)
        self.assertEqual(p.canonical,"https://example.com/")
if __name__=="__main__": unittest.main()
