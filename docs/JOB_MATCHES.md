# Private UK remote ecommerce job scanner

## Using the board

- Sign in at https://ryanfitter.co.uk/admin/job-matches.
- The board shows CV fit, working-arrangement fit and overall heuristic scores, role/seniority tags, hours when supplied, source attribution and explicit remote/UK caveats. Relevance is a SORT option, not a filter. Filter separately by role focus, seniority or hours.
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
- [Jobicy public jobs API](https://jobicy.com) — European or worldwide remote postings from a public API.
- **Reed Jobseeker API** (optional, requires an approved developer key) — official search API; no unauthorised scraping.
- **Adzuna UK jobs API** (optional, requires personal-use app ID and app key) — official search API; adhere to its terms and tier limits.

Optional credentials are **not supplied or active by default**. To enable the adapters, provision root-only mode-0600 `/etc/ryanfitter-job-feeds.env` outside Git:
```dotenv
REED_API_KEY=YOUR_ISSUED_REED_KEY
ADZUNA_APP_ID=YOUR_APP_ID
ADZUNA_APP_KEY=YOUR_APP_KEY
```
Run the usual deployment afterward to restart the web service and refresh the feed scanner. Never commit credentials or share them in chat.

**Indeed**: no direct site integration is currently authorised. Indeed's developer APIs are subject to its partner programme, and its site terms prohibit unauthorised scraping. Use Indeed searches in a browser and add vacancies manually; don't turn on a browser scraper.

First-party ATS feeds such as Greenhouse/Lever may be added later for explicitly selected employers. These do not provide a universal cross-employer search API.

The three free feeds do not claim to cover LinkedIn, Indeed, YunoJuno, employer career sites or the ChatGPT scheduled search, which has broader public-web access. This is not a unified feed of the old ChatGPT reports; there is no native webhook/export channel available from the scheduled ChatGPT automation to a private website.

## CV, lifestyle and seniority matching

Reviewed against the latest uploaded November 2026 CV, not a model-inferred profile:
- Direct experience includes ecommerce merchandising, catalogues and promotions across 25,000+ SKUs, Shopify, BigCommerce, Akeneo PIM, Magento, SEO, marketing, analytics, CRO, email/CRM, UX-led website redesigns and eBay.
- Strongest role tags: Ecommerce, Merchandising, Product data & PIM, Marketing, SEO, Analytics & CRO, CRM & email, UX and Marketplace.
- Specialist **UI design** has weaker demonstrated evidence than ecommerce UX work. Pure engineering or head-of-function roles are treated cautiously.
- Role tags are derived primarily from job titles, with specification fallback. Seniority labels are title-based: Head / director, Senior / lead, Managerial title, Junior / entry, Not stated. Managerial title does not prove people management.
- **CV fit (0–100)**: skills, role area, tools and seniority observed in the CV.
- **Working fit (0–100)**: remote/hybrid/office evidence and hours relative to preferred 10–30 hours/week. Full-time and compulsory office attendance are penalised; explicitly advertised flexible working and adjustments receive a modest positive marker.
- **Overall (0–100)**: blended work and CV fit, with caps for mandatory office attendance, geographical eligibility uncertainty and overseas contractor arrangements. These are transparent heuristic estimates, not actual employer eligibility or automated machine learning.
- **UK-listing priority (scoring version 4)**: UK-listed job scopes are sorted first by default; the user can select adjusted overall fit, CV match, working fit, newest or company instead. Worldwide claims receive a **−10 working-fit** adjustment and an **overall ceiling of 74**; unspecified UK eligibility gets a **−7 working-fit** adjustment and a **ceiling of 78**. Worldwide independent contractors remain capped at **70 overall**. Himalayas results receive an additional modest **−4 overall points** to avoid letting its broad source dominate. Explicit UK-location restrictions are prioritised, but no employer location or UK payroll is inferred from them.
- **UK market vs employer country**: Reed and Adzuna UK-market feeds count as UK-listed when the location is a UK place name, not as independently verified UK-incorporated companies. Himalayas search `country=GB` includes both worldwide listings and listings that explicitly include GB in their allowed applicant countries. The scanner differentiates these and warns about incompatible listed timezones. The provider API does **not** supply the employer's country of incorporation; never label a listing UK-owned or American-owned from source or salary alone. Existing saved/dismissed matches are re-scored on access without rewriting human decisions.
- Explicit accessibility / adjustments signals mean *only that words appear in a listing*. No personal diagnosis or sensitive medical details are stored or sent to the scanner.
- A remote-job-board category is **not proof of a home-working contract**. Always review the employer listing.
- Jobs are deduplicated by company and title; saved and dismissed decisions survive scans. Existing results without stored specifications are re-scored from the available role title and summary; those scores can be less precise.
- Listing dates and vacancy availability may be stale. No automatic employer applications are made.

## Scan health and audit history

The dashboard's **View scan health & history** panel reports:
- Last run, success/partial/failure, distinct matched jobs and new matches.
- How many scanned jobs were already known; how many of those had already been saved in your dashboard.
- Total saved and dismissed matches.
- Per-source statuses including success, error and not-configured, plus each source's matching results count.
- The last 12 scans.

`job_scans` is migrated in place with extra counters and JSON source statuses. Older historical runs display **—** where the original scanner did not record a metric. A zero returned count is not a failure if an API call succeeds; source API limits can affect coverage.

## Operational verification

- Frontend builds and backend authentication/scanner tests must pass in CI.
- Deployment checks anonymous access to both `/admin/job-matches` and `/admin/api/job-matches`.
- The scheduled scanner workflow must report successful SSM execution at least once before automatic scans can be considered operational.
- Authenticated save/dismiss and scan-now should be tested in a browser, since unit tests cannot substitute for Cognito browser flows.
