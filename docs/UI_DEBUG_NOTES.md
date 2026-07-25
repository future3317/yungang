# 界面与调试说明

页面复用 `frontend/static/ui-assets/02_cloud_ribbon_divider.webp` 作为背景材质，不增加新的素材依赖。节点、动作、日志均由同一个后端状态渲染，便于定位“状态正确但显示错误”与“动作不合法仍出现”的问题。

右侧“调试状态”可展开查看完整 v2 JSON，包含 `revision`、行动者、AP、节点、合法动作和牌堆。复现问题时记录 URL 的 `game` 参数、操作顺序和 revision，即可在同一 SQLite 会话中重放。
