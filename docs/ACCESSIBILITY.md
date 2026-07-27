# 无障碍验收

目标是 WCAG 2.2 AA，并参考 Xbox Accessibility Guidelines。当前已提供大字体、高对比、减少动态、首次设置入口、可见焦点、状态 live region、目标按钮替代拖拽和结果页文字摘要。

核心交互要求：

- 地图节点可聚焦、Enter/Space 查看，行动目标仍由服务端合法目标决定。
- Escape 取消行动模式和行动预览。
- 规划、事件、错误、同步状态使用文字和图形双通道表达。
- 关键中文正文不小于 16px；移动端目标优先使用 44px 触控尺寸。
- 390px 宽度不得出现横向滚动；大字体不能隐藏行动按钮。

手动键盘验收见 [MANUAL_KEYBOARD_TEST.md](accessibility/MANUAL_KEYBOARD_TEST.md)。未运行的屏幕阅读器、axe 和 Lighthouse 结果不标记为通过。
