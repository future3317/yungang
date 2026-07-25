# 云冈遗产节点网络

这是一个 FastAPI + React + TypeScript 的多人合作文化游戏。玩家沿遗产线路移动，用行动点探索、修护和贡献文化证据，把分散节点重新连接成共同影响力网络。

## 启动

```powershell
cd frontend
npm install
npm run build
cd ..
conda run -n piepaper python -m uvicorn backend.app:app --reload
```

打开 `http://127.0.0.1:8000/`，从首页创建或恢复旅程。开发前端可使用 `cd frontend; npm run dev`，并让 Vite 代理 `/api` 到本地 FastAPI。

## 检查

```powershell
conda run -n piepaper python scripts/validate_content.py
conda run -n piepaper pytest -q tests/test_api.py
cd frontend
npm run typecheck
npm run build
```

截图审计需要启动 FastAPI 并安装 Playwright Chromium：

```powershell
conda run -n piepaper python scripts/audit_screenshots.py
```

## 文档

- `docs/MECHANICS_V2.md`：遗产网络规则
- `docs/design/`：设计、动效、内容、资源和 Red Dot 自评
- `docs/engineering/`：前后端架构、API、测试和性能预算
- `docs/audit/`：现状与资产审计
- `docs/award/`：概念陈述、演示脚本和用户测试计划
