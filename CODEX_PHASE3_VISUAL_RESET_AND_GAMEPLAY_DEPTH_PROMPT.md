# Codex 第三阶段主任务：视觉减法、地图重构与核心玩法纵深

仓库：`https://github.com/future3317/yungang`

本阶段基于当前 schema v3 和第一、二阶段代码继续开发。不要回退已经完成的：

- React + TypeScript + Vite；
- TanStack Query；
- 动作模式；
- 409 revision 同步；
- d3 zoom；
- 元数据驱动；
- scenario / region / route / project / objective / seed 基础结构。

当前版本的问题不是“素材不够”，而是：

1. 素材同时叠加过多，缺少主次；
2. 地图仍采用密集网络图表达，路线穿插；
3. 节点像悬浮卡片，不像地图地点；
4. 佛像、节点、路线、背景、边框争夺注意力；
5. 第二阶段机制多数只是数据脚手架，尚未形成有意义的策略循环。

本阶段必须以“删除、收敛、验证”为主，不要继续无差别增加节点、纹样、边框、发光和占位内容。

---

## 0. 开始前

确认工作分支和现有提交：

```bash
git status
git branch --show-current
git log -8 --oneline
```

创建检查点：

```text
chore: checkpoint phase-2 world map scaffold
```

运行：

```bash
pytest
cd frontend
npm run typecheck
npm run build
```

新增：

`docs/audit/PHASE3_VISUAL_AND_MECHANICS_AUDIT.md`

记录当前截图和代码中以下问题：

- 路线使用 `<line>` 与位图路线双重绘制；
- 路线位图使用 `preserveAspectRatio="none"`；
- `network-frame image` 全局 `mix-blend-mode: screen`；
- 佛像硬编码在 SVG 中并被路线穿过；
- region label 用节点坐标平均值生成；
- 节点均为同一种浮动深色卡片；
- 三栏、底部坞、时间线和聚焦条同时占用地图；
- 双向路线被建模为两条独立 route；
- scenario 是否真实筛选节点、路线、任务、牌库和事件；
- prepare、card effect、role upgrade、project stage 是否真实生效；
- placeholder 内容比例。

审计后继续实际修改。

---

# 一、视觉方向彻底调整

## 1.1 新概念

停止把主界面设计成“发光网络图”。

新视觉概念：

# 「大同文化舆图 / Cultural Atlas of Datong」

核心表达：

- 地图是由四个文化区域组成的抽象舆图；
- 节点是地点或文化设施；
- 路线只在需要决策时显现；
- 文物和佛像用于节点内容、章节进入和完成仪式，不直接作为全局地图底图；
- 传统素材是内容，不是到处铺设的皮肤。

主界面要像一张可操作的博物馆舆图，而不是知识图谱、流程图或深色 Dashboard。

## 1.2 必须删除

从主地图删除：

- 中央大佛图；
- 所有路线 PNG；
- `preserveAspectRatio="none"` 位图路线；
- 全局 `mix-blend-mode: screen`；
- 所有永久显示的路线发光；
- 大面积重复云纹、水纹和石刻边框；
- 节点外部完整黑色卡片；
- 地图顶部长期占用的大标题；
- 地图底部长期占用的聚焦横条；
- 永久展开的右侧任务、事件和市场三块面板；
- 地图外四周不必要的装饰框。

佛像资源移动到：

- 云冈石窟节点详情；
- 核心项目完成动画；
- 首页或章节封面；
- 结算页。

不得继续作为地图中央背景。

## 1.3 素材使用规则

新增 `docs/design/ASSET_USAGE_RULES.md`：

1. 一个视图最多一个主视觉资产；
2. 不拉伸任何具象素材；
3. 不允许 `preserveAspectRatio="none"` 用于纹理、图案和插画；
4. 装饰纹样保持原比例，使用裁切、mask、repeat 或九宫格；
5. 不对所有图片统一使用 blend mode；
6. 边框素材只用于真正的容器边缘；
7. 节点图标统一尺寸、色温和轮廓；
8. 地图背景只保留低对比纸/岩层纹理；
9. 所有资源在 Storybook 中单独审查；
10. 建立 unused / duplicated / stretched 资源检查脚本。

