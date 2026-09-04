# Changelog · Salary Timer v2.2

> **v2.2 独立 changelog 文件**。基线分支 `feat/v2.2-mobile`(自 `feat/v2.1-mobile`)。
>
> 历史变更见 [`docs/CHANGELOG.md`](./CHANGELOG.md) 索引。

---

## [v2.2] · 2026-09-04 · 统计页三视图 + 记账日历

### A · TASK-038 · 统计聚合数据层

- **新增 `src/lib/accounting/stats.ts`**:统计/日历共用纯聚合函数 —— `filterByRange`(dateKey 闭区间过滤)、`aggregateByDay` / `aggregateByMonth`(收/支聚合,支出输出正数)、`aggregateByCategory`(分类聚合 + 占比,未分类记录归入 `UNCATEGORIZED_ID` 虚拟分类)、`sumRecords`(总收入/总支出/净额)、`shiftDay` / `shiftMonth`(日期/月份平移,跨月跨年安全)
- **虚拟池预留开关**:`StatsOptions.includeVirtualPool` 控制是否纳入 `poolStatus='virtual'` 记录,默认不统计(v2.3 池机制启用)
- **新增 `stats.test.ts`**:14 个单测,覆盖区间边界、支出负数约定、未分类归并、虚拟池开关、跨月跨年平移

### B · TASK-038 · StatsPage 统计页(STATS tab)

- **新增 `src/components/Accounting/StatsPage/`**(StatsPage / StatsBarChart / CategoryRankList):日/月/年三视图 + 支出/收入切换,复用 `SegmentedControl`
- **汇总条**:本期总支出/总收入 + 环比上期 ±%(支出上升红 / 收入上升主题色;上期为 0 显示「上期无记录」)
- **日视图**:‹ 9月3日 · 周三 › 日期切换(尺寸复用日视图日期切换样式)+ 当日记录列表(分类图标 + 名称 + 备注 + 金额)
- **月视图**:每日收/支双柱图(纯 div+CSS,不引图表库,柱最小宽度 + 横向滚动)+ 分类排行条形列表(图标 + 名称 + 占比条 + 金额 + 百分比);点柱下钻到日视图
- **年视图**:12 个月收/支双柱图 + 分类排行;点柱下钻到月视图
- **柱色约定**:支出 `--danger` / 收入 `--accent`,三主题自动跟随

### C · TASK-038 · AccountingCalendar 记账日历(CAL tab)

- **新增 `src/components/Accounting/AccountingCalendar/`**:月历格子显示当日净额(收入−支出),支出为主红 / 收入为主主题色,今天描边高亮,周一为一周起点
- **月切换**:‹ 2026年9月 › 左右切换(新建组件,不触碰计时主题 CalendarPage)
- **本月小结条**:当月总支出 / 总收入

### D · TASK-038 · DayDetailSheet 日详情弹窗

- **新增 `src/components/Accounting/DayDetailSheet/`**:底部半屏 sheet(结构对齐 AddRecordModal)—— 头部日期 + 当日总支出/收入;记录列表点击 → RecordActionSheet 编辑/删除;底部「+ 记一笔」打开 AddRecordModal 并预填该日期

### E · TASK-038 · CategoryRecordsPage 分类记录页

- **新增 `src/components/Accounting/CategoryRecordsPage/`**:某分类全部记录(大图标 + 累计金额 + 月份筛选 + 按月分组倒序列表),记录点击直接编辑(复用 AddRecordModal)
- **两个入口**:统计页分类排行点击;`CategoryDetailPanel` 新增「查看全部记录」按钮(新增 `onShowAllRecords` 可选 prop,现有样式未改)
- **未分类虚拟分类**:排行中可点击查看全部 `isUncategorized` 记录

### F · 接线

- **`App.tsx`**:记账主题 STATS / CAL 占位页替换为 StatsPage / AccountingCalendar(MINE 保留 v2.4 占位)
- **`AccountingPage`**:接入分类记录页 overlay(z-index 160,高于 detailOverlay 150、低于弹窗 200)

### 未改动(TASK-038 约束)

- 计时主题全部页面(TodayPage / CalendarPage / FishPage / SettingsPage 等)
- 桌面端布局(桌面记账仍为 TASK-034 右面板)
- AddRecordModal / RecordActionSheet / CategoryDetailPanel 现有样式

### 验证

- typecheck 0 错误、300 单测全过、build 成功
- 用户浏览器验收通过(2026-09-04)

---

*创建于 2026-09-04*
