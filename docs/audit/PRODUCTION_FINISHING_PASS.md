# Production finishing pass

## Scope

This pass preserves the Cave Light Atlas layout, deep green environment, warm stone surfaces and existing node assets. It concentrates on focus, map legibility, Inspector structure and interaction defects.

## Delivered

- Replaced the three persistent right panels with one low-luminance `SiteInspector` with summary, Task, Event and Market tabs, plus a collapse rail.
- Added Inspector-aware map space, automatic SVG fit-to-bounds, resize fitting, explicit fit and current-player controls.
- Defined route priority for main, neighbor, legal-target, risk, closed, restored and illuminated routes.
- Added action target mode status, route hover detail, compact timeline drawer, cancel-focus control and clearer expandable secondary actions.
- Corrected map tool icon rendering, landing difficulty labels, compact scenario cards, resume button wrapping and region label positions.

## Verification executed

| Check | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `pytest -q` in `piepaper` | 11 passed |
| `npm run test` | command executed; exits 1 because the repository has no Vitest test files |
| Playwright viewport capture | generated 1920, 1440, 1280, 768 and 390 captures in `audit_output/redesign` |
| Browser action path | create journey → move mode → two legal targets → keyboard Enter submit; success toast and no application console errors |

## Known limits

- The browser automation driver did not dispatch a usable mouse click on SVG `<g>` nodes; keyboard activation completed the same legal movement flow. Manual pointer testing remains recommended before external release.
- Axe and Lighthouse are not configured in this repository and are not claimed as passed.
- Cultural source review status remains independent from this UI pass.