---

# 二、地图重构

## 2.1 地图拓扑

当前路线数据是 A→B 和 B→A 两条独立记录。重构为单一无向 Route：

```json
{
  "id": "route_yungang_huayan",
  "endpoints": ["yungang", "huayan_temple"],
  "movement_cost": 1,
  "status": "open",
  "risk": 0,
  "connection_level": 0,
  "tags": []
}
```

只有确实存在方向差异时才增加：

```json
"directional_rules": {}
```

必须迁移：

- route state；
- movement selector；
- scenario blocked routes；
- objective counting；
- map renderer；
- test fixtures。

避免：

- 只阻断单方向；
- 同一路线被统计两次；
- UI 任选一条方向状态显示；
- route objective 虚高。

## 2.2 控制地图连接数量

所有 18 个节点不应形成蜘蛛网。

规则：

- 每个普通节点度数 1–3；
- 每个区域内部形成清晰的主路和支路；
- 区域之间只有 1–2 条门户路线；
- 标准情景只启用 10–12 个节点；
- 长局最多启用 14–16 个节点；
- 其余节点用于不同 seed 和情景轮换；
- 不在同一局同时展示全部内容。

建立拓扑检查：

- 无孤立的必需节点；
- 无过度连接节点；
- 无不必要交叉；
- 至少存在两种宏观路线选择；
- 被阻断后仍有替代路线，除非情景明确要求断网。

## 2.3 路线绘制

使用纯 SVG Bézier path：

```tsx
<path d={...} />
```

禁止使用路线 PNG。

路线视觉状态：

- 默认：极细、低对比；
- 当前节点相邻：中等对比；
- 可移动：明确但克制；
- 目标预览：高亮；
- strained：间断；
- blocked：缺口和风险标记；
- restored：连续石青；
- illuminated：金色，但只在局部出现；
- 事件目标：赭红脉冲。

默认视图只显示：

- 区域主干路线；
- 当前节点邻接路线；
- 有异常状态的路线。

其他支路在节点聚焦或缩放后显现。

不要动画所有路线。只动画当前行动和事件结算路径。

## 2.4 区域设计

四个区域使用低对比色块、等高线或淡墨地貌区分，不使用浮动胶囊文字。

区域名称固定在区域内部合适位置，不用节点坐标平均值自动放置。

`regions.json` 增加：

```json
{
  "label_position": {"x": 20, "y": 30},
  "hull_points": [],
  "visual_token": "region-pingcheng",
  "description": "",
  "content_review_status": "placeholder"
}
```

区域边界可以用 SVG path 或 polygon 表达。

## 2.5 节点视觉

节点不再是“图标 + 黑色矩形卡”。

建立三种节点：

### 核心遗产

- 44–56px 圆形或龛形徽记；
- 名称放在外部；
- 选中时出现外环；
- 风险用环形缺口表示；
- 玩家用小型角色标记围绕节点。

### 支撑设施

- 32–40px 简化符号；
- 名称在聚焦或足够缩放时出现；
- 不使用大卡片。

### 临时事件点

- 24–32px；
- 只在事件期间出现；
- 事件结束后消失。

节点内部不显示 `0/3 损伤` 文本。使用图形状态，详情抽屉显示精确数值。

当前节点不使用大面积朱红色卡片，仅用：

- 外环；
- 玩家标记；
- 短标签；
- 可访问文本。

## 2.6 LOD

根据 zoom level：

- `< 0.9`：只显示区域、核心节点、主干路线；
- `0.9–1.25`：显示启用节点和重要路线；
- `> 1.25`：显示支撑节点、风险、玩家、次要路线和标签。

节点本体使用 screen-space size，不随缩放无限放大。

## 2.7 页面布局

主游戏：

