"""Security, persistence and concurrency checks for the personal Work board."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.work_board import TaskStore, validate_task
from backend.tests.test_app import DashboardAuthTest
from backend.app import create_app


def sample():
    return {
        "title":"Fix LOPT catalogue refresh","project":"LOPT","notes":"Review overnight job output",
        "status":"todo","priority":"high","due_date":"2026-11-21"
    }


class TaskStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path=self.tmp.name+"/jobs.sqlite3"
        self.store=TaskStore(self.path)

    def test_create_move_reopen_and_conflict(self):
        t=self.store.create(sample())
        self.assertEqual(t["status"],"todo")
        self.assertEqual(t["revision"],1)
        edited=self.store.update(t["id"],{**sample(),"status":"in_progress"},1)
        self.assertEqual(edited["revision"],2)
        self.assertEqual(TaskStore(self.path).all()[0]["status"],"in_progress")
        with self.assertRaises(RuntimeError):
            self.store.update(t["id"],{**sample(),"status":"done"},1)
        self.store.delete(t["id"],2)
        self.assertEqual(self.store.all(),[])

    def test_rejects_unknown_fields_and_invalid_date(self):
        for item in (
            {**sample(),"notes":"x"*6001},
            {**sample(),"title":""},
            {**sample(),"priority":"urgent"},
            {**sample(),"status":"hidden"},
            {**sample(),"due_date":"2026-02-31"},
            {**sample(),"script":"danger"},
        ):
            with self.assertRaises(ValueError):
                validate_task(item)


class WorkBoardAuthTest(DashboardAuthTest):
    def setUp(self):
        super().setUp()
        self.env_db=patch.dict(os.environ,{"JOB_DATABASE":self.temp.name+"/jobs.sqlite3"})
        self.env_db.start()
        self.addCleanup(self.env_db.stop)
        self.app=create_app()
        self.app.testing=True
        self.app.config["TRUSTED_HOSTS"]=["localhost","ryanfitter.co.uk"]
        self.client=self.app.test_client()

    def test_anonymous_task_endpoints_are_locked(self):
        self.assertEqual(self.client.get("/admin/tasks").status_code,302)
        self.assertEqual(self.client.get("/admin/api/tasks").status_code,401)
        self.assertEqual(self.client.post("/admin/api/tasks",json=sample()).status_code,401)

    def test_authenticated_crud_and_csrf(self):
        self.assertEqual(self.mock_callback().status_code,303)
        self.assertEqual(self.client.get("/admin/tasks").status_code,200)
        self.assertEqual(self.client.get("/admin/api/tasks").json["tasks"],[])
        self.assertEqual(self.client.post("/admin/api/tasks",json=sample()).status_code,403)
        csrf=self.client.get("/admin/api/session").json["csrf"]
        headers={"Origin":"https://ryanfitter.co.uk","X-CSRF-Token":csrf}
        create=self.client.post("/admin/api/tasks",json=sample(),headers=headers)
        self.assertEqual(create.status_code,201,create.data)
        item=create.json["task"]
        update=self.client.put(f"/admin/api/tasks/{item['id']}",
           json={"revision":1,"task":{**sample(),"status":"done"}},headers=headers)
        self.assertEqual(update.status_code,200,update.data)
        self.assertEqual(update.json["task"]["status"],"done")
        stale=self.client.delete(f"/admin/api/tasks/{item['id']}",json={"revision":1},headers=headers)
        self.assertEqual(stale.status_code,409)
        done=self.client.delete(f"/admin/api/tasks/{item['id']}",json={"revision":2},headers=headers)
        self.assertEqual(done.status_code,204)
        self.assertEqual(self.client.get("/admin/api/tasks").json["tasks"],[])


if __name__=="__main__":
    unittest.main()
