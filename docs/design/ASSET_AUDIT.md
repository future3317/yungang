# Asset audit

| Group | Runtime use | Status |
|---|---|---|
| `01_buddha_relief_medallion.webp` | SVG map center | used |
| `04_yungang_seal_stamp.webp` | landing/game brand | used |
| `generated/icon_node_*.png` | semantic site nodes | used |
| `generated/icon_role_*.png` | player roster | used |
| `generated/icon_action_*.png` | action and culture entry points | used |
| `generated/scene_*.png` | node focus, event forecast and result context | used/lazy by state |
| `generated/ui_mural_paper_background.png` | map texture | used |
| `generated/card_frame_*.png`, `ui_*frame*.png` | retained for future card/exhibition variants | audited, not all loaded |
| `generated/source/*` | source originals | not loaded by runtime |

The source directory is not a runtime dependency. PNG optimization and responsive derivatives remain a release task; do not claim compression or Lighthouse results without running them.
