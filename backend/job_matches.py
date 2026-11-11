"""Private, deduplicated UK-remote ecommerce job matches and scheduled feed scanner.

Sources: Himalayas, Remotive and Jobicy public job APIs. Never claim an employer's
working pattern is verified solely because a job board classifies it 'remote'.
"""
from __future__ import annotations

import hashlib
import os
import html
import json
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

import requests
from backend.job_profile import profile as career_profile, PROFILE_VERSION

SEARCH_TERMS = ("ecommerce", "digital marketing", "shopify", "seo", "merchandising", "email marketing", "product data", "crm")
ROLE_WORDS = ("ecommerce", "e-commerce", "digital marketing", "merchandis", "online trading",
              "shopify", "seo", "crm", "email marketing", "marketplace", "web analyst",
              "website", "digital content", "digital trading", "growth marketing",
              "content manager", "product data", "pim", "marketing executive", "marketing manager")
TECH_WORDS = ("shopify", "bigcommerce", "magento", "akeneo", "seo", "analytics", "email",
              "conversion", "merchandis", "pricing", "pim", "crm", "product catalogue")
REJECT_TITLE = ("intern", "volunteer", "graduate trainee", "chief ", "vp ", "director of", "head of ")
HOUR_RANGE = re.compile(r"\b(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*(?:hours|hrs|h)\b", re.I)
SINGLE_HOURS = re.compile(r"\b(\d{1,2})\s*(?:hours|hrs)\s*(?:/|per)\s*week\b", re.I)
SEED = (
    {
        "company": "Recruitment Juice", "title": "Digital Marketing Executive",
        "apply_url": "https://uk.linkedin.com/jobs/view/digital-marketing-executive-at-recruitment-juice-4486429677",
        "source": "ChatGPT report · LinkedIn", "hours": "20–40 hours/week, flexible",
        "employment_type": "Contract", "location": "UK remote", "score": 94,
        "reason": "Strong flexible-hours marketing fit; email, analytics, campaigns, AI skills.",
        "warning": "Salary not disclosed; confirm availability and whether a 20-hour contract is offered.",
        "confidence": "review", "posted": "2026-11-04", "salary": "",
    },
    {
        "company": "Clothes Cycle Limited", "title": "Website, CRM & Digital Analytics Specialist",
        "apply_url": "https://uk.linkedin.com/jobs/view/website-crm-digital-analytics-specialist-at-clothes-cycle-limited-4485677493",
        "source": "ChatGPT report · LinkedIn", "hours": "10–20 hours/week",
        "employment_type": "Part-time / freelance", "location": "London or remote", "score": 92,
        "reason": "Excellent Shopify, CRO, CRM, SEO and analytics fit; highly suitable hours.",
        "warning": "Listing mentions hybrid/flexible arrangements; confirm zero compulsory attendance.",
        "confidence": "review", "posted": "2026-11-03", "salary": "",
    },
    {
        "company": "Mammutmarsch", "title": "Junior Marketing Manager (m/f/d)",
        "apply_url": "https://join.com/companies/mammutmarschde/16935160-junior-marketing-manager-m-f-d",
        "source": "ChatGPT report · employer listing", "hours": "15–20 hours/week",
        "employment_type": "Freelance", "location": "UK remote", "score": 73,
        "reason": "Part-time UK remote marketing role; experience transferable from LoftyCards.",
        "warning": "Employer mentions occasional UK activities/travel; confirm whether fully remote is possible.",
        "confidence": "review", "posted": "2026-10-26", "salary": "",
    },
)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def key_for(company, title):
    def normal(s):
        return re.sub(r"[^a-z0-9]", "", s.lower())
    return hashlib.sha256((normal(company) + "|" + normal(title)).encode()).hexdigest()[:32]


class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.words = []

    def handle_data(self, data):
        self.words.append(data)


def plain(value):
    if not isinstance(value, str):
        return ""
    parser = TextOnly()
    parser.feed(value[:30000])
    return " ".join(html.unescape(" ".join(parser.words)).split())[:3000]


