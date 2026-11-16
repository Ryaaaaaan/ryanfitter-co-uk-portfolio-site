"""Self-service private project portfolio, separate from day-to-day tasks.

All writes use the existing Cognito + CSRF gateway and revision-protected
SQLite records. Starter import is opt-in and idempotent; edits are preserved.
"""
from __future__ import annotations

import json
import re
import secrets
import sqlite3
from datetime import date, datetime, timezone
from backend.project_starter import PROJECT_DETAILS
from pathlib import Path

CATEGORIES = ("Commercial", "Income", "Software", "Privacy", "Infrastructure", "Research", "Electronics", "Creative")
PRIORITIES = ("P0", "P1", "P2", "P3", "P4")
STATUSES = ("backlog", "active", "waiting", "done", "parked")
DEFAULTS = {
    "title": "", "category": "Commercial", "priority": "P2",
    "status": "backlog", "board_id": "", "hours_low": 0, "hours_high": 0,
    "cost_low": 0, "cost_high": 0, "benefit": "",
    "next_step": "", "later": "", "notes": "", "due_date": "", "checklist": [],
}
LENGTHS = {"title": 180, "category": 60, "board_id": 40, "benefit": 650,
           "next_step": 1000, "later": 1000, "notes": 8000, "due_date": 10}

# Title | category | P level | hours low-high | incremental cost GBP low-high.
# Snapshot only: estimates belong to the owner and remain editable.
STARTER = """LoftyCards refund/reversal audit|Commercial|P0|8-18|0-0
LoftyCards / LOPT stock accuracy|Commercial|P0|24-65|0-80
Remote applications and CV tailoring|Income|P0|12-30|0-30
Cash-flow, debt and operating budget|Commercial|P0|6-15|0-0
LOPT Shopify title/SKU/SEO trust|Software|P0|18-50|0-40
LoftyCards listing throughput|Commercial|P1|25-75|0-180
LOPT A4 picking / batch picks|Software|P1|25-65|0-100
5limes positioning and first customer|Income|P1|24-70|20-150
Dixy website completion and payment|Income|P1|8-30|0-60
Personal portfolio case studies|Income|P1|10-25|0-50
LoftyCards stock buying & sell-through|Commercial|P1|10-25|100-750
LoftyCards SEO and paid ads experiments|Commercial|P1|15-40|50-250
Email/account digital cleanse|Privacy|P1|15-40|0-0
Vaultwarden - secure first deployment|Infrastructure|P1|14-35|0-100
Flint 2 network stability & segmentation|Infrastructure|P1|6-18|0-80
Project portfolio board for /admin|Software|P1|18-45|0-30
LoftyCards Pokémon launch test|Commercial|P2|20-65|150-800
Whatnot / eBay Live pilot|Commercial|P2|12-35|0-180
5limes freelance outreach channels|Income|P2|12-35|0-80
LOPT external pilot and security gate|Software|P2|90-220|100-700
LOPT eBay / channel stock fanout|Software|P2|70-160|0-300
LOPT stock-aware mega menu|Software|P2|65-160|0-120
LOPT free catalogue and CSV funnel|Software|P2|60-140|0-150
LoftyCards old-admin consolidation|Software|P2|10-30|0-0
Career workspace maintenance|Software|P2|8-25|0-40
72-hour household outage readiness|Infrastructure|P2|5-15|25-120
PS2-PC build video/documentation|Creative|P2|12-32|0-100
DJ practice and first recorded set|Creative|P2|25-70|0-120
LOPT release planning and purchasing|Software|P3|45-115|0-100
LOPT multi-game catalogue expansion|Software|P3|80-220|0-500
TradingLab paper trading validation|Research|P3|30-85|0-100
Alarm Rush playable public build|Creative|P3|18-50|0-80
NAS / N100 backup system|Infrastructure|P3|30-100|350-1100
Flight radar touchscreen prototype|Electronics|P3|16-55|30-180
GrapheneOS / phone privacy migration|Privacy|P3|12-30|0-600
Pokémon original-493 / Platinum preservation|Creative|P3|20-65|0-80
Original cartridge capture/streaming|Creative|P3|12-35|20-150
Pokémon / PokeMMO tools|Software|P3|18-55|0-50
Fedora / Firefox / Proton maintenance|Infrastructure|P3|3-12|0-0
Home network firmware update dashboard|Electronics|P4|18-55|0-80
Internet radio small-screen device|Electronics|P4|12-40|25-140
Game Boy hardware repair|Creative|P4|6-20|20-120
Future mobile-games studio|Creative|P4|120-320|50-500
LoftyCards bricks-and-mortar shop|Commercial|P4|120-300|15000-60000
Custom rack/router and redundant homelab|Infrastructure|P4|80-220|400-1800
Project car restoration|Creative|P4|100-400|1000-7000""".splitlines()

