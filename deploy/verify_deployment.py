"""Verify that the public production host serves the exact GitHub deployment run.

Only non-sensitive revision metadata is exposed publicly. The server writes this
after its local smoke checks and the GitHub runner verifies it independently.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser


class BuildRevisionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.revisions = []

    def handle_starttag(self, tag, attrs):
        if tag == "meta":
            attributes = dict(attrs)
            if attributes.get("name") == "site-build-revision":
                self.revisions.append(attributes.get("content"))


def validate_deployment(manifest, html, revision, run_id, run_attempt, now=None):
    """Raise ValueError if the deployed marker and HTML aren't from this run."""
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Expected Git revision is not a full SHA")
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1:
        raise ValueError("Production revision marker is missing or invalid")
    if manifest.get("revision") != revision:
        raise ValueError("Production revision mismatch: expected %s, got %s" %
                         (revision, manifest.get("revision")))
    if manifest.get("run_id") != str(run_id) or manifest.get("run_attempt") != int(run_attempt):
        raise ValueError("Production marker belongs to a different Actions run or attempt")
    try:
        deployed_at = datetime.fromisoformat(manifest["deployed_at"])
        if deployed_at.tzinfo is None:
            raise ValueError("Missing timezone")
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Production marker has an invalid deployment timestamp") from exc
    clock = now or datetime.now(timezone.utc)
    seconds = (clock - deployed_at).total_seconds()
    if seconds < -300 or seconds > 10800:
        raise ValueError("Production marker timestamp is not recent")
    parser = BuildRevisionParser()
    parser.feed(html)
    if parser.revisions != [revision]:
        raise ValueError("Live homepage HTML does not advertise the expected build revision")
    return deployed_at


def fetch_text(path):
    url = "https://ryanfitter.co.uk" + path
    request = urllib.request.Request(url, headers={
        "Cache-Control": "no-cache, no-store",
        "Pragma": "no-cache",
        "Accept": "application/json" if path.startswith("/deployment-status.json") else "text/html",
    })
    with urllib.request.urlopen(request, timeout=25) as response:
        if response.status != 200:
            raise ValueError("%s returned HTTP %s" % (path, response.status))
        return response.read().decode("utf-8")


def main():
    revision = os.environ["DEPLOY_SHA"]
    run_id = os.environ["GITHUB_RUN_ID"]
    run_attempt = os.environ["GITHUB_RUN_ATTEMPT"]
    for attempt in range(1, 6):
        try:
            nonce = str(int(time.time() * 1000))
            manifest = json.loads(fetch_text("/deployment-status.json?verify=" + nonce))
            html = fetch_text("/?verify=" + nonce)
            deployed_at = validate_deployment(manifest, html, revision, run_id, run_attempt)
            print("Verified production: %s | GitHub run %s attempt %s | installed %s" %
                  (revision, run_id, run_attempt, deployed_at.isoformat()), flush=True)
            return 0
        except (ValueError, KeyError, OSError, TimeoutError, json.JSONDecodeError) as exc:
            print("Production verification %d/5 failed: %s" % (attempt, exc), flush=True)
            if attempt != 5:
                time.sleep(4)
    return 1


if __name__ == "__main__":
    sys.exit(main())
