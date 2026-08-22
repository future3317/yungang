# 部署到 Render

本项目已包含 `Dockerfile` 和 `render.yaml`。Render 会构建 React 前端，并由 FastAPI 在同一个网址提供游戏和接口。

1. 登录 [Render Dashboard](https://dashboard.render.com/)，使用 GitHub 授权登录。
2. 选择 **New +** → **Blueprint**，选择仓库 `future3317/yungang`。
3. Render 会读取根目录的 `render.yaml`；确认服务名后点击 **Apply**。
4. 等待首次构建完成，在服务页复制 `https://yungang-feitianqi.onrender.com` 这一类公开地址并发给同学。

免费实例在一段时间无人访问后会休眠，第一次重新打开通常需要几十秒。正式答辩前请提前打开一次，并在服务页确认 `/api/meta` 健康检查为正常。

## 存档持久化是发布前置条件

游戏状态、房间席位、旅程时间线和事件历史都写入同一个 SQLite 文件。运行时数据库不提交到 GitHub，也不会复制进 Docker 镜像；否则每次构建都会覆盖成旧快照。

要让重新部署、实例重启和免费实例休眠后的存档继续可读，Render 服务必须使用支持持久磁盘的付费计划，并挂载：

```yaml
plan: starter
disk:
  name: yungang-runtime-data
  mountPath: /var/lib/yungang
  sizeGB: 1
envVars:
  - key: YUNGANG_DATABASE_PATH
    value: /var/lib/yungang/games.sqlite3
```

持久磁盘只保证同一个 Render 服务实例的运行数据跨部署保留。删除服务、删除磁盘或没有完成数据库备份时，不能把存档视为可恢复。发布前应先确认磁盘已挂载，并通过 `/healthz` 检查数据库状态。
