# 部署到 Render

本项目已包含 `Dockerfile` 和 `render.yaml`。Render 会构建 React 前端，并由 FastAPI 在同一个网址提供游戏和接口。

1. 登录 [Render Dashboard](https://dashboard.render.com/)，使用 GitHub 授权登录。
2. 选择 **New +** → **Blueprint**，选择仓库 `future3317/yungang`。
3. Render 会读取根目录的 `render.yaml`；确认服务名后点击 **Apply**。
4. 等待首次构建完成，在服务页复制 `https://yungang-feitianqi.onrender.com` 这一类公开地址并发给同学。

免费实例在一段时间无人访问后会休眠，第一次重新打开通常需要几十秒。正式答辩前请提前打开一次，并在服务页确认 `/api/meta` 健康检查为正常。

运行数据默认保存在服务实例内部。免费服务重启后，正在进行的房间和本地存档可能会清空；给同学试玩和答辩演示没有影响。
