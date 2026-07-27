# 测试策略

已运行并应保持通过：

```powershell
conda run -n piepaper pytest -q
cd frontend
npm run typecheck
npm run test
npm run build
```

后端重点覆盖 API revision、seed、路线移动、事件目标、准备、策略牌目标、角色技能和内容初始化。下一批自动化应补齐四场景、四难度、单人双角色、36 张证据、12 张策略牌、18 个任务、节点能力、8 个升级和项目阶段的参数化测试。

前端应使用 Testing Library 覆盖 Landing、PlanningPhase、ActionPreview、Inspector、Result 和恢复状态；Playwright 覆盖首次单人、双人标准局、路线阻断、胜负结算、409/断网/刷新；axe 覆盖默认、大字体、高对比和移动视口。没有实际命令输出的项目不标记为通过。

当前已运行：Vitest 2 个测试文件共 3 项通过；Playwright 6 项通过，包含桌面/390px 首页创建流程、横向溢出检查和 landing axe serious/critical 检查。完整游戏流程、结果页 axe、断网、多标签页和视觉回归仍需扩展，不在当前结果中冒充通过。
