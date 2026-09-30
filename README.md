# ryanfitter.co.uk

Hyper-lightweight personal site and unlisted utility workspace.

## Current scope
- Minimal public homepage: plain text, top-left
- Entire site excluded from search indexing
- Unlinked `/pokemon` tools landing page
- Native accordion navigation for Pokémon tools
- Explicit light/dark Pokémon theme with local preference storage
- Dedicated placeholder routes for PokeMMO breeding, mainline breeding, IV and shiny tools
- No calculator logic, backend, CMS or UI framework yet
- Component and token structure kept ready for future content/CMS data

## Development
```bash
npm install
npm run dev
```

## Production
```bash
npm run build
```

Serve the generated `dist/` directory with Nginx or another static server.
