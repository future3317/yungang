# 回滚

回滚优先切换到上一个已验证 Git commit，并保留 SQLite 数据库备份。不要删除 `data/games.sqlite3`，不要用 `git reset --hard` 覆盖用户本地素材。若 schema 迁移失败，停止写入、恢复数据库副本，再使用兼容版本读取；无法恢复时从首页创建新旅程，不伪造旧状态。
