# Current state audit

## Findings

- The previous UI was a single `innerHTML` renderer with duplicated display data and no route-level landing page.
- The game API already owns legal actions, revision checks, market state, pending choices and outcomes; the new UI must consume those fields rather than copy rules.
- The old screenshot audit selected `.network`, `.actions` and `.site`, which no longer represented the runtime DOM.
- Static assets are valuable but were mixed between original, generated and source directories without an explicit usage record.
- The backend uses SQLite snapshots and a synchronous service boundary. This is adequate for the current game size, but action and state values need enums and content validation.

## Implemented direction

- React 19 + TypeScript + Vite application in `frontend/src`.
- TanStack Query owns server game/meta cache; local UI state is limited to focus, card dialog and mobile view.
- SVG map reads node coordinates and connections from `/api/meta` and visual state from the game response.
- The landing page creates or restores a shareable `/room/:roomId` URL.
- FastAPI serves the Vite `dist` build and falls back to `index.html` for SPA routes.

## Remaining evidence work

Screenshot, axe, Lighthouse and Playwright results must be generated in a machine with Chromium installed. No user research or cultural review results are fabricated here.
