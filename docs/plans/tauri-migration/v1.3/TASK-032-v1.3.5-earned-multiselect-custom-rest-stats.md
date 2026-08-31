# TASK-032 · v1.3.5 · 已赚多选 / 自定义休息 / 统计页

> 状态：待开发 · 优先级：P0
> 设计稿（含移动端/桌面端交互原型）：`docs/plans/tauri-migration/v1.3/task-032-v1.3.5-prd/task-032-v1.3.5-prd.html`

## 背景

v1.3.4 完成桌面三栏布局后，暴露三块时间模型缺口：

1. 已赚记录只能「一键生成」，无法跳天/撤销
2. 休息模式只有固定周历（双休/单休/无休），排班制用户无法使用
3. 摸鱼/加班/净工时数据只能看单日，没有周/月视角

## 范围（3 个功能 × 移动端 + 桌面端）

### F1 · 已赚多选生成 / 取消

- 日历页「已赚」视图：一键生成 → 多选模式
- 顶部 segmented：生成 / 取消；快捷：全选工作日 / 清空
- 只允许今天之前的日期；底部实时汇总（已选 N 天 · ¥ 前后对比）
- 生成写 `earnedGenerated` + 金额快照，不覆盖已有 DaySheet 配置
- 桌面端右栏展示选择清单（可单行移除）

### F2 · 自定义休息模式

- `restMode` 新增 `'custom'`，设置页选中后打开 `RestCalendarModal`
- 弹窗：模板区（继承全局 / 自定义工时）+ 完整月历 + 图例 + 薪资提示
- 移动端「先选模板再点日期」；桌面端支持 HTML5 拖拽 + 点选
- 模板可重复应用到多天；同一天可分配多个模板（追加合并为多段工时，重叠走 `unionSegments`）
- **模板简化**：工时模板收敛为单段（`SegmentTemplate.segments[]` → `segment`），设置页模板编辑简化为 2 个时间选择器；老多段模板迁移时自动拆分为多个单段模板（原名 · 1/2/3）
- 数据：`config.customRestSchedule.workDays: Record<dateKey, templateId[] | ['inherit']>`
- 优先级：DaySheet override > 自定义排班 > 全局 restMode
- 薪资不自动入账：走 F1 手动生成或当天度过后自动生成

### F3 · Fish · 时间记录页（日 / 周 / 月）

- 移动端 BottomNav 保持 4 tabs：今日 / 日历 / Fish / 设置，**移除「换算」tab**（换算并入首页咖啡卡片，点击打开详情 push 页）
- Fish 页日 / 周 / 月三态，**默认「日」**= 现有 SlackingDetailPage 内容迁入（不再是 TodayPage 内部 state 切换）；首页摸鱼 Widget 点「详情」跳转至此
- 周 / 月视图：翻页 + 4 汇总卡（净工时/平均净时薪/摸鱼/加班补偿）
- `TrendBars`：纯 SVG 柱状图（不引入图表库），柱色：普通绿 / 加班靛蓝 / 休息灰 / 今天虚线
- 点柱联动当日明细（移动端黑底条 / 桌面右栏）
- 摸鱼/加班记录折叠列表，按日分组
- 桌面端：左侧导航新增「Fish」第 3 项

## 数据模型（v3.3）

见 PRD 05 节：`Config.restMode` 扩展 + `customRestSchedule` + `DayOverrideEntry.earnedGenerated/earnedAmount`。

## compute.ts 新增

- `isRestDayCustom(date, config)`
- `getEffectiveSegments` 优先级链更新
- `batchGenerateEarned(dates, config, overrides)`
- `computeRangeStats(start, end, ...)` 聚合逐日净工时

## 单测要求

- `isRestDayCustom`（inherit 回退）≥3 条
- `batchGenerateEarned`（生成/取消/保留手工配置）≥3 条
- `computeRangeStats`（跨周/跨月/休息日/加班日）≥3 条

## 验收

见 PRD 08 节（8 条），重点：
- typecheck 0 errors，build 增量 < 20KB
- 现有组件（TimerCard / StatCard / QuoteCard / TimeTrackerWidget）零改动
- <1024px 回退移动端布局正常

## 文件影响预估

| 类型 | 文件 |
|---|---|
| 新增 | `RestCalendarModal/` `TemplateChip/` `FishPage` `TrendBars/` |
| 改造 | `CalendarPage` `SettingsPage` `TodayPage` `SlackingDetailPage` `ConvertPage` `BottomNav` `DesktopSidebar` `compute.ts` `types.ts` `constants.ts` |
| 不动 | `TimerCard` `StatCard` `QuoteCard` `TimeTrackerWidget` `DaySheet`（样式不动，仅 TodayPage 层加点击行为） |

## 完成后

- 更新 `docs/CHANGELOG-v1.3.md` 追加 `[v1.3.5]` 节
- 更新 `docs/plans/README.md` 索引
