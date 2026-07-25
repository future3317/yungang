# 给 Claude Code 的第二段 Prompt（在审计之后实施改版）

你现在基于已经完成的项目审计报告，正式开始改版前端 UI。目标不是“能用的 demo”，而是把它提升成：

“具有中国文化气质、国际化审美、优雅克制、适合比赛展示的高完成度 Web 游戏界面”。

请严格执行以下要求：

## 一、总体视觉目标

1. 参考方向：
   - 高端文化数字展陈；
   - 国际化网页游戏/桌游 companion app；
   - 克制、留白、精致、温润；
   - 不要廉价国潮，不要花哨，不要卡通幼态。

2. 关键词：
   - warm ivory
   - sandstone
   - light gold
   - celadon accent
   - cinnabar accent
   - subtle relief
   - museum-grade elegance

3. 结果要求：
   - 页面一眼看上去像“作品成品”，而不是课堂作业 demo；
   - 有主视觉层级；
   - 模块间留白合理；
   - 棋盘和右侧信息区风格统一；
   - 标题、说明、卡牌、角色、进度条都要精致。

## 二、必须接入的图片资产

假设这些图片已经放到：
`frontend/static/ui-assets/`

你需要在代码中接入：

- `01_buddha_relief_medallion.png`
- `02_cloud_ribbon_divider.png`
- `03_lotus_corner_frame.png`
- `04_yungang_seal_stamp.png`
- `05_heritage_medallion_set.png`
- `06_vertical_card_frame.png`
- `07_role_badge_set.png`
- `08_horizontal_banner_frame.png`

要求：
- 合理使用，不要堆砌；
- 主视觉只保留一个核心焦点；
- 如果某张图更适合裁切使用，请在 CSS 中处理 background-position / background-size；
- 不要让图片挤压文字可读性。

## 三、具体改版任务

### 1. 顶部 Hero 区
- 重做标题区；
- 用 `08_horizontal_banner_frame.png` 或更克制的容器表现主标题；
- 将 `04_yungang_seal_stamp.png` 作为小角标；
- 副标题排版更精致；
- 弱化现在廉价的大字背景水印。

### 2. 棋盘主区域
- 让棋盘成为真正的视觉中心；
- 使用更优雅的外框和层次；
- 中心主图使用 `01_buddha_relief_medallion.png`；
- 节点与路径的描边、间距、颜色重新设计；
- 起点/遗产节点卡片重新设计成更统一的面板；
- 底部图例重新设计。

### 3. 右侧侧栏
- 统一所有 panel 的容器样式；
- 调整标题、按钮、进度条、玩家信息的层级；
- 当前“手牌”“文化卡牌”区域要更像真正游戏 UI；
- 控制信息密度，减少拥挤。

### 4. 角色选择弹窗
- 做成高端选择面板；
- 角色卡片使用 `07_role_badge_set.png`；
- 选中态明显且优雅；
- 按钮更精致；
- 整体宽度、间距、排版全面优化。

### 5. 卡牌系统展示
- 卡牌 UI 用 `06_vertical_card_frame.png` 做底框；
- 抽到卡时要有更明显的展示感；
- 标题、类型、效果、文化说明层次更清楚。

### 6. 装饰元素
- 适量使用 `02_cloud_ribbon_divider.png`、`03_lotus_corner_frame.png`；
- 只在关键区域加，宁少勿多；
- 目标是“精致”，不是“堆素材”。

## 四、工程要求

1. 不要破坏现有功能逻辑；
2. 尽量只重构前端，不随便改后端接口；
3. 如果需要新增 class，请保持命名清晰；
4. 允许适当整理 HTML 结构和 CSS 文件；
5. 如果需要把内联结构拆成更清楚的区域，可以改；
6. 页面必须保持响应式基础能力；
7. 改完后请输出：
   - 改了哪些文件
   - 核心视觉改动点
   - 仍可继续优化的点

## 五、最终标准

完成后，这个项目应该达到：
- 适合截图放进比赛 PPT；
- 适合给老师、评委、文科同学演示；
- 视觉上明显高于普通学生 demo；
- 有文化感，也有当代数字产品感。
