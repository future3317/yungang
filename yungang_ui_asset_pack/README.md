# Yungang UI Asset Pack

这是给 Claude Code / 前端同学直接接入的透明背景 UI 资产包。

## 文件列表

- `assets/01_buddha_relief_medallion.png`
  - 主视觉佛像浮雕，可放首页 hero、中间主徽章、胜利弹窗顶端。
- `assets/02_cloud_ribbon_divider.png`
  - 横向云气丝带分隔线，用在标题区、面板标题下方、章节分隔。
- `assets/03_lotus_corner_frame.png`
  - 四角莲花边框，适合整页大容器、弹窗背景、规则说明页。
- `assets/04_yungang_seal_stamp.png`
  - 红色篆刻印章，可放 logo 辅助标、角标、按钮角徽、卡牌角标。
- `assets/05_heritage_medallion_set.png`
  - 六枚遗产主题徽章，可裁切后作为节点图标、成就徽章、图鉴入口。
- `assets/06_vertical_card_frame.png`
  - 竖版卡牌边框，适合文化卡牌、事件卡、知识卡。
- `assets/07_role_badge_set.png`
  - 四个角色圆形徽章，可裁切为单独角色头像/选择卡头图。
- `assets/08_horizontal_banner_frame.png`
  - 横向卷轴式标题框，适合 section header、抽卡展示、弹窗标题。
- `assets/current_ui_screenshot_reference.png`
  - 当前版本界面截图，供 Claude Code 对照改版。

## 接入建议

1. 页面背景不要再用纯色大块 div，改成：
   - 米白到暖灰的细腻渐变背景；
   - 很淡的宣纸/石壁纹理；
   - 配少量云纹角饰。
2. 视觉层级建议：
   - 顶部 Hero 用 `08_horizontal_banner_frame.png` + `04_yungang_seal_stamp.png`
   - 主棋盘容器外层可叠 `03_lotus_corner_frame.png`
   - 中心主图改为 `01_buddha_relief_medallion.png`
   - 各模块标题下方加 `02_cloud_ribbon_divider.png`
3. 角色选择区：
   - 使用 `07_role_badge_set.png` 裁切成四个角色徽章；
   - 卡片样式做成淡金描边、悬浮发光、选中有红金边。
4. 卡牌 UI：
   - 使用 `06_vertical_card_frame.png` 作为文化卡牌的底框；
   - 卡牌标题使用楷体/宋体，正文用现代无衬线。
5. 遗产节点：
   - 从 `05_heritage_medallion_set.png` 裁切出单个圆章，作为云冈、华严寺、长城、互市等节点插图。

## 说明

这些 PNG 已经是透明背景，可以直接 `img` 引用或做 CSS background-image。
建议接入时统一输出到 `frontend/static/ui-assets/`。
