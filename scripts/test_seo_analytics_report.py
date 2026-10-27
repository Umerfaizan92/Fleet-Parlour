import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location("seo_analytics_report",Path(__file__).with_name("seo_analytics_report.py"))
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class TestAnalytics(unittest.TestCase):
    def test_no_data_does_not_fabricate_metrics(self):
        r=mod.analyse([],[])
        self.assertEqual(r["opportunities"],[])
        self.assertEqual(len(r["limitations"]),2)
    def test_low_ctr_review(self):
        r=mod.analyse([{"Top pages":"https://example.com/a","Clicks":"1","Impressions":"200","CTR":"0.5%","Position":"8"}],[])
        self.assertIn("low observed CTR",r["opportunities"][0]["review"])
    def test_unknown_schema(self):
        r=mod.analyse([{"foo":"bar"}],[])
        self.assertEqual(r["opportunities"],[])
        self.assertIn("not recognised",r["limitations"][0])
if __name__=="__main__":unittest.main()
