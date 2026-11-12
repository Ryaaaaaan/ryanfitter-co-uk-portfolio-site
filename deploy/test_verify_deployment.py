"""Independent regression tests for exact-revision production validation."""
import importlib.util
import pathlib
import unittest
from datetime import datetime, timedelta, timezone


script = pathlib.Path(__file__).with_name("verify_deployment.py")
spec = importlib.util.spec_from_file_location("verify_deployment", script)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

SHA = "a" * 40
NOW = datetime(2026, 11, 12, 14, 0, tzinfo=timezone.utc)
HTML = '<!doctype html><html><head><meta name="site-build-revision" content="' + SHA + '"/></head></html>'


def marker():
    return {
        "schema_version": 1,
        "revision": SHA,
        "run_id": "1234",
        "run_attempt": 2,
        "deployed_at": NOW.isoformat(),
    }


class ProductionVerificationTests(unittest.TestCase):
    def test_exact_run_and_html_succeed(self):
        self.assertEqual(verify.validate_deployment(marker(), HTML, SHA, "1234", "2", now=NOW), NOW)

    def test_wrong_revision_fails(self):
        sample = marker()
        sample["revision"] = "b" * 40
        with self.assertRaisesRegex(ValueError, "revision mismatch"):
            verify.validate_deployment(sample, HTML, SHA, "1234", "2", now=NOW)

    def test_stale_run_or_rerun_fails(self):
        for run_id, attempt in [("1235", "2"), ("1234", "3")]:
            with self.subTest(run_id=run_id, attempt=attempt), self.assertRaisesRegex(ValueError, "different Actions run"):
                verify.validate_deployment(marker(), HTML, SHA, run_id, attempt, now=NOW)

    def test_html_build_mismatch_fails(self):
        with self.assertRaisesRegex(ValueError, "homepage HTML"):
            verify.validate_deployment(marker(), HTML.replace(SHA, "b" * 40), SHA, "1234", "2", now=NOW)

    def test_missing_build_meta_fails(self):
        with self.assertRaisesRegex(ValueError, "homepage HTML"):
            verify.validate_deployment(marker(), "<html></html>", SHA, "1234", "2", now=NOW)

    def test_stale_timestamp_fails(self):
        sample = marker()
        sample["deployed_at"] = (NOW - timedelta(hours=4)).isoformat()
        with self.assertRaisesRegex(ValueError, "not recent"):
            verify.validate_deployment(sample, HTML, SHA, "1234", "2", now=NOW)

    def test_naive_timestamp_fails(self):
        sample = marker()
        sample["deployed_at"] = "2026-11-12T14:00:00"
        with self.assertRaisesRegex(ValueError, "invalid deployment timestamp"):
            verify.validate_deployment(sample, HTML, SHA, "1234", "2", now=NOW)

    def test_invalid_marker_fails(self):
        with self.assertRaisesRegex(ValueError, "missing or invalid"):
            verify.validate_deployment({}, HTML, SHA, "1234", "2", now=NOW)


if __name__ == "__main__":
    unittest.main()
