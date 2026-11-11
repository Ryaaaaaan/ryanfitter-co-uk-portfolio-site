# Private UK remote ecommerce job scanner

## Using the board

- Sign in at https://ryanfitter.co.uk/admin/job-matches.
- The board shows feed results, relevance scores, hours when supplied, employment type, source attribution and explicit remote/UK caveats.
- **Save to applications** copies a vacancy into the private tracker at `/admin/jobs`. It is not an actual job application.
- **Not relevant** dismisses a vacancy; future scans will not show it again.
- Run scan now starts an in-process, nonblocking scan (requires your authenticated session + CSRF token). The page checks for completion while it is open.
- The three named matches from the 11 November 2026 ChatGPT search are seeded on first access, with verified job listing links and caveats. This is a *one-off import*, not a live integration with ChatGPT automation output.

## Recurring scans

`.github/workflows/job-scan.yml` executes Monday, Wednesday and Friday around **8 AM Europe/London**, adjusting for BST/GMT. GitHub Actions may start scheduled jobs later than the advertised time.

An extra scan occurs after a successful website deployment, as a health and freshness check. Manual workflow_dispatch is also available on GitHub.

GitHub Actions assumes the existing restricted GitHub OIDC deploy role and issues an SSM command *only to the website EC2 instance*. The scan itself executes as unprivileged `ryanfitter-admin`, not root. It writes to `/var/lib/ryanfitter-admin/jobs.sqlite3` alongside (but in separate tables from) the application records.

The scanner uses approved third-party JSON sources:
- [Himalayas Remote Jobs API](https://himalayas.app/docs/remote-jobs-api) — source attributed and external apply link left unchanged.
- [Remotive public jobs API](https://remotive.com/remote-jobs/api) — source attributed and original Remotive URL preserved.

The scanner does *not* claim to cover LinkedIn, Reed, Indeed, YunoJuno, employer career sites or the ChatGPT scheduled search, which has broader public-web access. This is not a unified feed of the old ChatGPT reports; there is no native webhook/export channel available from the scheduled ChatGPT automation to a private website.

## Matching and safeguards

- Job titles must match an ecommerce/marketing/SEO/merchandising/CRM keyword; generic engineering and highly senior roles are filtered out.
- Part-time or contract roles rank above conventional full-time roles. This is heuristic scoring rather than AI CV analysis.
- Only remote-listing providers are used. Himalayas country restrictions must include GB (or be worldwide); Remotive candidate location must clearly name UK/GB or worldwide.
- Listings older than 45 days are omitted and salary/cadence are displayed only when disclosed.
- Every result is labelled **check eligibility and remote terms**; job-board remote labels are not sufficient proof of no travel/office requirements.
- Duplicate company+role pairs are consolidated; dismissed and saved choices persist across refreshes. A saved match becomes a separate private application.
- If sources fail, scan history records partial/failure status and errors; no jobs are invented. Public API rate limits can reduce coverage.
- Feed contents are never copied to public portfolio routes.
- Existing data and media survive deployments; deploy backs up the SQLite database locally. Configure off-server backup separately.
- Any salary, advertised date, weekly hours or vacancy status may become stale; verify against original employer listing before applying.

## Operational verification

- Frontend builds and backend authentication/scanner tests must pass in CI.
- Deployment checks anonymous access to both `/admin/job-matches` and `/admin/api/job-matches`.
- The scheduled scanner workflow must report successful SSM execution at least once before automatic scans can be considered operational.
- Authenticated save/dismiss and scan-now should be tested in a browser, since unit tests cannot substitute for Cognito browser flows.
