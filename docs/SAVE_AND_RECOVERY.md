# 保存与恢复

SQLite 的同一个数据库文件保存 `GameState`、房间状态、旅程时间线、事件历史和 schema version。游戏行动使用 revision 条件更新，冲突时不写入部分结果。旧游戏状态通过显式迁移标记进入当前 schema，不靠修改数字伪装迁移完成。

旧 session 可从首页恢复；房间通过房间码和本地保存的席位 token 恢复。丢失浏览器席位凭证时，进入房间后选择原席位重新发放凭证。多设备刷新后重新读取房间和游戏状态，结果页刷新仍可读取已完成旅程。

云端部署必须把 `YUNGANG_DATABASE_PATH` 指向 Render 持久磁盘。GitHub 仓库不保存运行时 SQLite，Docker 构建也不应覆盖持久磁盘中的数据库。

`tests/test_persistence.py` 验证关闭并重新创建 repository 后，游戏状态、时间线、事件历史和房间席位仍然一致。
