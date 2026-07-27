# 会话与存档

服务端以 `session_id`、`revision`、`schema_version` 和 SQLite 保存旅程。刷新页面会重新读取同一 session；每次行动都携带 expected revision，避免旧页面覆盖新状态。

恢复路径：

- 首页输入旅程编号重新进入。
- 409 使用服务端 current state 同步后重新选择行动。
- 404 返回首页并新建旅程或使用相同 seed 重开。
- schema 不兼容时保留数据库文件，使用新旅程恢复，不手动修改 SQLite。
- 结果页可用同一 seed 重玩，也可创建新的随机旅程。

当前仍需浏览器实测多标签页冲突、断网刷新和损坏存档提示，并将证据写入试玩记录。
