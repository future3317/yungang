# Codex 发布级总任务：补齐《石窟光谱》的完整玩家旅程与多人合作产品闭环

仓库：`https://github.com/future3317/yungang`

你是本项目的游戏产品负责人、合作制桌游系统设计师、React/TypeScript 工程负责人、FastAPI/Pydantic 工程负责人、多人权限设计负责人、无障碍设计师和发布 QA 负责人。

请直接在当前仓库中完成一次“可正式发布”的产品闭环升级。不要只写审计报告、建议、伪代码、线框图或待办列表。以下所有要求均为发布阻断项，不分优先级，不允许只做其中一部分。

---

## 一、产品目标与边界

把当前已经可玩的 Alpha 升级为一个从进入首页、创建或加入旅程、多人分配角色、完整游玩、保存恢复，直到胜利或失败复盘都没有死路的正式产品。

产品必须明确支持三种模式：

1. **单人模式**：一个人控制两个角色；
2. **本地合作模式**：2–4 人在同一设备轮流操作；
3. **多设备房间模式**：2–4 人通过同一房间码进入，每人只控制自己的席位。

不需要账号系统、排行榜、付费、WebSocket 或复杂社交。多设备同步可以使用 HTTP 轮询、revision 和立即刷新；不得把当前没有身份验证的单页面状态冒充成真正的多人权限系统。

核心规则继续保持：节点网络地图、有限 AP、路线选择、文化证据、节点任务、多阶段项目、节点和路线修护、世界事件、角色能力与升级、共同胜负。

不得改成飞行棋、答题闯关、战斗、抽卡付费或数值膨胀游戏。

保持现有深绿环境色、暖石纸 Inspector、矿物色语义、SVG 文化图谱和现有素材命名。此次重点是完整性、交互质量、规则兑现、多人权限、错误恢复和发布可靠性，不是再次更换美术方向。

---

## 二、开始前必须完成的真实审计

执行：

```bash
git status
git branch --show-current
git log -15 --oneline
```

创建工作分支：

```text
feat/release-complete-player-journey
```

建立检查点：

```text
chore: checkpoint current playable alpha
```

完整阅读：

```text
README.md
docs/MECHANICS_CURRENT_STATE.md
docs/MECHANICS_V2.md
docs/design/*
docs/audit/*
docs/engineering/*

backend/app.py
backend/models.py
backend/engine.py
backend/actions.py
backend/content.py
backend/repository.py
backend/domain/*

frontend/package.json
frontend/src/app/*
frontend/src/pages/landing/*
frontend/src/pages/game/*
frontend/src/widgets/game/*
frontend/src/widgets/heritage-network/*
frontend/src/shared/api/*
frontend/src/types/*
frontend/src/styles/*

data/*.json
tests/*
scripts/*
.github/workflows/*
```

运行当前基线：

```bash
python scripts/validate_content.py
pytest -q
cd frontend
npm ci
npm run typecheck
npm run test
npm run build
```

启动应用并实际游玩，不只截图。至少完成：

- 单人创建并结束两轮；
- 本地双人创建并结束两轮；
- 多设备房间用两个浏览器 context 加入并各完成一回合；
- 探索、贡献、打出文化牌、打出策略牌；
- 交换证据；
- 节点修护；
- 路线勘察、修护和连接；
- 事件准备和事件选择；
- 项目推进；
- 角色升级；
- 胜利和失败；
- 刷新恢复；
- 409 冲突；
- 网络中断与重连。

新增：

```text
docs/audit/RELEASE_PLAYER_JOURNEY_AUDIT.md
```

按玩家旅程记录每一个实际断点。审计后继续修改，不得停在报告。

如果下文提到的问题已经在其他本地分支修复，保留修复并补测试，不要退回旧实现。

---

## 三、首页、Lobby 与创建旅程

### 3.1 首页信息必须与真实配置一致

