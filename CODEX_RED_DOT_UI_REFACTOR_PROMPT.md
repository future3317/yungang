# Codex 主任务：将 `future3317/yungang` 从 Demo 重构为博物馆级、可参赛的文化游戏体验

仓库：`https://github.com/future3317/yungang`

你是本项目的设计工程负责人、资深交互设计师、前端架构师和 FastAPI 后端工程师。请直接在仓库中完成一次真实的产品级重构。不要只写方案、不要只换配色、不要套用通用后台模板，也不要把“红点设计奖水平”理解为增加渐变、玻璃拟态和动画。

目标不是承诺获奖，而是按高水平文化数字体验的标准，系统提升：

- 原创概念与品牌识别；
- 视觉形式与实现质量；
- 信息可理解性与情绪感染力；
- 功能、吸引力、易用性与责任性；
- 工程可维护性、性能、无障碍和测试证据。

最终产品应从“开发者 Demo 页面”升级为“可独立公开展示、可答辩、可录制参赛演示视频的完整数字文化游戏”。

---

## 0. 工作方式与硬性要求

### 0.1 先审查，再设计，再实现

开始前必须完整阅读仓库，至少检查：

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/MECHANICS_V2.md`
- `docs/UI_ASSET_MANIFEST.md`
- `backend/app.py`
- `backend/models.py`
- `backend/engine.py`
- `backend/actions.py`
- `backend/content.py`
- `backend/repository.py`
- `frontend/index.html`
- `frontend/static/js/app.js`
- `frontend/static/js/api.js`
- `frontend/static/css/styles.css`
- `data/*.json`
- `tests/test_api.py`
- `scripts/audit_screenshots.py`
- 全部 UI 图片、图标、字体引用和静态资源

同时运行现有后端测试、启动应用，并在至少以下视口截图：

- 1920×1080
- 1440×900
- 1280×800
- 768×1024
- 390×844

输出 `docs/audit/CURRENT_STATE_AUDIT.md`，内容必须包括：

1. 当前 UX 主流程；
2. 当前视觉层级问题；
3. 当前信息架构问题；
4. 当前功能缺口；
5. 当前前端和后端耦合问题；
6. 硬编码、重复数据和失效脚本；
7. 性能、无障碍、响应式风险；
8. 改造影响面；
9. 可保留资产与应淘汰实现。

审查后继续实际修改，不要停在报告阶段。

### 0.2 Git 安全

创建分支：

`feat/museum-grade-experience`

修改前建立检查点提交：

`chore: checkpoint heritage-network-v2-demo`

不得直接破坏 `main`。完成后以小而清晰的提交组织改动，并准备 PR 描述。

### 0.3 不允许做的事

- 不要使用通用 SaaS Dashboard、Admin Template 或未经改造的 shadcn 默认视觉。
- 不要用 React Flow 直接生成流程图式地图。
- 不要用一堆卡片和边框解决所有布局问题。
- 不要把大面积米白、淡金和低对比文字继续作为唯一视觉语言。
- 不要使用 emoji、Unicode 符号充当正式图标。
- 不要在生产界面显示 `REV`、原始 JSON、角色代码 ID 或调试字段。
- 不要引入 Three.js、复杂 WebGL 或粒子系统作为核心依赖，除非能证明性能、可访问性和维护收益。
- 不要复制一份游戏规则到前端。
- 不要编造文化史实、文物资料、专家审核结果或用户测试结果。
- 不要为了“架构升级”拆成微服务。
- 不要同时重写游戏机制；本任务重点是体验、界面和工程质量，保留 v2 遗产节点网络规则。

---

## 1. 当前项目已确认的问题，必须逐项处理

根据仓库现状，至少存在以下明确问题。请在实现中验证并解决，不要仅记录：

### 1.1 前端是单文件字符串渲染

`frontend/static/js/app.js` 用一个大型 `render()` 和整段 `innerHTML` 重建全部页面。这导致：

- 组件不可复用；
- 状态难隔离；
- 每次更新会丢失焦点和局部交互状态；
- 难以做可靠动效、可访问性和组件测试；
- 文案、内容、资产、布局和业务动作混在一起。

必须迁移到组件化、强类型的现代前端。

### 1.2 前端存在服务端数据副本和硬编码

当前前端硬编码：

- 节点名称；
- 角色名称；
- 卡牌名称；
- 节点位置；
- 路线边；
- 场景图片；
- 动作图标映射。

其中角色映射键与后端角色 ID 不一致，容易直接显示 `pingcheng_artisan` 等代码值；前端节点坐标和路线也可能与 `data/sites.json`、`data/routes.json` 不一致。

必须以 `/api/meta` 和游戏状态为唯一内容来源。前端只保留展示层语义映射，不得维护规则和内容副本。

### 1.3 当前主界面像后台看板，不像文化游戏

截图中的主要问题：

- 大面积米白和同质边框，层级近乎相同；
- 地图、行动、事件、任务和玩家之间缺乏明确主次；
- 首屏大量空白；
- 右栏在无动作时完全失去价值；
- “共同影响力”“环境压力”只有细进度条，没有叙事和决策意义；
- 地图节点是通用圆形按钮，缺乏云冈自身的视觉记忆；
- 中央佛像被低透明度处理成背景噪声，没有成为视觉核心；
- 路线是低对比虚线，缺乏方向、状态和反馈；
- 手牌为空时占据大块空面板；
- 日志是开发日志，不是可理解的旅程叙事；
- “第 9 回合、0 项可用”没有结束状态、原因或下一步；
- 没有展示公开文化牌市场；
- 没有清楚展示节点任务需求、贡献进度、事件预告和其他玩家位置；
- 缺少首次进入、回合切换、任务完成、胜负和恢复存档的完整状态。

### 1.4 CSS 不具备设计系统结构

当前 `styles.css` 是单行、超长、全局样式文件：

- token 数量少；
- 所有组件共享相似边框和阴影；
- 无明确语义色；
- 无设计组件状态矩阵；
- 无容器查询策略；
- 无主题分层；
- 无减少动画策略；
- 无可复用排版、间距、圆角、层级和动效 token。

必须建立正式设计系统，而不是继续堆选择器。

### 1.5 审查脚本已经与 DOM 脱节

`scripts/audit_screenshots.py` 使用 `.network`、`.actions`、`.site` 等旧选择器，而当前实现使用 `.network-map`、`.action-list`、`.map-node`。必须重写审计流程，不能保留“看似存在但不能运行”的脚本。

### 1.6 后端虽然分层，但领域类型仍偏原型

现状包括：

- `actions.py` 只是透传；
- `engine.py` 集中处理所有规则；
- 动作、效果、阶段、状态使用大量自由字符串和 `Dict[str, Any]`；
- 内容校验只覆盖少量引用；
- 事件和效果存在硬编码分支；
- `next_id()` 使用行数生成 ID，存在并发和删除后的冲突风险；
- Repository 只保存 JSON 文本，缺少时间、版本、原子 revision 更新；
- 全局 `repo/content/engine` 不利于测试注入；
- 测试数量不足以支撑大规模 UI 重构。

在不改变核心规则的前提下，提升为可维护的模块化单体。

---

## 2. 设计北极星：不是“古风网页”，而是“可操作的数字石窟展台”

### 2.1 核心概念

设计概念暂定：

**「石窟光谱 / Cave Light Atlas」**

一句话定义：

> 玩家不是在看一张传统文化海报，而是在一座被重新点亮的数字石窟中，通过连接节点、修护遗产和组合文化证据，让文明关系逐层显现。

产品应该像一件数字博物馆展陈与合作桌游的结合体，而不是网页后台。

### 2.2 独特交互隐喻

采用“光照揭示文化关系”的统一隐喻：

- 未探索节点：暗部石龛，仅有轮廓；
- 可移动节点：边缘出现柔和矿物色光；
- 当前节点：龛像被点亮，出现呼吸式光晕；
- 任务贡献：卡牌化为一束“证据光”进入节点；
- 路线激活：丝路般的光线沿 SVG 路径流动；
- 节点受损：光层出现裂隙和颗粒剥落；
- 修护成功：裂隙收拢，石质纹理恢复；
- 任务完成：对应文明色谱加入共同图卷；
- 胜利：五类色谱汇入中央云冈节点，形成完整光环；
- 失败：不是简单红色弹窗，而是网络逐步失去连接，明确说明失败原因和可复盘决策。

所有动效必须服务于状态理解，而不是装饰。

### 2.3 视觉基调

从“整页浅米色纸张”升级为“深色博物馆空间 + 局部温暖展签”：

主背景：

- 深岩灰、墨绿黑、洞窟褐黑；
- 不使用纯黑；
- 允许极轻颗粒和石壁纹理，但不能影响文字可读性。

核心文化色：

- 朱砂红：当前行动、关键确认；
- 石青：探索、知识；
- 石绿：修护、稳定；
- 金箔暖黄：成就、连接、历史层；
- 岩土赭：威胁、风化；
- 象牙白：正文和展签面板。

颜色使用必须语义化。金色禁止作为小号低对比正文。

### 2.4 排版

建议字体角色：

- 展示标题：思源宋体 / Noto Serif SC，使用中高字重；
- 界面正文：思源黑体 / Noto Sans SC；
- 数字、AP、轮次：可用克制的等宽字体；
- 不再让所有界面文字都使用宋体；
- 不使用运行时 Google Fonts `@import`；
- 使用合法、可再分发的本地 WOFF2 子集，并保留许可证说明；
- 中文正文最小 14px，主要操作 15–16px；
- 行高、段宽和字重按阅读场景分级。

### 2.5 形状语言

不要继续用“所有内容都是矩形卡片”。

建立三类形状：

1. **石龛**：节点、角色和成就；
2. **展签**：文化解释、任务信息、来源；
3. **器物托盘**：手牌、市场、动作工具。

圆角应克制，避免现代 SaaS 的大圆角气泡感。边框只在需要定义物理层级时使用。

### 2.6 图标语言

- 节点、角色、文明领域继续使用自有文化徽章；
- 通用系统图标可使用 `lucide-react`；
- 禁止用 Lucide 替代所有文化图标；
- 所有图标统一线宽、尺寸、光影和底座；
- 禁止使用 emoji、`✦`、`⌖` 等临时符号作为正式设计。

---

## 3. 新的信息架构与页面流程

### 3.1 页面层级

构建以下完整流程：

1. `/`：品牌引导与新建/继续游戏；
2. `/game/:sessionId`：主游戏；
3. 游戏内 onboarding：首次进入 3 步引导；
4. 回合行动状态；
5. `pending_choice` 选择状态；
6. 回合事件结算；
7. 任务完成文化解读；
8. 胜利/失败与复盘；
9. 存档不存在、版本冲突、离线、服务器错误等恢复状态。

可以使用 React Router，也可以保持轻路由，但 URL 必须可分享和恢复。

### 3.2 新建游戏页

不再默认静默创建 `demo`。

创建一个有品牌感的开始页：

- 15 秒内能理解主题；
- 可选择 2–4 人、角色和难度；
- 显示预计时长和合作目标；
- 提供“继续上次旅程”；
- 提供“快速演示局”；
- 角色选择显示能力、起点和文化身份；
- 创建成功后跳转正式 session URL。

### 3.3 桌面主界面

目标：1440×900 下主要决策无需纵向滚动。

推荐布局：

- 顶部 64–72px：品牌、轮次、当前事件倒计时、共同目标；
- 中央主舞台：遗产节点网络，占视口主要面积；
- 左侧窄栏：全体玩家、当前位置、贡献状态；
- 右侧上下文栏：当前节点任务、事件预告、文化说明；
- 底部动作坞：当前玩家 AP、合法动作、手牌和市场入口；
- 详情使用可关闭的侧抽屉或底部面板，不永久占据地图空间。

不要照搬该布局；根据真实内容密度优化，但必须形成“地图是舞台、上下文围绕舞台”的结构。

### 3.4 移动端

390px 不能简单把桌面列堆叠成超长页面。

移动端改为：

- 顶部紧凑状态栏；
- 主区域在“地图 / 任务 / 手牌”三个视图间切换；
- 操作使用底部固定动作栏和可访问 Bottom Sheet；
- 地图支持安全的缩放/平移，也提供节点列表替代操作；
- 所有核心功能不依赖拖拽；
- 点击目标至少 44×44 CSS px；
- 不允许整页水平滚动。

### 3.5 必须完整表现的状态

每一个组件都要有 Storybook 状态：

- loading；
- empty；
- disabled；
- focused；
- selected；
- success；
- warning；
- danger；
- closed；
- pending；
- revision conflict；
- offline；
- game over；
- reduced motion。

“0 项可用”必须转化为具体原因：

- 游戏已结束；
- 等待团队选择；
- 当前玩家无 AP；
- 当前节点关闭；
- 状态正在同步；
- 服务端异常。

---

## 4. 前端架构升级

### 4.1 技术栈

把 `frontend/` 迁移为：

- React 19；
- TypeScript，`strict: true`；
- Vite 最新稳定版，Node 22 LTS；
- Tailwind CSS 4，使用官方 Vite 插件；
- 自定义 CSS design tokens，不使用 Tailwind 默认色板作为品牌视觉；
- Radix UI Primitives，仅用于 Dialog、Tooltip、Tabs、Popover、ScrollArea、Progress、VisuallyHidden 等无障碍行为；
- Motion for React，导入路径使用 `motion/react`；
- TanStack Query 管理服务端状态；
- Zustand 仅管理短暂 UI 状态；
- `openapi-typescript` + `openapi-fetch` 从 FastAPI OpenAPI 生成类型安全客户端；
- `class-variance-authority`、`clsx`、`tailwind-merge` 管理组件变体；
- `lucide-react` 仅用于通用系统图标；
- Storybook；
- Vitest + Testing Library；
- Playwright；
- `@axe-core/playwright`；
- MSW 用于 Storybook 和前端测试中的 API mock。

版本使用最新稳定、互相兼容的版本，并提交锁文件。不要写宽泛的 `latest` 到依赖清单。

### 4.2 为什么不用重型全局状态

游戏状态是服务端权威，必须存放在 TanStack Query cache：

```ts
['game', sessionId]
```

动作使用 mutation：

- 发送 `expected_revision`；
- 禁止本地复制游戏规则；
- 禁止对复杂规则做乐观修改；
- 成功时使用服务端完整响应更新 cache；
- 409 时用服务端返回的最新状态覆盖 cache，并给出可理解提示；
- 网络中断时保留最后状态，但明确标记“只读/待同步”。

Zustand 只存：

- 当前聚焦节点；
- 当前查看卡牌；
- 地图缩放位置；
- 抽屉开关；
- 声音开关；
- 用户动效偏好；
- onboarding 是否已完成。

### 4.3 目录结构

采用轻量 Feature-Sliced 结构：

```text
frontend/
  index.html
  package.json
  vite.config.ts
  src/
    app/
      App.tsx
      router.tsx
      providers.tsx
      error-boundary.tsx
    pages/
      landing/
      game/
      result/
    features/
      create-game/
      perform-action/
      inspect-site/
      inspect-card/
      resolve-choice/
      onboarding/
    entities/
      game/
      player/
      site/
      task/
      event/
      culture-card/
    widgets/
      heritage-network/
      turn-command-dock/
      mission-panel/
      event-forecast/
      player-roster/
      culture-market/
      hand-tray/
      game-result/
    shared/
      api/
        generated/
        client.ts
        query-keys.ts
      ui/
        button/
        panel/
        dialog/
        sheet/
        tooltip/
        progress/
        badge/
        empty-state/
        skeleton/
      lib/
      hooks/
      assets/
      styles/
        tokens.css
        typography.css
        motion.css
        globals.css
```

不要把所有内容重新塞回 `App.tsx`。

### 4.4 设计 token

使用 CSS custom properties 和 Tailwind 4 `@theme` 建立：

- primitive colors；
- semantic colors；
- typography；
- spacing；
- radius；
- border；
- elevation；
- opacity；
- z-index；
- motion duration；
- easing；
- map/node sizes。

至少支持：

```css
--surface-cave
--surface-stone
--surface-label
--text-primary
--text-secondary
--text-inverse
--accent-cinnabar
--accent-azure
--accent-malachite
--accent-gold
--state-stable
--state-risk
--state-closed
--focus-ring
```

不得在组件中散落大量任意 hex 值。

### 4.5 组件 API

所有通用组件必须：

- props 类型明确；
- 支持 `className`；
- 支持键盘；
- 有可见焦点；
- 有 loading/disabled；
- 不在组件内部读取全局游戏状态；
- 在 Storybook 中覆盖主要状态；
- 业务组件和基础 UI 组件分离。

---

## 5. 遗产网络地图重构

### 5.1 技术实现

使用自定义语义化 SVG，不使用 React Flow。

- 节点坐标来自 `/api/meta` 的 `x/y`；
- 连接边来自 routes 或 site connections；
- 使用正常 `viewBox`，禁止 `preserveAspectRatio="none"` 拉伸；
- SVG 路径必须可根据视口自适应；
- 节点实际交互使用 `<button>` 或可访问 SVG 元素；
- 支持键盘在相邻节点之间移动焦点；
- 支持 Zoom In、Zoom Out、Reset；
- 移动端提供节点列表等价入口；
- 路线可显示普通、可达、选中、阻断和已完成状态；
- 多玩家同节点必须可辨认。

### 5.2 视觉表现

- 中央佛像不再低透明度漂浮；
- 将佛像做成中央石龛的视觉核心；
- 使用径向光、局部遮罩和纹理层，不能降低文字对比度；
- 节点不是统一白圆，而是统一结构下的不同文化徽章；
- 当前节点、可达节点、危险节点、关闭节点要同时依赖形状、图标和文字，不只依赖颜色；
- 路线表现为“丝路/光路”，而不是普通流程图虚线；
- 动画只使用 transform、opacity、stroke-dashoffset 等性能友好属性；
- `prefers-reduced-motion` 下关闭路径流动和视差。

### 5.3 节点详情

聚焦节点后显示：

- 节点名称；
- 文化摘要；
- 场景图；
- 损伤 0/3；
- 当前任务名称；
- 任务需要的领域；
- 来源多样性；
- 已贡献卡牌；
- 参与玩家；
- 本回合可执行动作；
- 内容审核状态；
- 资料来源入口。

不是只显示“未探索 / 损伤 0/3”。

---

## 6. 游戏操作体验重构

### 6.1 行动坞

把当前右栏“行动手册”改为情境化 Command Dock：

- 始终显示 AP；
- 最推荐动作有明确主按钮；
- 其他动作按“移动、探索、协作、修护、技能”分组；
- 点击动作后再选择合法目标；
- 地图上同步高亮合法目标；
- Escape 可取消；
- 选中状态有返回路径；
- 无动作时显示原因和建议；
- 动作提交时按钮锁定并显示局部反馈；
- 成功后聚焦回到合适位置；
- 错误提示不得只显示后端英文字符串。

### 6.2 公开文化市场

后端已有 `market`，必须在主界面真实展示：

- 3 张公开文化牌；
- 卡牌领域、来源、效果和文化说明；
- 可选择牌有明确高亮；
- 不可选说明原因；
- 牌面风格统一；
- 详情通过 Dialog/Drawer；
- 卡牌贡献时显示它能满足任务的哪些条件；
- 卡牌使用与贡献必须是两个明确动作，避免误操作。

### 6.3 手牌

- 默认以底部托盘呈现；
- 空手牌状态占用最小空间；
- 手牌数量变化有克制的发牌动画；
- 拖拽不是唯一操作方式；
- 键盘和点击均可操作；
- 手牌上限和弃牌状态清晰；
- 卡牌不显示内部 ID；
- 当前只有 4 张硬编码名称的问题必须消失。

### 6.4 任务进度

使用“证据槽”而不是普通进度条：

- 领域槽；
- 来源多样性槽；
- 贡献者标记；
- 当前差距；
- 完成后文化解释；
- 奖励动画。

### 6.5 事件预告

当前事件不能只被折叠成“环境压力”。

事件面板必须显示：

- 事件名称；
- 事件插画/图标；
- 将在何时结算；
- 影响哪些节点；
- 玩家可以如何应对；
- 已采取的缓解行动；
- 结算后的实际影响。

`pending_choice` 必须使用阻断式但可访问的团队决策 Dialog。

### 6.6 玩家与合作感

显示所有玩家：

- 角色名和真实角色名称；
- 当前位置；
- AP；
- 手牌数量；
- 技能是否可用；
- 贡献数；
- 当前行动者；
- 同节点状态。

不要只显示当前玩家 1。

### 6.7 日志与叙事

把“沿途发生”重构为旅程时间线：

- 动作类型图标；
- 行动者；
- 节点；
- 结果；
- 文化解释；
- 可按回合折叠；
- 默认只显示关键事件；
- 调试 JSON 仅开发环境可访问。

### 6.8 胜负与复盘

当前回合超过上限或游戏结束时必须立即进入明确结果状态。

结算页显示：

- 胜利/失败；
- 触发原因；
- 完成任务；
- 五类文化印记；
- 各玩家贡献；
- 关键决策时间线；
- 本局出现的文化内容；
- 来源；
- 再来一局；
- 分享结果图；
- 返回首页。

不得出现“第 9 回合、0 项可用”但没有解释的死界面。

---

## 7. 静态资产与艺术指导

### 7.1 资产审计

扫描：

- `frontend/static/ui-assets/`
- `frontend/static/ui-assets/generated/`
- `frontend/static/ui-assets/generated/source/`

输出：

`docs/design/ASSET_AUDIT.md`

对每个资源记录：

- 文件名；
- 尺寸；
- 体积；
- 格式；
- 用途；
- 是否实际使用；
- 是否重复；
- 风格是否一致；
- 建议保留、重制或删除。

### 7.2 资产处理

- PNG 优先生成 AVIF/WebP；
- 保留必要 alpha；
- 根据展示尺寸输出多规格；
- 使用 `srcset` / `picture`；
- 首屏只预加载中央关键视觉；
- 节点详情图延迟加载；
- 删除生产构建中的 `_orig` 或 source 原图；
- 不直接拉伸位图；
- 为不同宽高比制作合理裁切；
- 所有图片提供 alt 或标记为装饰。

可使用 `sharp` 或 `vite-imagetools` 建立可重复脚本。

### 7.3 风格统一

现有资源包含写实、浮雕、生成插画和扁平图标。通过统一处理解决割裂：

- 统一色温；
- 统一对比度；
- 统一颗粒；
- 统一边缘处理；
- 统一图标底座；
- 统一阴影方向；
- 统一节点场景裁切比例。

不要继续把未经处理的各种图片直接混排。

---

## 8. 动效、声音与反馈

### 8.1 Motion 系统

使用 Motion for React，但建立统一 token：

- micro：120–180ms；
- standard：220–320ms；
- narrative：500–900ms；
- 只允许 2–3 套 easing；
- 禁止所有组件各自使用随机弹簧。

关键动效：

- 页面进入；
- 节点聚焦；
- 路线激活；
- 卡牌发入手牌；
- 卡牌贡献；
- 修护；
- 事件结算；
- 任务完成；
- 回合切换；
- 胜负。

所有动效必须在 `prefers-reduced-motion` 下有静态替代。

### 8.2 声音

P1 可增加极轻声音：

- 石击；
- 纸张；
- 风沙；
- 钟磬；
- 任务完成。

要求：

- 默认音量克制；
- 明确静音按钮；
- 不自动播放长音乐；
- 不影响无障碍；
- 没有合法素材时使用占位接口，不引入未经授权音频。

---

## 9. 后端架构提升

### 9.1 目标架构

保持模块化单体：

```text
backend/
  app.py
  api/
    dependencies.py
    routers/
      meta.py
      games.py
  domain/
    models.py
    enums.py
    commands.py
    engine.py
    actions/
    effects/
    selectors.py
    validation.py
  content/
    loader.py
    schemas.py
  infrastructure/
    repository.py
    database.py
  services/
    game_service.py
```

根据实际规模适度调整，不为目录而目录。

### 9.2 动作协议

把自由字符串动作改为 Pydantic 判别联合，例如：

```py
class MoveAction(BaseModel):
    action: Literal["move"]
    player_id: str
    expected_revision: int
    target_site_id: str
```

为以下动作分别建模：

- move；
- explore；
- contribute；
- restore；
- exchange；
- use_skill；
- play_card；
- end_turn；
- resolve_event；
- select_market_card；
- discard。

OpenAPI 必须生成准确的请求和响应 schema，供前端类型生成。

### 9.3 枚举和效果

为以下内容建立 Enum / discriminated union：

- GameOutcome；
- SiteStatus；
- ActionType；
- PendingChoiceKind；
- Domain；
- RoleAbility；
- CardEffect；
- EventEffect。

删除散落的 magic strings 和 `if event_id == "route_blocked"` 之类的特殊分支；特殊事件通过效果处理器注册表实现。

### 9.4 Content validation

为 roles、sites、routes、cards、tasks、events、difficulty 建立 Pydantic 内容模型。

启动时验证：

- ID 唯一；
- route 双向/单向语义明确；
- 坐标范围；
- 引用存在；
- role start site 存在；
- active task 与 site 匹配；
- domain 合法；
- card effect 合法；
- task 可完成；
- reward 合法；
- 文化来源字段和审核状态存在；
- 资源数值不越界。

生成 `scripts/validate_content.py`。

### 9.5 Repository

当前 JSON snapshot 模式可以保留，但提升为可靠持久化：

- 使用 SQLAlchemy 2；
- Alembic 迁移；
- 开发环境 SQLite；
- 生产环境可切 PostgreSQL；
- 表字段至少包括：
  - session_id；
  - schema_version；
  - revision；
  - state JSON；
  - created_at；
  - updated_at；
- 使用 UUID 或 ULID，不使用 COUNT 生成 ID；
- revision 更新必须原子：
  - `UPDATE ... WHERE session_id = ? AND revision = expected_revision`
- 冲突返回 409；
- repository 接口可在测试中替换为内存实现。

不要无必要改为 async SQLAlchemy；同步实现更简单时保持同步。

### 9.6 FastAPI 边界

- 使用 lifespan 初始化依赖；
- 使用 FastAPI Depends 注入 service/repository；
- 路由只负责协议与错误映射；
- 领域层不抛 HTTPException；
- 统一错误结构：
  - code；
  - message；
  - details；
  - current_state（冲突时）；
- 增加 request id；
- 使用结构化日志；
- 隐藏生产环境 traceback；
- 保留 `/api/meta`、创建游戏、读取游戏、动作接口；
- 如有破坏性变更，使用 `/api/v2`，并更新文档。

---

## 10. 工程工具链

### 10.1 Python

迁移到 `pyproject.toml`，建议：

- Python 3.12；
- FastAPI；
- Pydantic 2；
- SQLAlchemy 2；
- Alembic；
- Uvicorn；
- pytest；
- pytest-cov；
- Ruff；
- mypy 或 Pyright。

使用 `uv.lock` 或等价锁文件。不要继续只写无上限的 `>=` 依赖。

### 10.2 前端

脚本至少包括：

```json
{
  "dev": "...",
  "build": "...",
  "typecheck": "...",
  "lint": "...",
  "test": "...",
  "test:ui": "...",
  "test:e2e": "...",
  "storybook": "...",
  "build-storybook": "...",
  "api:generate": "...",
  "assets:optimize": "..."
}
```

### 10.3 FastAPI 与 Vite 集成

开发：

- Vite dev server；
- `/api` proxy 到 FastAPI；
- HMR；
- 单独启动前后端，提供一个统一开发命令。

生产：

- Vite 输出 `frontend/dist`；
- FastAPI 只挂载 dist；
- index fallback 支持 SPA route；
- hashed assets 长缓存；
- `index.html` no-cache；
- Brotli/Gzip 由部署层配置。

### 10.4 CI

新增 GitHub Actions：

Backend：

- Ruff；
- typecheck；
- pytest；
- coverage。

Frontend：

- install with lock；
- typecheck；
- lint；
- Vitest；
- Storybook build；
- production build。

E2E：

- 启动 FastAPI；
- Playwright Chromium；
- 核心旅程；
- screenshot comparison；
- axe。

Artifacts：

- Lighthouse report；
- Playwright report；
- screenshots；
- coverage；
- Storybook static build。

---

## 11. 测试与审计

### 11.1 后端测试

扩展测试覆盖：

- 创建 2–4 人游戏；
- meta 内容；
- 所有动作；
- 角色技能；
- pending choice；
- revision conflict；
- game over；
- 任务完成；
- 事件结算；
- SQLite 重载；
- 原子更新；
- 内容校验；
- 不合法请求；
- 旧存档提示。

覆盖率目标：领域核心逻辑不低于 90%。

### 11.2 前端组件测试

至少覆盖：

- ActionDock；
- SiteNode；
- TaskProgress；
- EventForecast；
- CultureCard；
- Market；
- HandTray；
- PendingChoiceDialog；
- RevisionConflict；
- GameResult。

### 11.3 Playwright 主流程

至少实现：

1. 打开首页；
2. 创建普通难度双人游戏；
3. 进入 onboarding；
4. 选择当前合法移动；
5. 探索并从市场选择卡牌；
6. 查看卡牌；
7. 贡献卡牌；
8. 修护；
9. 结束回合；
10. 触发事件；
11. 处理 pending choice；
12. 模拟 revision conflict；
13. 截取任务完成；
14. 截取胜利与失败。

### 11.4 视觉回归

使用 Playwright `toHaveScreenshot()`，在固定 Docker/CI 环境生成基线。

覆盖：

- landing；
- game normal；
- focused node；
- market；
- card dialog；
- pending choice；
- task complete；
- victory；
- defeat；
- desktop/tablet/mobile；
- reduced motion。

### 11.5 可访问性

目标 WCAG 2.2 AA：

- 键盘完整操作；
- 可见焦点；
- 对比度；
- 24px 最低目标，项目内部优先 44px；
- Dialog 焦点管理；
- 不只用颜色传达状态；
- 屏幕阅读器可理解地图；
- 拖拽有等价操作；
- 放大 200% 不丢功能；
- 390px 不横向溢出；
- `prefers-reduced-motion`；
- Storybook a11y；
- Playwright axe；
- 人工键盘检查清单。

### 11.6 性能预算

目标：

- LCP ≤ 2.5s；
- INP ≤ 200ms；
- CLS ≤ 0.1；
- Lighthouse Accessibility ≥ 95；
- Lighthouse Best Practices ≥ 95；
- 桌面 Performance ≥ 90；
- 移动 Performance ≥ 85；
- 首屏 JS gzip 尽量 ≤ 220KB；
- 首屏图片总量尽量 ≤ 1.2MB；
- 单个非关键图片 ≤ 250KB；
- 详情图 lazy-load；
- 不使用运行时远程字体；
- 无明显布局跳动。

若未达到，输出原因和后续计划，不得伪造报告。

---

## 12. Red Dot 导向的设计验收矩阵

新增：

`docs/design/RED_DOT_READINESS.md`

按以下维度逐条自评，并附证据文件或截图：

### Idea：原创与创意

- 是否有一句可复述的核心概念；
- 视觉和交互是否由同一隐喻驱动；
- 是否区别于古风 H5、普通桌游和后台系统；
- 文化主题是否通过交互发生，而非只做背景。

### Form：设计质量与创新

- 是否建立一致视觉系统；
- 是否有清晰的形状、色彩、字体、图标和动效语言；
- 是否在各视口保持质量；
- 是否处理资源风格割裂；
- 是否避免默认组件库外观。

### Impact：理解与情绪

- 5 秒内是否知道当前目标；
- 10 秒内是否知道当前风险；
- 玩家是否能预测动作结果；
- 任务完成是否产生文化记忆点；
- 胜负是否形成完整叙事闭环。

### Function / Use

- 主流程是否无死路；
- 空状态、错误状态、结束状态是否完整；
- 是否支持键盘和移动端；
- 是否有稳定性能和明确反馈。

### Seduction

- 首屏是否具有强视觉吸引力；
- 地图是否成为可识别关键视觉；
- 微动效是否增强仪式感；
- 产品截图是否可以脱离说明独立传达品质。

### Responsibility

- 文化内容是否标记来源和审核状态；
- 是否尊重字体、图片、声音版权；
- 是否减少无意义资源加载；
- 是否满足无障碍；
- 是否不编造用户研究结果。

所有维度必须有证据，不能只写“已完成”。

---

## 13. 文化体验参照原则

参考成熟文化数字体验的共同方法，但不要复制视觉：

- 以访客行为为中心，而不是以资料目录为中心；
- 用路线、聚焦、参与和记录帮助理解展品；
- 让玩家成为文化关系的主动构建者；
- 用互动完成教育目标，而不是依赖长段说明；
- 让传统内容与现代交互并存，而不是做表面古风；
- 把修护行为、任务组合和共同选择变成文化叙事本身。

---

## 14. 实施阶段

### Phase 0：审计与冻结

- 现状截图；
- 测试基线；
- 资产清单；
- 数据/API 清单；
- Git checkpoint。

### Phase 1：架构地基

- Vite + React + TS；
- OpenAPI type generation；
- Query client；
- 设计 token；
- Storybook；
- CI 基础；
- FastAPI dist serving。

### Phase 2：核心体验骨架

- Landing；
- Game shell；
- 玩家栏；
- Event forecast；
- Context panel；
- Command dock；
- 基础响应式。

### Phase 3：地图与内容

- SVG map；
- 节点状态；
- 路线状态；
- 任务进度；
- 市场；
- 手牌；
- 详情抽屉。

### Phase 4：动效与叙事

- 回合；
- 贡献；
- 修护；
- 事件；
- 任务完成；
- 胜负；
- reduced motion。

### Phase 5：后端硬化

- typed actions；
- typed effects；
- content schemas；
- repository；
- dependency injection；
- structured errors。

### Phase 6：审计与打磨

- Storybook states；
- Vitest；
- Playwright；
- a11y；
- visual regression；
- Lighthouse；
- asset compression；
- microcopy；
- final screenshots。

每个 Phase 结束后运行相关测试并提交。

---

## 15. 最终交付物

必须提交：

1. 可启动的重构代码；
2. 新前端源码和锁文件；
3. 新后端结构；
4. OpenAPI 生成类型；
5. 设计系统；
6. Storybook；
7. 单元、组件和 E2E 测试；
8. CI；
9. 视觉回归基线；
10. 多视口截图；
11. Lighthouse/axe 报告；
12. 资产审计；
13. 架构文档；
14. UX 流程图；
15. Red Dot readiness 自评；
16. 迁移说明；
17. 部署说明；
18. PR 描述。

文档建议：

```text
docs/
  audit/
    CURRENT_STATE_AUDIT.md
  design/
    DESIGN_NORTH_STAR.md
    DESIGN_SYSTEM.md
    UX_FLOW.md
    ASSET_AUDIT.md
    MOTION_SYSTEM.md
    CONTENT_DESIGN.md
    RED_DOT_READINESS.md
  engineering/
    FRONTEND_ARCHITECTURE.md
    BACKEND_ARCHITECTURE.md
    API_CONTRACT.md
    TEST_STRATEGY.md
    PERFORMANCE_BUDGET.md
  award/
    CONCEPT_STATEMENT.md
    DEMO_STORYBOARD.md
    USER_TEST_PLAN.md
```

`USER_TEST_PLAN.md` 只能写测试方案和待填写结果，不得伪造访谈数据。

---

## 16. 最终验收标准

只有同时满足以下条件才可宣布完成：

1. 产品不再呈现为通用后台 Dashboard；
2. 首屏有清晰、独特的云冈关键视觉；
3. 地图是主要交互舞台；
4. 角色名称、节点、卡牌、路线不再前端硬编码；
5. 公开市场、任务进度、事件预告、其他玩家均可见；
6. 不再出现代码 ID、原始 JSON 和编码错误；
7. 游戏结束有明确结果页；
8. 0 动作状态有解释和恢复路径；
9. 桌面主要决策无需长页面滚动；
10. 移动端不是简单纵向堆叠；
11. 390px 无整页横向滚动；
12. 组件化 React/TS 架构完成；
13. API 类型从 OpenAPI 自动生成；
14. 服务端仍是规则唯一来源；
15. 后端动作和效果实现强类型化；
16. revision 冲突有正确处理；
17. 所有核心组件有 Storybook；
18. Playwright 主流程通过；
19. 视觉回归可运行；
20. axe 无严重或关键违规；
21. Lighthouse 达到预算，或提供真实差距报告；
22. 图片完成压缩和响应式处理；
23. 本地字体合法、无 Google Fonts 运行时依赖；
24. `prefers-reduced-motion` 生效；
25. 全部文化内容保留来源和审核状态；
26. README 提供一条命令启动开发环境；
27. 生产构建可由 FastAPI 正常服务；
28. CI 通过；
29. 最终截图可以用于答辩和作品集；
30. PR 中明确列出已完成、未完成、风险和回退方式。

---

## 17. Codex 最终回复格式

完成后按以下结构回复：

1. **现状审计摘要**
2. **设计概念**
3. **架构决定**
4. **使用库及选择理由**
5. **关键 UX 改动**
6. **关键视觉改动**
7. **前端文件变化**
8. **后端文件变化**
9. **API 变化**
10. **数据与资产变化**
11. **测试命令与实际结果**
12. **Lighthouse / axe 实际结果**
13. **截图路径**
14. **CI 状态**
15. **手动验收步骤**
16. **尚未完成内容**
17. **风险与回退方法**

不要只给截图，不要只给代码片段，不要只给设计说明。实际修改仓库、运行测试、修复失败，并保持项目可启动。