- Header：52–60px；
- Map：填满剩余空间；
- Command Dock：96–120px；
- Roster：左侧折叠浮层，默认宽 220px；
- Context Drawer：右侧滑入，宽 360–420px；
- Market / Hand：从底部坞展开；
- Timeline：抽屉，不永久显示；
- 节点聚焦信息进入右侧 Drawer，不占地图底部。

1440×900 下不得出现：

- 大标题压住玩家列表；
- 右侧三个永久框；
- 底部坞遮挡节点；
- 左右内容互相覆盖。

---

# 三、排版重构

使用本地合法 WOFF2：

- Noto Sans SC Variable；
- Noto Serif SC Variable。

排版 token：

```css
--font-display: "Noto Serif SC";
--font-ui: "Noto Sans SC";

--text-display: clamp(40px, 4vw, 58px);
--text-h1: 36px;
--text-h2: 24px;
--text-h3: 18px;
--text-body: 16px;
--text-body-small: 14px;
--text-label: 13px;
--text-caption: 12px;
```

要求：

- 功能性中文不低于 12px；
- 正文默认 16px；
- 次要正文 14px；
- 不使用 9–11px 中文；
- 不把大量中文放进等宽字体；
- 英文只作二级信息；
- 标签字距不超过 `.08em`；
- 大标题只在首页或章节进入显示，游戏中缩小；
- 对比度达到 WCAG 2.2 AA。

---

# 四、机制审查与修复

## 4.1 先修复当前“看起来有系统、实际没生效”的问题

逐项写测试并修复：

### Prepare

当前 `prepare` 消耗 AP 并记录 event id，但事件结算必须实际读取准备状态。

设计：

- 玩家准备时选择一个目标节点或路线；
- 结算时减少该目标 1 点损伤/风险；
- 或为团队提供一次响应选项；
- 事件结束后清除准备标记；
- UI 显示谁准备、保护了哪里。

### Next contribute bonus

`next_contribute_bonus` 必须在贡献时：

- 被读取；
- 增加指定推进或影响；
- 消耗 flag；
- 写入日志；
- 有测试。

### Harmony

`harmony_active` 必须真实影响来源多样性，并在使用后消耗。

### Role upgrade

建立明确触发：

- 玩家首次完成项目阶段或累计 3 次贡献；
- 进入 `pending_choice: role_upgrade`；
- 选择后能力真实改变 selector/effect；
- 每局最多一次。

### Action cards

`action_cards.json` 当前被加载但必须真正进入对应情景牌库，或明确删除该文件。不得存在“配置了但游戏从不使用”。

### Scenario

每个 scenario 必须真实决定：

- enabled site ids；
- enabled route ids；
- project pool；
- task pool；
- culture deck composition；
- action card composition；
- event deck composition；
- initial damage；
- blocked routes；
- objectives；
- win/fail conditions。

不能只改回合、资源和目标数字。

## 4.2 项目系统

删除：

- “多阶段文化项目 01”
- “多阶段文化项目 02”
- 所有相同模板的数字命名项目。

项目必须有独特规则。

实现 6 个可玩项目，每个项目至少一个不同机制：

### 1. 造像复原

- 调查：获得两种来源的造像/纹样证据；
- 对照：同时提交 statue + pattern；
- 复原：消耗修护资源；
- 奖励：解锁核心节点能力。

### 2. 木构诊断

- 调查建筑面向；
- 收集 architecture + craft；
- 选择“快速加固”或“完整记录”；
- 两种选择产生不同奖励。

### 3. 路线重开

- 勘察两条 strained/blocked route；
- 恢复其中一条；
- 建立区域连接；
- 改变移动网络。

### 4. 档案编目

- 保存不同 origin 的证据；
- 不要求全部弃掉；
- 完成后提高市场质量或手牌上限。

### 5. 边塞协作

- 两名玩家参与；
- frontier + trade 组合；
- 减少事件风险。

### 6. 万象成卷

- 终局项目；
- 汇总已完成区域成果；
- 需要多个领域；
- 决定最终胜利。

每一阶段包含：

```json
{
  "action_type": "...",
  "requirements": {},
  "choice": null,
  "reward": {},
  "failure_or_decay": {}
}
```

