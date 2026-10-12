# TASK-055 · 统计页列表优先（Phase 1）

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | 无 |
| **优先级** | P0（用户明确需求 ⑤） |
| **状态** | ⏳ 待开发 |

---

## 1. 背景

现状（TASK-038 / v2.2）：统计页月 / 年视图只有柱状图 + 分类排行，想看某条具体记录必须点柱子逐级下钻到日视图。用户的高频诉求是「翻一翻这个月的账」，图表反而成了障碍。

**目标**：日 / 月 / 年三视图**默认都是按时间排序的记录列表**（与日视图体验一致）；新增「列表 | 统计」切换，点「统计」才展示柱状图 + 分类占比。

## 2. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-551 | 列表 / 统计切换器 | 汇总条下方新增 `SegmentedControl`（列表 / 统计），默认「列表」；状态记忆到本次会话（不持久化） |
| T-552 | 月视图 · 列表模式 | 按天分组：天头（日期 + 星期 + 当日支/收小计）+ 当日记录行；天头吸顶（`position: sticky`） |
| T-553 | 年视图 · 列表模式 | 按月分组：月头（月份 + 当月支/收小计 + 折叠箭头，默认展开最近 2 个月，其余折叠）；展开后内部仍按天分组 |
| T-554 | 日视图 · 统计模式 | 日视图的「统计」= 当日分类占比（复用 `CategoryRankList`，数据源为当日记录） |
| T-555 | 记录行抽取共用 | 现 `StatsPage` 内 `DayRecordRow` 抽取为 `Accounting/RecordRow/` 共用组件，列表三模式 + 日视图共用（点击编辑、拖拽、池标记行为不变） |

## 3. 详细设计

### 3.1 页面结构（v3.0）

```
PageTopbar（stats · 日统计）
[日 | 月 | 年]  [支出 | 收入]
汇总条：本期支出 / 收入 + 环比
[列表 | 统计] 切换器                    ← T-551 新增
PeriodNav ‹ 期 ›
列表模式：分组记录列表                   ← 默认
统计模式：柱状图 + 分类排行（月/年）/ 分类占比（日）
```

### 3.2 分组聚合

`src/lib/accounting/stats.ts` 新增纯函数（**必须单测**）：

```ts
/** 按天分组并保持日期降序；每组内记录按 createdAt 降序 */
groupByDay(records: AccountRecord[]): Array<{ dateKey: string; records: AccountRecord[]; expense: number; income: number }>;

/** 按月分组（月键降序）；组内含 byDay 二级分组与小计 */
groupByMonth(records: AccountRecord[]): Array<{ monthKey: string; days: ReturnType<typeof groupByDay>; expense: number; income: number }>;
```

- 分组小计口径与汇总条一致：走 `visibleRecords`（排除存量虚拟记录），`claimed` 记录计入列表展示但金额标注沿用现有「已关联池 · 不计统计」规则
- 空分组（当日无记录）不出现在列表中

### 3.3 交互规则

| 场景 | 行为 |
|---|---|
| 列表模式点击记录行 | 打开编辑弹窗（现状不变） |
| 列表模式拖拽归入账户 | **保留**（v3.0 Phase 3 TASK-057 才移除账户体系，本任务不动） |
| 统计模式点柱子 | 下钻逻辑不变（月→日、年→月），下钻后自动切回「列表」模式 |
| 视图切换（日/月/年） | 「列表 | 统计」状态保持 |
| 支出/收入切换 | 列表模式展示全部记录（金额自带正负色），仅分类排行按类型过滤 —— 与日视图现状一致 |

### 3.4 性能

年视图全量列表可能数百行：月组默认折叠（仅最近 2 个月展开），折叠态只渲染月头；展开用懒渲染（`content-visibility: auto` 或条件渲染均可）。

## 4. 新增 / 改动文件

| 文件 | 改动 |
|---|---|
| `src/lib/accounting/stats.ts` + 单测 | 新增 `groupByDay` / `groupByMonth` |
| `src/components/Accounting/RecordRow/*` | 新增：从 StatsPage 抽取的记录行共用组件 |
| `src/components/Accounting/StatsPage/GroupedRecordList.tsx` | 新增：月 / 年分组列表（含吸顶天头、折叠月头） |
| `src/components/Accounting/StatsPage/StatsPage.tsx` | 增加列表/统计切换；月/年默认渲染分组列表 |
| `src/components/Accounting/StatsPage/StatsPage.module.css` | 新增分组列表样式（天头吸顶、月头折叠） |

## 5. 验收标准

- [ ] 打开统计页默认「日 · 列表」，与现状一致
- [ ] 月视图默认列表：按天分组、天头吸顶、小计正确
- [ ] 年视图默认列表：按月分组、可折叠、小计正确
- [ ] 点「统计」：月/年显示柱状图 + 分类排行（与现状一致）；日显示当日分类占比
- [ ] 统计模式点柱子下钻后回到列表模式对应期
- [ ] 记录行点击编辑、池标记、拖拽行为不变
- [ ] 三套主题配色正确；桌面端布局不受影响
- [ ] typecheck / test / build 全绿 + 用户浏览器验收通过

## 6. 不做的事

- ❌ 账单搜索（v3.1 backlog）
- ❌ 账户体系改动（TASK-057）
- ❌ 列表虚拟滚动（数据量未到，折叠已够用）

---

*创建于 2026-10-09 · 状态：待开发*
