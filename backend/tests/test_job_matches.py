"""Scanned job match persistence, filtering and authenticated actions."""
import os
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from backend.job_matches import MatchStore, normalize, score_match, scan
from backend.tests.test_jobs import JobsAndMediaAuthTest


def match(title="Ecommerce Merchandising Manager", company="Demo Retail"):
    return normalize({
        "title": title, "company": company,
        "apply_url": "https://remotive.com/remote-jobs/marketing/demo-role-123",
        "description": "Shopify, product catalogue, pricing, promotions, Akeneo and SEO.",
        "source": "Remotive", "employment_type": "Part-time",
        "location": "United Kingdom", "confidence": "review",
    })


class MatchStoreTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.store = MatchStore(self.directory.name + "/jobs.sqlite3")

    def test_previous_search_recommendations_preloaded(self):
        result = self.store.list()
        self.assertEqual(len(result["matches"]), 3)
        self.assertTrue(any(m["company"] == "Recruitment Juice" for m in result["matches"]))
        self.assertIsNone(result["scan"])

    def test_dedupe_keeps_human_decisions_and_records_scan(self):
        item = match()
        self.assertIsNotNone(item)
        first = self.store.begin()
        summary = self.store.finish(first, [item], [], 1)
        self.assertEqual(summary["added"], 1)
        self.store.state(item["key"], "dismissed")
        second = self.store.begin()
        summary2 = self.store.finish(second, [item], [], 1)
        self.assertEqual(summary2["added"], 0)
        self.assertNotIn(item["key"], [r["key"] for r in self.store.list()["matches"]])
        self.assertEqual(self.store.get(item["key"])["state"], "dismissed")
        self.assertEqual(self.store.list()["scan"]["status"], "success")

    def test_parallel_scan_rejected(self):
        self.store.begin()
        with self.assertRaises(RuntimeError):
            self.store.begin()

    def test_matching_filters_ineligible_titles(self):
        self.assertIsNone(score_match("Backend Software Engineer", "Shopify SEO", "Full Time", "", "review"))
        self.assertIsNone(score_match("Chief Marketing Officer", "Shopify", "Part Time", "20 hours/week", "review"))
        self.assertIsNotNone(match())

    def test_saved_himalayas_matches_are_rescored_without_resetting_state(self):
        original = normalize({
            "title": "Ecommerce Marketing Manager",
            "company": "Worldwide Employer",
            "apply_url": "https://himalayas.app/companies/employer/jobs/ecommerce",
            "source": "Himalayas",
            "location": "Worldwide remote",
            "employment_type": "Part-time",
            "hours": "20 hours/week",
            "description": "Shopify, Akeneo, SEO, email, marketing, merchandising",
        })
        self.assertIsNotNone(original)
        old = {**original, "profile_version": 3, "score": 96}
        run = self.store.begin()
        self.store.finish(run, [old], [], 1)
        self.store.state(old["key"], "saved")
        visible = self.store.get(old["key"])
        self.assertEqual(visible["state"], "saved")
        self.assertEqual(visible["profile_version"], 4)
        self.assertEqual(visible["uk_group"], "worldwide")
        self.assertLessEqual(visible["score"], 74)
        self.assertEqual(len(self.store.list()["matches"]), 4)  # 3 seed jobs + saved match
        # Re-scoring for display must not overwrite the stored vacancy or
        # erase a human decision made before the scoring policy changed.
        with self.store.connect() as db:
            import json
            row = db.execute("SELECT data,state FROM job_matches WHERE key=?", (old["key"],)).fetchone()
            self.assertEqual(json.loads(row["data"])["score"], 96)
            self.assertEqual(row["state"], "saved")

    def test_provider_failure_recorded_without_fabricated_jobs(self):
        with patch("backend.job_matches.himalayas_jobs", side_effect=ValueError("rate limited")), \
             patch("backend.job_matches.remotive_jobs", return_value=[]), \
             patch("backend.job_matches.jobicy_jobs", return_value=[]):
            result = scan(self.store)
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["added"], 0)
        self.assertIn("Himalayas", result["errors"][0])

    def test_weaker_but_relevant_roles_can_be_explored(self):
        from backend.job_matches import score_match
        score = score_match("Digital Marketing Manager", "Basic email campaigns", "Full-time", "", "review")
        self.assertIsNotNone(score)
        self.assertLess(score, 65)

    def test_jobicy_public_feed_parsing(self):
        from backend.job_matches import jobicy_jobs
        class Reply:
            def raise_for_status(self): pass
            def json(self):
                return {"jobs": [{
                    "jobTitle": "Ecommerce Content Manager",
                    "companyName": "Sample UK Remote Shop",
                    "url": "https://jobicy.com/jobs/sample-uk-123",
                    "jobGeo": "Europe",
                    "jobType": ["Part-Time"],
                    "jobDescription": "<p>Shopify SEO ecommerce merchandising</p>",
                    "salaryMin": 20000, "salaryMax": 25000,
                    "salaryCurrency": "GBP", "salaryPeriod": "yearly",
                    "pubDate": "2026-11-11T09:00:00+00:00"
                }, {
                    "jobTitle": "Ecommerce Content Manager",
                    "companyName": "US Restricted",
                    "url": "https://jobicy.com/jobs/sample-us-123",
                    "jobGeo": "USA",
                    "jobType": ["Full-Time"],
                    "jobDescription": "<p>Shopify</p>",
                }]}
        with patch("backend.job_matches.requests.get", return_value=Reply()):
            rows = jobicy_jobs()
        self.assertEqual(len(rows), 2)  # Europe result is duplicated across two geo requests
        self.assertEqual(rows[0]["company"], "Sample UK Remote Shop")
        self.assertEqual(rows[0]["source"], "Jobicy")
        self.assertIn("£20,000", rows[0]["salary"])

    def test_himalayas_gb_eligibility_is_separate_from_worldwide_and_timezone(self):
        from backend.job_matches import himalayas_jobs
        now_stamp = int(datetime.now(timezone.utc).timestamp())
        def job(company, country, zones):
            return {
                "title": "Digital Marketing Executive", "companyName": company,
                "description": "Remote SEO ecommerce and Shopify customer journeys",
                "applicationLink": "https://himalayas.app/companies/test/jobs/" + company.lower(),
                "employmentType": "Part Time", "pubDate": now_stamp,
                "locationRestrictions": country, "timezoneRestrictions": zones,
            }
        class Reply:
            def raise_for_status(self): pass
            def json(self):
                return {"jobs":[
                    job("UKListed", [{"alpha2":"GB"},{"alpha2":"US"}], ["UTC+00:00"]),
                    job("Worldwide", [], ["UTC-05:00"]),
                    job("USOnly", [{"alpha2":"US"}], []),
                ]}
        with patch("backend.job_matches.SEARCH_TERMS", ("ecommerce",)), \\
             patch("backend.job_matches.requests.get", return_value=Reply()):
            found = himalayas_jobs()
        self.assertEqual(len(found), 2)
        listed, global_job = found
        self.assertEqual(listed["uk_group"], "uk_listed")
        self.assertEqual(global_job["uk_group"], "worldwide")
        self.assertIn("GB listed", listed["location"])
        self.assertIn("not", global_job["uk_eligibility"].lower())
        self.assertIn("timezone", global_job["warning"].lower())
        self.assertNotIn("timezone", listed["warning"].lower())
        self.assertLess(global_job["score"], listed["score"])

    def test_remote_uk_country_filter(self):
        date_stamp = int(datetime.now(timezone.utc).timestamp())
        base = {
            "title": "Ecommerce Merchandising Manager", "companyName": "Company A",
            "applicationLink": "https://himalayas.app/companies/a/jobs/ecommerce-manager",
            "description": "Shopify SEO CRM product data", "employmentType": "Part Time",
            "pubDate": date_stamp,
        }
        class Reply:
            def raise_for_status(self):
                pass
            def json(self):
                return {"jobs": [
                    {**base, "locationRestrictions": [{"alpha2": "US"}]},
                    {**base, "locationRestrictions": [{"alpha2": "GB"}]}
                ]}
        with patch("backend.job_matches.SEARCH_TERMS", ("ecommerce",)), \
             patch("backend.job_matches.requests.get", return_value=Reply()):
            from backend.job_matches import himalayas_jobs
            found = himalayas_jobs()
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["company"], "Company A")
        self.assertEqual(found[0]["source"], "Himalayas")


