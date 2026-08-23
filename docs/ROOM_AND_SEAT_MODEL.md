# 房间与席位模型

## 运行模式

`solo` 是一位玩家控制两位角色；`local` 是同一设备轮流交接席位；`multi_device` 是每台设备持有自己的席位凭证。三种模式共享同一套 FastAPI 游戏规则和 SQLite 持久化，不依赖账号、WebSocket 或第三方服务。

## 房间生命周期

房间状态为 `lobby`、`in_progress`、`paused`、`completed` 或 `abandoned`。房间创建时只建立席位，不创建游戏状态；房主点亮旅程时才创建 `GameState` 和 `session_id`。完成胜负结算后，房间进入 `completed`，旧行动不能再次提交。

## 凭证

创建房间返回一次性的 `host_token` 和创建者 `seat_token`。加入房间返回加入者的 `seat_token`。服务端只保存 SHA-256 摘要，公开房间信息不返回 token、内部 player id 或完整席位凭证。后续房间请求通过 `X-Seat-Token` 认证。

## API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| POST | `/api/rooms` | 创建 Lobby |
| GET | `/api/rooms/{room_id}` | 查看房间公开状态 |
| POST | `/api/rooms/{room_id}/join` | 加入空席位 |
| POST | `/api/rooms/{room_id}/role` | 选择角色 |
| POST | `/api/rooms/{room_id}/ready` | 设置准备状态 |
| POST | `/api/rooms/{room_id}/start` | 房主点亮旅程 |
| POST | `/api/rooms/{room_id}/pause` | 房主暂停旅程 |
| POST | `/api/rooms/{room_id}/resume` | 房主恢复旅程 |
| POST | `/api/rooms/{room_id}/leave` | 离开 Lobby |
| GET | `/api/rooms/{room_id}/game` | 读取带席位权限的游戏状态 |
| POST | `/api/rooms/{room_id}/actions` | 使用席位凭证提交行动 |

正式流程统一使用 `/api/rooms/*`；客户端行动请求不直接携带可伪造的房间席位身份，席位由 `X-Seat-Token` 认证。