不能再由“任意一次贡献”自动推进所有阶段。

## 4.3 节点能力

每个启用节点必须有一个可理解、非重复的被动或主动能力。

示例：

- 档案库：保留一张市场牌到下一轮；
- 材料场：研究线索换修护资源；
- 纹样廊：一张 pattern 证据可复制一个 technique tag；
- 行旅营地：移动后可交换；
- 烽火台：预览下一张边塞事件；
- 互市驿站：跨节点交易成本降低；
- 云冈石窟：完成多个领域后解锁核心项目。

占位节点仍可作为游戏化设施，但必须明确标记，不冒充真实遗址。

## 4.4 卡牌双用途

文化证据牌必须二选一：

1. 贡献到项目；
2. 打出即时能力。

即时能力使用后进入弃牌堆；贡献后进入项目档案区。

增加：

- discard pile；
- archive pile；
- market refresh；
- rarity/weight；
- scenario deck building。

不要继续 `list(cards) * 3`。

牌库由情景定义数量和权重：

```json
{
  "card_pool": [
    {"id": "...", "count": 2}
  ]
}
```

## 4.5 合作规划

每轮开始进入简短 Planning Phase：

- 显示事件目标；
- 玩家各放置一个计划标记；
- 计划标记可指向节点、路线或项目；
- 完成计划获得小奖励；
- 偏离计划没有惩罚；
- 用于降低讨论成本。

2 人游戏允许每人放 2 个计划标记。

## 4.6 风险与节奏

建立一个明确的“风化轨迹”：

- 0–8；
- 事件或关闭节点提高；
- 修复重大项目降低；
- 达到 8 失败。

节点关闭仍可存在，但不应是唯一压力。

事件分为：

- 已知目标事件；
- 区域事件；
- 路线事件；
- 机会事件；
- 事件链。

事件必须可预判、可准备、可部分缓解。

## 4.7 胜利结构

每个情景要求：

- 完成 1 个核心项目；
- 完成 2 个随机公共目标；
- 风化轨迹未满。

失败：

- 风化轨迹达到上限；
- 核心节点关闭；
- 回合结束仍未完成核心项目。

终局评分保留，但胜利条件要简单可讲。

---

# 五、内容数量控制

不要继续把同一局塞满 18 个节点。

内容库可以有 18–24 个节点，但单局：

- 快速局：8–9 个；
- 标准局：10–12 个；
- 长局：13–15 个。

首个打磨版本只要求：

- 2 个真正不同的情景完整可玩；
- 10–12 个有独特能力的节点；
- 18 张完成设计的牌；
- 8 张真正不同的事件；
- 3 个完整项目；
- 4 个角色及真实升级。

其他内容可继续 placeholder，但不要展示在默认标准局中。

质量优先于数量。

---

# 六、服务端动作协议

服务端返回动作类型与目标：

```json
{
  "type": "restore_route",
  "label": "修护路线",
  "cost": {"ap": 1, "research_clues": 1},
  "targets": [
    {
      "id": "route_x",
      "label": "修护……",
      "preview": {
        "before": {"status": "blocked", "risk": 2},
        "after": {"status": "restored", "risk": 0}
      }
    }
  ],
  "disabled_reason": null
}
```

错误统一为：

```json
{
  "code": "site_does_not_need_restoration",
  "message": "当前节点没有需要修护的损伤",
  "details": {}
}
```

不得把 `nothing_to_repair` 或其他内部 code 直接显示为 Toast。

---

# 七、前端拆分

进一步拆分：

```text
widgets/
  atlas-map/
    AtlasMap.tsx
    RegionLayer.tsx
    RouteLayer.tsx
    NodeLayer.tsx
    PlayerMarkerLayer.tsx
    EventOverlay.tsx
    map-layout.ts
  context-drawer/
  player-roster/
  command-dock/
  planning-phase/
  culture-market/
  hand-tray/
  project-view/
  result-view/
```

`GamePage.tsx` 只负责：

- query；
- controller；
- 布局；
- modal/drawer composition。

地图状态放 Zustand：