- 所有人数、时长、场景目标、难度说明从 meta 数据读取；
- 单人选择后明确显示“你将控制两个角色”；
- 本地合作和多设备合作是两个明确选项；
- 不再用硬编码文案覆盖 JSON 数据；
- 创建按钮前展示最终配置摘要；
- 场景卡显示推荐人数、预计时长、核心目标、主要风险和策略特征；
- 难度卡显示实际生效的资源、回合、初始损伤、事件预览和单人补偿；
- seed 是高级设置，不干扰首次玩家。

### 3.2 建立正式 Lobby

Lobby 必须包含：

- 玩家名称；
- 席位编号；
- 角色选择；
- 角色不可重复；
- 起始节点；
- 角色能力和升级方向；
- 准备状态；
- 房主；
- 房间状态；
- 开始游戏按钮；
- 离开、重新加入、换角色；
- 单人自动配置两个角色但允许调整；
- 本地合作允许在一个设备配置全部席位；
- 多设备合作每个设备只能配置自己的席位。

不得向玩家显示 `p1`、`p2`、`p1-ally-2` 等内部 ID。

### 3.3 正式路由

至少包括：

```text
/
/room/:roomId
/game/:sessionId
/result/:sessionId
/resume
/help
```

要求：

- Lobby 有独立页面；
- 游戏结束自动进入结果状态；
- 刷新结果页仍能读取结果；
- 已结束游戏不能重新提交动作；
- 无效 session 有恢复入口；
- 帮助页可从游戏内打开并返回原状态；
- 路由直接访问均可工作。

---

## 四、多人权限与房间模型

### 4.1 不可信任客户端 player_id

正式多设备模式必须实现无账号的房间席位令牌：

- 创建房间返回 `host_token`；
- 加入席位返回 `seat_token`；
- 服务端只保存 token 哈希；
- token 不进入公开游戏状态、日志或 URL；
- 动作请求从请求头读取席位 token；
- 服务端从 token 推导玩家 ID，不能相信客户端传入的 `player_id`；
- 房主只能管理 Lobby、开始和暂停，不能代替其他在线席位行动；
- 本地合作模式的主设备 token 可以控制全部本地席位；
- 单人 token 可以控制两个受控角色；
- 多设备模式每个 token 只能控制自己的席位；
- 当前玩家以外的玩家可以浏览共享信息，但不能提交动作；
- 角色升级必须由角色所有者确认；
- 服务端为每项拒绝返回明确的中文原因。

新增：

```text
docs/ROOM_AND_SEAT_MODEL.md
docs/MULTIPLAYER_PERMISSIONS.md
```

### 4.2 房间 API

新增或规范以下 API，保留旧接口兼容层：

```text
POST /api/rooms
GET  /api/rooms/{room_id}
POST /api/rooms/{room_id}/join
POST /api/rooms/{room_id}/leave
POST /api/rooms/{room_id}/ready
POST /api/rooms/{room_id}/role
POST /api/rooms/{room_id}/start
POST /api/rooms/{room_id}/pause
POST /api/rooms/{room_id}/resume
GET  /api/rooms/{room_id}/game
POST /api/rooms/{room_id}/actions
```

房间状态：

```text
lobby
in_progress
paused
completed
abandoned
```

同步要求：

- TanStack Query 定时刷新房间和游戏状态；
- 当前标签页完成动作后立即刷新；
- 后台标签降低轮询频率；
- revision 变化时更新；
- 网络恢复后主动刷新；
- 多标签页冲突有说明；
- 不要求 WebSocket；
- 轮询不能造成重复动作。

### 4.3 玩家权限

当前玩家可以：

- 执行自己的行动；
- 选择自己的技能；
- 使用自己的两类手牌；
- 确认自己的升级；
- 结束自己的回合。

非当前玩家可以：

