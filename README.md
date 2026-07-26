# 石窟光谱：云冈遗产节点网络

基于 FastAPI、React 与 TypeScript 的多人协作文化策略游戏。玩家沿遗产路线行动，以有限 AP 探索文化证据、贡献任务、修护风险地点，并让分散的关系重新显影。

## 当前内容规模

| 模块 | 数量 |
| --- | ---: |
| 可选场景 | 4 |
| 地点节点 | 18 |
| 路线 | 30 |
| 区域图谱 | 4 |
| 文化证据 | 36 |
| 世界事件 | 18 |
| 玩家角色 | 4 |

## 一局怎么玩

1. 创建旅程，选择 2-4 人、场景和难度；标准局为 8 回合。
2. 聚焦地图地点，阅读该地点的任务、事件或公开文化市场。
3. 在左侧行动轨道选择移动、探索、贡献或修护。
4. 客户端只显示服务端计算的合法目标；非法地点仍可查看，但不能提交行动。
5. 结束回合后结算事件。完成文化领域、共同影响与保护条件即可获胜。

## 运行

```powershell
cd frontend
npm install
npm run build
cd ..
conda run -n piepaper python -m uvicorn backend.app:app --reload --port 8000
```

打开 `http://127.0.0.1:8000/`。前端开发可使用 `cd frontend; npm run dev`。

## 验证

```powershell
conda run -n piepaper python scripts/validate_content.py
conda run -n piepaper pytest -q
cd frontend
npm run typecheck
npm run test
npm run build
```

截图审计：启动本地服务后运行 `conda run -n piepaper python scripts/audit_screenshots.py`。

## 机制与设计文档

- `docs/MECHANICS_V2.md`：游戏循环、胜负条件、内容规模与可扩展边界。
- `docs/design/AWARD_UI_REDESIGN.md`：Cave Light Atlas 视觉与交互规则。
- `docs/audit/UI_REDESIGN_REPORT.md`：UI 验证记录与剩余风险。
- `docs/engineering/FRONTEND_ARCHITECTURE.md`：前端状态与模块边界。