# Stable workstream identifiers are separate from financial/functional category.
DEFAULT_TABS = (
    {"id": "lopt", "name": "LOPT"},
    {"id": "lofty", "name": "LoftyCards"},
    {"id": "portfolio", "name": "Portfolio"},
    {"id": "fun", "name": "Fun"},
    {"id": "dj", "name": "DJ"},
    {"id": "freelance", "name": "Freelance"},
    {"id": "5limes", "name": "5limes"},
    {"id": "home", "name": "Home & Privacy"},
    {"id": "other", "name": "Other"},
)

def inferred_tab(name, category):
    """Map legacy records without modifying their stored JSON or revisions."""
    n = name.lower()
    if "lopt" in n:
        return "lopt"
    if "5limes" in n or "dixy" in n:
        return "5limes"
    if "freelance" in n:
        return "freelance"
    if n.startswith("dj ") or " dj " in n:
        return "dj"
    if "loftycards" in n or "whatnot" in n or "ebay live" in n:
        return "lofty"
    if ("portfolio" in n or "career" in n or "cv " in n or
        "remote applications" in n or "project board" in n):
        return "portfolio"
    if category in ("Privacy", "Infrastructure", "Electronics"):
        return "home"
    if category in ("Creative", "Research"):
        return "fun"
    return "other"

def validate_tabs(raw):
    if not isinstance(raw, list) or not 1 <= len(raw) <= 40:
        raise ValueError("Provide between one and 40 tabs.")
    ids = set()
    names = set()
    tabs = []
    for tab in raw:
        if not isinstance(tab, dict) or set(tab) != {"id", "name"}:
            raise ValueError("Tab must have an ID and name.")
        key, name = tab["id"], tab["name"]
        if not isinstance(key, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,40}", key):
            raise ValueError("Invalid tab identifier.")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 50:
            raise ValueError("Tab names must contain 1–50 characters.")
        if key in ids or name.strip().casefold() in names:
            raise ValueError("Duplicate tab.")
        ids.add(key)
        names.add(name.strip().casefold())
        tabs.append({"id": key, "name": name.strip()})
    if "other" not in ids:
        raise ValueError("Keep the Other tab for uncategorised projects.")
    return tabs

