# Phase 3 Generated Asset Catalog

The source images supplied on 2026-07-26 are split by `scripts/split_generated_assets.py` into runtime assets under `frontend/static/ui-assets/generated`.

## Runtime folders

| Folder | Purpose | Naming convention |
|---|---|---|
| `nodes/` | 18 semantic heritage node icons | `icon_node_<site_id>.png` |
| `nodes/states/` | Normal, active, reachable, and closed node variants | `<site_id>_<variant>.png` |
| `routes/` | Route state textures | `route_<state>.png` |
| `effects/` | Discovery, restoration, network, and victory effects | `effect_<meaning>.png` |
| `badges/` | Damage, task, connection, and resource badges | `badge_<meaning>.png` |
| `panels/` | Map, context, banner, and timeline frames | `panel_<meaning>.png` or `banner_<meaning>.png` |
| `cards/` | Card frame variants | `card_frame_<number>.png` |

## Node mapping

The 3x6 node sheets map left-to-right, top-to-bottom to the site IDs in this order:

`yungang`, `huayan_temple`, `shanhua_temple`, `archive_depot`, `pingcheng_ruins`, `trade_post`, `wall_pass`, `border_market`, `northern_workshop`, `river_crossing`, `motif_gallery`, `river_archive`, `watchtower`, `material_yard`, `carving_courtyard`, `craft_school`, `route_junction`, `caravan_camp`.

Do not put text into future generated images. Names, status labels, costs, and progress remain HTML text so they stay readable and localizable.
