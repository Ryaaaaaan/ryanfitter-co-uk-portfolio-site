# Personal job application tracker

Open https://ryanfitter.co.uk/admin/jobs and sign in with the existing Cognito-approved dashboard account.

## Features

- Add and edit employers, role titles, vacancy links, location, remote/hybrid/onsite arrangement, salary, source, contacts and notes.
- Track saved, applied, interview, offer, rejected and withdrawn stages.
- Record date applied and follow-up date. Due follow-ups show a prominent indicator.
- Filter by text, stage and workplace; move jobs between stages from the list.
- Conflict checks prevent stale edits overwriting a newer version. Duplicate exact vacancy URLs are rejected.
- Database is private SQLite at `/var/lib/ryanfitter-admin/jobs.sqlite3`, separate from the CMS document database.

## Security

All application data requires an allowlisted signed-in Cognito session, including reading. Write APIs require an exact Origin and CSRF token. Data is not exposed to the public portfolio. Job URLs are limited to HTTP(S), user input is rendered as text rather than HTML, and unauthorized callers cannot read application records.

The scheduled ChatGPT job search remains a separate automation. It does **not** automatically sync matches to this app yet. No integration, scraping, or artificial vacancy data is claimed or seeded. A future authenticated ingestion service can be added separately.

## Backups and deployment

Normal GitHub Actions deployment to the existing website host installs the code and restarts the personal admin service. Jobs are kept outside the checkout and remain across deploys. Deployment takes a local SQLite snapshot when the database exists. Set up off-host backups before relying on it for irreplaceable records.

Authenticated browser creation/editing, session expiry and drag interactions should be manually smoke-tested after deployment; automated tests cover the API, authorization, persistence and revision conflict protection.