def validate_project(raw):
    if not isinstance(raw, dict) or set(raw) - set(DEFAULTS):
        raise ValueError("Invalid project fields.")
    obj = {**DEFAULTS, **raw}
    for field, limit in LENGTHS.items():
        val = obj[field]
        if not isinstance(val, str) or len(val) > limit:
            raise ValueError(f"{field} must contain at most {limit} characters.")
        obj[field] = val.strip()
    if not obj["title"]:
        raise ValueError("Project title is required.")
    if not obj["category"]:
        raise ValueError("Category is required.")
    if obj["due_date"]:
        try:
            if date.fromisoformat(obj["due_date"]).isoformat() != obj["due_date"]:
                raise ValueError()
        except ValueError:
            raise ValueError("Due date must be YYYY-MM-DD.") from None
    if obj["board_id"] and not re.fullmatch(r"[a-zA-Z0-9_-]{1,40}", obj["board_id"]):
        raise ValueError("Invalid workstream tab.")
    if obj["priority"] not in PRIORITIES or obj["status"] not in STATUSES:
        raise ValueError("Invalid priority or status.")
    for field in ("hours_low", "hours_high", "cost_low", "cost_high"):
        n = obj[field]
        if type(n) is not int or not 0 <= n <= 1_000_000:
            raise ValueError(f"{field} must be a non-negative whole number.")
    if obj["hours_low"] > obj["hours_high"] or obj["cost_low"] > obj["cost_high"]:
        raise ValueError("Minimum hours or costs cannot exceed maximum.")
    items = obj["checklist"]
    if not isinstance(items, list) or len(items) > 80:
        raise ValueError("Up to 80 checklist items are allowed.")
    seen = set()
    cleaned = []
    for row in items:
        if not isinstance(row, dict) or set(row) - {"id", "text", "done", "due_date"}:
            raise ValueError("Invalid checklist item.")
        text = row.get("text")
        done = row.get("done", False)
        due = row.get("due_date", "")
        if not isinstance(due, str) or len(due) > 10:
            raise ValueError("Invalid checklist due date.")
        if due:
            try:
                if date.fromisoformat(due).isoformat() != due:
                    raise ValueError()
            except ValueError:
                raise ValueError("Invalid checklist due date.") from None
        ident = row.get("id") or secrets.token_hex(8)
        if (not isinstance(text, str) or not 0 < len(text.strip()) <= 300
                or type(done) is not bool or not isinstance(ident, str)
                or not re.fullmatch(r"[a-zA-Z0-9_-]{1,40}", ident)
                or ident in seen):
            raise ValueError("Checklist item has invalid content or identifier.")
        seen.add(ident)
        cleaned.append({"id": ident, "text": text.strip(), "done": done, "due_date": due})
    obj["checklist"] = cleaned
    return obj

