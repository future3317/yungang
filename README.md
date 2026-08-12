# 石窟光谱 / Cave Light Atlas

《石窟光谱》是一款以云冈文化遗产网络为主题的合作研判游戏。玩家在有限回合内移动、探索文化证据、交换与贡献卡牌、修护节点和路线，并在世界事件压力下完成场景目标。

## 当前产品状态

运行时规则以 FastAPI 服务端和 `data/` 内容为唯一来源。前端只渲染服务端返回的合法行动、目标和预览，不复制胜负计算。

已落地的核心体验：

- 服务端生成 `ActionOption`，包含费用、描述、合法目标、预览变化和确认文案。
- 目标行动统一经过目标选择、确认、请求中锁定、成功反馈或错误恢复。
- 重复请求带 `request_id`，服务端保存最近处理过的请求 ID，避免重复扣除资源。
- 文化牌、节点能力、事件和策略牌效果通过机制注册表执行；内容启动时校验未知效果和触发器。
- 任务状态返回结构化进度，包括证据数、领域、来源、组合标签、贡献者和最低贡献条件。
- 事件预告和结算使用同一组确定性目标，并返回实际影响对象、数值变化和原因。
- 房间使用席位令牌；大厅和游戏页支持 revision SSE 推送，并保留轮询作为断线兜底。
- 单人旅程在大厅中明确为一人轮流调度两位角色。

## 当前内容规模

| 模块 | 当前数量 |
| --- | ---: |
| 场景 | 6 |
| 遗产节点 | 24 |
| 路线 | 42 |
| 区域 | 4 |
| 文化证据卡 | 48 |
| 世界事件 | 24 |
| 角色 | 4 |
| 角色升级 | 8 |
| 策略牌 | 16 |
| 多阶段项目 | 12 |
| 任务 | 24 |

以上数量以当前 `data/` 文件和服务端加载结果为准，已经达到本轮产品化目标数量。

## 游戏流程

1. 首页选择人数、场景、难度和可复现 seed；单人控制两个角色。
2. 事件预告锁定影响范围，回合结算沿用同一组确定性目标。
3. 规划阶段放置地点、路线或项目标记。
4. 行动阶段从左侧行动坞选择移动、探索、证据研判、修护、勘察、路线治理、交换、策略牌或角色技能。
5. 行动目标由后端返回。点击后显示目标、费用、预期变化和风险，再确认提交。
6. 到达节点后才能探索、贡献证据或修护该地点；远处节点只可查看公开摘要。
7. 结束回合后结算世界事件，展示影响对象和资源变化，再进入下一轮规划。
8. 完成场景核心项目与公共目标后进入结算页，显示项目、路线、来源、守护和发现评分。

## 运行

推荐使用本地 Conda 环境 `piepaper`。

一条命令启动开发前后端：

```powershell
conda activate piepaper
cd E:\CODE\yungang-feitianqi-fullstack
.\run-dev.ps1
```

如果需要分别启动：

```powershell
conda activate piepaper
cd E:\CODE\yungang-feitianqi-fullstack
python -m uvicorn backend.app:app --reload --port 8000
```

另开终端：

```powershell
cd E:\CODE\yungang-feitianqi-fullstack\frontend
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`。生产构建后也可以由 FastAPI 托管 `frontend/dist`，访问 `http://127.0.0.1:8000/`。

## 验证命令

```powershell
conda activate piepaper
cd E:\CODE\yungang-feitianqi-fullstack
python scripts/validate_content.py
python -m pytest -q
cd frontend
npm run typecheck
npm run test
npm run build
```

OpenAPI 类型生成要求后端运行在 `127.0.0.1:8000`：

```powershell
npm run api:generate
```

## 重要接口

- `GET /api/meta`：内容与展示元数据。
- `POST /api/games`：创建本地旅程。
- `GET /api/games/{session_id}`：读取旅程状态。
- `POST /api/games/{session_id}/actions`：提交带 revision 和 request ID 的行动。
- `POST /api/rooms`：创建大厅。
- `GET /api/rooms/{room_id}`：读取大厅与席位状态。
- `GET /api/rooms/{room_id}/game`：读取带 viewer 权限的游戏状态。
- `GET /api/rooms/{room_id}/events?seat_token=...`：订阅 revision SSE。
- `POST /api/rooms/{room_id}/actions`：使用席位令牌提交多人行动。

## 文档入口

给外部读者使用的说明分成两份：先用手把手教程完成第一次试玩，再用评审说明了解项目内容与讨论方向：

- [第一次试玩手把手教程](docs/FIRST_PLAYTHROUGH_GUIDE.md)
- [项目内容、玩法与试玩评审说明](docs/SUPERVISOR_REVIEW_BRIEF.md)

以下文档仅供项目维护者使用：

- [Render 部署说明](docs/DEPLOY_RENDER.md)
- [工程架构](docs/engineering/BACKEND_ARCHITECTURE.md)
- [接口契约](docs/engineering/API_CONTRACT.md)
- [测试策略](docs/engineering/TEST_STRATEGY.md)
- [无障碍实现说明](docs/accessibility/ACCESSIBILITY_FEATURES.md)

## 生产化补充

当前版本的运行时规则以服务端返回的 `action_options` 为唯一行动来源。前端不再根据动作类型猜测合法性：需要目标的行动会进入目标选择和确认，提交时携带 `expected_revision` 与幂等 `request_id`，成功后地图、资源栏和结构化时间线同步反馈。

地图是全屏世界层，左侧角色与行动 HUD、右侧地点检查器叠加在地图之上。右侧检查器分为任务、事件、市场三页；移动端对应独立的地图、地点、手牌内容区。地图路线支持 `waypoints`、`roadClass`、`terrain` 和 `labelPosition`，运行时端点始终由路线两端节点计算。

开发工具：本地开发服务器启动后访问 `/dev/map-editor`，可拖动、网格吸附、锁定节点、保存草稿并导出布局 JSON。

内容分类：`documented` 表示真实遗产信息，`interpretive` 表示研究性解释，`gameplay` 表示游戏化功能。游戏化节点不会被 UI 伪装成确定的历史遗址。

发布前建议执行：

```powershell
python scripts/validate_content.py
cd frontend; npm run typecheck; npm run test; npm run build
cd ..; pytest -q
```

## 交付边界

当前后端测试、前端类型检查、Vitest 和 production build 已纳入本地验收。Playwright、axe、Lighthouse、五种分辨率视觉回归和真人试玩必须在本地服务启动后实际执行，不能仅凭代码推断通过。测试产生的 `data/games.sqlite3`、截图和 `audit_output/` 不应提交。

Git 回退应回到功能提交，不要删除用户素材和本地存档数据库。

## 机制与安全基线

当前版本包含六个可选场景，场景牌池严格按 `data/scenarios.json` 的 `card_pool` 构建，场景规则使用结构化 `trigger` 与 `effect` 并由引擎执行。规划阶段支持地点、路线和项目三类目标；房间结果通过房间专用接口读取。

房间 SSE 使用短时一次性订阅票据，长期席位令牌只通过 `X-Seat-Token` 请求头传输，并仅保存在当前浏览器会话。房间码是访问标识而非强私密凭证，不应当公开分享。

旧的指定 session 创建接口和旧玩家加入接口已删除。运行数据库、审计截图、Playwright 报告、覆盖率和日志均为本地产物，已在 `.gitignore` 中排除。

详细机制基线见 [`docs/IMPLEMENTATION_STATUS_8_14.md`](docs/IMPLEMENTATION_STATUS_8_14.md)。
