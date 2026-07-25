# 云冈遗产节点网络

这是一个 FastAPI + 原生 JavaScript 的多人协作桌游原型。v2 放弃飞行棋式掷骰移动，改为遗产节点网络：玩家沿文化线路移动，用 AP 探索、修复和贡献，把分散遗产节点连接成共同的影响力网络。

```powershell
pip install -r requirements.txt
uvicorn backend.app:app --reload
```

打开 `http://127.0.0.1:8000/?game=demo`。状态持久化在 `data/games.sqlite3`，内容配置在 `data/*.json`。

机制详见 `docs/MECHANICS_V2.md`，迁移说明见 `docs/MIGRATION_V1_TO_V2.md`，旧机制保存在 `docs/legacy/`。
