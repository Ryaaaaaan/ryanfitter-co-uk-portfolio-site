# Portfolio components and CMS

The initial homepage is **Ryan Fitter / some guy @ LoftyCards**, with no navigation,
project cards or footer. This is also the fail-safe display if published content
cannot be loaded. Existing Pokémon routes are unchanged.

Sign in at `/admin/cms`. Text, hero, stats, projects, expertise, about and contact
components support editable text, links, visibility, ordering, colours, alignment,
spacing and base font size. Global theme settings include colours, font family and
content width. Header/footer text and links and project case-study data are editable.
Component-specific heading sizes still use the responsive design. Arbitrary CSS or HTML is not supported. PNG/JPEG/WebP screenshot uploads (maximum 5 MB) are available in the Media tab. Paste a screenshot URL into a section or project image field; it stays private until that page is published.

Save draft persists privately; Preview draft renders those edits; Save & publish
saves and publishes them. Loading the original portfolio or resetting to the blank
starter only changes the editor until saved/published. The original portfolio's
content is a recoverable bundled starter, not confidential draft data.

## Storage and protection

SQLite lives at `/var/lib/ryanfitter-admin/cms.sqlite3`, outside the checkout and
public web root. systemd creates the private writable state directory. CMS writes
require an allowlisted signed session, CSRF header, exact origin and matching revision.
Only `/content/site.json` is public. SQLite survives service restarts and deployments,
but is not an off-instance backup. Deployment takes a local SQLite snapshot when it
exists. Arrange separate backups before relying on this for irreplaceable content.
The job tracker is now implemented at `/admin/jobs`; the work board remains planned. Screenshot files are stored privately in `/var/lib/ryanfitter-admin/media`, outside the checkout.

## Deploy to the established EC2 host

AWS/SSM access is still required. No new AWS storage or IAM resources are needed.
Do not run the old CDK stack for this change. On the website host, make a separate
checkout, build it as the session user (`npm ci && npm run build`), then run:

```bash
sudo bash /path/to/built-checkout/deploy/install-cms.sh /path/to/built-checkout
```

The script expects the currently deployed runtime at `/opt/ryanfitter-portfolio`,
public files at `/var/www/ryanfitter/html`, existing authentication environment file,
and the already-installed Nginx admin include. It runs tests, backs up the old code,
index, unit and snippet, then installs the changes. It briefly restarts only the
personal dashboard service and gracefully reloads Nginx. The backend remains bound
to localhost. Failure triggers rollback. Public assets are added before replacing
the index so old Pokémon tabs can still load their assets.

Backend seed data uses `src/cms/defaults.json`; include `src/cms/` in deployment
bundles. Existing saved CMS content is retained on subsequent deployments.

After deployment check signed-out `/admin` redirects, anonymous CMS/session APIs
return 401, login works, draft saving stays private, publishing updates the homepage,
logout denies access, and Pokémon and Trading Lab still work. Browser QA could not
be completed in the implementation workspace because its browser cannot reach the
local preview server. Automated backend tests and frontend build are the available
implementation checks.
