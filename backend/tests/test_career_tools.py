"""Private CV vault and interview calendar tests."""
import io
import os
import tempfile
import unittest
import zipfile
from unittest.mock import patch

from backend.cv_vault import CvVault, validate_cv
from backend.interviews import InterviewStore, validate_event, to_ical
from backend.tests.test_jobs import JobsAndMediaAuthTest


def pdf():
    return b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def event():
    return {
        "title": "Interview — Ecommerce Manager", "company": "Retail Co",
        "start_at": "2026-07-21T10:30", "duration_minutes": 60,
        "kind": "video", "meeting_url": "https://meet.example.com/room",
        "location": "Teams", "notes": "Prepare Shopify examples",
        "job_id": None, "status": "scheduled",
    }


class VaultStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.vault = CvVault(self.tmp.name+"/files", self.tmp.name+"/jobs.sqlite3")

    def test_upload_default_replace_download_delete(self):
        from werkzeug.datastructures import FileStorage
        first = FileStorage(stream=io.BytesIO(pdf()), filename="Ryan CV.pdf")
        data = self.vault.upload(first, "Main CV")
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["is_primary"], 1)
        meta, path = self.vault.lookup(data[0]["id"])
        self.assertEqual(path.read_bytes(), pdf())
        self.assertEqual(meta["filename"], "Ryan-CV.pdf")
        second = FileStorage(stream=io.BytesIO(pdf()), filename="Tailored.pdf")
        docs = self.vault.upload(second, "Marketing version")
        self.assertEqual(len(docs), 2)
        new = next(d for d in docs if d["label"] == "Marketing version")
        self.vault.set_primary(new["id"])
        self.assertEqual(self.vault.list()[0]["label"], "Marketing version")
        self.vault.delete(new["id"])
        self.assertEqual(len(self.vault.list()), 1)
        self.assertEqual(self.vault.list()[0]["is_primary"], 1)

    def test_no_unsafe_uploads(self):
        for suffix, content in ((".svg", b"<svg/>"), (".pdf", b"not a pdf"),
                                (".docm", b"PK"), (".pdf", b"%PDF-invalid")):
            with self.subTest(suffix=suffix), self.assertRaises(ValueError):
                validate_cv(content, suffix)
        z=io.BytesIO()
        with zipfile.ZipFile(z,'w') as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", "<w:document/>")
        validate_cv(z.getvalue(), ".docx")


class InterviewStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store=InterviewStore(self.tmp.name+"/jobs.sqlite3")

    def test_crud_and_summer_time_ics(self):
        first=self.store.add(event())
        self.assertEqual(first["company"], "Retail Co")
        self.assertEqual(len(InterviewStore(self.store.path).list()), 1)
        ics=to_ical(self.store.list())
        self.assertIn("DTSTART:20260721T093000Z", ics)
        self.assertIn("DTEND:20260721T103000Z", ics)
        updated=self.store.update(first["id"], {**event(), "status":"completed"})
        self.assertEqual(updated["status"], "completed")
        self.store.delete(first["id"])
        self.assertEqual(self.store.list(), [])

    def test_invalid_meeting_url_rejected(self):
        with self.assertRaises(ValueError):
            validate_event({**event(), "meeting_url": "javascript:alert(1)"})
        with self.assertRaises(ValueError):
            validate_event({**event(), "start_at": "2026-02-30T10:30"})


class VaultCalendarApiTest(JobsAndMediaAuthTest):
    def setUp(self):
        super().setUp()
        self.cv_env=patch.dict(os.environ,{"CV_DIRECTORY": self.temp.name+"/cvs"})
        self.cv_env.start()
        self.addCleanup(self.cv_env.stop)
        from backend.app import create_app
        self.app=create_app()
        self.app.testing=True
        self.app.config['TRUSTED_HOSTS']=['localhost']
        self.client=self.app.test_client()

    def test_no_private_data_without_session(self):
        for endpoint in ("/admin/api/cvs","/admin/api/interviews",
                         "/admin/api/interviews/calendar.ics"):
            self.assertEqual(self.client.get(endpoint).status_code, 401)
        self.assertEqual(self.client.get("/admin/cvs").status_code,302)
        self.assertEqual(self.client.get("/admin/interviews").status_code,302)

    def test_cv_upload_and_authenticated_download(self):
        headers=self.auth_headers()
        upload=self.client.post("/admin/api/cvs",data={
            "label":"Main CV","file":(io.BytesIO(pdf()),"Ryan CV.pdf")},
            content_type="multipart/form-data",headers=headers)
        self.assertEqual(upload.status_code,201,upload.data)
        doc=upload.json["documents"][0]
        url="/admin/api/cvs/"+doc["id"]+"/download"
        response=self.client.get(url)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.data,pdf())
        self.assertIn('attachment',response.headers['Content-Disposition'])
        with self.client.session_transaction() as session:
            session.clear()
        self.assertEqual(self.client.get(url).status_code,401)

    def test_cannot_write_without_csrf_origin(self):
        headers=self.auth_headers()
        self.assertEqual(self.client.post("/admin/api/interviews",json=event()).status_code,403)
        self.assertEqual(self.client.post("/admin/api/cvs",data={
            "label":"Main","file":(io.BytesIO(pdf()),"Ryan.pdf")},
            content_type="multipart/form-data").status_code,403)
        result=self.client.post("/admin/api/interviews",json=event(),headers=headers)
        self.assertEqual(result.status_code,201,result.data)
        i=result.json["event"]["id"]
        self.assertEqual(len(self.client.get("/admin/api/interviews").json["events"]),1)
        self.assertIn(b"BEGIN:VCALENDAR",self.client.get("/admin/api/interviews/calendar.ics").data)
        self.assertEqual(self.client.put("/admin/api/interviews/"+str(i),json={
            **event(),"company":"New Company"},headers=headers).status_code,200)
        self.assertEqual(self.client.delete("/admin/api/interviews/"+str(i),headers=headers).status_code,204)