class ProjectStore:
    def __init__(self, path):
        self.path = Path(path)

    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=12)
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS portfolio_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS portfolio_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seed_key TEXT UNIQUE,
            data TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )""")
        db.commit()
        return db

    @staticmethod
    def _item(row):
        data = json.loads(row["data"])
        if not data.get("board_id"):
            data["board_id"] = inferred_tab(data["title"], data["category"])
        return {"id": row["id"], **data,
                "revision": row["revision"], "created_at": row["created_at"],
                "updated_at": row["updated_at"]}

    def tabs(self):
        with self.connect() as db:
            row = db.execute("SELECT value FROM portfolio_settings WHERE key='workstream_tabs'").fetchone()
            return json.loads(row["value"]) if row else {"revision": 1, "tabs": list(DEFAULT_TABS)}

    def save_tabs(self, tabs, revision):
        cleaned = validate_tabs(tabs)
        if type(revision) is not int or revision < 1:
            raise ValueError("Tab revision is required.")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT value FROM portfolio_settings WHERE key='workstream_tabs'").fetchone()
            current = json.loads(row["value"]) if row else {"revision": 1, "tabs": list(DEFAULT_TABS)}
            if current["revision"] != revision:
                raise RuntimeError("Tabs changed on another device. Reload before editing.")
            old = {t["id"] for t in current["tabs"]}
            new = {t["id"] for t in cleaned}
            deleted = old - new
            if deleted:
                rows = db.execute("SELECT data FROM portfolio_projects").fetchall()
                for r in rows:
                    item = json.loads(r["data"])
                    assigned = item.get("board_id") or inferred_tab(item["title"], item["category"])
                    if assigned in deleted:
                        raise ValueError("Move all projects out of a tab before deleting it.")
            updated = {"revision": revision + 1, "tabs": cleaned}
            db.execute("INSERT OR REPLACE INTO portfolio_settings(key,value) VALUES(?,?)",
                       ("workstream_tabs", json.dumps(updated, ensure_ascii=False)))
            db.commit()
            return updated

    def _check_board(self, item):
        allowed = {x["id"] for x in self.tabs()["tabs"]}
        if item["board_id"] and item["board_id"] not in allowed:
            raise ValueError("Workstream tab no longer exists.")


    def all(self):
        self.ensure_starter()
        with self.connect() as db:
            rows = db.execute("SELECT * FROM portfolio_projects ORDER BY id LIMIT 2000")
            return [self._item(row) for row in rows.fetchall()]

    def create(self, payload):
        item = validate_project(payload)
        self._check_board(item)
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            cur = db.execute("INSERT INTO portfolio_projects(data,created_at,updated_at) VALUES(?,?,?)",
                             (json.dumps(item,ensure_ascii=False), now, now))
            row = db.execute("SELECT * FROM portfolio_projects WHERE id=?", (cur.lastrowid,)).fetchone()
            db.commit()
            return self._item(row)

    def update(self, project_id, payload, revision):
        item = validate_project(payload)
        self._check_board(item)
        if type(revision) is not int or revision < 1:
            raise ValueError("Valid project revision required.")
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            cur = db.execute("""UPDATE portfolio_projects SET data=?, revision=revision+1,
                             updated_at=? WHERE id=? AND revision=?""",
                             (json.dumps(item,ensure_ascii=False), now, project_id, revision))
            if cur.rowcount != 1:
                raise RuntimeError("Project has changed or was deleted; reload and retry.")
            row = db.execute("SELECT * FROM portfolio_projects WHERE id=?", (project_id,)).fetchone()
            db.commit()
            return self._item(row)

    def delete(self, project_id, revision):
        if type(revision) is not int or revision < 1:
            raise ValueError("Valid project revision required.")
        with self.connect() as db:
            cur = db.execute("DELETE FROM portfolio_projects WHERE id=? AND revision=?",
                             (project_id, revision))
            if cur.rowcount != 1:
                raise RuntimeError("Project has changed or was deleted; reload and retry.")
            db.commit()

    def ensure_starter(self):
        """Seed once on authenticated first visit; deletions never reappear."""
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            marker = db.execute(
                "SELECT value FROM portfolio_settings WHERE key='november_2026_seeded'"
            ).fetchone()
            if marker is not None:
                return {"added": 0, "total_starter": len(STARTER)}
            result = self._seed(db)
            db.execute("INSERT INTO portfolio_settings(key,value) VALUES(?,?)",
                       ("november_2026_seeded", "1"))
            db.commit()
            return result

    def import_starter(self):
        """Explicit re-import is non-destructive and only restores missing seeds."""
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            result = self._seed(db)
            db.execute("INSERT OR REPLACE INTO portfolio_settings(key,value) VALUES(?,?)",
                       ("november_2026_seeded", "1"))
            db.commit()
            return result

    @staticmethod
    def _seed(db):
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        added = 0
        for idx, line in enumerate(STARTER):
            name, category, priority, hours, cost = line.split("|")
            hl, hh = map(int, hours.split("-"))
            cl, ch = map(int, cost.split("-"))
            next_step, later, benefit, status = PROJECT_DETAILS[name]
            item = validate_project({
                "title": name, "category": category, "priority": priority,
                "hours_low": hl, "hours_high": hh, "cost_low": cl, "cost_high": ch,
                "status": status, "board_id": inferred_tab(name, category), "next_step": next_step,
                "benefit": benefit, "later": later,
                "checklist": [
                    {"text": "Confirm outcome, scope and dependencies", "done": False},
                    {"text": next_step[:300], "done": False},
                    {"text": "Validate result and document what changed", "done": False},
                ],
            })
            cur = db.execute("""INSERT OR IGNORE INTO portfolio_projects
                (seed_key,data,created_at,updated_at) VALUES(?,?,?,?)""",
                (f"2026-11-16:{idx:03d}", json.dumps(item, ensure_ascii=False), now, now))
            added += cur.rowcount
        return {"added": added, "total_starter": len(STARTER)}