- 查看地图、任务、项目和公开信息；
- 在规划阶段提交自己的计划标记；
- 不能提交当前玩家的行动；
- 不能替当前玩家使用卡牌或升级；
- 在本地模式中需要通过“切换到该席位”后操作。

名册显示：

- 玩家名称；
- 角色；
- 所在节点；
- AP；
- 手牌数量；
- 策略牌；
- 技能可用；
- 升级；
- 是否在线；
- 是否准备；
- 是否已完成本轮；
- 计划标记。

---

## 五、单人和本地合作体验

### 5.1 单人模式

单人默认控制两个角色：

- 不显示虚构玩家 ID；
- 两个角色手牌和策略牌分区；
- 当前受控角色清楚；
- 快速切换；
- 单人手牌上限、AP、规划、路线折扣和虚拟交换规则真实生效；
- 不要求假装有第二名真人；
- 结算标记为单人模式；
- 所有场景均可单人完成；
- 教学局优先支持单人。

### 5.2 本地合作

- 明确为共享屏幕轮流操作；
- 每位玩家有名称和席位；
- 回合结束显示“交给下一位玩家”遮罩；
- 遮罩可隐藏当前玩家手牌，虽然规则为开放信息；
- 下一位玩家确认后进入回合；
- 非当前席位不能误点行动；
- 可在设置中关闭交接遮罩；
- 不产生必须私密的信息机制。

---

## 六、回合阶段与规划

新增显式 `phase`：

```text
round_forecast
planning
player_action
pending_choice
event_resolution
round_summary
game_over
```

每轮标准流程：

1. **事件预告**：展示风险范围、严重度和可应对方式；
2. **团队规划**：每个角色标记一个节点、路线或项目；
3. **玩家行动**：使用 AP 执行合法行动；
4. **事件响应**：已准备角色选择保护对象；
5. **事件结算**：显示缓解和实际结果；
6. **回合摘要**：显示变化和下一轮重点。

规划阶段：

- 单人按场景规则允许多个标记；
- 本地模式逐席位确认；
- 多设备模式每人提交自己的标记；
- 所有人完成或房主选择跳过后进入行动阶段；
- 标记在地图和名册可见；
- 完成标记目标可获得配置中的轻量奖励；
- 未完成不惩罚；
- 每轮清理；
- 规划不能重复提交。

回合界面始终显示：

- 当前轮次；
- 当前阶段；
- 当前角色；
- 剩余 AP；
- 哪些角色尚未行动；
- 事件何时结算；
- 是否存在待选择；
- 结束回合的后果。

结束回合：

- 若仍有 AP，弹出确认并提示可执行行动；
- 本地模式进入席位交接；
- 多设备模式其他客户端显示等待；
- 断线玩家可重连；
- 房主只能在明确确认后跳过长期断线席位；
- 普通玩家不能跳过他人。

最后一名玩家结束后：事件响应 → 事件结算 → 回合摘要 → 下一轮预告。修复所有轮次加一和日志回合错位。

---

## 七、地图管理与目标选择

### 7.1 显示所有玩家

地图必须显示：

- 所有玩家所在节点；
- 当前玩家；
- 玩家颜色、角色图标和名称缩写；
- 多人同节点的堆叠或环绕；
- 计划标记；
- 准备保护标记；
- 事件目标；
- 项目状态；
- 路线风险。

查看其他玩家只改变聚焦，不改变权限。

### 7.2 浏览和行动分离

普通浏览：

- 点击节点只打开详情；
- 点击路线只打开路线详情；
- 不直接消耗行动；
- 可查看非当前节点；
- 清楚显示“尚未抵达”。

行动模式：

- 服务端提供合法目标；
- 地图只突出合法目标；
- 点击目标先进入行动预览；
- 预览显示成本、前后状态、任务或项目推进、触发能力；
- 确认后才提交；
- 取消后回到浏览；
- Escape 取消；
- 移动可通过设置启用快速确认，默认提供预览。

