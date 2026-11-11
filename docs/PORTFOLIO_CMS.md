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


## Visual builder (LOPT-style)

The previous settings-led editor has been replaced by a responsive three-panel CMS,
adapted from the existing LOPT marketing CMS at admin.getlopt.co.uk:

1. **Left rail**: choose Home or Case Study pages, select/drag/reorder sections, add sections, manage header/footer and settings.
2. **Live draft stage**: render the *same public React components* as the published site, update instantly as you type, click a rendered section to edit it, switch Desktop/Tablet/Mobile and expand for focused preview.
3. **Right inspector**: edit selected text, links, buttons, content arrays, colours with pickers, spacing and font sizes with sliders, optional image layouts, header and footer.
4. **Media picker**: open directly from any section or project image control, upload private screenshot or select an existing image.
5. **Templates**: choose Professional Portfolio or Blank Slate; the selection immediately updates the stage and selects the first editable section, with an Undo action for the previous draft. A starter never changes the public website until Publish.

Home sections now include text, hero, stats, projects, expertise, about, contact,
image, image+text, image gallery, testimonial, call-to-action and spacer/divider.
Case study pages use the same public ProjectDetail component in both preview and
live output, avoiding mock preview discrepancies. The current site only has a
homepage and case-study routes: it does not gain unrelated LOPT marketing pricing
or signup pages.

Saving is explicit. The editor retains private draft/revision locking and
requires confirmation on Publish. An unsaved-change guard prevents accidental
navigation. Template loading never auto-publishes, and the existing minimalist
homepage stays published until the owner chooses to replace it.

Browser notes: mobile preview forces key responsive layout rules inside the
scaled stage, but final checks on a real mobile device are still important.
The media library accepts PNG/JPEG/WebP images up to 5 MiB; videos are not
supported in this revision.
