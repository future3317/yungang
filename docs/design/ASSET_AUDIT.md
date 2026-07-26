# Runtime asset audit

| Asset group | Current use | Rule |
|---|---|---|
| `04_yungang_seal_stamp.webp` | landing and brand mark | one brand accent per view |
| `generated/nodes/icon_node_*.png` | semantic site nodes | preserve intrinsic ratio; no stretched map cards |
| `generated/icon_role_*.png` | player roster | roster only |
| `generated/icon_action_*.png` | command and culture entry points | action feedback only |
| `generated/scene_*.png` | focused site, event forecast and result context | lazy content imagery |
| `generated/panels/banner_route.png` | restrained panel divider | CSS decoration, not a route |
| `generated/routes/*` | retained source material | no runtime map use; SVG paths are the only route renderer |
| `01_buddha_relief_medallion.webp` | archived source material | not used as a global map background |
| `generated/ui_mural_paper_background.png` | archived texture | not used by the map stage |
| `generated/source/*` | source originals | never loaded by runtime |

The map has one visual lead: a low-contrast atlas surface. Node icons, scene art, evidence cards and panel borders are content or feedback layers, not competing backgrounds. All illustration assets keep their aspect ratio; `preserveAspectRatio="none"` is prohibited.

PNG optimization, responsive derivatives and Lighthouse measurement remain release tasks. Do not claim compression or performance scores without running those tools.