### 7.3 路线是独立实体

路线勘察、修护、建立连接和策略牌必须选择 `route_id`，不能借目标节点猜路线。

路线可：

- 聚焦；
- 键盘选择；
- 查看端点、成本、状态、风险和项目；
- 预览行动前后；
- 显示事件影响和替代路线。

### 7.4 地图列表替代

提供与地图等价的节点与路线列表：

- 筛选当前位置、可达、风险、任务、项目；
- 核心操作不依赖拖动或缩放；
- SVG 节点支持方向键在相邻节点间导航；
- 焦点不因刷新丢失；
- 屏幕阅读器可完成整局。

---

## 八、行动系统完全由服务端描述

前端以 `action_options` 为唯一主要交互来源，不再自行从扁平 `legal_actions` 猜成本和目标。

服务端返回：

```json
{
  "type": "restore_route",
  "label": "修护路线",
  "description": "消耗研究线索，恢复一条相邻的承压路线。",
  "cost": {
    "ap": 1,
    "research_clues": 1,
    "restoration_resource": 0
  },
  "items": [],
  "targets": [
    {
      "id": "route_x",
      "kind": "route",
      "label": "云冈石窟—华严寺",
      "preview": {
        "before": {"status": "blocked", "risk": 2},
        "after": {"status": "restored", "risk": 0},
        "triggered_effects": []
      }
    }
  ],
  "requires_confirmation": true,
  "disabled_reason": null
}
```

前端不得：

- 自己推导成本；
- 自己猜目标类型；
- 选择第一个可用目标；
- 用节点 ID 代替路线 ID；
- 根据按钮名称复制规则；
- 把后端错误当规则提示。

所有动作必须有中文说明、成本、合法目标、不可执行原因、结果预览、提交状态、成功结果、失败恢复和 idempotency key。

---

## 九、市场、文化手牌、策略牌和交换

### 9.1 文化市场

市场显示：

- 三张公开证据；
- 领域；
- 来源；
- 组合标签；
- 当前任务匹配；
- 当前项目匹配；
- 即时用途；
- 贡献用途；
- 来源入口；
- 探索成本。

探索流程：选择探索 → 浏览市场 → 选择卡牌 → 查看用途 → 确认 → 服务端抽取并补牌。

手牌已满时：

- 不隐藏探索；
- 说明手牌已满；
- 允许先弃牌或探索后弃牌；
- 使用 `pending_choice: discard`；
- 任何技能不能绕过上限。

牌堆耗尽时按明确规则重洗弃牌堆，或显示资源耗尽。相同 seed 可复现。

### 9.2 文化证据手牌

每张证据可：

1. 贡献给任务或项目；
2. 打出即时效果；
3. 交换；
4. 查看来源。

详情回答：当前能否贡献、满足什么、形成什么组合、即时使用会失去什么、适合哪些地点、为什么不可用。

贡献和打出必须是两个明确按钮，避免误操作。

### 9.3 策略牌手牌

显示独立策略牌托盘：

- 名称；
- 时机；
- 目标规则；
- 成本；
- 效果；
- 最佳情景；
- 可用状态和原因。

12 张策略牌逐张实现：单路线、多路线、队友、多目标、当前事件、恢复后移动、远程交换、保存 AP、团队准备。

流程：选择策略牌 → 选择合法目标 → 预览 → 确认 → 服务端结算 → 弃牌 → 补牌。

禁止自动选择第一条相邻路线。

### 9.4 交换证据

实现完整多步流程：

```text
选择交换
→ 选择同节点队友
→ 选择自己的证据
→ 查看对方手牌容量
→ 确认
```

- 当前玩家发起；
- 结果对所有人可见；
- 多设备同步双方；
- 互市节点免费交换能力生效；
- 单人虚拟交换规则生效；
- 不显示内部玩家 ID。

---

## 十、地点任务、项目和共同目标

明确层级：

