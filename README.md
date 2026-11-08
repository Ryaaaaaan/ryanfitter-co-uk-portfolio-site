# ryanfitter.co.uk

React, TypeScript and Vite personal portfolio for Ryan Fitter.

## Public portfolio

- Homepage for recruiters and freelance e-commerce clients.
- Three case studies: LoftyCards, Bensons for Beds, LBS Horticulture / LoveGardening.
- Selected work, expertise, about and contact sections.
- Real work and links only; no generated imagery.
- Public portfolio pages are indexable.

## Private workspace foundation

- Unlinked `/admin` React dashboard shell for a future CMS, job tracker and task board.
- **Server-side protection** via a Python Flask/Gunicorn gateway, OAuth 2.0
  authorization-code/PKCE flow and an explicitly allowlisted Cognito identity.
- Intended to reuse **TradingLab's existing Cognito user pool in eu-west-2**
  using a **separate app client**. No new pool and no new users required.
- Deployable AWS CDK stack for an app client and isolated future DynamoDB/S3 data.
- Tests, Nginx routes and systemd service examples.

**The private dashboard is not live until the server, app client, and allowlist
are provisioned.** No jobs, tasks, CMS content or media can be edited yet.

**Read [private dashboard deployment & security guide](docs/PRIVATE_DASHBOARD.md)
before deploying.** The existing public Vite host must route ALL `/admin`
requests through the authentication gateway; client-side checks are not
sufficient to secure private pages or APIs.

## Existing unlisted tools

The existing `/pokemon` routes and functionality remain unchanged.
They are intentionally unlisted and excluded from search indexing, but they
are **not** protected by Cognito.

## Site structure

- `src/pages/HomePage.tsx` — public portfolio
- `src/pages/WorkPage.tsx` — case studies
- `src/portfolioData.ts` — editable public project content (until CMS exists)
- `src/pages/AdminPage.tsx` — private dashboard UI shell
- `src/styles/admin.css` — private dashboard design
- `backend/app.py` — Cognito PKCE/server session and route protection
- `backend/tests/` — authentication tests
- `infrastructure/` — AWS CDK resources (requires deployment)
- `deploy/` — example systemd and Nginx config
- `docs/PRIVATE_DASHBOARD.md` — installation/runbook

## Development and checks

```bash
npm install
npm run build

python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
python -m unittest discover -s backend/tests -v
```

Deploy `dist/` as public static assets and add explicit protected `/admin`
routing to the backend. The application is designed for HTTPS production
cookies, not insecure HTTP development logins.

## Follow-ups

- Review the public portfolio PR and visual layout.
- Connect and smoke-test the existing AWS user pool/app client and hosting.
- Later implement a small CMS, task board and job application tracker, in
  whichever order proves most useful.
