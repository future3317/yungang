# 机制与发布安全收口记录

本轮完成任务书第 8–14 项，作为后续机制迭代的实现基线。

- 场景牌池只从 `card_pool` 生成，不再把未声明的文化牌默认混入；六个场景均可从首页进入，并显示各自时长。
- `scenario_rule` 已结构化为触发器与效果，运行时在修护、贡献、探索、建立连接和回合结束时显式触发。
- 回合摘要在结算前捕获旧事件、旧目标和规划标记快照。
- 规划阶段可选择地点、路线和项目；项目规划通过统一阶段推进器结算。
- 已删除指定 session 创建和旧玩家加入两个接口，客户端只能创建服务端生成的 session。
- 房间 SSE 使用请求头换取一次性 60 秒订阅票据，长期席位令牌不再进入 SSE URL；席位令牌仅保存在当前浏览器会话。
- 房间码使用 16 位随机标识，并对创建、加入和行动接口启用基础限流与安全响应头。
- `data/*.sqlite3`、Playwright 结果、审计截图、覆盖率和日志均视为本地产物，不提交到仓库。

## 机制数据约定

场景规则必须使用以下结构，不得再使用自由文本替代运行时配置：

```json
{
  "description": "玩家可读的规则说明",
  "trigger": "after_restore",
  "effect": {
    "type": "move_planning_mark_adjacent",
    "amount": 1
  }
}
```

新增效果必须同时注册在 `backend/mechanisms.py`、接入 `backend/engine.py`，并增加行为测试。

## 本地验证

```powershell
conda activate piepaper
cd frontend
npm run typecheck
npm run test -- --run
npm run build
cd ..
python -m pytest -q
python scripts/validate_content.py
```

运行数据库只存在于本地 `data/games.sqlite3`，不要强行加入 Git。
