# 架构

`backend/content.py` 严格加载并校验 `content_schema_version=3` 的分层 JSON；`backend/models.py` 定义 API 状态与动作协议；`backend/engine/` 是唯一规则源；`backend/repository.py` 负责持久化；`backend/app.py` 只处理 HTTP、房间与 SSE 边界。生产环境通过 `DATABASE_URL` 连接 Neon PostgreSQL，并复用 PostgreSQL 连接池；本地开发和隔离测试不设置外部数据库时使用 SQLite。`YUNGANG_REQUIRE_EXTERNAL_DATABASE=true` 用于阻止生产误用 SQLite。

前端只请求状态并渲染服务端生成的 `action_options`，不自行计算移动、任务或项目合法性。每项行动包含中文标签、目标、费用、要求、后果预览、推荐理由和禁用原因。动作成功后服务端递增 `revision`；冲突响应携带最新状态。`legal_actions` 不属于前端行动主路径。

桌面游戏页只有一个布局所有者：`GameViewport` 的 HUD Grid。顶部显示回合、主题、核心目标和风化压力；左侧是队伍；中央是地图世界层；右侧是地点检查器；底部是行动坞与折叠手牌。业务组件不得自行计算页面坐标，Dialog、Popover 和 Tooltip 才能进入 overlay 层。

内容入口由 `data/game_data.json` 声明。运行时内容包括角色、地点、任务、难度、文化证据、策略牌、事件、路线、项目、场景、术语和目标；`data/legacy/` 与 `docs/legacy/` 仅用于历史参考，运行时禁止读取。

数据库只保存可恢复的游戏、房间、席位、回合摘要和事件历史。Render 容器是无状态运行环境，不承担生产存档；表结构初始化与索引迁移必须幂等，启动流程不会执行 SQLite 全量导入。
