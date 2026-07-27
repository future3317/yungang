# 性能与可靠性报告

当前代码层已避免在前端复制规则，地图使用 SVG 和已有资产，Inspector 可收起，动态效果受 reduced-motion 设置控制。生产 bundle 通过 Vite 生成，但本文件不虚构 LCP、INP、CLS、Lighthouse 或 axe 数值。

待测命令和证据：

- Lighthouse：桌面和移动各运行一次，保存 JSON/HTML，记录 Performance、Accessibility、Best Practices。
- Playwright：1920×1080、1440×900、1280×800、768×1024、390×844 截图。
- Web Vitals：记录真实 LCP、INP、CLS，而不是用开发机启动时间代替。
- 重点检查地图工具、Inspector 权重、规划遮罩、行动预览、手牌布局和横向滚动。

目标为 p75 LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1；未实测前只称为目标。

## 本地实测记录

2026-07-27，开发服务器首页 Lighthouse：移动预设 Performance 56、Accessibility 100、Best Practices 96，LCP 21.0s、CLS 0.001、TBT 20ms；桌面预设 Performance 71、Accessibility 100、Best Practices 96，LCP 3.6s、CLS 0.021、TBT 0ms。LCP 尚未达到目标，主要风险是开发服务器冷启动和首屏资源加载，不能宣称已达标。

截图输出位于 `frontend/audit_output/world-class/`，包含 1920×1080、1440×900、1280×800、768×1024、390×844 首页截图及两份 Lighthouse JSON。下一步应在 production preview、真实网络和压缩资产条件下复测。
