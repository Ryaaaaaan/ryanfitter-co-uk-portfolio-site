# Portfolio and careers workspace upgrade

## Public portfolio CMS
Use [Portfolio CMS](https://ryanfitter.co.uk/admin/cms).

- **Professional starter** loads a complete draft with case studies, hero, skills, about and contact blocks.
- **Blank slate** resets a *draft* to the short Ryan Fitter introduction.
- **Screenshot block** adds an image-and-caption section; upload genuine images under Media, then select their thumbnails from each section or project image field.
- **Theme presets** include Forest, Slate and Dark; individual colours remain configurable.
- **Preview draft** never changes the published site.
- **Save draft** preserves unpublished work. **Save & publish** requires explicit confirmation before replacing the publicly visible content.

The existing minimal public homepage is intentionally NOT changed during this code rollout. You control publication through the CMS.

## CV vault
[My CVs](https://ryanfitter.co.uk/admin/cvs) lets an allowlisted Cognito user upload, label, download, set a default version, and delete CVs from any phone or computer. No file uploads happen automatically: use your device to choose your current PDF or DOCX CV.

- Maximum size 4 MiB; PDF or macro-free DOCX only. Filenames on disk use random IDs.
- Metadata lives in private `/var/lib/ryanfitter-admin/jobs.sqlite3`; documents in `/var/lib/ryanfitter-admin/cvs`.
- Files have **no public URL** and every download requires the authenticated session.
- The system does not submit employer applications. Download your CV and attach it in the employer's application form manually.
- Deployments preserve files and make a *local* backup. Configure encrypted off-host backups before relying on the vault for your only CV copy.

## Interview calendar
[Interview calendar](https://ryanfitter.co.uk/admin/interviews) is a monthly view with new/edit/delete interview entries, format, meeting links, location, notes, optional linked application and status. Events are stored separately from application stages in the private jobs database.

- Times entered in Europe/London timezone; downloadable `.ics` snapshot converts to UTC for Apple/Google/Outlook calendar.
- The `.ics` file is an export, NOT a calendar sync or scheduled reminder.
- Access to reading or changing the calendar requires an authenticated private dashboard session.
- No email or notifications are sent to employers.

## Expanded discovery
The website scanner still runs Monday/Wednesday/Friday near 08:00 London time with on-demand scans. Data now comes from three public remote-job APIs:

1. **Himalayas** — keyword and GB remote-location restrictions.
2. **Remotive** — remote listings available in UK or worldwide.
3. **Jobicy** — public 7-day European and worldwide marketing feed, filtered to likely UK-eligible candidates.

Existing ChatGPT scheduled searches and selected seeded recommendations remain separate; the scanner does not automatically ingest the full ChatGPT report or index LinkedIn, Indeed, Reed, CV-Library or YunoJuno. Broadening those needs official licensed APIs, an import feature or another permitted connector.

Results with lower lifestyle/career fit are retained instead of silently discarded, with **Strong (80+)**, **Possible (65–79)** and **Explore (below 65)** filters. The heuristic is a prioritisation aid, not a verified CV match, remote-work guarantee or eligibility decision. The live job source link is always present; check working hours, travel, availability and application conditions directly.

## Post-deploy checks

CI verifies the React build, Flask authorization, private CV downloads, interview persistence/iCalendar and scanner parsing. AWS deployment checks anonymous requests to new routes are redirected/denied. Signed-in mobile and desktop interaction should still be user smoke-tested.
