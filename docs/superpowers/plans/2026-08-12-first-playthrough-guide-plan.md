# 第一次试玩手把手教程实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一份不需要代码背景、可以边打开网页边照做的《石窟光谱》第一次试玩教程，并把它接入现有文档入口。

**Architecture:** 教程独立保存为 `docs/FIRST_PLAYTHROUGH_GUIDE.md`，采用固定的“单人旅程—风沙与石—导览”示范路径，按界面顺序解释每次点击、行动点消耗、预期反馈和卡住时的恢复方式。原有 `SUPERVISOR_REVIEW_BRIEF.md` 保持主体内容不变，只在开头增加教程入口；`README.md` 增加面向首次试玩者的独立链接。

**Tech Stack:** UTF-8 Markdown、相对路径图片链接、PowerShell/Python 只读校验。

## Global Constraints

- 面向文学、哲学和文化研究读者，不要求读者了解代码、接口、构建或测试。
- 第一次试玩的教学闭环定义为：抵达 → 取线索 → 放入支持/冲突/待确认 →（可能跨几个回合补齐条件）形成解释 → 选择干预 → 结束回合并观察后果。
- 教程使用当前页面真实按钮名称：进入准备厅、准备、开始旅程、移动、探索/寻访一件线索、研判证据、形成当前解释、立即处理/最小干预/先记录、结束回合。
- 所有 Markdown 与 JSON 文件按 UTF-8 读写；不使用未指定编码的 PowerShell 重写命令。
- 不上传 `yungang_game_ui_assets/`、`output/`、`tmp/` 等素材包或临时目录。

---

### Task 1: 编写独立第一次试玩教程

**Files:**
- Create: `docs/FIRST_PLAYTHROUGH_GUIDE.md`
- Read: `docs/SUPERVISOR_REVIEW_BRIEF.md`, `frontend/src/pages/landing/LandingPage.tsx`, `frontend/src/pages/room/RoomPage.tsx`, `frontend/src/pages/game/GamePage.tsx`, `frontend/src/widgets/game/SiteInspector.tsx`, `frontend/src/widgets/game/CommandDock.tsx`

**Interfaces:**
- Consumes: 当前前端显示的按钮、面板、弹窗和后端 `action_options` 对应的行动名称。
- Produces: 可独立打开、包含六张已有截图相对链接和完整勾选清单的教学文档。

- [ ] **Step 1: 写入教学开场和固定选择**

写清第一次试玩只需要完成第一回合闭环；给出名字、单人旅程、风沙与石、导览四个固定选择，并解释“单人旅程会轮流控制两位同行者”。

- [ ] **Step 2: 写入准备厅和新手教程操作**

逐步说明两个席位选择角色、分别点击准备、开始旅程；说明开始按钮灰色时检查角色和准备状态；解释教程弹窗的下一步、跳过、右上角关闭和右下角“怎么玩”。

- [ ] **Step 3: 写入地图阅读和第一次移动**

按左侧行动区、中间遗产网络、右侧地点详情、底部旅程时间线解释画面；说明点击“移动”后只看金色可达路线，点击目标后先看行动确认弹窗，再点击确认行动；明确移动通常消耗 1 AP。

- [ ] **Step 4: 写入市场探索和手牌理解**

说明抵达节点后点击“探索”或“寻访一件线索”，比较三张公开市场线索，金边与灰边的含义，取牌消耗 1 AP、手牌上限 3 张；说明点击文化牌只查看详情，右上角“关闭”可退出，不想使用不必提交。

- [ ] **Step 5: 写入研究台、解释和干预**

用一个通俗示例逐一解释支持、冲突、待确认；说明归类后可能需要多张不同领域/来源线索，满足条件才出现“形成当前解释”；用表格说明三种干预表达的判断、直接后果和适合的第一次选择。

- [ ] **Step 6: 写入结束回合、规划阶段和闭环判断**

说明两位同行者都行动后，点击“结束回合”；如果出现规划阶段，点击“开始行动”；再观察上一回合摘要、事件目标、风化压力和修护资源；明确完整的研究台闭环可能跨几个回合完成。

- [ ] **Step 7: 写入常见卡住情况和勾选清单**

至少覆盖：开始旅程灰色、找不到移动、市场牌不能选、研究台没有“形成当前解释”、行动确认后悔了、策略牌/文化牌弹窗退出、时间线遮挡、页面加载慢；最后提供 12 项可勾选清单。

- [ ] **Step 8: 运行文档检查**

检查所有图片链接存在、中文 UTF-8 可读、无常见乱码字符串、无代码术语残留（除“AP”并在首次出现处解释）。

### Task 2: 接入现有文档入口

**Files:**
- Modify: `README.md`
- Modify: `docs/SUPERVISOR_REVIEW_BRIEF.md`

**Interfaces:**
- Consumes: `docs/FIRST_PLAYTHROUGH_GUIDE.md` 的稳定相对路径。
- Produces: README 首次试玩入口、评审说明开头的“先看教学版”入口。

- [ ] **Step 1: 在 README 增加首玩入口**

在“文档入口”下先列“第一次试玩手把手教程”，再列“项目内容、玩法与试玩评审说明”，让新读者先进入教学路径。

- [ ] **Step 2: 在评审说明增加交叉入口**

在标题下方加入一句：如果第一次不知道从哪里开始，请先阅读独立手把手教程；链接使用 `FIRST_PLAYTHROUGH_GUIDE.md`。

- [ ] **Step 3: 检查相对链接和编码**

用 Python UTF-8 读取三份 Markdown，解析链接目标并确认教程中六张图片和两个文档入口均存在。

### Task 3: 验收并提交

**Files:**
- Test: `docs/FIRST_PLAYTHROUGH_GUIDE.md`, `README.md`, `docs/SUPERVISOR_REVIEW_BRIEF.md`

**Interfaces:**
- Consumes: Task 1 和 Task 2 的文档内容。
- Produces: 无乱码、无断链、与现有界面词汇一致的独立教程提交。

- [ ] **Step 1: 检查 diff**

运行 `git diff --check` 和 `git diff --stat`，确认没有临时目录或原始素材被纳入。

- [ ] **Step 2: 检查关键词覆盖**

确认教程同时包含“移动、探索、支持、冲突、待确认、形成当前解释、立即处理、最小干预、先记录、结束回合、怎么玩、关闭”。

- [ ] **Step 3: 提交文档变更**

```powershell
git add README.md docs/SUPERVISOR_REVIEW_BRIEF.md docs/FIRST_PLAYTHROUGH_GUIDE.md docs/superpowers/plans/2026-08-12-first-playthrough-guide-plan.md
git commit -m "Add first playthrough teaching guide"
```
