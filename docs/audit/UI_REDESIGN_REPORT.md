# UI redesign report

## Implemented changes

- Replaced monolithic global styling with token, reset, typography, primitive, landing, shell, map, dock, responsive and motion modules.
- Reframed the product as Cave Light Atlas with a restrained rock-strata map stage.
- Moved routes, regions and all interactive nodes into one SVG coordinate system.
- Replaced rectangular region bounds with deterministic softened convex hulls.
- Reworked the landing journey setup, command dock hierarchy, action icon semantics, responsive modes and keyboard affordances.

## Verification record

Executed results: `npm run typecheck` passed; `npm run build` passed; `conda run -n piepaper python scripts/validate_content.py` passed with schema v3, 18 sites, 30 routes, 36 cards, 18 events and 4 scenarios; `conda run -n piepaper pytest -q` passed with 11 tests. `npm run test` was executed but exited with code 1 because the frontend contains no Vitest test files.

The screenshot script was executed successfully against a clean local server at port 8011 and wrote `game_1920.png`, `game_1440.png`, `game_1280.png`, `game_768.png`, `game_390.png` and metrics to `audit_output/redesign`. Desktop and mobile images were visually inspected. Axe and Lighthouse were not run because neither audit integration is configured in this repository; they are not claimed as passed.

## Remaining risk

Cultural source review remains separate from UI work. Visual grouping hulls are deliberately game-layout abstractions, not archaeological reconstruction. Lighthouse and axe reports require a final browser run on the built application.
