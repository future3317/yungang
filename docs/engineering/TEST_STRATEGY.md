# 测试策略

## 分层入口

- 内容与运行时覆盖：`conda run -n piepaper python scripts/validate_content.py`。
- 后端回归：`conda run -n piepaper pytest -q`。
- 前端类型与构建：在 `frontend/` 执行 `npm run typecheck`、`npm run lint` 和 `npm run build`。
- 前端单测：在 `frontend/` 执行 `npm run test`。
- 浏览器流程和无障碍：先启动 FastAPI，再在 `frontend/` 执行 `npm run test:ui`。

GitHub Actions 的完整入口见 `.github/workflows/quality.yml`，包括内容校验、规则检查、类型检查、单测、构建、资源预算和 Playwright。CI 与本地隔离测试使用 SQLite；生产 Neon 不作为测试数据源，避免测试修改真实存档。

## 当前产品边界

项目只维护 PC 端。窗口宽度低于 `1024px` 时显示桌面端提示，不执行移动端布局或移动端视觉基线。桌面视觉回归覆盖 `1280 / 1440 / 1920 / 2048` 等项目配置的尺寸；如果视觉调整是有意变更，更新快照后必须再次执行不带更新参数的回归。

## 重点回归合同

- revision/CAS 冲突不能覆盖较新的房间或游戏状态。
- 行动预览、实际结算和反馈中的目标及数值必须一致。
- 事件预告与回合结算必须使用同一影响范围。
- SSE 正常连接时不启动固定频率数据库轮询；连接异常时才启用低频恢复路径。
- 路线和地点清单、右侧检查器正文、对话框和地图操作必须可用且不能产生页面级溢出。
- 测试运行产物、截图、报告和本地数据库不得提交到仓库。