- 地点任务：短期证据组合；
- 项目：多阶段场景推进；
- 核心项目：胜利必要条件；
- 公共目标：跨地图统计。

Inspector 分为：地点概览、地点任务、当前项目、节点能力、事件影响、文化档案。

任务显示：

- 已投入证据；
- 缺数量、领域、来源、组合、不同玩家；
- 奖励；
- 当前手牌匹配。

项目显示：

- 当前阶段；
- 已完成阶段；
- 阶段行动类型；
- 阶段证据；
- 阶段贡献者；
- 线索和资源要求；
- 阶段奖励；
- 地图变化；
- 是否为核心项目。

修复：

- 前一阶段证据不能满足后一阶段；
- 阶段线索必须明确是消耗还是仅校验；
- 最后阶段后不显示不存在的下一阶段；
- 奖励只结算一次；
- 角色升级触发对象明确；
- 多人贡献显示玩家名称。

目标统计：

- 来源多样性按本局已发现和已贡献档案统计，不只看当前手牌；
- 路线不重复计数；
- 保护目标按场景指定节点；
- 区域连通按真实图计算；
- 进度不会因打出或贡献卡牌倒退。

---

## 十一、事件、准备和事件链

### 11.1 事件实例预先确定目标

创建事件实例：

```json
{
  "instance_id": "event-instance-x",
  "event_id": "sandstorm",
  "status": "forecast",
  "severity": 2,
  "target_ids": ["site_a", "site_b"],
  "target_kind": "site",
  "revealed_target_ids": [],
  "forecast_scope": {},
  "mitigations": [],
  "choices": [],
  "resolved_effects": []
}
```

- 揭示时使用保存的 RNG 选目标；
- 目标存入状态；
- 预告显示范围和数量；
- 调查、节点能力或策略牌可揭示具体目标；
- 结算使用同一目标；
- 结果可复现；
- 不在结算时取字典中的前两个节点。

### 11.2 准备选择保护对象

流程：选择准备 → 选择事件 → 选择节点、路线或团队资源 → 预览减免 → 确认。

地图显示准备标记和角色归属。结算后显示避免了什么并清理状态。

### 11.3 道路阻断真实改变路线

`route_blocked` 必须：

- 预选路线；
- 改变路线状态；
- 影响移动；
- 可通过准备、资源、勘察、修护或绕行应对；
- 团队选择改变路线结果；
- 地图立即显示；
- 不只是资源减一或压力加一。

### 11.4 事件链是状态机

每条事件链保存：当前步骤、已触发步骤、前置条件、选择、延迟后果、分支、完成状态和终局影响。

UI 显示上一步、本轮选择和后续风险。

---

## 十二、节点能力、角色技能和升级

### 12.1 节点能力

为默认场景启用的所有节点能力建立数据驱动处理器：

```text
trigger
condition
effect
frequency
scope
```

支持数据中实际使用的全部触发器。UI 在行动前显示可触发能力，行动后显示来源和结果。每个能力有测试。不支持的能力不得进入默认场景。

### 12.2 角色技能

四个技能必须显示完整结果、不可用原因和目标。每轮次数正确，与升级组合正确。

### 12.3 角色升级

建立专用 `RoleUpgradeDialog`：

- 两个方向；
- 触发条件；
- 持续效果；
- 当前局面提示；
- 只能由角色所有者确认；
- 选择后持久化；
- 后续触发与描述一致；
- 不能在选择时错误地提前结算未来效果；
- 8 个升级独立测试。

---

## 十三、难度、场景和单人规则全部兑现

合并顺序：

```text
基础规则
→ 场景配置
→ 难度修正
→ 游戏模式修正
```

返回：

```json
"effective_rules": {}
```

以下字段均须有运行时处理、UI 说明和测试：

