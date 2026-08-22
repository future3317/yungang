# 部署到 Render

本项目已包含 `Dockerfile` 和 `render.yaml`。Render 会构建 React 前端，并由 FastAPI 在同一个网址提供游戏和接口。

1. 登录 [Render Dashboard](https://dashboard.render.com/)，使用 GitHub 授权登录。
2. 选择 **New +** → **Blueprint**，选择仓库 `future3317/yungang`。
3. Render 会读取根目录的 `render.yaml`；确认服务名后点击 **Apply**。
4. 等待首次构建完成，在服务页复制 `https://yungang-feitianqi.onrender.com` 这一类公开地址并发给同学。

免费实例在一段时间无人访问后会休眠，第一次重新打开通常需要几十秒。正式答辩前请提前打开一次，并在服务页确认 `/healthz` 健康检查为正常。

## 存档持久化是发布前置条件

游戏状态、房间席位、旅程时间线和事件历史都写入同一个数据库。Render 免费实例的本地文件系统不能保存 SQLite，所以生产环境使用 Neon PostgreSQL；运行时数据库不提交到 GitHub，也不会复制进 Docker 镜像。

## Neon 免费数据库配置

1. 在 Neon 创建 PostgreSQL 项目，复制带 `sslmode=require` 的连接串。
2. 在 Render 服务的 Environment 中新增 `DATABASE_URL`，粘贴连接串；不要把它写进仓库或聊天记录。
3. 重新部署后打开 `/healthz`，返回 `"database": "postgresql"` 才表示应用已经切换到 Neon。
4. 如果本地 `data/games.sqlite3` 有需要保留的存档，在切换前执行 `D:\Anaconda\envs\piepaper\python.exe scripts/migrate_sqlite_to_postgres.py --source data/games.sqlite3`，并在同一终端设置 `DATABASE_URL`。

迁移脚本按 `session_id` 和 `room_id` 幂等覆盖目标记录，迁移前应保留本地数据库备份。迁移完成后，Render 的重新部署、休眠和重启都只会重新连接 Neon，不会重建游戏存档。

不要同时设置 `DATABASE_URL` 和云端 SQLite 路径；应用优先使用 `DATABASE_URL`。本地开发和测试不设置 `DATABASE_URL` 时仍使用 SQLite。删除 Neon 项目或超过免费额度后，服务会无法读写存档，应在 Neon 控制台保留备份和用量提醒。
