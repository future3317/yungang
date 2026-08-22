# Player Experience Baseline

Date: 2026-07-27

## Observed baseline

- Content validation passed: schema v3, 18 sites, 30 routes, 36 culture cards, 18 events, and 4 scenarios.
- Frontend type checking and production build passed.
- The frontend had no discovered Vitest test files.
- The former fixed-session write endpoint `POST /api/games/{session_id}` and the direct player-join endpoint are intentionally removed. Production creation uses `POST /api/games`; room membership uses the authenticated room flow, and regression tests assert that both old writes return `405`.
- Before this branch there was no result route. A game with an outcome could remain on the game board after legal actions were cleared.

## Remaining evidence gaps

- No Playwright, axe, visual-regression, or Lighthouse evidence has yet been generated in this branch.
- Manual checks at 1920x1080, 1440x900, 1280x800, 768x1024, and 390x844 remain required before release.
- Strategy-card target selection and the complete planning-phase UI require a separate implementation pass; they are not claimed complete by this baseline.
