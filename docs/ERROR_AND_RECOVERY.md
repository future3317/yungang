# 错误与恢复

API 错误结构：

```json
{
  "detail": {
    "code": "site_does_not_need_restoration",
    "message": "当前地点没有需要修护的损伤。",
    "details": {},
    "recovery": "inspect_site_status"
  }
}
```

前端只显示 `message` 和恢复动作，不显示 `code`。409 会使用服务端返回的 current state 同步并清空旧选择；404 提供返回首页；请求失败时保留当前聚焦并允许重新连接。离线时只能查看最近一次已经加载的状态，不能伪造行动成功。
