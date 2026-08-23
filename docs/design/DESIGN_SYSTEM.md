# Design system

Tokens live in `frontend/src/styles/tokens.css`. Base reset and typography live in the global style entry; page geometry belongs only to the game HUD layout, map visuals to the map stylesheet, and widget visuals to CSS Modules. `components.css` and `hud-contract.css` are migration-only files: do not add new widget rules there.

## Semantic colors

`--surface-cave` and `--surface-deep` are the environment. `--surface-stone` and `--surface-label` are local exhibition surfaces. `--accent-cinnabar` is active action, `--accent-azure` is exploration, `--accent-malachite` is repair/stability, `--accent-gold` is connection/achievement, and `--state-risk`/`--state-closed` communicate danger without relying on color alone.

## Interaction rules

Desktop controls have a 44px minimum hit area even when their visible icon is smaller. Ordinary body text is at least 14px, auxiliary text at least 12px, and focus is visible with `--focus-ring`. Reduced motion disables route flow and transition movement. Cultural images use `alt=""` when decorative and descriptive alt text when they carry meaning.

Use at most two simultaneous emphasis signals on one object. Gold denotes task relevance or completion, cinnabar primary action, azure discovery, malachite repair, and red only danger. Map states are limited to default, current location, currently actionable, and danger/event; selected state uses a focus ring rather than another color system.
