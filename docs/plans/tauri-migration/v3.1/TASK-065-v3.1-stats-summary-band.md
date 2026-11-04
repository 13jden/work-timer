# TASK-065 · v3.1 统计页汇总带重设计

**状态**：已实现（待验收）
**版本**：v3.1
**范围**：`src/components/Accounting/StatsPage/`

## 背景

统计页顶部的汇总卡片是一张白卡（`--card`），夹在纸色页面中间，视觉上跟整个 App 的
「护照页 / 手账」语言不搭；卡片内的「列表 / 统计」切换沿用共用 `SegmentedControl`，
在卡片底部显得松散、不像同一套语言。

同时上一轮改动误伤了分类排行卡片与其他卡片样式，本任务把范围收回到「只改顶部汇总带」。

## 范围

**只改顶部汇总带（统计卡片）**：

- 去掉白卡底色 + 圆角 + 阴影，改为纸面直排 + 上下细线（与一程详情页「总账带」同一语言）
- 期间标签 / 范围 / 支出 / 收入 标签统一为 mono 小字 + 大字距
- 金额改用数字专用体（`--font-num`），支出 `--expense`、收入 `--income`，
  环比好/坏同色系（替代原先偏亮的 `--danger`）
- 「列表 / 统计」切换改为本地 `ModeSwitch`（墨底胶囊 + mono 字），
  不改动共用 `SegmentedControl` 的样式

**不改**：

- 列表展示（`GroupedRecordList` / `RecordRow`）不动
- 分类排行卡片、柱状图卡片、日视图列表卡样式恢复原样
- 页面级「日 / 月 / 年」切换继续用共用 `SegmentedControl`

## 验收

- `npm run typecheck` 通过
- `npm run test` 470 / 470 通过
- `npm run build` 成功
