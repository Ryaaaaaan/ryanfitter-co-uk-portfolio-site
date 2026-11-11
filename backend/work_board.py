"""Authenticated personal work board, separate from job applications and CVs.

SQLite records live in the existing private jobs database and are never served
to the public website. Revision checks protect against stale edits on devices.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path

STATUSES = ("todo", "in_progress", "blocked", "done")
PRIORITIES = ("low", "normal", "high")
FIELDS = {"title": 220, "project": 80, "notes": 6000, "due_date": 10}
DEFAULTS = {"title": "", "project": "Personal", "notes": "", "due_date": "",
            "status": "todo", "priority": "normal"}


def validate_task(raw):
    if not isinstance(raw, dict):
        raise ValueError("A task record is required.")
    if set(raw) - set(DEFAULTS):
        raise ValueError("Unknown task fields.")
    item = {**DEFAULTS, **raw}
    for field, length in FIELDS.items():
        value = item[field]
        if not isinstance(value, str) or len(value) > length:
            raise ValueError(f"{field} must be text no longer than {length} characters.")
        item[field] = value.strip()
    if not item["title"]:
        raise ValueError("Task title is required.")
    if not item["project"]:
        item["project"] = "Personal"
    if item["status"] not in STATUSES:
        raise ValueError("Unknown task status.")
    if item["priority"] not in PRIORITIES:
        raise ValueError("Unknown task priority.")
    if item["due_date"]:
        try:
            if date.fromisoformat(item["due_date"]).isoformat() != item["due_date"]:
                raise ValueError()
        except ValueError:
            raise ValueError("Due date must be a valid YYYY-MM-DD date.") from None
    return item


class TaskStore:
    def __init__(self, path):
        self.path = Path(path)

    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=12)
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS personal_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )""")
        db.commit()
        return db

    @staticmethod
    def record(row):
        return {"id": row["id"], **json.loads(row["data"]),
                "revision": row["revision"],
                "created_at": row["created_at"], "updated_at": row["updated_at"]}

    def all(self):
        with self.connect() as db:
            rows = db.execute("SELECT * FROM personal_tasks ORDER BY updated_at DESC, id DESC LIMIT 2000")
            return [self.record(row) for row in rows.fetchall()]

    def create(self, payload):
        data = validate_task(payload)
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            cursor = db.execute("INSERT INTO personal_tasks(data,created_at,updated_at) VALUES(?,?,?)",
                                (json.dumps(data), now, now))
            db.commit()
            row = db.execute("SELECT * FROM personal_tasks WHERE id=?", (cursor.lastrowid,)).fetchone()
            return self.record(row)

    def update(self, task_id, payload, revision):
        data = validate_task(payload)
        if type(revision) is not int or revision < 1:
            raise ValueError("A valid revision is required.")
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            cursor = db.execute(
                "UPDATE personal_tasks SET data=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?",
                (json.dumps(data), now, task_id, revision))
            if cursor.rowcount != 1:
                raise RuntimeError("Task has changed or no longer exists. Reload before editing.")
            row = db.execute("SELECT * FROM personal_tasks WHERE id=?", (task_id,)).fetchone()
            db.commit()
            return self.record(row)

    def delete(self, task_id, revision):
        if type(revision) is not int or revision < 1:
            raise ValueError("A valid revision is required.")
        with self.connect() as db:
            cursor = db.execute("DELETE FROM personal_tasks WHERE id=? AND revision=?", (task_id, revision))
            if cursor.rowcount != 1:
                raise RuntimeError("Task has changed or no longer exists. Reload before deleting.")
            db.commit()
