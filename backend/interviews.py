"""Interview calendar with browser-safe UTC iCalendar exports.

Times entered in UK local time, stored as wall clock string for predictable
editing across BST/GMT; export converts them to UTC via Europe/London.
"""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
KINDS = ("phone", "video", "in_person", "assessment", "other")
STATUSES = ("scheduled", "completed", "cancelled")
INPUT = ("title", "company", "start_at", "duration_minutes", "kind", "meeting_url",
         "location", "notes", "job_id", "status")


def validate_event(data):
    if not isinstance(data, dict) or set(data) - set(INPUT):
        raise ValueError("Invalid interview fields.")
    result = {
        "title": "", "company": "", "start_at": "", "duration_minutes": 60,
        "kind": "video", "meeting_url": "", "location": "", "notes": "",
        "job_id": None, "status": "scheduled", **data
    }
    for field, limit in (("title", 160), ("company", 160), ("location", 250),
                         ("notes", 5000), ("meeting_url", 2000)):
        value = result[field]
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f"Invalid {field}")
        result[field] = value.strip()
    if not result["title"] or not result["company"]:
        raise ValueError("Interview title and company are required.")
    try:
        dt = datetime.strptime(result["start_at"], "%Y-%m-%dT%H:%M")
        if dt.strftime("%Y-%m-%dT%H:%M") != result["start_at"]:
            raise ValueError()
    except (TypeError, ValueError):
        raise ValueError("Start must be a valid local date and time (YYYY-MM-DDTHH:MM)") from None
    if type(result["duration_minutes"]) is not int or not 15 <= result["duration_minutes"] <= 480:
        raise ValueError("Duration must be 15–480 minutes.")
    if result["kind"] not in KINDS or result["status"] not in STATUSES:
        raise ValueError("Invalid interview type or status.")
    if result["job_id"] is not None and (type(result["job_id"]) is not int or result["job_id"] < 1):
        raise ValueError("Invalid linked application.")
    if result["meeting_url"]:
        parsed = urlparse(result["meeting_url"])
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Meeting URL must be HTTPS.")
    return result


class InterviewStore:
    def __init__(self, path):
        self.path = Path(path)

    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=12)
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS interviews(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )""")
        db.commit()
        return db

    @staticmethod
    def convert(row):
        return {"id": row["id"], **json.loads(row["data"]),
                "created_at": row["created_at"], "updated_at": row["updated_at"]}

    def list(self):
        with self.connect() as db:
            rows = db.execute("SELECT * FROM interviews ORDER BY json_extract(data,'$.start_at') ASC LIMIT 1000")
            return [self.convert(row) for row in rows]

    def get(self, key):
        with self.connect() as db:
            row = db.execute("SELECT * FROM interviews WHERE id=?", (key,)).fetchone()
            return self.convert(row) if row else None

    def add(self, payload):
        item = validate_event(payload)
        stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            cur = db.execute("INSERT INTO interviews (data,created_at,updated_at) VALUES (?,?,?)",
                             (json.dumps(item), stamp, stamp))
            db.commit()
            return self.get(cur.lastrowid)

    def update(self, key, payload):
        item = validate_event(payload)
        stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.connect() as db:
            cur = db.execute("UPDATE interviews SET data=?,updated_at=? WHERE id=?",
                             (json.dumps(item), stamp, key))
            if cur.rowcount != 1:
                raise LookupError("Interview not found")
            db.commit()
        return self.get(key)

    def delete(self, key):
        with self.connect() as db:
            cur = db.execute("DELETE FROM interviews WHERE id=?", (key,))
            if cur.rowcount != 1:
                raise LookupError("Interview not found")
            db.commit()


def escape_ical(value):
    return (str(value).replace("\\", "\\\\").replace("\n", "\\n")
            .replace(",", "\\,").replace(";", "\\;").replace("\r", ""))


def to_ical(events):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RyanFitter//Interviews//EN",
             "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    for event in events:
        if event["status"] == "cancelled":
            continue
        start = datetime.strptime(event["start_at"], "%Y-%m-%dT%H:%M").replace(tzinfo=LONDON)
        start_utc = start.astimezone(timezone.utc)
        end_utc = (start + timedelta(minutes=event["duration_minutes"])).astimezone(timezone.utc)
        notes = "\n".join(v for v in (event["notes"], event["meeting_url"]) if v)
        lines += ["BEGIN:VEVENT", f"UID:interview-{event['id']}@ryanfitter.co.uk",
                  "DTSTAMP:" + stamp,
                  "DTSTART:" + start_utc.strftime("%Y%m%dT%H%M%SZ"),
                  "DTEND:" + end_utc.strftime("%Y%m%dT%H%M%SZ"),
                  "SUMMARY:" + escape_ical(event["title"] + " — " + event["company"]),
                  "DESCRIPTION:" + escape_ical(notes),
                  "LOCATION:" + escape_ical(event["location"]),
                  "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