```text
max_rounds
restoration_resource
event_weight
node_damage_base
event_preview_count
solo_ap_bonus
starting_threat
starting_clues
blocked_route_count
scenario_rule
solo_rules.controlled_roles
solo_rules.planning_marks_per_round
solo_rules.hand_limit_bonus
solo_rules.virtual_exchange
solo_rules.route_action_discount
core_project_id
objective_ids
event_chain_ids
card_pool
action_card_pool
event_deck
```

策略牌堆也必须使用 seed 洗牌。

---

## 十四、胜负、评分、回合摘要和结果页

### 14.1 胜负

每个场景始终显示：核心项目、公共目标、失败压力、回合上限和核心节点状态。

不得硬编码共同影响目标。

服务端返回：

```json
{
  "outcome": "victory",
  "outcome_reason": "core_project_and_objectives_completed",
  "outcome_details": {},
  "effective_goal": {},
  "score": {}
}
```

胜利原因不能统一为 `all_domains_completed`。

### 14.2 回合摘要

每轮结束显示：玩家行动、任务和项目变化、路线变化、事件结果、压力变化、下一轮预告和目标距离。

摘要来自结构化日志，不从字符串猜测。

### 14.3 正式结果页

新增 `/result/:sessionId`，显示：

- 胜利或失败；
- 具体原因；
- 团队评分和等级；
- 核心项目；
- 公共目标；
- 完成任务；
- 节点保护；
- 路线治理；
- 来源多样性；
- 剩余资源；
- 回合效率；
- 本局发现；
- 每个角色贡献画像；
- 最关键事件；
- 证据组合；
- 文化档案和来源；
- seed；
- 房间玩家；
- 再玩同 seed；
- 换场景；
- 返回首页。

完成后状态冻结、房间变为 completed、刷新仍可查看。

---

## 十五、保存、恢复、离线和错误

### 15.1 存档元数据和迁移

数据库显式迁移并保存：

```text
session_id
room_id
schema_version
revision
status
play_mode
scenario_id
difficulty_id
seed
created_at
updated_at
completed_at
state_json
```

不要只修改 schema_version 数字。实现迁移函数和迁移测试。

### 15.2 最近旅程

首页显示最近旅程：场景、模式、玩家、回合、状态、最后保存时间、继续、查看结果和删除本地记录。

浏览器保存 ID，服务器提供摘要接口，不需要账号。

### 15.3 错误结构

统一：

```json
{
  "detail": {
    "code": "site_does_not_need_restoration",
    "message": "当前地点没有需要修护的损伤。",
    "details": {},
    "recovery": "choose_another_action"
  }
}
```

前端正确读取对象形式 `detail.message`。

处理 400、401、403、404、409、410、422、500、离线和超时。每种错误有恢复按钮，不能只显示“请求失败（400）”。

### 15.4 幂等和并发

动作请求携带：

```text
expected_revision
idempotency_key
seat_token
```

服务端原子更新；相同 key 不重复结算；失败不部分保存；多标签页冲突返回最新状态。

---

## 十六、文化内容呈现

玩家界面不显示：`placeholder`、`needs_review`、`TODO`、`未验证`、`人工审核`、内部 ID。

文化内容只在查看节点、查看证据、完成任务、完成项目、事件解释和结果档案中出现。

每条内容显示：简短说明、与行动关系、来源标题、来源链接、游戏化说明、真实遗产或游戏化设施标识。

来源安全打开。内部审核状态保留在数据中但不进入 UI。

---

## 十七、前端架构与 API 类型

保留 React、TypeScript、Vite、TanStack Query、d3-zoom 和现有视觉系统。

新增并实际使用：

```text
openapi-fetch
Radix Dialog
Radix AlertDialog
Radix Tabs
Radix Tooltip
Radix ScrollArea
Testing Library
MSW
Storybook
@axe-core/playwright
ESLint
Prettier
web-vitals
```

FastAPI 用判别联合描述动作；OpenAPI 生成 TypeScript 类型；CI 检查漂移；删除手写 API 状态类型重复定义。

