"""Private CV vault. Files never enter the public website tree.

PDF and macro-free DOCX only, 4 MiB max. No direct public URLs; all
downloads are handled by the authenticated dashboard endpoint.
"""
from __future__ import annotations

import os
import re
import secrets
import sqlite3
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

MAX_CV_BYTES = 4 * 1024 * 1024
ALLOWED = {".pdf": "application/pdf",
           ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


def validate_cv(data: bytes, suffix: str):
    if suffix not in ALLOWED:
        raise ValueError("Upload a PDF or DOCX CV.")
    if not data or len(data) > MAX_CV_BYTES:
        raise ValueError("CV must be at most 4 MB.")
    if suffix == ".pdf":
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-1024:]:
            raise ValueError("Invalid PDF file.")
    else:
        try:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                names = archive.namelist()
                if (len(names) > 1500 or "word/document.xml" not in names
                    or "[Content_Types].xml" not in names
                    or any(n.lower().endswith((".bin", ".exe", ".js", ".vbs"))
                           or "vbaproject" in n.lower() for n in names)
                    or any(i.file_size > 25 * 1024 * 1024 for i in archive.infolist())):
                    raise ValueError("DOCX contains unsupported content.")
        except (zipfile.BadZipFile, OSError):
            raise ValueError("Invalid DOCX file.") from None


class CvVault:
    def __init__(self, directory: str, db_path: str):
        self.directory = Path(directory)
        self.db_path = Path(db_path)

    def connect(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.db_path, timeout=12)
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS cv_documents(
          id TEXT PRIMARY KEY, filename TEXT NOT NULL,
          label TEXT NOT NULL, mime TEXT NOT NULL,
          size INTEGER NOT NULL, created_at TEXT NOT NULL,
          is_primary INTEGER NOT NULL DEFAULT 0
        )""")
        db.commit()
        return db

    def list(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute(
                "SELECT id,filename,label,mime,size,created_at,is_primary "
                "FROM cv_documents ORDER BY is_primary DESC, created_at DESC")]

    def upload(self, uploaded_file, label: str):
        if not uploaded_file or not getattr(uploaded_file, "filename", ""):
            raise ValueError("Please select a CV file.")
        if not isinstance(label, str) or not label.strip() or len(label) > 100:
            raise ValueError("Give this CV a label of at most 100 characters.")
        original = uploaded_file.filename
        suffix = Path(original).suffix.lower()
        data = uploaded_file.stream.read(MAX_CV_BYTES + 1)
        validate_cv(data, suffix)
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        key = secrets.token_hex(16)
        safe_filename = re.sub(r"[^a-zA-Z0-9._-]", "-", Path(original).name)[:120]
        if not safe_filename.lower().endswith(suffix):
            safe_filename = "CV" + suffix
        stored = self.directory / (key + suffix)
        fd = os.open(stored, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
            with self.connect() as db:
                db.execute("BEGIN IMMEDIATE")
                existing = db.execute("SELECT 1 FROM cv_documents LIMIT 1").fetchone()
                db.execute("""INSERT INTO cv_documents
                  (id,filename,label,mime,size,created_at,is_primary)
                  VALUES (?,?,?,?,?,?,?)""", (
                    key, safe_filename, label.strip(), ALLOWED[suffix],
                    len(data), datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    0 if existing else 1,
                ))
                db.commit()
        except Exception:
            stored.unlink(missing_ok=True)
            raise
        return self.list()

    def lookup(self, key):
        if not re.fullmatch(r"[0-9a-f]{32}", key):
            return None
        with self.connect() as db:
            row = db.execute("SELECT * FROM cv_documents WHERE id=?", (key,)).fetchone()
            if not row:
                return None
            suffix = ".pdf" if row["mime"] == ALLOWED[".pdf"] else ".docx"
            path = self.directory / (key + suffix)
            return (dict(row), path) if path.is_file() else None

    def set_primary(self, key):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT 1 FROM cv_documents WHERE id=?", (key,)).fetchone():
                raise LookupError("CV not found")
            db.execute("UPDATE cv_documents SET is_primary=0")
            db.execute("UPDATE cv_documents SET is_primary=1 WHERE id=?", (key,))
            db.commit()

    def delete(self, key):
        entry = self.lookup(key)
        if not entry:
            raise LookupError("CV not found")
        _, path = entry
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM cv_documents WHERE id=?", (key,))
            if not db.execute("SELECT 1 FROM cv_documents WHERE is_primary=1").fetchone():
                row = db.execute("SELECT id FROM cv_documents ORDER BY created_at DESC LIMIT 1").fetchone()
                if row:
                    db.execute("UPDATE cv_documents SET is_primary=1 WHERE id=?", (row["id"],))
            db.commit()
        path.unlink(missing_ok=True)
