# 游戏视口与反馈闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成复审中尚未闭环的 HUD 布局、路线可读性、结构化反馈、行动机制、类型收敛和完整验证。

**Architecture:** 保留 D3/SVG 地图和 React DOM HUD。游戏页使用一个世界层与 HUD 槽位层，所有普通弹窗/提示使用统一 overlay；后端以真实状态变化作为预览和反馈的唯一来源。

**Tech Stack:** React、TypeScript、TanStack Query、D3/SVG、FastAPI、Pydantic、pytest、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-08-22-game-viewport-and-feedback-design.md`

## Global Constraints

- 使用 UTF-8 编辑文件，玩家界面不出现英文内部枚举。
- 不保留被替代的旧实现、重复 formatter 或重复布局真相。
- 不降低既有测试断言，不用跳过、mock 或放宽校验让测试变绿。
- Python 使用 `piepaper` 环境；完成相关批次后运行项目要求的测试与构建。
- 未跟踪的 `output/`、`tmp/`、`yungang_game_ui_assets/` 不提交。

---

### Task 1: 统一游戏视口与 HUD 槽位

**Files:**
- Create: `frontend/src/widgets/game/GameViewport.tsx`
- Create: `frontend/src/styles/game-viewport.css`
- Modify: `frontend/src/pages/game/GamePage.tsx`
- Modify: `frontend/src/styles/game-shell.css`
- Modify: `frontend/src/styles/fullscreen-map.css`

**Interfaces:**
- `GameViewport` 接收 `top`, `left`, `center`, `right`, `bottom`, `overlay` ReactNode 和 `rightCollapsed` 状态。
- 业务组件不再直接负责 viewport 级 `left/right/top/bottom`。

- [ ] 用现有 GamePage JSX 写一个失败的布局断言，确认 HUD slot 和 map world layer 的 DOM 关系。
- [ ] 创建 `GameViewport`，以 `world-layer`、`hud-layer`、五个 slot 和 `overlay-layer` 输出固定结构。
- [ ] 将 ScenarioHeader、roster/CommandDock、地图、SiteInspector、RoundSummary、JourneyTimeline 和交互 overlay 分别迁入 slot。
- [ ] 删除已迁移组件对应的 fullscreen fixed 几何规则，保留颜色和地图层规则。
- [ ] 运行 `npm run typecheck` 和相关 Vitest。

### Task 2: 修路线检查器和节点标签层级

**Files:**
- Modify: `frontend/src/widgets/heritage-network/HeritageNetwork.tsx`
- Modify: `frontend/src/styles/map.css`
- Modify: `frontend/src/styles/game-viewport.css`
- Test: `frontend/src/widgets/heritage-network/HeritageNetwork.test.tsx`

**Interfaces:**
- `HeritageNetwork` 继续通过 `onFocus` 回传地图选择；路线检查器改由中心 HUD slot 容器承载，地图只负责路线选择数据。

- [ ] 增加路线选择与关闭的组件测试，验证没有矩形框 overlay 和英文状态。
- [ ] 将路线信息从 SVG/地图内部浮层移到稳定的 center route slot。
- [ ] 保留路线命中区但降低视觉 stroke，合法/相邻/承压/阻断/修护只改变语义线型与颜色。
- [ ] 为路线名称设置标签避让与裁切规则，禁止节点名称被路线文字覆盖。
- [ ] 运行地图组件测试和类型检查。

### Task 3: 统一结构化变化展示和术语

**Files:**
- Create: `frontend/src/widgets/game/StateChangeList.tsx`
- Modify: `frontend/src/pages/game/GamePage.tsx`
- Modify: `frontend/src/widgets/game/RoundSummary.tsx`
- Modify: `frontend/src/widgets/game/JourneyTimeline.tsx`
- Modify: `frontend/src/widgets/game/gameUi.ts`
- Modify: `frontend/src/styles/experience.css`
- Modify: `frontend/src/styles/game-shell.css`

**Interfaces:**
- `StateChangeList` 接收 `FeedbackChange[]`，统一显示 `label`, `before`, `after`, `delta`。
- timeline/event history 只传结构化变化和已本地化 message，不直接渲染内部 key。

- [ ] 增加 `StateChangeList` 对正负变化、状态变化和空变化的测试。
- [ ] 将 GamePage 的 `Object.entries(event.changes)` 替换为 `StateChangeList`，只保留 `weathering_track` 权威指标。
- [ ] 将回合摘要和历史记录接入同一组件，补充玩家姓名、事件名、目标和变化原因。
- [ ] 将 toast、ActionPreview、事件弹窗统一使用深绿暖石纸 surface，移除浏览器默认白色表面。
- [ ] 扩展术语 formatter，禁止 `target_rule`、`effect.type`、route/status 内部值进入玩家文本。

### Task 4: 收口第一阶段并做视觉回归

**Files:**
- Modify: `frontend/playwright.config.ts`
- Modify: `frontend/e2e/game.spec.ts`
- Modify: `frontend/e2e/accessibility.spec.ts`
- Modify: `docs/README.md` 或现有项目状态文档

- [ ] 为桌面 1280×800、1440×900、1920×1080 增加地图、路线检查器、胜利清单、历史记录状态截图。
- [ ] 增加英文枚举、白色弹层、横向溢出和关键重叠的 Playwright 断言。
- [ ] 跑 `npm run typecheck`、`npm run test -- --run`、`npm run build`、`pytest -q` 和 Playwright。
- [ ] 提交并推送第一阶段。

### Task 5: 统一行动预览、提交锁定与玩家反馈

**Files:**
- Modify: `backend/engine.py`
- Modify: `backend/models.py`
- Modify: `frontend/src/pages/game/GamePage.tsx`
- Modify: `frontend/src/widgets/game/ActionPreview.tsx`
- Modify: `frontend/src/widgets/game/CommandDock.tsx`
- Modify: `frontend/src/widgets/game/SiteInspector.tsx`
- Test: `tests/test_action_preview_contract.py`

- [ ] 为行动预览写真实 before/after 失败测试，覆盖修护折扣、个人补给、路线连接和研判。
- [ ] 以状态复制、同一 handler 执行、状态 diff 生成 preview，删除漂移的手写 `_action_preview_delta`。
- [ ] 文化证据拆成“作为证据研判”和“发动即时效果并弃置”。
- [ ] pending choice、弃牌、升级和策略牌统一经过预览与 mutation 锁定。
- [ ] 反馈显示完整结构化变化，并在失败时显示中文原因和恢复动作。

### Task 6: 完成研究台、事件和项目闭环

**Files:**
- Modify: `backend/engine.py`
- Modify: `backend/content_schemas.py`
- Modify: `frontend/src/widgets/game/SiteInspector.tsx`
- Modify: `frontend/src/widgets/game/RoundSummary.tsx`
- Test: `tests/test_interpretation_contract.py`
- Test: `tests/test_round_summary_contract.py`

- [ ] 让 evaluator 唯一返回 requirements、缺口、可信度和 `can_form`，删除旧条件计算路径。
- [ ] 让可信度真正影响立即处理、先记录和冲突补偿。
- [ ] 项目阶段只通过 `_advance_project` 推进，并记录阶段资源消费和贡献者。
- [ ] 固定 `finalize_round` 顺序并把事件、场景规则、规划和目标变化纳入摘要。
- [ ] 地点 inspector 增加项目页，事件独立为全局 EventBanner。

### Task 7: 机制合同测试与内容校验

**Files:**
- Modify: `backend/content_schemas.py`
- Modify: `backend/engine.py`
- Modify: `tests/test_action_card_semantics.py`
- Modify: `tests/test_release_mechanics.py`
- Create: `tests/test_node_abilities_contract.py`
- Create: `tests/test_role_upgrades_contract.py`
- Create: `tests/test_scenario_rules_contract.py`

- [ ] 16 张策略牌逐张断言 AP、资源、压力、路线、目标玩家状态和弃牌堆。
- [ ] 逐项断言节点能力、8 个角色升级和 6 个场景规则的真实 before/after。
- [ ] 补完整内容模型并按类别逐步改为 `extra="forbid"` 与 discriminated union。
- [ ] 彻底移除 `threat` 兼容路径，统一 `weathering_track`。
- [ ] 运行后端全量测试并修复固定种子下的测试隔离。

### Task 8: API/CSS 收敛和完整发布验证

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/app.py`
- Modify: `frontend/src/shared/api/client.ts`
- Modify: `frontend/src/types/game.ts`
- Modify: `frontend/src/styles/*.css`
- Modify: `frontend/e2e/*.spec.ts`

- [ ] 将 runtime `JsonObject` 替换为实际 Pydantic schema，并重新生成 OpenAPI 类型。
- [ ] 删除前端 API 镜像类型，只保留明确的 ViewModel。
- [ ] 删除已迁移的 CSS override 文件或规则，建立唯一 overlay/z-index 和组件样式入口。
- [ ] 完成胜利、失败、双角色交接、断线恢复、409、满手牌和六场景路径 E2E。
- [ ] 完成 1280×720、1440×900、1920×1080、390×844 的视觉矩阵与 axe 扫描。
- [ ] 运行全部测试、构建、类型检查，整理文档，提交并推送 `main`。
