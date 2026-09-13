# 会话与存档

服务端以 `session_id`、`revision` 和 `schema_version` 保存旅程。`rooms` 与 `games` 通过同一个存储后端关联，生产使用 `DATABASE_URL` 指向的 Neon PostgreSQL，本地开发和隔离测试使用 SQLite。刷新页面会重新读取同一 session；每次行动都携带 expected revision，避免旧页面覆盖新状态。

恢复路径：

- 首页输入旅程编号重新进入。
- 409 使用服务端 current state 同步后重新选择行动。
- 404 只表示当前服务找不到该存档；生产环境先检查 Render 的 `DATABASE_URL` 和 `/healthz`，不要直接用相同 seed 冒充恢复。只有玩家明确选择“重新开始”时才使用相同 seed 重玩。
- schema 不兼容时保留数据库记录，先使用项目提供的迁移路径处理，不手动修改生产数据库。
- 结果页可用同一 seed 重玩，也可创建新的随机旅程。

发布前必须确认 Render 的 `DATABASE_URL` 指向 Neon，并通过 `/healthz` 验证数据库类型。还应实测多标签页冲突、断网刷新、席位凭证恢复和损坏存档提示，并将证据写入试玩记录。Render 免费容器不提供生产 SQLite 持久化。
