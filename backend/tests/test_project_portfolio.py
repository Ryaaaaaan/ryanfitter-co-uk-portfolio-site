"""Portfolio persistence, automatic one-off seeding, editability and auth regressions."""
import os
import tempfile
import unittest
from unittest.mock import patch

from backend.project_portfolio import ProjectStore, validate_project, STARTER
from backend.project_starter import PROJECT_DETAILS
from backend.tests.test_app import DashboardAuthTest
from backend.app import create_app


def sample():
    return {
        "title": "A custom new project", "category": "New custom category", "priority": "P2",
        "status": "active", "hours_low": 10, "hours_high": 30,
        "cost_low": 0, "cost_high": 150, "due_date": "2027-02-18",
        "next_step": "Complete a real milestone", "benefit": "Save time",
        "later": "Maybe add automation", "notes": "Keep this private",
        "checklist": [
            {"id": "step_a", "text": "First step", "done": False, "due_date": "2027-01-12"},
            {"id": "step_b", "text": "Second step", "done": True, "due_date": ""}
        ],
    }


class ProjectStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = ProjectStore(self.tmp.name + "/jobs.sqlite3")

    def test_all_seed_entries_present_with_real_milestones(self):
        self.assertEqual(len(STARTER), 46)
        self.assertEqual(len(PROJECT_DETAILS), 46)
        projects = self.store.all()
        self.assertEqual(len(projects), 46)
        self.assertEqual(len(set(p["title"] for p in projects)), 46)
        self.assertTrue(all(p["next_step"] and p["benefit"] and p["later"] for p in projects))
        self.assertTrue(all(len(p["checklist"]) == 3 for p in projects))
        self.assertEqual(self.store.ensure_starter()["added"], 0)
        self.assertEqual(len(ProjectStore(self.store.path).all()), 46)

    def test_create_custom_project_and_edit_checklist_with_deadline(self):
        self.store.all()
        created = self.store.create(sample())
        self.assertEqual(created["revision"], 1)
        self.assertEqual(created["due_date"], "2027-02-18")
        self.assertEqual(len(self.store.all()), 47)
        edited = self.store.update(
            created["id"],
            {**sample(), "priority": "P0", "due_date": "2027-03-05",
             "checklist": [
                 {"id": "step_a", "text": "Renamed first", "done": True, "due_date": "2027-02-20"}
             ]},
            1,
        )
        self.assertEqual(edited["priority"], "P0")
        self.assertEqual(edited["checklist"][0]["text"], "Renamed first")
        self.assertEqual(edited["checklist"][0]["due_date"], "2027-02-20")
        with self.assertRaises(RuntimeError):
            self.store.update(created["id"], sample(), 1)
        self.store.delete(created["id"], 2)

    def test_deleted_seed_is_not_recreated_without_explicit_restore(self):
        p = self.store.all()[0]
        self.store.delete(p["id"], p["revision"])
        self.assertEqual(len(self.store.all()), 45)
        restored = self.store.import_starter()
        self.assertEqual(restored["added"], 1)
        self.assertEqual(len(self.store.all()), 46)

    def test_default_tabs_legacy_mapping_and_safe_editing(self):
        entries = self.store.all()
        self.assertEqual(len(entries), 46)
        self.assertTrue(any(p["board_id"] == "lopt" for p in entries))
        self.assertTrue(any(p["board_id"] == "lofty" for p in entries))
        tabs = self.store.tabs()
        self.assertIn("5limes", [t["id"] for t in tabs["tabs"]])
        new_tabs = [*tabs["tabs"][:-1], {"id": "special", "name": "Custom"}, tabs["tabs"][-1]]
        saved = self.store.save_tabs(new_tabs, 1)
        self.assertEqual(saved["revision"], 2)
        self.assertEqual(self.store.tabs()["tabs"][-2]["name"], "Custom")
        with self.assertRaises(RuntimeError):
            self.store.save_tabs(new_tabs, 1)
        self.assertEqual(self.store.create({**sample(), "board_id": "special"})["board_id"], "special")
        with self.assertRaises(ValueError):
            self.store.save_tabs([t for t in saved["tabs"] if t["id"] != "special"], 2)
        with self.assertRaises(ValueError):
            self.store.create({**sample(), "board_id": "unknown_tab"})
        # A stale legacy record can still be read, edited and ticked off without data loss.
        p = entries[0]
        revised = self.store.update(p["id"], {
            "title": p["title"], "category": p["category"], "board_id": p["board_id"],
            "priority": p["priority"], "status": "done",
            "hours_low": p["hours_low"], "hours_high": p["hours_high"],
            "cost_low": p["cost_low"], "cost_high": p["cost_high"],
            "due_date": p["due_date"], "benefit": p["benefit"],
            "next_step": p["next_step"], "later": p["later"], "notes": p["notes"],
            "checklist": p["checklist"]
        }, p["revision"])
        self.assertEqual(revised["board_id"], p["board_id"])

    def test_bad_data_rejected(self):
        invalid = [
            {**sample(), "due_date": "2027-02-30"},
            {**sample(), "hours_high": 1},
            {**sample(), "cost_low": 200},
            {**sample(), "priority": "secret"},
            {**sample(), "name": "unexpected"},
            {**sample(), "checklist": [{"id": "a", "text": "A", "done": False, "due_date": "wrong"}]},
            {**sample(), "checklist": [{"id": "x", "text": "A", "done": False},
                                       {"id": "x", "text": "B", "done": False}]},
        ]
        for payload in invalid:
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    validate_project(payload)