def hours_in(text):
    m = HOUR_RANGE.search(text)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if 5 <= a <= b <= 60:
            return f"{a}–{b} hours/week", a, b
    m = SINGLE_HOURS.search(text)
    if m and 5 <= int(m.group(1)) <= 60:
        value = int(m.group(1))
        return f"{value} hours/week", value, value
    return "", None, None


def valid_link(url):
    if not isinstance(url, str) or len(url) > 2000:
        return False
    p = urlparse(url)
    return p.scheme == "https" and bool(p.hostname) and not p.username and not p.password


def score_match(title, description, employment, hours, confidence):
    """Compatibility for older callers; uses the same CV + working-fit model."""
    report = career_profile(title, description, employment, hours)
    return report["score"] if report else None

def normalize(job):
    title = plain(job.get("title", ""))[:200]
    company = plain(job.get("company", ""))[:160]
    url = str(job.get("apply_url", ""))
    if not title or not company or not valid_link(url):
        return None
    description = plain(job.get("description", ""))
    employment = plain(job.get("employment_type", ""))[:120]
    hours = plain(job.get("hours", ""))[:120]
    confidence = job.get("confidence", "review")
    profile_data = career_profile(
        title, description, employment, hours, str(job.get("location", "")),
        str(job.get("warning", "")), str(job.get("source", "")),
    )
    if not profile_data:
        return None
    s = profile_data["score"]
    h, _, _ = hours_in(hours + " " + description[:1600])
    return {
        "key": key_for(company, title), "company": company, "title": title,
        "apply_url": url, "source": plain(job.get("source", ""))[:120],
        "hours": h or hours, "employment_type": employment,
        "location": plain(job.get("location", ""))[:160],
        "score": s, "reason": plain(job.get("reason", ""))[:500] or ("Relevant ecommerce/digital responsibilities; check workload and flexibility." if s >= 70 else "Broader related role; may require more hours, skills or travel than preferred."),
        "warning": plain(job.get("warning", ""))[:500] or "Confirm UK eligibility, hours and remote arrangements directly.",
        "confidence": confidence, "posted": str(job.get("posted", ""))[:10],
        "salary": plain(job.get("salary", ""))[:120],
        # Keep only a short public job-spec excerpt. Never copy the user's CV.
        "description": description[:1800],
        **profile_data,
    }


def enrich(row):
    # Legacy matches were saved with only one combined heuristic score. Re-score
    # without silently overwriting human save/dismiss choices or inventing spec.
    result = dict(row)
    if result.get("profile_version") != PROFILE_VERSION:
        candidate = career_profile(
            result.get("title", ""), result.get("description", "") or
            result.get("reason", ""), result.get("employment_type", ""),
            result.get("hours", ""), result.get("location", ""),
            result.get("warning", ""), result.get("source", ""),
        )
        if candidate:
            result.update(candidate)
    return result


def seed_rows():
    return [enrich({**item, "key": key_for(item["company"], item["title"])}) for item in SEED]


