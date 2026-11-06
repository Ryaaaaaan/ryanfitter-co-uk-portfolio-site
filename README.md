# ryanfitter.co.uk

Personal portfolio for Ryan Fitter, built on the existing React / Vite codebase.

## Site structure

- `/` — public e-commerce portfolio: selected work, services, background and contact.
- `/pokemon` — preserved unlinked Pokémon tool collection, including the existing PokeMMO breeding routes.
- Portfolio is text-first. No generated imagery or third-party image assets have been added.
- The global search-engine block was removed for the portfolio homepage. Pokémon routes receive a `noindex` meta tag before React loads.
- `/sitemap.xml` currently lists only the portfolio homepage.

## Work in progress

This is an initial content/design foundation, **not a final published portfolio**.

Before merge / launch:
1. Review the user-provided CV and align job history, experience and results to verified facts.
2. Replace the project monograms with **real project screenshots only if supplied**.
3. Build detailed LoftyCards, LOPT and previous-role case studies with appropriately sourced claims.
4. Agree the public contact email or enquiry channel, then replace the contact placeholder.
5. Confirm the hosting platform, deployment pipeline and the DNS setup for ryanfitter.co.uk.
6. Test responsive design, accessibility, meta tags and all public links.

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
```

Serve `dist/` from a static host configured to fall back to `index.html` for nested tool routes. This repository does not currently include a deployment workflow.
