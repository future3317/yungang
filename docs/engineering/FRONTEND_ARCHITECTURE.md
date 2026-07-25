# Frontend architecture

`frontend/src` uses a lightweight feature-sliced layout:

- `app`: router and bootstrap.
- `pages/landing`, `pages/game`: route-level composition.
- `widgets/heritage-network`: semantic SVG map.
- `shared/api`: typed fetch boundary.
- `types`: API-facing state types.
- `styles`: semantic tokens and global responsive rules.

TanStack Query owns `['game', sessionId]` and `['meta']`. Local state is limited to focus, card dialog and mobile view. Gameplay legality is never recomputed in the browser.