class JobMatchesAuthTest(JobsAndMediaAuthTest):
    def test_private_matches_and_save(self):
        self.assertEqual(self.client.get("/admin/api/job-matches").status_code, 401)
        self.assertEqual(self.client.get("/admin/job-matches").status_code, 302)
        headers = self.auth_headers()
        source = self.client.get("/admin/api/job-matches")
        self.assertEqual(source.status_code, 200)
        self.assertEqual(len(source.json["matches"]), 3)
        key = source.json["matches"][0]["key"]
        route = "/admin/api/job-matches/" + key + "/action"
        self.assertEqual(self.client.post(route, json={"action": "save"}).status_code, 403)
        saved = self.client.post(route, json={"action": "save"}, headers=headers)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(len(self.client.get("/admin/api/jobs").json["jobs"]), 1)
        self.assertEqual(self.client.post(route, json={"action": "save"}, headers=headers).status_code, 200)
        self.assertEqual(len(self.client.get("/admin/api/jobs").json["jobs"]), 1)

    def test_manual_scan_requires_authentication_csrf(self):
        self.assertEqual(self.client.post("/admin/api/job-scans", json={}).status_code, 401)
        headers = self.auth_headers()
        self.assertEqual(self.client.post("/admin/api/job-scans", json={}).status_code, 403)
        with patch("backend.app.Thread") as thread:
            response = self.client.post("/admin/api/job-scans", json={}, headers=headers)
            self.assertEqual(response.status_code, 202)
            self.assertEqual(response.json["status"], "running")
            thread.return_value.start.assert_called_once()
        with patch("backend.app.Thread"):
            self.assertEqual(self.client.post("/admin/api/job-scans", json={}, headers=headers).status_code, 409)


if __name__ == "__main__":
    unittest.main()
