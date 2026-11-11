"""Career profile scoring and scan-health contract tests.

Scores are transparent heuristic priorities, not employment eligibility decisions.
"""
import os
import tempfile
import unittest
from unittest.mock import patch

import requests

from backend.job_matches import (
    MatchStore, adzuna_jobs, normalize, reed_jobs, scan
)
from backend.job_profile import classify, profile, eligible_title


def vacancy():
    return normalize({
        "title": "Ecommerce Merchandising Manager",
        "company": "Retail Example",
        "apply_url": "https://example.com/careers/ecommerce-123",
        "description": "Manage 20,000 catalogue SKUs with Shopify, Akeneo, pricing, SEO and CRO.",
        "hours": "20–30 hours/week",
        "employment_type": "Part-time",
        "location": "UK remote",
        "source": "Himalayas",
        "warning": "Verify UK employment terms",
    })


class ProfileTests(unittest.TestCase):
    def test_strong_cv_and_lifestyle(self):
        p = profile(
            "Ecommerce Merchandising Manager",
            "Shopify, BigCommerce, Akeneo, pricing, SEO and product catalogue",
            "Part-time", "20–30 hours/week", "UK remote",
        )
        self.assertGreaterEqual(p["cv_score"], 75)
        self.assertGreaterEqual(p["lifestyle_score"], 80)
        self.assertIn("Ecommerce", p["role_tags"])
        self.assertIn("Merchandising", p["role_tags"])
        self.assertEqual(p["seniority"], "Managerial title")
        self.assertIn("unverified", p["remote_status"].lower())
        self.assertEqual(p["profile_version"], 3)

    def test_global_independent_contractors_are_not_overscored_as_uk_employment(self):
        global_contract = profile(
            "Jr. E-Commerce Assistant (Flex-Time) (Remote/Global)",
            "Independent contractor supporting Shopify online stores, ecommerce marketing, "
            "SEO, customer service and product inventory.",
            "Contractor", "5-15 hours/week", "Worldwide remote")
        self.assertEqual(global_contract["engagement_route"], "Independent contractor")
        self.assertTrue(global_contract["cross_border_review"])
        self.assertIn("Worldwide", global_contract["uk_eligibility"])
        self.assertLessEqual(global_contract["score"], 74)
        self.assertLessEqual(global_contract["lifestyle_score"], 78)
        self.assertTrue(any("invoicing" in e for e in global_contract["fit_evidence"]))
        same_role_in_uk = profile(
            "Jr. E-Commerce Assistant (Flex-Time)",
            "Shopify ecommerce marketing SEO and inventory management",
            "Part-time", "15 hours per week", "UK remote")
        self.assertFalse(same_role_in_uk["cross_border_review"])
        self.assertGreater(same_role_in_uk["lifestyle_score"], global_contract["lifestyle_score"])

    def test_explicit_non_uk_location_restriction_is_flagged(self):
        p = profile("Ecommerce Manager", "Shopify. Must be based in the United States.",
                    "Contract", "20 hours/week", "US only")
        self.assertTrue(p["uk_restricted"])
        self.assertLessEqual(p["score"],20)

    def test_ui_experience_not_oversold_as_ux(self):
        ux = profile("Ecommerce UX Executive", "Website redesign, CRO, user experience",
                     "Part-time", "", "UK remote")
        ui = profile("UI Designer", "Figma, design systems, Adobe XD",
                     "Part-time", "", "UK remote")
        self.assertIn("UI", ui["role_tags"])
        self.assertIn("UX", ux["role_tags"])
        self.assertLess(ui["cv_score"], ux["cv_score"])

    def test_office_constraint_dominates_lifestyle_score(self):
        remote = profile("Digital Marketing Manager", "SEO, Google Ads", "Part-time",
                         "20 hours per week", "UK remote")
        hybrid = profile("Digital Marketing Manager", "SEO, Google Ads. 3 days in office hybrid",
                         "Part-time", "20 hours per week", "UK remote")
        self.assertGreater(remote["lifestyle_score"], hybrid["lifestyle_score"])
        self.assertLessEqual(hybrid["lifestyle_score"], 34)
        self.assertLessEqual(hybrid["score"], 54)

    def test_office_day_count_penalty_scales(self):
        one = profile("Ecommerce Manager", "Shopify, one day in office", "Part-time",
                      "20 hours per week", "UK remote")
        three = profile("Ecommerce Manager", "Shopify, 3 days in office", "Part-time",
                        "20 hours per week", "UK remote")
        four = profile("Ecommerce Manager", "Shopify, 4 days in office", "Part-time",
                       "20 hours per week", "UK remote")
        self.assertGreater(one["lifestyle_score"], three["lifestyle_score"])
        self.assertGreater(three["lifestyle_score"], four["lifestyle_score"])
        self.assertEqual(three["office_days"], 3)
        self.assertIn("3 office day", three["remote_status"])

    def test_only_explicit_support_evidence(self):
        without = profile("Ecommerce Manager", "Shopify marketing",
                          "Contract", "", "UK remote")
        with_support = profile("Ecommerce Manager",
                               "Shopify marketing. Flexible working, reasonable adjustments available.",
                               "Contract", "", "UK remote")
        self.assertEqual(without["support_signals"], [])
        self.assertIn("Adjustments mentioned", with_support["support_signals"])
        self.assertIn("Flexible working mentioned", with_support["support_signals"])

    def test_broader_related_title_and_seniority(self):
        self.assertTrue(eligible_title("UX Researcher"))
        self.assertTrue(eligible_title("UI Designer"))
        self.assertFalse(eligible_title("Backend Infrastructure Engineer"))
        self.assertEqual(classify("Junior Ecommerce Assistant")[1], "Junior / entry")
        self.assertEqual(classify("Senior SEO Specialist")[1], "Senior / lead")
        self.assertEqual(classify("Head of Digital Marketing")[1], "Head / director")

    def test_full_time_not_assumed_part_time(self):
        p = profile("Ecommerce Trading Manager", "Shopify ecommerce",
                    "Full-time", "", "UK remote")
        self.assertLess(p["lifestyle_score"], 80)
        self.assertEqual(p["hours_fit"], "Full-time (hours unconfirmed)")


class HealthTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.store = MatchStore(self.dir.name + "/jobs.sqlite3")

    def test_old_and_new_and_saved_counts(self):
        item = vacancy()
        self.assertIsNotNone(item)
        source_info = [
            {"name": "Himalayas", "status": "success", "matched": 1, "detail": ""},
            {"name": "Reed", "status": "not_configured", "matched": 0, "detail": "Key required"},
        ]
        run = self.store.begin()
        first = self.store.finish(run, [item], [], 1, source_details=source_info)
        self.assertEqual(first["added"], 1)
        self.assertEqual(first["existing"], 0)
        self.store.state(item["key"], "saved")
        run2 = self.store.begin()
        repeat = self.store.finish(run2, [item], [], 1, source_details=source_info)
        self.assertEqual(repeat["added"], 0)
        self.assertEqual(repeat["existing"], 1)
        self.assertEqual(repeat["saved_seen"], 1)
        response = self.store.list()
        self.assertEqual(response["total_saved"], 1)
        self.assertEqual(response["scan"]["sources"][1]["status"], "not_configured")
        self.assertEqual(response["history"][0]["saved_seen"], 1)
        self.assertEqual(len(response["history"]), 2)
        self.assertEqual(response["matches"][0]["cv_score"], item["cv_score"])

    def test_unconfigured_sources_are_not_treated_as_errors(self):
        with patch.dict(os.environ, {"REED_API_KEY": "", "ADZUNA_APP_ID": "",
                                     "ADZUNA_APP_KEY": ""}), \
             patch("backend.job_matches.himalayas_jobs", return_value=[]), \
             patch("backend.job_matches.remotive_jobs", return_value=[]), \
             patch("backend.job_matches.jobicy_jobs", return_value=[]):
            r = scan(self.store)
        self.assertEqual(r["status"], "success")
        self.assertEqual(r["added"], 0)
        self.assertEqual(len(r["sources"]), 5)
        self.assertEqual(r["sources"][3]["status"], "not_configured")
        self.assertEqual(r["sources"][4]["status"], "not_configured")

    def test_sensitive_query_error_is_not_leaked(self):
        with patch.dict(os.environ, {"REED_API_KEY": "", "ADZUNA_APP_ID": "id",
                                     "ADZUNA_APP_KEY": "PRIVATE_KEY_DO_NOT_PRINT"}), \
             patch("backend.job_matches.himalayas_jobs", return_value=[]), \
             patch("backend.job_matches.remotive_jobs", return_value=[]), \
             patch("backend.job_matches.jobicy_jobs", return_value=[]), \
             patch("backend.job_matches.adzuna_jobs",
                   side_effect=requests.HTTPError("PRIVATE_KEY_DO_NOT_PRINT in URL")):
            result = scan(self.store)
        self.assertEqual(result["status"], "partial")
        self.assertNotIn("PRIVATE_KEY_DO_NOT_PRINT", str(result))
        self.assertNotIn("PRIVATE_KEY_DO_NOT_PRINT", str(self.store.list()["scan"]))


class CredentialledSourcesTests(unittest.TestCase):
    def test_reed_requires_remote_evidence_and_key(self):
        class MockResponse:
            def raise_for_status(self): pass
            def json(self):
                return {"results": [
                    {"jobTitle": "Ecommerce UX Manager", "employerName": "UK Retail",
                     "jobUrl": "https://www.reed.co.uk/jobs/abc/123",
                     "locationName": "UK", "jobDescription": "Shopify remote working, SEO",
                     "partTime": True},
                    {"jobTitle": "Ecommerce UX Manager", "employerName": "Local Office",
                     "jobUrl": "https://www.reed.co.uk/jobs/def/456",
                     "locationName": "London", "jobDescription": "Office based five days",
                     "fullTime": True},
                ]}
        with patch.dict(os.environ, {"REED_API_KEY": "fixture"}), \
             patch("backend.job_matches.requests.get", return_value=MockResponse()) as api:
            rows = reed_jobs()
        self.assertEqual(len(rows), 5)  # one relevant remote job per search keyword
        self.assertTrue(all(x["company"] == "UK Retail" for x in rows))
        self.assertEqual(api.call_args.kwargs["auth"], ("fixture", ""))

    def test_adzuna_credentials_are_only_sent_to_official_api(self):
        class MockResponse:
            def raise_for_status(self): pass
            def json(self):
                return {"results": [{
                    "title": "Digital Marketing Executive",
                    "company": {"display_name": "UK Agency"},
                    "location": {"display_name": "United Kingdom"},
                    "description": "Remote PPC SEO digital marketing 20 hours per week",
                    "redirect_url": "https://www.adzuna.co.uk/jobs/abc123",
                    "salary_min": 25000, "salary_max": 35000,
                }]}
        with patch.dict(os.environ, {"ADZUNA_APP_ID":"fixture-id", "ADZUNA_APP_KEY":"fixture-key"}), \
             patch("backend.job_matches.requests.get", return_value=MockResponse()) as api:
            rows = adzuna_jobs()
        self.assertEqual(len(rows), 4)
        self.assertEqual(api.call_args.args[0], "https://api.adzuna.com/v1/api/jobs/gb/search/1")
        self.assertEqual(api.call_args.kwargs["params"]["app_key"], "fixture-key")


if __name__ == "__main__":
    unittest.main()
