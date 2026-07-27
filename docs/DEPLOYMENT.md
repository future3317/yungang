# 部署

后端使用 `conda run -n piepaper python -m uvicorn backend.app:app --port 8000` 启动；前端执行 `npm run build` 后由 FastAPI 托管 `frontend/dist`。生产环境应将 SQLite 路径、静态资源根目录和允许的代理来源配置为环境变量，并为数据库目录提供持久卷和备份。

发布前至少执行内容校验、后端测试、前端 typecheck、单测、production build 和 Playwright。
