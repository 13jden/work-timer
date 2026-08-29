# v1.3 Roadmap · Enhanced Time Model

> 本目录为 **v1.3 · 增强版薪资模型** 的开发计划。PRD 原型见 [`../task-020-visual-prd/task-020-visual-prd.html`](../task-020-visual-prd/task-020-visual-prd.html)。

## 目标

把 Salary Timer 从"单一月薪 + 固定工时"模型升级为可覆盖全职 / 倒班 / 兼职 / 自由职业的统一模型。四块增强:

| 块 | 模块 | 关键交付 |
|---|---|---|
| **A** | 加班实时时薪 | TimerCard 加 ⚡×1.5 胶囊,每秒收益按 effectiveHourlyRate 累加,换算页同步使用加班时薪 |
| **B** | 摸鱼 + 净工时 | Today 页摸鱼 Widget,新增摸鱼详情页(月/季汇总占位),新增午休配置,净时薪公式 |
| **C** | 自由模式 | 设置页薪资 segmented(按月/时/日结),多段工时 SegmentsEditor,日类型新增 `freelance` |
| **D** | DaySheet 增强 | 单日自定义工时 + 跨天段 + 夜班加权 |

## 任务拆分

| TASK ID | 标题 | 依赖 | 估时 |
|---|---|---|---|
| TASK-021 | 数据模型 v3 升级 + migration + compute.ts 重构 | - | 1.5 天 |
| TASK-022 | SegmentsEditor 通用组件 + 自由模式设置页 | TASK-021 | 0.8 天 |
| TASK-023 | 摸鱼 Store + Widget + 详情页 + 午休配置 | TASK-021 | 1.0 天 |
| TASK-024 | DaySheet 单日覆盖 + 跨天 + 夜班 + 加班胶囊 + 换算时薪 | TASK-021, 022 | 1.0 天 |

**总估时**:4.3 天(单 Agent 串行)

## 约束

- ✅ **不动现有组件样式**(TimerCard / StatCard / QuoteCard / BottomNav 等保留,只新增组件)
- ✅ **本次专注移动端**,桌面端布局后续版本完善
- ✅ **共享组件**:摸鱼 widget、segments editor 等设计为可复用,桌面端后续可直接使用
- ✅ **compute.ts 100% 单测覆盖**,新功能验证口径见 PRD §7 验收标准
- ✅ **存储向后兼容**:v2 老 key 保留备份,v3 缺失字段补默认值

## 出口标准

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` 全通过(新增 ≥ 30 个 compute 用例)
- ✅ `npm run build` 成功
- ✅ 移动端 PRD §7 全部 9 条验收场景过
- ✅ `docs/CHANGELOG-v1.3.md` 完整记录所有变更
- ✅ 老数据可平滑升级(v2 → v3 数据不丢)

## 详细任务规格

- [TASK-021 · 数据模型 + 计算层重构](./TASK-021-data-model-and-compute.md)
- [TASK-022 · SegmentsEditor + 自由模式设置](./TASK-022-segments-editor-and-freelance-mode.md)
- [TASK-023 · 摸鱼 + 净工时 + 午休配置](./TASK-023-slacking-and-net-hours.md)
- [TASK-024 · DaySheet 增强 + 加班胶囊 + 换算时薪](./TASK-024-daysheet-and-overtime-badge.md)

## 变更日志

- 详细变更见 [`../../../CHANGELOG-v1.3.md`](../../../CHANGELOG-v1.3.md)
- 历史变更(阶段 1)见 [`../../../CHANGELOG.md`](../../../CHANGELOG.md)

---

*最后更新:2026-08-29 · v1.3 启动*
