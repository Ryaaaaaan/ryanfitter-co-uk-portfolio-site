"""Private, deduplicated UK-remote ecommerce job matches and scheduled feed scanner.

Sources: Himalayas, Remotive and Jobicy public job APIs. Never claim an employer's
working pattern is verified solely because a job board classifies it 'remote'.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

import requests

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
    name = title.lower()
    if not any(word in name for word in ROLE_WORDS):
        return None
    if any(word in name for word in REJECT_TITLE):
        return None
    score = 53
    if any(w in name for w in ("ecommerce", "e-commerce", "merchandis", "shopify", "online trading")):
        score += 20
    elif any(w in name for w in ("seo", "crm", "email marketing", "digital marketing", "digital trading")):
        score += 15
    else:
        score += 9
    tech = sum(word in description.lower() for word in TECH_WORDS)
    score += min(12, tech * 3)
    _, start, end = hours_in(hours + " " + description[:1800])
    if start is not None and 10 <= start <= 20 and end <= 30:
        score += 17
    elif any(x in employment.lower() for x in ("part time", "part-time", "contract", "freelance")):
        score += 9
    elif "full" in employment.lower():
        score -= 23
    if confidence == "review":
        score -= 6
    # Keep weaker-but-relevant roles in Explore instead of hiding them.
    return min(100, max(0, score)) if score >= 40 else None


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
    s = score_match(title, description, employment, hours, confidence)
    if s is None:
        return None
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
    }


def seed_rows():
    return [{**item, "key": key_for(item["company"], item["title"])} for item in SEED]


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
            return {
                "matches": [{**json.loads(r["data"]), "state": r["state"],
                             "first_seen": r["first_seen"], "last_seen": r["last_seen"]} for r in rows],
                "scan": dict(latest) if latest else None,
            }

    def get(self, key):
        with self.connect() as db:
            row = db.execute("SELECT * FROM job_matches WHERE key=?", (key,)).fetchone()
            return ({**json.loads(row["data"]), "state": row["state"]} if row else None)

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

    def finish(self, run_id, candidates, errors, sources_ok):
        added = 0
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
                    db.execute("UPDATE job_matches SET data=?,last_seen=? WHERE key=?",
                               (json.dumps(item), stamp, item["key"]))
            status = ("failed" if not sources_ok else "partial" if errors else "success")
            db.execute(
                "UPDATE job_scans SET finished=?,status=?,added=?,reviewed=?,details=? WHERE id=?",
                (stamp, status, added, len(candidates), "; ".join(errors)[:1000], run_id),
            )
            db.commit()
        return {"status": status, "added": added, "reviewed": len(candidates), "errors": errors}


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
            if not re.search(r"\\b(?:united kingdom|great britain|uk|europe|anywhere|worldwide)\\b", location.lower()):
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


def scan(store, run_id=None):
    # Claims across workers and scheduled SSM invocations use a transactional lock.
    if run_id is None:
        run_id = store.begin()
    errors = []
    sources_ok = 0
    matched = {}
    for label, operation in (("Himalayas", himalayas_jobs), ("Remotive", remotive_jobs), ("Jobicy", jobicy_jobs)):
        try:
            rows = operation()
            sources_ok += 1
            for item in rows:
                current = matched.get(item["key"])
                if not current or item["score"] > current["score"]:
                    matched[item["key"]] = item
        except (requests.RequestException, ValueError, KeyError, TypeError) as error:
            errors.append(f"{label}: {type(error).__name__}: {str(error)[:120]}")
    result = store.finish(run_id, list(matched.values()), errors, sources_ok)
    return result
