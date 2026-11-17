
# AGENTS.md — ryanfitter.co.uk

## Project overview

This repository powers Ryan Fitter's personal website and workspace.

It serves three distinct purposes:
1. A public professional portfolio.
2. A private, authenticated work management dashboard.
3. A preview environment for freelance client projects.

These areas have different audiences, security requirements
and design goals. Keep them logically separated.

## 1. Public portfolio — /

Audience:
- Potential employers and recruiters
- Professional contacts
- Prospective freelance clients

Purpose:
- Showcase real professional experience and achievements.
- Present case studies and relevant technical skills.
- Provide a professional and easily navigable website.
- Support employment and freelance enquiries.

Rules:
- Prioritise accessibility, performance, SEO and responsive design.
- Maintain a professional, employer-friendly tone.
- Never invent qualifications, metrics or work experience.
- Respect the existing CMS and its publishing workflow.
- Never expose private documents or workspace data.
- Avoid unrelated visual or content changes.

The public portfolio should remain separate from the
branding and design of individual freelance clients.

## 2. Private workspace — /admin

Audience: The authenticated site owner only.

Purpose:
- Personal task and project management.
- Job application and interview tracking.
- CV versions and work document storage.
- Freelance projects, clients and deliverables.
- Portfolio CMS and publishing.
- Future reporting and productivity tools.

The dashboard is a private working application,
not a public-facing section of the portfolio.

Security requirements:
- Preserve server-side Cognito authentication.
- Enforce authentication and authorization for every
  private page, API endpoint and file operation.
- Do not rely on client-side route hiding for security.
- Never place private CVs, work files or uploads in public/.
- Store private documents using access-controlled storage.
- Validate uploads and use secure download endpoints.
- Keep secrets, tokens and credentials out of Git.
- Never expose sensitive data in logs.
- Keep protected content out of search indexes.

Maintain existing data and functionality when updating
dashboard components.

Do not assume that local development has access to
production Cognito, databases or private storage.

## 3. Freelance previews — /review/

Purpose:
- Develop and demonstrate proposed client websites.
- Allow visual review before full development.
- Test responsive layouts and user experiences.
- Support the transition to client-owned domains.

Each client project must:
- Have its own isolated directory and assets.
- Follow the client's branding and requirements.
- Avoid inheriting unrelated portfolio styling.
- Avoid changing other client previews.
- Clearly distinguish demo functions from real services.
- Preserve supplied logos and official brand assets.
- Keep private client information out of public assets.

Unfinished previews should be noindex.

However, noindex is NOT access protection.
Use authentication for genuinely confidential previews.

Client sites intended for production should generally
have their own repositories and deployment pipelines.

## 4. Dixy's Colne

Current preview:
public/review/dixiescolne/index.html

Purpose:
- Demonstrate a responsive takeaway website.
- Present a homepage, menu, about and contact pages.
- Prepare for potential independent deployment.

Rules:
- Preserve the official supplied logo.
- Do not replace the logo with AI-generated artwork.
- Keep design changes scoped to this preview.
- Keep demo forms and ordering clearly non-operational.
- Do not implement live ordering or payments without
  a separate approved specification.
- Maintain desktop and mobile compatibility.

## 5. Existing application features

This repository also contains legacy/unlisted
Pokémon tools and application functionality.

Do not delete, restructure or break these features
while working on the portfolio, admin or previews.

Preserve existing routes and functionality.

## 6. Architecture and development

Frontend:
- React
- TypeScript
- Vite

Private backend:
- Python/Flask
- Gunicorn
- AWS Cognito authentication

Hosting:
- Existing AWS infrastructure
- Nginx reverse proxy

Read relevant documentation before infrastructure changes.

Development rules:
- Inspect existing code before making changes.
- Keep changes small, scoped and maintainable.
- Prefer reusable components where appropriate.
- Avoid unnecessary dependencies.
- Use feature branches.
- Run relevant build and test commands.
- Never automatically deploy or modify production.
- Do not alter unrelated applications or AWS resources.
- Never commit .env files, credentials or private data.

The local development server does not reproduce
all production backend services.

## 7. CMS and content management

The public portfolio uses a CMS.

Its published content can be served from:
public/content/site.json

Rules:
- Do not assume local CMS content matches production.
- Do not overwrite production CMS data from local files.
- Treat imported production data as a local snapshot.
- Preserve existing publishing and revision workflows.
- Keep private and draft content out of public output.
- Back up persistent data before migrations.

## 8. Deployment and infrastructure

Deployments must be deliberate and separately approved.

Before deployment:
- Review the proposed changes.
- Run the frontend build.
- Run relevant backend tests.
- Check private routes and authentication.
- Check public and client preview routes.
- Verify that existing services remain unaffected.

Never modify production databases, authentication
configuration or infrastructure without approval.

## 9. Working with AI coding agents

Before starting a task:
1. Identify the affected website area.
2. Inspect its existing implementation.
3. Explain the intended changes.
4. Avoid modifying unrelated sections.

After completing a task:
1. Summarise changed files.
2. Report tests and their results.
3. Identify anything not tested.
4. State whether deployment is required.
5. Do not merge or deploy without approval.

The goal is to develop each area independently,
without risking other functionality.