class ProjectSecurityTest(DashboardAuthTest):
    def setUp(self):
        super().setUp()
        self.db_patch = patch.dict(os.environ, {"JOB_DATABASE": self.temp.name + "/jobs.sqlite3"})
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.app = create_app()
        self.app.testing = True
        self.app.config["TRUSTED_HOSTS"] = ["localhost", "ryanfitter.co.uk"]
        self.client = self.app.test_client()

    def test_unauthenticated_project_routes_are_private(self):
        self.assertEqual(self.client.get("/admin/projects").status_code, 302)
        self.assertEqual(self.client.get("/admin/api/projects").status_code, 401)
        self.assertEqual(self.client.post("/admin/api/projects", json=sample()).status_code, 401)
        self.assertEqual(self.client.post("/admin/api/projects/import-starter", json={}).status_code, 401)

    def test_tab_api_protected_editable_and_conflict_checked(self):
        self.assertEqual(self.client.get("/admin/api/project-tabs").status_code, 401)
        self.assertEqual(self.client.put("/admin/api/project-tabs", json={}).status_code, 401)
        self.assertEqual(self.mock_callback().status_code, 303)
        initial = self.client.get("/admin/api/project-tabs").json
        self.assertEqual(initial["revision"], 1)
        self.assertEqual(self.client.put("/admin/api/project-tabs", json={
            "revision": 1, "tabs": initial["tabs"]}).status_code, 403)
        csrf = self.client.get("/admin/api/session").json["csrf"]
        headers = {"Origin": "https://ryanfitter.co.uk", "X-CSRF-Token": csrf}
        changed = [*initial["tabs"], {"id": "new_tab", "name": "New workstream"}]
        edited = self.client.put("/admin/api/project-tabs", headers=headers,
            json={"revision": 1, "tabs": changed})
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(edited.json["tabs"][-1]["id"], "new_tab")
        stale = self.client.put("/admin/api/project-tabs", headers=headers,
            json={"revision": 1, "tabs": changed})
        self.assertEqual(stale.status_code, 409)
        bad = self.client.put("/admin/api/project-tabs", headers=headers,
            json={"revision": 2, "tabs": [{**changed[0], "id": "BAD SPACE"}]})
        self.assertEqual(bad.status_code, 400)

    def test_authenticated_project_crud_csrf_and_versions(self):
        self.assertEqual(self.mock_callback().status_code, 303)
        response = self.client.get("/admin/api/projects")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json["projects"]), 46)
        self.assertEqual(self.client.post("/admin/api/projects", json=sample()).status_code, 403)
        csrf = self.client.get("/admin/api/session").json["csrf"]
        headers = {"Origin": "https://ryanfitter.co.uk", "X-CSRF-Token": csrf}
        res = self.client.post("/admin/api/projects", json=sample(), headers=headers)
        self.assertEqual(res.status_code, 201, res.data)
        p = res.json["project"]
        self.assertEqual(p["category"], "New custom category")
        upd = self.client.put(f"/admin/api/projects/{p['id']}", headers=headers,
            json={"revision": p["revision"], "project": {**sample(), "status": "done"}})
        self.assertEqual(upd.status_code, 200, upd.data)
        self.assertEqual(upd.json["project"]["status"], "done")
        stale = self.client.delete(f"/admin/api/projects/{p['id']}",
            headers=headers, json={"revision": 1})
        self.assertEqual(stale.status_code, 409)
        ok = self.client.delete(f"/admin/api/projects/{p['id']}",
            headers=headers, json={"revision": 2})
        self.assertEqual(ok.status_code, 204)
        self.assertEqual(self.client.get("/admin/projects").status_code, 200)
