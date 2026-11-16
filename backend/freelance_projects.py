"""Private freelance client projects and design drafts for the admin workspace."""
from __future__ import annotations

import json
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

STATUSES = ("discovery", "design", "build", "review", "complete")
DEFAULT_DESIGN = {
    "brand": "Dixy Fried Chicken",
    "headline": "Hot, fresh and ready when you are",
    "subheading": "Your local favourites, made fresh and ready for collection or delivery.",
    "cta": "Order now",
    "accent": "#b91c1c",
    "phone": "",
    "address": "Colne",
    "delivery_note": "Collection and delivery details to be confirmed.",
    "menu": [
        {"name": "Classic chicken burger", "description": "Crispy chicken, fresh salad and house mayo.", "price": "£6.49"},
        {"name": "Family sharing box", "description": "A generous mix for sharing. Final menu to be confirmed.", "price": "£18.99"},
        {"name": "Loaded fries", "description": "Golden fries with your choice of toppings.", "price": "£4.49"}
    ]
}
DEFAULT_PROJECT = {
    "title": "Takeaway ordering website",
    "client": "Dixy Fried Chicken, Colne",
    "status": "design",
    "summary": "Complete the existing takeaway website as a polished portfolio case study, then hand over a clear route for the business to take online orders.",
    "scope": "Build a mobile-first takeaway website with a clear menu, ordering path, contact and opening information, and local search foundations. Confirm the final menu, prices, delivery radius, ordering provider and client sign-off before launch.",
    "tech_stack": "Existing website repository; HTML/CSS/JavaScript or the current framework; ordering provider to be confirmed; local SEO and analytics after access is agreed.",
    "repository_url": "",
    "preview_url": "",
    "design": DEFAULT_DESIGN,
}

LIMITS = {"title": 140, "client": 140, "summary": 1200, "scope": 6000,
          "tech_stack": 1600, "repository_url": 500, "preview_url": 500}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def validate_project(raw):
    if not isinstance(raw, dict) or set(raw) - (set(LIMITS) | {"status", "design"}):
        raise ValueError("Invalid project fields.")
    item = {**DEFAULT_PROJECT, **raw}
    for key, limit in LIMITS.items():
        value = item.get(key)
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f"{key} must be text no longer than {limit} characters.")
        item[key] = value.strip()
    if not item["title"]:
        raise ValueError("Project title is required.")
    if not item["client"]:
        raise ValueError("Client name is required.")
    if item["status"] not in STATUSES:
        raise ValueError("Choose a valid project status.")
    for key in ("repository_url", "preview_url"):
        if item[key] and not re.fullmatch(r"https://[^\\s]+", item[key]):
            raise ValueError(f"{key} must be a secure https URL.")
    design = item.get("design", DEFAULT_DESIGN)
    if not isinstance(design, dict) or set(design) - set(DEFAULT_DESIGN):
        raise ValueError("Invalid design content.")
    design = {**DEFAULT_DESIGN, **design}
    for key, limit in {"brand": 100, "headline": 180, "subheading": 500, "cta": 40,
                       "phone": 60, "address": 180, "delivery_note": 300}.items():
        value = design.get(key)
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f"Design {key} must be text no longer than {limit} characters.")
        design[key] = value.strip()
    accent = design.get("accent")
    if not isinstance(accent, str) or not HEX.fullmatch(accent):
        raise ValueError("Accent colour must be a six-digit hex colour.")
    menu = design.get("menu")
    if not isinstance(menu, list) or len(menu) > 12:
        raise ValueError("Menu preview can contain up to 12 items.")
    cleaned = []
    for row in menu:
        if not isinstance(row, dict) or set(row) - {"name", "description", "price"}:
            raise ValueError("Invalid menu item.")
        entry = {}
        for key, limit in {"name": 100, "description": 240, "price": 30}.items():
            value = row.get(key, "")
            if not isinstance(value, str) or len(value) > limit:
                raise ValueError("Menu text is too long.")
            entry[key] = value.strip()
        if entry["name"]:
            cleaned.append(entry)
    design["menu"] = cleaned
    item["design"] = design
    return item


class FreelanceProjectStore:
    def __init__(self, path):
        self.path = Path(path)

    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=12)
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS freelance_projects (
            id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )""")
        db.commit()
        return db

    @staticmethod
    def record(row):
        return {"id": row["id"], **json.loads(row["data"]), "revision": row["revision"],
                "created_at": row["created_at"], "updated_at": row["updated_at"]}

    def all(self):
        with self.connect() as db:
            rows = db.execute("SELECT * FROM freelance_projects ORDER BY updated_at DESC")
            return [self.record(row) for row in rows.fetchall()]

    def ensure_starter(self):
        with self.connect() as db:
            exists = db.execute("SELECT 1 FROM freelance_projects LIMIT 1").fetchone()
            if exists:
                return
            data = validate_project(DEFAULT_PROJECT)
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            db.execute("INSERT INTO freelance_projects VALUES(?,?,?,?,?)",
                       ("dixy-takeaway", json.dumps(data), 1, now, now))
            db.commit()

    def create(self, payload):
        data = validate_project(payload)
        now, ident = datetime.now(timezone.utc).isoformat(timespec="seconds"), secrets.token_hex(12)
        with self.connect() as db:
            db.execute("INSERT INTO freelance_projects VALUES(?,?,?,?,?)",
                       (ident, json.dumps(data), 1, now, now))
            row = db.execute("SELECT * FROM freelance_projects WHERE id=?", (ident,)).fetchone()
            db.commit()
            return self.record(row)

    def update(self, ident, payload, revision):
        data = validate_project(payload)
        if type(revision) is not int or revision < 1:
            raise ValueError("A valid revision is required.")
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            cursor = db.execute("UPDATE freelance_projects SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
                                (json.dumps(data), now, ident, revision))
            if cursor.rowcount != 1:
                raise RuntimeError("Project changed or no longer exists. Reload before editing.")
            row = db.execute("SELECT * FROM freelance_projects WHERE id=?", (ident,)).fetchone()
            db.commit()
            return self.record(row)

    def delete(self, ident, revision):
        if type(revision) is not int or revision < 1:
            raise ValueError("A valid revision is required.")
        with self.connect() as db:
            cursor = db.execute("DELETE FROM freelance_projects WHERE id=? AND revision=?", (ident, revision))
            if cursor.rowcount != 1:
                raise RuntimeError("Project changed or no longer exists. Reload before deleting.")
            db.commit()
