# 架构

`backend/content.py` 加载并校验分层 JSON；`backend/models.py` 定义 v2 状态与动作协议；`backend/engine.py` 是唯一规则源；`backend/repository.py` 负责 SQLite 持久化；`backend/app.py` 只负责 HTTP 边界。

前端只请求状态、显示节点和服务端生成的 `action_options`，不计算移动合法性，不维护本地规则副本。每项行动包含目标、费用、要求、预览变化、推荐理由和禁用原因。动作成功后服务端递增 `revision`，冲突响应携带最新状态；`legal_actions` 仅作为迁移期内部序列化字段，不再作为前端行动来源。

内容分层为角色、节点、任务、难度、文化牌、事件和路线，入口由 `data/game_data.json` 声明，当前 `content_schema_version=2`。