拆分 GamePage：

```text
RoomLobby
SeatSetup
PlayerRoster
SeatHandoff
GamePhaseRouter
RoundForecast
PlanningBoard
GameHeader
HeritageMap
MapEntityList
ActionDock
ActionPreviewDialog
CultureMarket
CultureHand
ActionCardHand
ExchangeFlow
SiteInspector
RouteInspector
TaskPanel
ProjectPanel
EventPanel
EventChoiceDialog
RoleSkillPanel
RoleUpgradeDialog
RoundSummary
GameResult
JourneyTimeline
ConnectionStatus
AccessibilitySettings
```

TanStack Query 管理 room、game、meta、session summaries。Zustand/reducer 仅管理地图、聚焦、行动流程、Inspector、教学、设置和弹窗。规则留在服务端。

---

## 十八、无障碍

目标 WCAG 2.2 AA：

- 键盘完整通关；
- SVG 节点方向键导航；
- 路线键盘选择；
- 地图列表替代；
- 拖动有点击替代；
- 可见焦点；
- Dialog 焦点管理；
- Tabs 方向键；
- 24×24 最低目标，主要按钮优先 44×44；
- 不只用颜色；
- 200% 放大不丢功能；
- 390px 无横向滚动；
- 大字体；
- 高对比；
- 减少动态；
- 路线动画可暂停；
- 屏幕阅读器可读阶段、角色、AP、目标、事件和结果；
- 无强制计时。

当前自写 Dialog 和 tab 改为可靠无障碍原语。

---

## 十九、测试与发布验收

### 19.1 后端测试

覆盖：

- 单人、本地 2–4 人、多设备 2–4 人；
- 房主和席位权限、token 伪造；
- ready/start/leave/rejoin；
- 所有阶段；
- 规划；
- 所有基础行动；
- 交换；
- 手牌上限、弃牌、牌堆耗尽；
- 36 张证据牌；
- 12 张策略牌及目标；
- 18 个任务；
- 8 个项目；
- 18 个事件；
- 8 条事件链；
- 节点能力；
- 角色技能；
- 8 个升级；
- 4 场景；
- 4 难度；
- 单人规则；
- 目标统计；
- 胜利和所有失败原因；
- 评分；
- idempotency、revision；
- 保存、恢复、迁移；
- 结构化错误。

核心领域覆盖率至少 90%。

### 19.2 前端测试

覆盖首页、Lobby、席位权限、单人说明、场景和难度摘要、名册、地图、路线、行动预览、市场、两类手牌、交换、任务、项目、事件、升级、交接、摘要、结果、404、离线、409、大字体和高对比。

### 19.3 Playwright 完整流程

- 单人完整局；
- 本地双人完整局；
- 多设备双人房间；
- 互市重开路线流程；
- 固定 seed 胜利和失败；
- 无效房间、权限错误、冲突、重复提交、离线、刷新、多标签页。

视口：1920×1080、1440×900、1280×800、768×1024、390×844。

### 19.4 视觉回归、axe 和性能

截图基线包括首页、Lobby、单人、多设备等待、规划、地图、行动预览、市场、交换、项目、事件、升级、摘要、胜利、失败、大字体、高对比和移动端。

axe 不允许 serious 或 critical。实际运行 Lighthouse 和 Core Web Vitals并保存报告，不得伪造。

---

## 二十、发布工程

新增或完善：

- `/health/live`；
- `/health/ready`；
- 环境变量；
- 数据库路径；
- 静态缓存；
- index no-cache；
- CSP；
- 请求 ID；
- 结构化日志；
- 生产错误边界；
- GitHub Actions；
- 锁文件；
- 可重复构建；
- 数据备份；
- SQLite 并发说明；
- 迁移；
- Docker 或部署脚本；
- 开发、测试、生产启动命令。

