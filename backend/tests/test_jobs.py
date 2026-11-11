"""Private application records and screenshot publication security tests."""
import copy
import io
import os
import struct
import tempfile
import unittest
import zlib
from unittest.mock import patch

from backend.tests import test_app as auth_tests
from backend.jobs import JobStore, validate_job
from backend.cms import DEFAULT


def sample():
    return {"company": "Example Retail", "title": "Remote Ecommerce Manager",
            "url": "https://example.org/careers/role-1", "workplace": "remote",
            "status": "saved", "notes": "Check role before applying."}


def png_image():
    def chunk(name, data):
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\x12\x34\x56")) + chunk(b"IEND", b""))


class JobStoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = JobStore(self.temp.name + "/jobs.sqlite3")

    def test_crud_revision_and_duplicate(self):
        record = self.store.create(sample())
        self.assertEqual(record["revision"], 1)
        self.assertEqual(record["status"], "saved")
        self.assertEqual(JobStore(self.store.path).all()[0]["title"], sample()["title"])
        with self.assertRaises(RuntimeError):
            self.store.create(sample())
        updated = self.store.update(record["id"], {**sample(), "status": "applied", "applied_at": "2026-11-11"}, 1)
        self.assertEqual(updated["revision"], 2)
        with self.assertRaises(RuntimeError):
            self.store.update(record["id"], sample(), 1)
        with self.assertRaises(RuntimeError):
            self.store.delete(record["id"], 1)
        self.store.delete(record["id"], 2)
        self.assertEqual(self.store.all(), [])

    def test_rejects_invalid_fields(self):
        for record in (
            {**sample(), "url": "javascript:alert(1)"},
            {**sample(), "url": "https://user:secret@example.org/"},
            {**sample(), "company": ""},
            {**sample(), "title": "<" * 201},
            {**sample(), "status": "admin"},
            {**sample(), "workplace": "space"},
            {**sample(), "applied_at": "2026-02-30"},
            {**sample(), "unknown_field": "irrelevant"},
        ):
            with self.subTest(record=record), self.assertRaises(ValueError):
                validate_job(record)


class JobsAndMediaAuthTest(auth_tests.DashboardAuthTest):
    def setUp(self):
        super().setUp()
        self.db_env = patch.dict(os.environ, {
            "JOB_DATABASE": self.temp.name + "/jobs.sqlite3",
            "CMS_DATABASE": self.temp.name + "/cms.sqlite3",
            "CMS_MEDIA_DIR": self.temp.name + "/media",
        })
        self.db_env.start()
        self.addCleanup(self.db_env.stop)
        from backend.app import create_app
        self.app = create_app()
        self.app.testing = True
        self.app.config["TRUSTED_HOSTS"] = ["localhost"]
        self.client = self.app.test_client()

    def auth_headers(self):
        self.mock_callback()
        csrf = self.client.get("/admin/api/session").json["csrf"]
        return {"X-CSRF-Token": csrf, "Origin": "https://ryanfitter.co.uk"}

    def test_anonymous_access_denied(self):
        self.assertEqual(self.client.get("/admin/jobs").status_code, 302)
        self.assertEqual(self.client.get("/admin/api/jobs").status_code, 401)
        self.assertEqual(self.client.post("/admin/api/jobs", json=sample()).status_code, 401)
        self.assertEqual(self.client.get("/admin/api/media").status_code, 401)

    def test_jobs_api_crud_and_csrf(self):
        headers = self.auth_headers()
        self.assertEqual(self.client.get("/admin/api/session").json["features"]["jobs"], "ready")
        self.assertEqual(self.client.post("/admin/api/jobs", json=sample()).status_code, 403)
        bad = self.client.post("/admin/api/jobs", json=sample(),
                               headers={"X-CSRF-Token": headers["X-CSRF-Token"],
                                        "Origin": "https://evil.invalid"})
        self.assertEqual(bad.status_code, 403)
        created = self.client.post("/admin/api/jobs", json=sample(), headers=headers)
        self.assertEqual(created.status_code, 201)
        job = created.json["job"]
        self.assertEqual(len(self.client.get("/admin/api/jobs").json["jobs"]), 1)
        duplicate = self.client.post("/admin/api/jobs", json=sample(), headers=headers)
        self.assertEqual(duplicate.status_code, 409)
        edit = self.client.put("/admin/api/jobs/" + str(job["id"]),
                               json={"revision": 1, "job": {**sample(), "status": "interview"}}, headers=headers)
        self.assertEqual(edit.status_code, 200)
        self.assertEqual(edit.json["job"]["revision"], 2)
        stale = self.client.put("/admin/api/jobs/" + str(job["id"]),
                               json={"revision": 1, "job": sample()}, headers=headers)
        self.assertEqual(stale.status_code, 409)
        gone = self.client.delete("/admin/api/jobs/" + str(job["id"]),
                                  json={"revision": 2}, headers=headers)
        self.assertEqual(gone.status_code, 204)
        self.assertEqual(self.client.get("/admin/api/jobs").json["jobs"], [])

    def test_media_private_until_published(self):
        headers = self.auth_headers()
        self.assertEqual(self.client.post("/admin/api/media", data={
            "file": (io.BytesIO(png_image()), "site.png")}, content_type="multipart/form-data").status_code, 403)
        upload = self.client.post("/admin/api/media", data={
            "file": (io.BytesIO(png_image()), "site.png")}, content_type="multipart/form-data", headers=headers)
        self.assertEqual(upload.status_code, 201)
        url = upload.json["url"]
        self.assertEqual(len(self.client.get("/admin/api/media").json["images"]), 1)
        self.assertEqual(self.client.get(url).status_code, 200)
        with self.client.session_transaction() as sess:
            sess.clear()
        self.assertEqual(self.client.get(url).status_code, 404)
        headers = self.auth_headers()
        draft = copy.deepcopy(DEFAULT)
        draft["sections"][0]["image"] = url
        saved = self.client.put("/admin/api/cms", json={"revision": 0, "document": draft}, headers=headers)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(self.client.post("/admin/api/cms/publish",
                                          json={"revision": 1}, headers=headers).status_code, 200)
        with self.client.session_transaction() as sess:
            sess.clear()
        public = self.client.get(url)
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.headers["Content-Type"], "image/png")
        self.assertEqual(public.headers["X-Content-Type-Options"], "nosniff")

    def test_rejects_non_raster_file(self):
        headers = self.auth_headers()
        result = self.client.post("/admin/api/media", data={
            "file": (io.BytesIO(b"<svg><script>alert(1)</script></svg>"), "bad.svg")},
            content_type="multipart/form-data", headers=headers)
        self.assertEqual(result.status_code, 400)


if __name__ == "__main__":
    unittest.main()
