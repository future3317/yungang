# 部署

## 本地开发

后端使用专用环境启动：

```powershell
conda run -n piepaper python -m uvicorn backend.app:app --reload --port 8000
```

前端另开终端：

```powershell
cd frontend
npm install
npm run dev
```

本地不设置 `DATABASE_URL` 时使用 SQLite；测试会使用隔离数据库，不应把运行时数据库文件提交到仓库。生产环境不得依赖 `YUNGANG_DATABASE_PATH` 或任何本地 SQLite 文件。

## Render 生产部署

Render 使用根目录 `render.yaml` 和 `Dockerfile` 构建单个 Web Service。Docker 镜像内包含编译后的 `frontend/dist`、后端代码和只读内容数据，由 FastAPI 同源托管页面和 `/api/*` 接口。

Render 环境必须设置：

```text
DATABASE_URL=<Neon PostgreSQL connection string>
YUNGANG_REQUIRE_EXTERNAL_DATABASE=true
```

应用启动时会检查外部数据库配置；缺少 `DATABASE_URL` 会失败，而不是回退到 SQLite。Render 的容器文件系统不保存生产存档，Neon 保存游戏、房间、席位、时间线和事件历史。重新部署、休眠或重启只会重新连接 Neon，不会清空或重建存档。

健康检查地址为 `/healthz`，确认返回的数据库类型为 PostgreSQL 后，才视为生产数据库配置完成。

## 发布前检查

至少执行内容校验、后端测试、前端 typecheck、Vitest、production build 和 Playwright。数据库迁移必须单独执行并保持幂等，不能放入容器启动命令，也不能在启动时重新执行 SQLite 到 PostgreSQL 的全量导入。
