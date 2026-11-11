"""Private job application tracking, scoped to the authenticated dashboard.

This deliberately has no job-board scraper or external feed access. Records are
entered by the owner. A future feed should use a separate authenticated importer.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

STATUSES = ("saved", "applied", "interview", "offer", "rejected", "withdrawn")
WORKPLACES = ("remote", "hybrid", "onsite", "unknown")
FIELDS = {
    "company": 160, "title": 200, "url": 2000, "location": 160,
    "salary": 120, "source": 120, "notes": 10000, "contact": 200,
    "applied_at": 10, "follow_up_at": 10,
}
DEFAULTS = {**{field: "" for field in FIELDS}, "status": "saved", "workplace": "unknown"}


def validate_job(document):
    if not isinstance(document, dict):
        raise ValueError("An application record is required.")
    unknown = set(document) - set(DEFAULTS)
    if unknown:
        raise ValueError("Unknown job fields: " + ", ".join(sorted(unknown)))
    result = {**DEFAULTS, **document}
    for key, max_length in FIELDS.items():
        value = result[key]
        if not isinstance(value, str) or len(value) > max_length:
            raise ValueError(f"{key} must be text of at most {max_length} characters.")
        result[key] = value.strip()
    for required in ("company", "title"):
        if not result[required]:
            raise ValueError(f"{required} is required.")
    if result["status"] not in STATUSES:
        raise ValueError("Invalid application status.")
    if result["workplace"] not in WORKPLACES:
        raise ValueError("Invalid workplace type.")
    if result["url"]:
        parsed = urlparse(result["url"])
        if (parsed.scheme not in ("https", "http") or not parsed.hostname
                or parsed.username or parsed.password):
            raise ValueError("Vacancy link must be an HTTP or HTTPS URL without credentials.")
    for field in ("applied_at", "follow_up_at"):
        value = result[field]
        if value:
            try:
                if date.fromisoformat(value).isoformat() != value:
                    raise ValueError()
            except ValueError:
                raise ValueError(f"{field} must be a valid YYYY-MM-DD date.") from None
    return result


class JobStore:
    def __init__(self, path):
        self.path = Path(path)

    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )""")
        db.commit()
        return db

    @staticmethod
    def record(row):
        return {
            "id": row["id"], **json.loads(row["data"]), "revision": row["revision"],
            "created_at": row["created_at"], "updated_at": row["updated_at"]
        }

    def all(self):
        with self.connect() as db:
            rows = db.execute("SELECT * FROM jobs ORDER BY updated_at DESC, id DESC LIMIT 2000").fetchall()
            return [self.record(row) for row in rows]

    def create(self, payload):
        data = validate_job(payload)
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            if data["url"] and self._url_taken(db, data["url"]):
                raise RuntimeError("That vacancy URL is already in the tracker.")
            cur = db.execute(
                "INSERT INTO jobs (data,created_at,updated_at) VALUES (?,?,?)",
                (json.dumps(data), now, now)
            )
            db.commit()
            row = db.execute("SELECT * FROM jobs WHERE id=?", (cur.lastrowid,)).fetchone()
            return self.record(row)

    @staticmethod
    def _url_taken(db, url, excluding=None):
        for row in db.execute("SELECT id,data FROM jobs").fetchall():
            if row["id"] != excluding and json.loads(row["data"]).get("url") == url:
                return True
        return False

    def update(self, job_id, payload, revision):
        data = validate_job(payload)
        if type(revision) is not int or revision < 1:
            raise ValueError("A valid revision is required.")
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if data["url"] and self._url_taken(db, data["url"], excluding=job_id):
                raise RuntimeError("That vacancy URL is already in the tracker.")
            cur = db.execute(
                "UPDATE jobs SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
                (json.dumps(data), now, job_id, revision)
            )
            if cur.rowcount != 1:
                raise RuntimeError("Application changed or no longer exists. Reload before editing.")
            row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            db.commit()
            return self.record(row)

    def delete(self, job_id, revision):
        if type(revision) is not int or revision < 1:
            raise ValueError("A valid revision is required.")
        with self.connect() as db:
            cur = db.execute("DELETE FROM jobs WHERE id=? AND revision=?", (job_id, revision))
            if cur.rowcount != 1:
                raise RuntimeError("Application changed or no longer exists. Reload before deleting.")
            db.commit()
