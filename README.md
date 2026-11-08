# ryanfitter.co.uk

React + TypeScript + Vite personal website for Ryan Fitter.

## Public portfolio

- Responsive, text-led landing page aimed at both prospective employers and freelance e-commerce clients.
- Three case studies: LoftyCards, Bensons for Beds, LBS Horticulture / LoveGardening.
- Links to real organisations and live sites. No stock or generated imagery.
- Work, expertise, about and contact sections.
- Public portfolio is indexable; project pages have individual titles/descriptions.
- Contact uses mailto; no backend, submissions or applicant data collection.

## Existing unlisted tools

The existing `/pokemon` routes and functionality are preserved. They remain excluded from the public navigation and blocked by robots.txt. These are not protected/private authenticated routes.

## Site structure

- `src/pages/HomePage.tsx` — portfolio homepage
- `src/pages/WorkPage.tsx` — individual case studies
- `src/portfolioData.ts` — editable content and project metrics
- `src/components/PortfolioChrome.tsx` — portfolio navigation and footer
- `src/styles/portfolio.css` — CSS scoped to public portfolio
- `src/App.tsx` — pathname routing, including existing Pokémon tools

## Development

```bash
npm install
npm run dev
npm run build
```

Deploy the generated `dist/` as a static site. Configure server fallback to `index.html` for routes such as `/work/loftycards` and the existing `/pokemon` tools.

## Follow-ups

- Review public wording and metrics against source reporting.
- Add real screenshots/assets only after reviewing their public-use suitability.
- Verify DNS/deployment routing and test mobile, accessibility and indexing.
- Job search dashboard is intentionally **not** implemented.
