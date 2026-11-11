"""Run the owner's private job scanner from a scheduled SSM command.

Execute as the unprivileged ryanfitter-admin OS user, never via the public web.
"""
import json
import os

from backend.job_matches import MatchStore, scan


def main():
    store = MatchStore(os.environ.get("JOB_DATABASE", "/var/lib/ryanfitter-admin/jobs.sqlite3"))
    result = scan(store)
    print(json.dumps(result, indent=2))
    return 0 if result["status"] != "failed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