class MatchStore:
    def __init__(self, path):
        self.path = Path(path)

    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS job_matches (
          key TEXT PRIMARY KEY, data TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'new',
          first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS job_scans (
          id INTEGER PRIMARY KEY AUTOINCREMENT, started TEXT NOT NULL,
          finished TEXT, status TEXT NOT NULL, added INTEGER NOT NULL DEFAULT 0,
          reviewed INTEGER NOT NULL DEFAULT 0, details TEXT NOT NULL DEFAULT ''
        )""")
        columns = {c["name"] for c in db.execute("PRAGMA table_info(job_scans)")}
        for name, definition in (
            ("existing", "INTEGER NOT NULL DEFAULT 0"),
            ("saved_seen", "INTEGER NOT NULL DEFAULT 0"),
            ("sources_json", "TEXT NOT NULL DEFAULT '[]'"),
        ):
            if name not in columns:
                db.execute(f"ALTER TABLE job_scans ADD COLUMN {name} {definition}")
        stamp = now()
        for item in seed_rows():
            db.execute(
                "INSERT OR IGNORE INTO job_matches (key,data,state,first_seen,last_seen) VALUES(?,?,?,?,?)",
                (item["key"], json.dumps(item), "new", stamp, stamp),
            )
        db.commit()
        return db

    def list(self):
        with self.connect() as db:
            limit = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat(timespec="seconds")
            rows = db.execute(
                "SELECT * FROM job_matches WHERE state != 'dismissed' AND last_seen >= ? "
                "ORDER BY json_extract(data,'$.score') DESC, first_seen DESC LIMIT 300",
                (limit,),
            ).fetchall()
            latest = db.execute("SELECT * FROM job_scans ORDER BY id DESC LIMIT 1").fetchone()
            history = db.execute("SELECT * FROM job_scans ORDER BY id DESC LIMIT 12").fetchall()
            def scan_record(r):
                d = dict(r)
                try:
                    d["sources"] = json.loads(d.pop("sources_json") or "[]")
                except (json.JSONDecodeError, TypeError):
                    d["sources"] = []
                return d
            return {
                "matches": [{**enrich(json.loads(r["data"])), "state": r["state"],
                             "first_seen": r["first_seen"], "last_seen": r["last_seen"]} for r in rows],
                "scan": scan_record(latest) if latest else None,
                "history": [scan_record(r) for r in history],
                "total_saved": db.execute("SELECT count(*) FROM job_matches WHERE state='saved'").fetchone()[0],
                "total_dismissed": db.execute("SELECT count(*) FROM job_matches WHERE state='dismissed'").fetchone()[0],
            }

    def get(self, key):
        with self.connect() as db:
            row = db.execute("SELECT * FROM job_matches WHERE key=?", (key,)).fetchone()
            return ({**enrich(json.loads(row["data"])), "state": row["state"]} if row else None)

    def state(self, key, state):
        if state not in ("dismissed", "saved", "new"):
            raise ValueError("Invalid action.")
        with self.connect() as db:
            row = db.execute("UPDATE job_matches SET state=? WHERE key=?", (state, key))
            if row.rowcount != 1:
                raise LookupError("Match not found.")
            db.commit()

    def begin(self):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            running = db.execute(
                "SELECT started FROM job_scans WHERE status='running' ORDER BY id DESC LIMIT 1"
            ).fetchone()
            if running and running["started"] > (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat():
                raise RuntimeError("A scan is already running.")
            if running:
                db.execute("UPDATE job_scans SET status='failed',finished=?,details=? WHERE status='running'",
                           (now(), "Previous scan expired."))
            cur = db.execute("INSERT INTO job_scans (started,status) VALUES (?,'running')", (now(),))
            db.commit()
            return cur.lastrowid

    def finish(self, run_id, candidates, errors, sources_ok, source_details=None):
        added = 0
        existing = 0
        saved_seen = 0
        stamp = now()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            for item in candidates:
                present = db.execute("SELECT data FROM job_matches WHERE key=?", (item["key"],)).fetchone()
                if not present:
                    db.execute(
                        "INSERT INTO job_matches (key,data,state,first_seen,last_seen) VALUES(?,?,?,?,?)",
                        (item["key"], json.dumps(item), "new", stamp, stamp),
                    )
                    added += 1
                else:
                    # Leave the human's saved/dismissed decision untouched.
                    existing += 1
                    if db.execute("SELECT state FROM job_matches WHERE key=?", (item["key"],)).fetchone()["state"] == "saved":
                        saved_seen += 1
                    db.execute("UPDATE job_matches SET data=?,last_seen=? WHERE key=?",
                               (json.dumps(item), stamp, item["key"]))
            status = ("failed" if not sources_ok else "partial" if errors else "success")
            db.execute(
                "UPDATE job_scans SET finished=?,status=?,added=?,reviewed=?,details=?,"
                "existing=?,saved_seen=?,sources_json=? WHERE id=?",
                (stamp, status, added, len(candidates), "; ".join(errors)[:1000],
                 existing, saved_seen, json.dumps(source_details or []), run_id),
            )
            db.commit()
        return {"status": status, "added": added, "reviewed": len(candidates),
                "existing": existing, "saved_seen": saved_seen,
                "sources": source_details or [], "errors": errors}


def himalayas_jobs():
    candidates = []
    headers = {"User-Agent": "RyanFitterPrivateJobScout/1.0 (+https://ryanfitter.co.uk)"}
    for term in SEARCH_TERMS:
        response = requests.get("https://himalayas.app/jobs/api/search",
            params={"q": term, "country": "GB", "sort": "recent"},
            headers=headers, timeout=10)
        response.raise_for_status()
        result = response.json()
        for row in result.get("jobs", [])[:30]:
            if not isinstance(row, dict):
                continue
            restrictions = row.get("locationRestrictions") or []
            if not isinstance(restrictions, list):
                continue
            codes = {str(c.get("alpha2", "")).upper() for c in restrictions if isinstance(c, dict)}
            if codes and "GB" not in codes:
                continue
            if row.get("expiryDate") and row["expiryDate"] < datetime.now(timezone.utc).timestamp():
                continue
            posted = datetime.fromtimestamp(row["pubDate"], timezone.utc) if isinstance(row.get("pubDate"), (int,float)) else None
            if posted and posted < datetime.now(timezone.utc) - timedelta(days=45):
                continue
            salary = ""
            if row.get("minSalary") or row.get("maxSalary"):
                money = {"GBP": "£", "USD": "$", "EUR": "€"}.get(str(row.get("currency")), str(row.get("currency") or "")+" ")
                start, end = row.get("minSalary"), row.get("maxSalary")
                salary = money + (f"{start:,.0f}–{end:,.0f}" if isinstance(start,(int,float)) and isinstance(end,(int,float))
                              else f"{start or end:,.0f}") + " / " + str(row.get("salaryPeriod") or "annual")
            desc = plain(row.get("description", ""))
            caution = "Source labels this remote and UK-eligible; confirm the employer's actual work arrangement and weekly hours."
            if any(term in desc.lower() for term in ("travel required", "onsite", "on-site", "hybrid", "office attendance")):
                caution = "Description mentions travel/office/hybrid; check for mandatory attendance before applying."
            link = row.get("applicationLink")
            if not valid_link(link):
                continue
            obj = normalize({
                "title": row.get("title"), "company": row.get("companyName"),
                "apply_url": link, "description": desc,
                "source": "Himalayas", "hours": "", "employment_type": row.get("employmentType", ""),
                "location": ("UK remote" if codes else "Worldwide remote"),
                "confidence": "review", "warning": caution, "salary": salary,
                "posted": posted.date().isoformat() if posted else "",
            })
            if obj:
                candidates.append(obj)
    return candidates


def remotive_jobs():
    results = []
    for term in ("ecommerce", "digital marketing"):
        response = requests.get("https://remotive.com/api/remote-jobs",
             params={"search": term, "limit": 100},
             headers={"User-Agent": "RyanFitterPrivateJobScout/1.0"}, timeout=10)
        response.raise_for_status()
        for row in response.json().get("jobs", []):
            location = str(row.get("candidate_required_location") or "")
            low = location.lower()
            if not re.search(r"\b(?:united kingdom|great britain|uk|worldwide|anywhere)\b", low):
                continue
            published = str(row.get("publication_date") or "")[:10]
            if published:
                try:
                    if datetime.fromisoformat(published).date() < (datetime.now(timezone.utc)-timedelta(days=45)).date():
                        continue
                except ValueError:
                    pass
            url = row.get("url")
            if not valid_link(url):
                continue
            desc = plain(row.get("description", ""))
            confidence = "review"
            caution = ("Remotive lists this as remote; confirm UK hiring eligibility and whether any attendance is compulsory."
                       if any(x in low for x in ("worldwide", "anywhere")) else
                       "Remotive lists UK among eligible locations; verify remote terms and weekly hours with employer.")
            obj = normalize({
                "title": row.get("title"), "company": row.get("company_name"),
                "apply_url": url, "description": desc, "source": "Remotive",
                "employment_type": row.get("job_type", ""), "location": location,
                "salary": row.get("salary", ""), "confidence": confidence,
                "warning": caution, "posted": published,
            })
            if obj:
                results.append(obj)
    return results


def jobicy_jobs():
    """Discover UK-possible roles via Jobicy's official seven-day public feed."""
    results = []
    # Europe and Anywhere cover UK candidates; employer eligibility still needs checking.
    for geo in ("europe", "anywhere"):
        response = requests.get(
            "https://jobicy.com/api/jobs",
            params={"count": 100, "geo": geo, "industry": "marketing"},
            headers={"User-Agent": "RyanFitterPrivateJobScout/1.0 (+https://ryanfitter.co.uk)"},
            timeout=12,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Unexpected Jobicy response.")
        for row in payload.get("jobs", []):
            if not isinstance(row, dict):
                continue
            location = str(row.get("jobGeo") or "")
            if not re.search(r"\b(?:united kingdom|great britain|uk|europe|anywhere|worldwide)\b", location.lower()):
                continue
            url = row.get("url")
            if not valid_link(url):
                continue
            title = row.get("jobTitle", "")
            employment = row.get("jobType", "")
            if isinstance(employment, list):
                employment = ", ".join(x for x in employment if isinstance(x, str))
            salary = ""
            currency = str(row.get("salaryCurrency") or "")
            minimum, maximum = row.get("salaryMin"), row.get("salaryMax")
            if isinstance(minimum, (int,float)) or isinstance(maximum, (int,float)):
                amounts = [x for x in (minimum, maximum) if isinstance(x,(int,float))]
                mark = {"GBP":"£","USD":"$","EUR":"€"}.get(currency, currency+" ")
                salary = mark + "–".join(f"{x:,.0f}" for x in amounts)
                salary += " / " + str(row.get("salaryPeriod") or "period not stated")
            description = plain(row.get("jobDescription", "") or row.get("jobExcerpt", ""))
            published = str(row.get("pubDate") or "")[:10]
            caution = ("Jobicy categorises this as remote and eligible for " + location +
                       "; confirm UK hiring, zero compulsory office visits and hours.")
            if any(q in description.lower() for q in ("hybrid", "office attendance", "travel required", "on-site")):
                caution = "Job description may involve office attendance/travel; verify before applying."
            item = normalize({
                "title": title, "company": row.get("companyName", ""),
                "apply_url": url, "source": "Jobicy",
                "description": description, "hours": "",
                "employment_type": employment, "location": location,
                "salary": salary, "posted": published, "confidence": "review",
                "warning": caution
            })
            if item:
                results.append(item)
    return results



def reed_jobs():
    """Read the official Reed Jobseeker API when the owner's key is configured.

    This intentionally avoids web scraping and restricts search output to
    listings containing remote/hybrid work evidence.
    """
    key = os.environ.get("REED_API_KEY", "").strip()
    if not key:
        return []
    matched = []
    for term in ("ecommerce", "digital merchandising", "online trading", "UX", "SEO marketing"):
        r = requests.get(
            "https://www.reed.co.uk/api/1.0/search",
            params={"keywords": term, "resultsToTake": 50, "resultsToSkip": 0},
            auth=(key, ""), timeout=12,
            headers={"User-Agent": "RyanFitterPrivateJobScout/1.0"},
        )
        r.raise_for_status()
        response = r.json()
        if not isinstance(response, dict):
            raise ValueError("Unexpected Reed result format")
        for job in response.get("results", []):
            if not isinstance(job, dict):
                continue
            desc = plain(job.get("jobDescription", ""))
            location = plain(job.get("locationName", ""))
            # Unlike the remote-only feeds, Reed lists both onsite and remote
            # work. Only retain jobs with remote / hybrid listing evidence.
            if not re.search(r"\b(remote|work.from.home|home.based|hybrid|wfh)\b",
                             (location + " " + desc).lower()):
                continue
            url = job.get("jobUrl")
            if not valid_link(url):
                continue
            minimum, maximum = job.get("minimumSalary"), job.get("maximumSalary")
            salary_values = [f"£{x:,.0f}" for x in (minimum, maximum)
                             if isinstance(x, (int,float))]
            salary = "–".join(salary_values)
            item = normalize({
                "title": job.get("jobTitle", ""), "company": job.get("employerName", ""),
                "apply_url": url, "description": desc, "source": "Reed",
                "employment_type": "Part-time" if job.get("partTime") else "Full-time" if job.get("fullTime") else "",
                "location": location, "salary": salary,
                "posted": str(job.get("date", ""))[:10], "confidence": "review",
                "warning": "Reed role mentions remote/hybrid work. Confirm zero required office attendance, UK eligibility and hours."
            })
            if item:
                matched.append(item)
    return matched


def adzuna_jobs():
    """Search the UK jobs API if the owner configures Adzuna personal-search credentials."""
    app_id = os.environ.get("ADZUNA_APP_ID", "").strip()
    app_key = os.environ.get("ADZUNA_APP_KEY", "").strip()
    if not (app_id and app_key):
        return []
    matched = []
    for term in ("remote ecommerce", "remote digital marketing", "remote UX", "remote merchandising"):
        r = requests.get(
            "https://api.adzuna.com/v1/api/jobs/gb/search/1",
            params={"app_id": app_id, "app_key": app_key, "results_per_page": 50,
                    "max_days_old": 30, "sort_by": "date", "what": term},
            timeout=12, headers={"User-Agent": "RyanFitterPrivateJobScout/1.0"},
        )
        r.raise_for_status()
        response = r.json()
        if not isinstance(response, dict):
            raise ValueError("Unexpected Adzuna result format")
        for job in response.get("results", []):
            if not isinstance(job, dict):
                continue
            desc = plain(job.get("description", ""))
            title = plain(job.get("title", ""))
            location = plain((job.get("location") or {}).get("display_name", ""))
            if not re.search(r"\b(remote|work.from.home|home.based|hybrid|wfh)\b",
                             (title + " " + desc + " " + location).lower()):
                continue
            salary_values = [f"£{x:,.0f}" for x in
                             (job.get("salary_min"), job.get("salary_max"))
                             if isinstance(x, (int,float))]
            item = normalize({
                "title": title, "company": (job.get("company") or {}).get("display_name", ""),
                "apply_url": job.get("redirect_url", ""), "description": desc,
                "source": "Adzuna", "employment_type": "Contract" if job.get("contract") else "",
                "location": location, "salary": "–".join(salary_values),
                "posted": str(job.get("created", ""))[:10], "confidence": "review",
                "warning": "Adzuna search contains remote/hybrid terms. Confirm the employer's actual attendance requirements."
            })
            if item:
                matched.append(item)
    return matched


def source_registry():
    return (
        ("Himalayas", himalayas_jobs, True),
        ("Remotive", remotive_jobs, True),
        ("Jobicy", jobicy_jobs, True),
        ("Reed", reed_jobs, bool(os.environ.get("REED_API_KEY"))),
        ("Adzuna", adzuna_jobs,
         bool(os.environ.get("ADZUNA_APP_ID") and os.environ.get("ADZUNA_APP_KEY"))),
    )


def scan(store, run_id=None):
    # Claims across workers and scheduled SSM invocations use a transactional lock.
    if run_id is None:
        run_id = store.begin()
    errors = []
    sources_ok = 0
    source_details = []
    matched = {}
    for label, operation, configured in source_registry():
        if not configured:
            source_details.append({
                "name": label, "status": "not_configured", "matched": 0,
                "detail": "Requires the owner's developer API credentials.",
            })
            continue
        try:
            rows = operation()
            sources_ok += 1
            source_details.append({
                "name": label, "status": "success", "matched": len(rows), "detail": "",
            })
            for item in rows:
                current = matched.get(item["key"])
                if not current or item["score"] > current["score"]:
                    matched[item["key"]] = item
        except (requests.RequestException, ValueError, KeyError, TypeError) as error:
            # Never expose exception strings: URL query parameters can contain
            # Adzuna API credentials; errors appear in the user's scan history.
            detail = type(error).__name__
            if isinstance(error, requests.HTTPError) and error.response is not None:
                detail += " (HTTP " + str(error.response.status_code) + ")"
            source_details.append({
                "name": label, "status": "failed", "matched": 0, "detail": detail,
            })
            errors.append(f"{label}: {detail}")
    result = store.finish(run_id, list(matched.values()), errors, sources_ok,
                          source_details=source_details)
    return result