CI 运行内容校验、后端 lint/typecheck/test/coverage、前端 lint/typecheck/unit test、Storybook build、production build、Playwright、axe 和视觉回归。

---

## 二十一、全部必须通过的发布清单

以下所有条目必须完成，不能标记为“后续”：

1. 首页文案与配置一致；
2. 正式 Lobby；
3. 玩家命名；
4. 角色选择；
5. ready 和房主开始；
6. 单人双角色完整；
7. 本地席位交接；
8. 多设备房间；
9. 服务端席位权限；
10. 不可信任客户端 player_id；
11. 非当前玩家不能行动；
12. 地图显示所有玩家；
13. 浏览不误执行；
14. 所有行动有预览；
15. 路线动作选 route_id；
16. 规划阶段；
17. 市场闭环；
18. 手牌满弃牌；
19. 牌堆耗尽规则；
20. 文化牌双用途；
21. 策略牌独立手牌；
22. 12 张策略牌目标正确；
23. 交换完整；
24. 任务和项目层级清楚；
25. 阶段证据不串用；
26. 事件目标预定；
27. 准备选择保护对象；
28. 道路真实阻断；
29. 事件链状态机；
30. 节点能力兑现；
31. 角色升级兑现；
32. 难度字段兑现；
33. 场景规则兑现；
34. 单人规则兑现；
35. 目标值不硬编码；
36. 目标统计不倒退；
37. 胜利原因准确；
38. 失败原因准确；
39. 回合摘要；
40. 正式结果页；
41. 结果可刷新；
42. 重玩同 seed；
43. 最近旅程；
44. 404、离线、409 可恢复；
45. 动作幂等；
46. 显式 schema 迁移；
47. OpenAPI 类型；
48. GamePage 拆分；
49. 键盘通关；
50. 390px 通关；
51. axe 无 serious/critical；
52. 前端测试存在；
53. 后端覆盖率达标；
54. Playwright 完整流程；
55. CI 通过；
56. 文化来源可查看；
57. 内部审核状态不进 UI；
58. README 完整；
59. 部署和回退；
60. 从建房到结果页可完成整局。

---

## 二十二、交付文档

新增或更新：

```text
README.md
docs/PLAYER_JOURNEY.md
docs/ROOM_AND_SEAT_MODEL.md
docs/MULTIPLAYER_PERMISSIONS.md
docs/SOLO_MODE.md
docs/GAME_PHASES.md
docs/ACTION_FLOW.md
docs/CARD_AND_MARKET_RULES.md
docs/TASK_AND_PROJECT_RULES.md
docs/EVENT_SYSTEM.md
docs/SAVE_AND_RECOVERY.md
docs/ERROR_MODEL.md
docs/ACCESSIBILITY.md
docs/TEST_STRATEGY.md
docs/DEPLOYMENT.md
docs/ROLLBACK.md
docs/CONTENT_RUNTIME_COVERAGE.md
```

---

## 二十三、完成后的回复格式

按以下顺序报告：

1. 工作分支和检查点；
2. 当前问题审计；
3. 首页和 Lobby；
4. 单人模式；
5. 本地合作；
6. 多设备房间；
7. 权限模型；
8. 回合阶段；
9. 地图管理；
10. 行动系统；
11. 市场；
12. 文化手牌；
13. 策略牌；
14. 交换；
15. 任务与项目；
16. 事件与事件链；
17. 节点能力和升级；
18. 胜负与结果；
19. 保存与恢复；
20. 前端架构；
21. 后端架构；
22. API 和迁移；
23. 无障碍；
24. 测试实际结果；
25. axe、Lighthouse 和性能；
26. 截图与 Playwright 报告；
27. CI 状态；
28. 文化内容风险；
29. 手动验收步骤；
30. 回退方式。

不得只提交文档。实际修改代码、运行测试、修复失败，并保持仓库处于可以从建房一直玩到结果页的状态。
