# 游戏阶段

当前状态由服务端 `SharedState.phase` 驱动：`player_action`、`planning`、`pending_choice`、`event_resolution`、`game_over`。规划阶段由计划标记进入行动阶段；行动通过 AP 消耗推进；回合结束后服务端结算事件并进入下一轮规划；结算后写入 `outcome`，前端进入结果页。

前端只展示服务端返回的阶段和合法行动，不自行推断阶段转换。刷新和版本冲突后以最新 `revision` 状态为准。
