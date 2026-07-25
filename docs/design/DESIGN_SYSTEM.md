# Design system

Tokens live in `frontend/src/styles/tokens.css`; global behavior lives in `frontend/src/styles/globals.css`.

## Semantic colors

`--surface-cave` and `--surface-deep` are the environment. `--surface-stone` and `--surface-label` are local exhibition surfaces. `--accent-cinnabar` is active action, `--accent-azure` is exploration, `--accent-malachite` is repair/stability, `--accent-gold` is connection/achievement, and `--state-risk`/`--state-closed` communicate danger without relying on color alone.

## Interaction rules

Interactive targets are at least 44px on the touch layout. Focus is visible with `--focus-ring`. Reduced motion disables route flow and transition movement. Cultural images use `alt=""` when decorative and descriptive alt text when they carry meaning.
