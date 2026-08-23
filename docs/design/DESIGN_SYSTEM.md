# Design system

Tokens live in `frontend/src/styles/tokens.css`. Base reset and typography live in the global style entry; page geometry belongs only to the game HUD layout, map visuals to the map stylesheet, and widget visuals to CSS Modules. `components.css` and `hud-contract.css` are migration-only files: do not add new widget rules there.

## Semantic colors

`--surface-environment` is the page environment, `--surface-stage` is the map stage, `--surface-raised` is a raised panel, and `--surface-interactive`/`--surface-selected` are interactive states. `--action-primary` is active action, `--discovery` is exploration, `--repair` is repair/stability, `--connection` is connection/achievement, and `--risk`/`--closed` communicate danger without relying on color alone.

## Interaction rules

Desktop controls have a 44px minimum hit area even when their visible icon is smaller. Typography uses the semantic scale in `frontend/src/styles/tokens.css`: display, page, entity, section, control, reading, body, label, and data tokens. SVG map labels use the explicit `--map-type-*` scale; the editor uses `--editor-map-label` because its 100×100 viewBox is not a CSS pixel surface. Reduced motion disables route flow and transition movement. Cultural images use `alt=""` when decorative and descriptive alt text when they carry meaning.

Use at most two simultaneous emphasis signals on one object. Gold denotes task relevance or completion, cinnabar primary action, azure discovery, malachite repair, and red only danger. Map states are limited to default, current location, currently actionable, and danger/event; selected state uses a focus ring rather than another color system. `hud-contract.css` owns only desktop HUD geometry and slot sizing; widget appearance belongs to the widget stylesheet or CSS Module.
