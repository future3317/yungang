# UI 与节点插画素材清单

所有新素材来自用户提供的 14 张生成图。原图保存在 `frontend/static/ui-assets/generated/source/`，可引用文件在 `frontend/static/ui-assets/generated/`。

## 装饰与界面

| 文件 | 用途 |
|---|---|
| `ui_mural_paper_background.png` | 壁画纸张背景 |
| `ui_banner_relief_frame.png` | 横向标题和状态区 |
| `ui_banner_scene_frame.png` | 场景说明横幅 |
| `ui_round_medallion_frame.png` | 节点或成就徽章底框 |
| `ui_quatrefoil_frame.png` | 任务/事件徽章 |
| `ui_arch_frame.png` | 详情面板 |
| `ui_flower_frame.png` | 文化印记面板 |
| `ui_lotus_frame.png` | 莲花主题按钮或胜利标记 |
| `ui_cloud_ornament_sheet.png` | 云纹原始图集 |
| `ui_cloud_*.png` | 已裁切云纹分隔线 |
| `ui_stone_ornament_sheet.png` | 石刻边饰原始图集 |
| `ui_pagoda_ornament.png` | 节点/页脚装饰 |
| `ui_card_back.png` | 文化牌背面 |
| `card_frame_arch.png` | 竖版文化牌框 |
| `card_frame_stone.png` | 竖版事件牌框 |
| `card_frame_arched.png` | 竖版档案牌框 |

## 六个节点对应场景

| 节点 | 文件 | 使用语义 |
|---|---|---|
| 云冈石窟 | `scene_yungang_day.png` | 白天的核心遗产节点 |
| 华严寺 | `scene_craft_restoration.png` | 工艺修复与结构审议 |
| 善化寺 | `scene_archive_cave.png` | 石窟档案与造像记录 |
| 长城关隘 | `scene_frontier_pass.png` | 边塞路线与压力事件 |
| 互市驿站 | `scene_trade_meeting.png` | 跨文化交换与贡献 |
| 平城遗址 | `scene_silk_road_expedition.png` | 路线起点与行旅探索 |

`scene_yungang_night.png` 作为夜间事件或回合结束背景，`scene_archive_cave.png` 也可作为档案卡详情图。原图不覆盖，所有裁切均可重新生成。

## 游戏图标与节点徽章

新增 `icon_badge_sheet.png` 已拆成 21 个独立徽章。第一行是节点徽章，第二行是行动/资源/事件徽章，第三行是任务与角色徽章。六个节点徽章和行动图标已经在 `frontend/static/js/app.js` 中绑定。