- transform；
- focused entity；
- action mode；
- selected target；
- LOD；
- open drawer。

规则仍由服务端决定。

---

# 八、测试

## 8.1 视觉测试

新增截图基线：

- 默认地图；
- 只显示主干路线；
- 移动目标；
- 阻断路线；
- 区域聚焦；
- 节点详情；
- 市场展开；
- 项目阶段；
- 事件覆盖；
- 角色升级；
- 结果页。

断言：

- 主地图没有佛像背景；
- 不存在 route PNG；
- 不存在 `preserveAspectRatio="none"`；
- 不存在全局 network image blend mode；
- 默认显示路线数量低于启用路线总数；
- 1440×900 不发生侧栏互相遮挡；
- 中文正文尺寸合规。

## 8.2 机制测试

必须覆盖：

- 无向 route；
- 两端移动一致；
- 阻断影响双向；
- route objective 不重复计数；
- prepare 真正缓解事件；
- next contribute bonus；
- harmony；
- role upgrade trigger/effect；
- action card 入牌库；
- scenario 实际筛选内容；
- project stage requirements；
- project choice；
- node ability；
- card dual use；
- event forecast；
- wind erosion track；
- core project victory；
- fixed seed determinism；
- persistence。

## 8.3 Playwright

完整执行：

1. 创建标准情景；
2. 查看规划事件；
3. 选择计划；
4. 移动；
5. 调查；
6. 取得卡牌；
7. 贡献；
8. 使用牌能力；
9. 准备事件；
10. 验证准备减伤；
11. 勘察和修护路线；
12. 完成项目阶段；
13. 选择角色升级；
14. 完成核心项目；
15. 进入结算。

---

# 九、阶段顺序

## Phase 1：视觉删除

- 移除佛像地图底图；
- 移除路线 PNG；
- 移除 blend mode；
- 移除多余边框和永久面板；
- 修复字号。

## Phase 2：地图结构

- 无向 route；
- 拓扑精简；
- 区域 shape；
- Bézier route；
- 新节点样式；
- LOD；
- drawer。

## Phase 3：机制修复

- prepare；
- bonus；
- harmony；
- upgrade；
- action cards；
- scenario filtering。

## Phase 4：纵深玩法

- 项目阶段；
- 节点能力；
- 双用途牌；
- 规划；
- 风化轨迹；
- 新胜负。

## Phase 5：打磨

- Storybook；
- Playwright；
- axe；
- visual regression；
- Lighthouse；
- 文档和截图。

---

# 十、验收标准

只有同时满足以下条件才算完成：

1. 地图中没有中央佛像底图；
2. 路线全部为纯 SVG path；
3. 没有拉伸路线图片；
4. 默认不显示全部路线；
5. 地图不再是蜘蛛网；
6. 节点不再是统一黑色矩形卡；
7. 区域有明确地理/视觉分组；
8. 四周面板不再同时永久展开；
9. 游戏中大标题不遮挡内容；
10. 中文正文至少 14–16px；
11. 双向路线变为单一 route；
12. 场景真正筛选地图和牌库；
13. prepare 有实际效果；
14. 所有配置系统都有真实入口；
15. 项目阶段有不同要求；
16. 节点拥有独特能力；
17. 卡牌有双用途；
18. 有规划阶段和风化轨迹；
19. 默认标准局仅启用 10–12 个节点；
20. 两个情景完整可玩且策略不同；
21. 后端仍为规则唯一来源；
22. 测试和构建通过；
23. 多视口无重叠；
24. 没有编造文化审核结果。

---

# 十一、最终回复

完成后报告：

1. 删除了哪些视觉元素；
2. 新地图截图；
3. 路线模型迁移；
4. 单局启用节点数量；
5. 两个完整情景；
6. 修复的无效机制；
7. 新项目与节点能力；
8. 新牌库结构；
9. 测试结果；
10. Playwright 截图；
11. axe / Lighthouse；
12. 未审核内容；
13. 未完成和风险；
14. 回退方式。

不要只写计划，实际修改代码并运行测试。
