# 石窟光谱 / Cave Light Atlas

一个基于云冈文化遗产网络的合作研判游戏。玩家在有限回合内共同移动、探索证据、完成地点任务、修护节点和路线，并在信息不完全的事件压力下完成核心项目。

## 当前内容规模

| 模块 | 数量 |
| --- | ---: |
| 场景 | 4 |
| 遗产节点 | 18 |
| 路线 | 30 |
| 区域 | 4 |
| 文化证据卡 | 36 |
| 世界事件 | 18 |
| 角色 | 4 |
| 角色升级 | 8 |
| 策略牌 | 12 |
| 项目 | 5 |

运行时规则以 FastAPI 服务端和 `data/` 内容为唯一来源。前端只消费合法行动、目标和预览，不复制胜负计算。

## 运行

在 PowerShell 中：

```powershell
conda activate piepaper
cd E:\CODE\yungang-feitianqi-fullstack
cd frontend
npm install
npm run dev
```

另开一个终端启动后端：

```powershell
conda activate piepaper
cd E:\CODE\yungang-feitianqi-fullstack
python -m uvicorn backend.app:app --reload --port 8000
```

打开 `http://127.0.0.1:5173/`。如果使用后端托管构建产物，先运行 `npm run build`，再访问 `http://127.0.0.1:8000/`。

## 一局流程

1. 首页选择人数、场景、难度和可复现 seed；单人会自动控制两个角色。
2. 事件预告锁定范围，回合结算使用同一组确定性目标。
3. 规划阶段每名角色放置一个节点、路线或项目标记，然后开始行动。
4. 行动阶段从左侧行动坞选择移动、探索、贡献、修护、勘察、路线治理或技能。
5. 行动目标由服务端返回；点击目标后会先出现成本、影响和风险预览，再确认。
6. 到达节点后才能探索、贡献证据或修护该地点；远处节点只可查看任务预览。
7. 结束回合后结算事件并显示回合摘要；完成核心项目和公共目标进入结算页。

## 常用验证

```powershell
conda run -n piepaper python scripts/validate_content.py
conda run -n piepaper pytest -q
cd frontend
npm run typecheck
npm run test
npm run build
```

生成当前 OpenAPI 类型：

```powershell
cd frontend
npm run api:generate
```

该命令要求后端运行在 `127.0.0.1:8000`，输出为 `frontend/src/shared/api/generated.ts`。

## 文档入口

- [玩家旅程](docs/PLAYER_JOURNEY.md)
- [当前玩法规则](docs/GAMEPLAY_RULES.md)
- [单人模式](docs/SOLO_MODE.md)
- [无障碍说明](docs/ACCESSIBILITY.md)
- [错误与恢复](docs/ERROR_AND_RECOVERY.md)
- [会话与存档](docs/SESSION_AND_SAVE.md)
- [文化解释原则](docs/CULTURAL_INTERPRETATION.md)
- [测试策略](docs/TEST_STRATEGY.md)
- [性能报告](docs/PERFORMANCE_REPORT.md)
- [内容运行时覆盖](docs/engineering/CONTENT_RUNTIME_COVERAGE.md)
- [五分钟演示脚本](docs/playtest/DEMO_SCRIPT.md)

## 真实状态边界

后端单元/API 测试、前端 typecheck、Vitest 和 production build 已纳入本地验收。Playwright、axe、Lighthouse、真实多视口截图和真人试玩不能凭代码推断通过；它们的运行记录和待测项分别保存在 `docs/TEST_STRATEGY.md`、`docs/PERFORMANCE_REPORT.md` 和 `docs/playtest/`。

## 回退

本轮规则通过 `schema_version`、`revision` 和本地 SQLite 保存。出现不兼容存档时不要手动编辑数据库；使用首页新建旅程或从同一 seed 重开。Git 回退应回到上一条功能提交，而不是删除用户本地素材和 `data/games.sqlite3`。

## Release player journey

??????????? Lobby ???????????????????????????? `X-Seat-Token` ???????????? revision ????????

?????

- ???`/`
- Lobby?`/room/:roomId`
- ?????`/room/:roomId/game`
- ?? session ???`/game/:sessionId`
- ????`/result/:sessionId`

??????

```powershell
conda run -n piepaper python scripts/validate_content.py
conda run -n piepaper pytest -q
cd frontend
npm run typecheck
npm run test
npm run build
```

???????? [ROOM_AND_SEAT_MODEL.md](docs/ROOM_AND_SEAT_MODEL.md) ? [MULTIPLAYER_PERMISSIONS.md](docs/MULTIPLAYER_PERMISSIONS.md)?
