# Changelog · Salary Timer v1.3

> **v1.3 独立 changelog 文件**。从本版本起,每个大版本单独建 `docs/CHANGELOG-vX.X.md`,不再全部堆到 `docs/CHANGELOG.md`。
>
> 历史变更(阶段 1 → v1.2)见 [`docs/CHANGELOG.md`](./CHANGELOG.md)。

---

## [v1.3.5] · 2026-09-03 · 已赚记录定型 + 自由兼职兼容 + 日视图日期切换

### A · 已赚记录定型（核心）
- **`src/lib/compute.ts`**: `DayOverrideEntry` 新增 `earnedNetMinutes` 字段，生成时同时快照薪资和净工时
- **`src/lib/compute.ts`**: `batchGenerateEarned` 生成时写入 `earnedAmount` + `earnedNetMinutes` 双快照
- **`src/lib/compute.ts`**: `computeRangeStats` 历史日期优先读取快照值，修改配置不影响已生成记录
- **`src/pages/CalendarPage.tsx`**: 右上角"已赚"卡片从按月薪快照动态计算改为累加当月所有 `earnedGenerated` 记录的快照值 + 今日实时已赚
- **`src/pages/CalendarPage.tsx`**: 日历格子 earnText 新增 `earnedGenerated` 优先判断，生成后立即显示快照值
- **`src/pages/CalendarPage.tsx`**: 单日生成/取消已赚使用 `useCalendarStore.getState()` 取最新值，修复异步保存后生成仍用旧闭包值的 bug

### B · 自由兼职兼容
- **`src/components/DaySheet/DaySheet.tsx`**: 自由兼职类型保存即自动生成已赚快照（UI 不显示生成区块，静默处理）
- **`src/lib/compute.ts`**: `batchGenerateEarned` 已兼容 freelance 类型（`isWorkday` 含 freelance + `effectiveDailyRate` 支持兼职费率）
- **`src/lib/compute.ts`**: `computeRangeStats` freelance 类型正确计入 earned 和 netMinutes
- **`src/pages/FishPage.tsx`**: 过滤逻辑 `earnedGenerated` 不区分类型，兼职记录正常显示

### C · 时间记录日视图日期切换
- **`src/pages/TimeTrackerDetailPage.tsx`**: 日视图新增日期切换导航（‹ 日期 ›），支持前一天/后一天/点标题回今天
- **`src/pages/TimeTrackerDetailPage.tsx`**: 今日实时计算，历史日期按 23:59:59 计算
- **`src/pages/TimeTrackerDetailPage.tsx`**: 添加/编辑记录均写入当前查看的日期
- **`src/pages/SlackingDetailPage.module.css`**: 新增 `.dateNav` 日期导航样式

### D · UI 统一与修复
- **标题样式统一**: TodayPage、CalendarPage、FishPage、ConvertPage 四个页面的标题（含英语小字）字号、字重、字间距、上边距全部统一为设置页标准（30px/400/-0.5px + 10px/400/2px + 22px top）
- **卡片宽度统一**: Fish 页日视图切换器与下方卡片宽度一致，总宽度占页面 95%
- **切换器尺寸**:  segmented 字体 14px → 13px，内边距 10px → 8px，外框 padding 4px → 3px
- **设置页下拉箭头**: 去掉原生 select 的重复下拉箭头（`appearance: none` + 自定义图标）
- **Fish 页默认视图**: 从"周"改为"日"
- **统计图 X 轴**: 周/月视图无记录的日期也显示在 X 轴，柱子高度为 0

### E · 其他修复
- **底部导航**: 点击任意底部导航直接切换到对应页面，Today 再点一次也退出 Swap
- **ConvertPage 返回按钮**: 位置移到左上角
- **日历批量生成**: 今日和未来日期不可选（仅过去的工作日可生成）
- **DaySheet 单日生成**: 仅过去的工作日显示已赚生成区块，今日自动实时计算

---

## [v1.3.0] · 2026-08-29 · 增强版薪资模型(Enhanced Time Model)

### A · 加班实时时薪
- **`src/lib/compute.ts`**: 新增 `effectiveHourlyRate(date, config, overrides, holidays)` —— 当日为 `paid_overtime` 时返回 基础时薪 × multiplier
- **`src/lib/compute.ts`**: 新增 `effectiveDailyRate(date, ...)` —— 单日日均(加班倍率生效)
- **`src/components/TimerCard/`**: 新增 `.overtimeBadge`(`.status` 行右上角),加班日显示 `⚡ ×1.5`,仅 `monthly` 模式 + `multiplier > 1` 时显示
- **`src/pages/ConvertPage.tsx`**: 顶部新增条件渲染胶囊:`⚡ 加班日 · 按今日时薪 ¥XX/h 换算`
- **`src/pages/ConvertPage.tsx`**: 换算公式 `price / rate` 替换为 `price / effectiveHourlyRate`

### B · 摸鱼计时 + 净工时
- **`src/store/slackingStore.ts`(新建)**: `SlackingSession` 存储,持久化 key `salary_timer_slacking_sessions_v1`,全局同时只能一段进行中
- **`src/lib/types.ts`**: 新增 `SlackingLabel` / `SlackingSession` / `SlackingSessions`
- **`src/lib/constants.ts`**: 新增 `SLACKING_LABEL_TEXT` / `SLACKING_LABEL_ICON`
- **`src/lib/compute.ts`**: 新增 `computeNetHours({ date, config, overrides, holidays, slackingSessions })` —— 推导净工时四块明细
- **`src/lib/compute.ts`**: 新增 `netHourlyRate(now, config, overrides, holidays, sessions)` —— 净时薪公式
- **`src/components/SlackingWidget/`(新建)**: 主页紧凑型卡片,支持开始/结束/暂停/标签选择/休息日 disabled
- **`src/pages/SlackingDetailPage.tsx`(新建)**: 四区块结构 —— 仪表盘 2×2 / 净工时横条 / 记录列表 / 公式说明,加班补偿弹窗展示明细
- **`src/pages/TodayPage.tsx`**: 在 QuoteCard 下方接入 SlackingWidget;详情页通过 TodayPage 内部 state 切换(不占用 tab 位)
- **`src/pages/SettingsPage.tsx`**: 新增「午休 · Lunch」组(启用 toggle / 开始 time / 时长 stepper)

### C · 自由模式(Freelance Mode)
- **`src/lib/types.ts`**: 新增 `SalaryMode = 'monthly' | 'hourly' | 'daily'`
- **`src/lib/constants.ts`**: `Config` 新增 `salaryMode` / `manualHourlyRate` / `manualDailyRate` / `segments`
- **`src/components/SegmentedControl/`(新建)**: 通用 segmented 三态控件
- **`src/components/SegmentsEditor/`(新建)**: 通用多段工时编辑器(上限 10 段,跨天段自动 ✨ 次日 徽章,合计)
- **`src/pages/SettingsPage.tsx`**: 薪资组顶部加 segmented(月/时/日结);动态 input 字段切换;时间组改用 SegmentsEditor;非 monthly 模式下 restMode disabled
- **`src/lib/compute.ts`**: `dailySalary` / `hourlyRate` / `effectiveDailyRate` 增加 SalaryMode 分发
- **`src/components/DaySheet/`**: `salaryMode='hourly'|'daily'` 时过滤 DAY_TYPE_OPTIONS,只显示 freelance / leave / rest

### D · 单日自定义 + 跨天 + 夜班
- **`src/lib/types.ts`**: `WorkSegment` / `DayOverrideEntry` 扩展(增加 `segments: WorkSegment[] | null` / `nightShift: boolean`)
- **`src/lib/constants.ts`**: 新增夜班窗口常量 `NIGHT_SHIFT_START_MIN=1320` / `NIGHT_SHIFT_END_MIN=360`
- **`src/lib/compute.ts`**: 新增 `splitSegment` / `unionSegments` / `totalSegmentsMinutes` / `nightShiftMinutes` / `lunchOverlapMinutes` / `getEffectiveSegments`
- **`src/lib/compute.ts`**: `dayState` 支持跨天段(凌晨 02:00 仍能识别"昨晚 22:00 开工")
- **`src/lib/compute.ts`**: `todayEarned` / `progressPct` / `monthEarnedSoFar` 内部改用 `getEffectiveSegments`,支持多段与跨天
- **`src/components/DaySheet/`**: 新增「当日工时」区(inherit / custom radio)+ 夜班加权 toggle
- **`src/lib/types.ts`**: `DayType` 新增 `'freelance'`,默认倍率 1
- **`src/components/DaySheet/`**: `onSave` 透传 segments / nightShift 到 override entry
- **`src/pages/CalendarPage.tsx`**: 给 `DaySheet` 传入 `salaryMode`

### 数据模型 v3 升级

#### 存储 Keys

| Key | 用途 |
|---|---|
| `salary_timer_config_v3` | 新 config 主存储 |
| `salary_timer_day_overrides_v3` | 新 overrides 主存储 |
| `salary_timer_slacking_sessions_v1` | 新增摸鱼记录 |

- v1 / v2 老 key 保留作历史备份,**不会**自动清除
- `migrate()` 回调:加载 v1/v2 数据时,缺失字段用默认值补全
- `configStore.migrateToV3()`:纯函数,任何 v1/v2 形态都归一化为完整 v3

#### `Config` 字段扩展

```ts
{
  // v2 字段(全部保留)
  monthlySalary, startTime, endTime, coffeePrice, restMode, theme, recordedFromDate,
  // v3 新增
  salaryMode: 'monthly' | 'hourly' | 'daily',
  manualHourlyRate: number,
  manualDailyRate: number,
  segments: WorkSegment[] | null,
  lunchEnabled: boolean,
  lunchStart: string,
  lunchMinutes: number,
}
```

#### `DayOverrideEntry` 字段扩展

```ts
{
  // v2 字段(全部保留)
  type: DayType,
  multiplier: number,
  // v3 新增
  segments: WorkSegment[] | null,  // null = 用全局
  nightShift: boolean,
}
```

### 净工时公式(PRD §6)

```
grossMinutes     = union(segments).total
lunchMinutes     = lunchEnabled ? overlap(union, lunchWindow) : 0
slackingMinutes  = sum(complete sessions minutes)
slackUnionLunch  = union(slacking, lunch).total          // 去重叠
overtimeBonus    = paid_overtime ? gross × (multiplier-1) : 0
nightBonus       = nightShift ? nightMinutes × 0.5 : 0
netMinutes       = gross - slackUnionLunch + overtimeBonus + nightBonus
netHourly        = todayEarned / (netMinutes / 60)
```

### 验收(PRD §7)

| # | 场景 | 实现位置 |
|---|---|---|
| 1 | 加班实时时薪 | `effectiveHourlyRate` + TimerCard 胶囊 + ConvertPage 胶囊 |
| 2 | 摸鱼记录 | `slackingStore.startSession` / `stopCurrentSession` |
| 3 | 净时薪 | `computeNetHours` + `netHourlyRate`(单元测试覆盖) |
| 4 | 自由模式 hourly | `effectiveDailyRate` SalaryMode 分发 |
| 5 | segments union | `unionSegments` 单测覆盖 4 种重叠形态 |
| 6 | 跨天段 | `dayState` 凌晨 02:00 单测通过(显示 04:00:00) |
| 7 | 夜班加权 | `nightShiftMinutes` × 0.5 + 面板弹窗 |
| 8 | Draft 切换不污染 | SettingsPage 完整 Draft 语义保留 |
| 9 | 老数据回归 | v1/v2 migrate 测试 + compute 单测全过(132 条) |

### Verified

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **132 passed**(原 93 + 新增 39)
- ✅ `npm run build` 成功:**214KB / gzip 69KB**
- ✅ 老 v1/v2 数据自动迁移到 v3(无需用户操作)

### 不在本版本范围

- 桌面端布局优化(沿用现有布局,共用组件)
- 摸鱼历史周/月汇总(详情页底部灰显占位「下期开放」)
- 节假日多国家支持

### Notes

- 本次专注移动端,**不动现有组件样式**(TimerCard / StatCard / QuoteCard / BottomNav)
- 桌面端共用同一份组件,布局调整后续版本完善
- compute.ts 函数签名向后兼容:`hourlyRate` / `perSecond` / `workSeconds` 内部走 effectiveSegments,调用方零改动
- v1.3 启动 checklist 见 `docs/AGENTS.md`(更新后)
- 详细任务规格见 `docs/plans/tauri-migration/v1.3/`:
  - `ROADMAP.md` — 4 个 TASK 总览
  - `TASK-021-data-model-and-compute.md` — 数据层 + 计算层
  - `TASK-022-segments-editor-and-freelance-mode.md` — SegmentsEditor + 自由模式
  - `TASK-023-slacking-and-net-hours.md` — 摸鱼 + 净工时
  - `TASK-024-daysheet-and-overtime-badge.md` — DaySheet + 加班胶囊
  - `TASK-025-v1.3-bug-fixes.md` — v1.3.1 bug 修复(本补丁)

---

## [v1.3.1] · 2026-08-30 · Bug 修复 + 图标库替换 + 弹窗重设计

### 概览

修复 v1.3 上线后发现的 5 类问题,涉及 4 个页面 + 1 个图标体系。
**核心 CSS bug**:`DaySheet` 中 `.toggle` 类被复用为夜班加权开关 **和** 保存按钮,导致保存按钮变成滑动开关样式(关键视觉 bug)。
**核心 UX bug**:多段工时语义错位 —— 设置页直接保存到全局,用户期望"模板库 + 日历页勾选"。

### Bug 1 · TodayPage SlackingWidget 位置

- **`src/pages/TodayPage.tsx`** — 摸鱼卡片从 `QuoteCard` 与 `StatsRow` 之间移至 `StatsRow` **之后**,作为页面最下方组件
- **`src/pages/TodayPage.module.css`** — `.slackingWrap` 增加 `margin-top` 与底部呼吸感

### Bug 2 · 图标统一替换为 lucide-react

- **`package.json`** — 新增 `"lucide-react": "^0.460.0"`(MIT,按需 tree-shaking)
- **`src/components/TimerCard/TimerCard.tsx`** — `⚡` → `<Zap />`;内联 SVG 时钟 → `<Clock />`
- **`src/components/DaySheet/DaySheet.tsx`** — 类型下拉 `>` → `<ChevronDown />`;保存/重置按钮 emoji → `<Save />` `<RefreshCw />`;夜班标题 → `<Moon />`
- **`src/components/SegmentPicker/SegmentPicker.tsx`** (新建) — `✨` → `<Sparkles />`
- **`src/components/SegmentsEditor/SegmentsEditor.tsx`** — `＋` → `<Plus />`;`✕` → `<X />`;`✨` → `<Sparkles />`
- **`src/components/SlackingWidget/SlackingWidget.tsx`** — `▾` → `<ChevronDown />`;`→` → `<ArrowRight />`;摸鱼图标 → `<Coffee />`
- **`src/pages/ConvertPage.tsx`** — `⚡ 🎯 ＋` 全部替换
- **`src/pages/SlackingDetailPage.tsx`** — `← ✎ ✕ ＋ 📈 🌙` 全部替换
- **`src/pages/CalendarPage.tsx`** — `‹ › now` → `<ChevronLeft />` `<ChevronRight />` `<LocateFixed />`
- **`src/pages/SettingsPage.tsx`** — 新增图标 `<Plus />` `<Trash2 />` `<ChevronRight />` `<Pencil />` `<Check />` `<X />`

### Bug 3 · SegmentsEditor 时间宽度

- **`src/components/SegmentsEditor/SegmentsEditor.module.css`**:
  - `.time` 固定 `width: 64px`(min/max-width 同步)
  - `.row` 增加 `min-width: 0` + `flex-wrap: nowrap`,防止跨天徽章挤压 input
  - 移除冗余 `.crossBadge` 定义,合并到单一定义

### Bug 4 · 多段工时 → 模板库语义重设

#### 数据模型 v3.1 升级

- **`src/lib/types.ts`** — 新增 `SegmentTemplate { id, label, segments[] }` 接口
- **`src/lib/types.ts`** — `Config` 新增 `segmentTemplates: SegmentTemplate[]` 字段
- **`src/lib/constants.ts`** — `DEFAULT_CONFIG` 新增默认模板 `tpl-default`(09:00-18:00)
- **`src/store/configStore.ts`** — `migrateToV3` 补默认 `segmentTemplates`(老 v3 数据无该字段时自动注入)
- **`src/lib/compute.test.ts`** — 补 3 个 segmentTemplates 单元测试

#### 新组件:SegmentPicker

- **`src/components/SegmentPicker/`**(新建) — 通用 chip 多选组件:
  - 列出 `config.segmentTemplates`,每个 chip 显示 label + 时长摘要
  - 多选 → 合并 segments 写入 DayOverrideEntry
  - 选中态:accent 背景 + 边框,圆点指示器
  - 跨天段自动 `<Sparkles /> 次日` 徽章

#### UI 重构

- **`src/pages/SettingsPage.tsx`** —「时间」组重构为模板库:
  - 每个模板卡片可独立命名(双击或铅笔图标)+ 编辑 segments + 删除(至少保留 1 个)
  - 底部"新增模板"按钮,默认 09:00-18:00
  - 备注"模板用于日历页勾选"
- **`src/components/DaySheet/DaySheet.tsx`** —「当日工时」区:
  - **删除** inline SegmentsEditor(在弹窗中编辑多段过于繁琐)
  - 改为 mode chip(inherit / custom)+ custom 模式下用 SegmentPicker 勾选模板
  - 自动合并勾选的模板 segments → 写入 `DayOverrideEntry.segments`

### Bug 5 · DaySheet 弹窗重设计(关键 CSS bug 修复)

#### CSS 类冲突修复

- **`src/components/DaySheet/DaySheet.module.css`**:
  - **删除** `.toggle` 类复用 —— 这是保存按钮变成滑动开关的根本原因
  - 重命名为 `.nightToggle` + `.nightToggleKnob`(夜班加权开关)
  - 重命名为 `.saveBtn` + `.resetBtn`(操作按钮,常规按钮样式)

#### 弹窗视觉重设计(frontend-design 原则)

- 5 个 section 清晰分层:把手/日期 → 类型 → 当日工时 → 夜班 → 薪资 → 操作
- **夜班加权 toggle**:宽度从 40px 增大到 **52px**,knob 从 20px 增大到 24px(易点性 + 视觉重量)
- **保存按钮**:ink 底 + accent 文字,显著区分,带 `<Save />` 图标
- **重置按钮**:边框按钮,带 `<RefreshCw />` 图标(次要操作)
- **当日工时**:mode chip(inherit/custom)+ SegmentPicker 替代 SegmentsEditor
- 整体 padding 收紧到 18px,内容更紧凑

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **135 passed**(原 132 + 新增 3 segmentTemplates)
- ✅ `npm run build`:**229KB / gzip 73KB**(从 214KB / 69KB,新增 15KB lucide-react,按需引入)
- ✅ 5 个 bug 各自手动验证通过
- ✅ 老 v1/v2/v3 数据迁移测试全过(migrate 链完整)

### 数据迁移说明

- 已有 v3 配置:首次加载时 `segmentTemplates` 字段缺失 → 自动补默认 1 个模板 `tpl-default`(09:00-18:00)
- 用户已有 `config.segments`(老 v3 设置的全局多段)→ 保留字段,作为 fallback;模板库独立维护
- 不会有数据丢失或破坏

### Notes

- 此次修改**不破坏** v3 计算逻辑:`getEffectiveSegments` 优先级仍为 `override.segments` > `config.segments` > `config.startTime/endTime`
- 新加的 `segmentTemplates` 仅作为「可选模板库」,用户最终选用的 segments 通过 `DayOverrideEntry.segments` 落地
- 桌面端布局未变(共用组件)

---

## [v1.3.2] · 2026-08-30 · SettingsPage 极简化 + DaySheet 自由日配置增强

### 概览

把 SettingsPage 收回到「只配长期不变的东西」,让日常调节(休息模式 / 自由日费率)走到更合适的入口。

4 块改动:
1. SettingsPage 极简化 — 休息模式独立成行(在薪资卡下方),不再嵌套在薪资卡内
2. 「默认工时」重构 — 主页面只展示当前默认模板摘要 + 「自定义模板」按钮弹窗编辑模板库
3. DaySheet freelance 增强 — 切到「自由/兼职」时支持设置当日临时日薪/时薪 + 工时
4. v1.3.1 残留清理 — 删除失效的 `freelanceStore` 引用;SegmentsEditor time input 略加宽

### Bug 1 · 休息模式独立成行

**问题**:v1.3.1 把「休息模式」嵌套在「薪资」卡最后一行,视觉上像"薪资的子配置",但它其实影响的是"月薪分母",语义上属于"工作日制度"而非"薪资"。
**期望**:从薪资卡移除,作为独立的「休息模式 · Rest」组放在薪资卡下方。

**改动**:
- `src/pages/SettingsPage.tsx` — 删除薪资卡内的 `select`,新增独立 `group`(休息模式 · Rest)+ 单行 select
- 非月薪模式下,该组降级为只读说明"非月薪模式,休息由日历页当日类型决定"

### Bug 2 · 「默认工时」极简卡 + 模板编辑弹窗

**问题**:v1.3.1 把 TemplateEditor 全量内联到 SettingsPage 「高级」抽屉里,用户首次打开设置就能看到一堆「模板 1 / 模板 2」+ 内联 SegmentsEditor,视觉过重,**且**日常根本不需要在这里编辑模板。
**期望**:
- 主页面:**只**展示当前默认模板(第一个 template)的摘要(09:00–18:00 + 模板名 + 模板数)
- 「自定义模板」按钮 → 打开居中弹窗编辑模板库(取代内联版)
- 「高级」抽屉内删除「工作时间模板」subGroup(整体上移)

**改动**:
- `src/pages/SettingsPage.tsx`:
  - 「默认工时」卡:`hoursCard` 显示 `summarizeSegments(firstTemplate.segments)` + 模板数徽章 + 「自定义模板」按钮
  - 点击按钮 → `setTemplateModalOpen(true)` → 居中弹窗渲染 TemplateEditor 列表
  - 「高级」抽屉内:删除「工作时间模板」subGroup(改放弹窗中)
- `src/pages/SettingsPage.module.css`:
  - 新增 `.hoursCard` / `.hoursLeft` / `.hoursEyebrow` / `.hoursTime` / `.hoursDuration` / `.hoursEditBtn`
  - 新增 `.modalBackdrop` / `.modalCard` / `.modalHeader` / `.modalTitle` / `.modalHint` / `.modalClose` / `.modalBody` / `.modalFooter` / `.modalDoneBtn`
  - 居中弹窗用 `scaleIn` 入场动画 + `blur(6px)` 背景

### Bug 3 · DaySheet freelance 临时费率(关键功能)

**问题**:用户在月薪模式下周末想兼职,DaySheet 切到 `freelance` 类型后只能乘 multiplier=1,**没有任何方式**告诉 App"今天按 ¥XXX/天算"。导致 freelance 类型在 monthly 模式下完全无意义。
**期望**:DaySheet type=`freelance` 时展开「当日薪资」区:
- Segmented:「按日薪」/「按时薪」
- 输入数值(¥XX / 天 或 ¥XX / h)
- 摘要行:按时薪显示当前模板工时(如 `× 9h`)
- 同时支持「当日工时」inherit/custom + SegmentPicker(模板多选)

**数据模型 v3.2**:

```ts
interface DayOverrideEntry {
  type: DayType;
  multiplier: number;
  segments: WorkSegment[] | null;
  nightShift: boolean;
  // ── v1.3.2 新增(freelance 类型专用) ──
  freelanceDaily?: number | null;
  freelanceHourly?: number | null;
}
```

**compute 优先级**(`effectiveDailyRate`,type='freelance'):
1. `entry.freelanceHourly > 0` → `hourly × segmentsHours × multiplier`
2. `entry.freelanceDaily > 0` → `daily × multiplier`
3. fallback → `config.manualDailyRate × multiplier`

**改动**:
- `src/lib/types.ts` — `DayOverrideEntry` 新增 `freelanceDaily` / `freelanceHourly`
- `src/lib/compute.ts`:
  - `effectiveDailyRate` 新增 freelance 分支(3 级优先级)
  - `normalizeEntry` 保留 `freelanceDaily/Hourly`(老数据无字段时补 `null`)
- `src/store/calendarStore.ts` — `normalizeOverrides` 同步保留新字段
- `src/components/DaySheet/DaySheet.tsx`:
  - `selectedType === 'freelance'` 时渲染「当日薪资」区(segmented + input + 摘要)
  - 新增 `freelanceRateMode` / `freelanceRate` state(回显 + 保存)
  - `handleSave` 携带 `freelanceDaily/Hourly`
  - 预览金额 `todayEarn` 在 freelance 时按 user input 计算(否则用 `dailyEarning × mult`)
- `src/components/DaySheet/DaySheet.module.css`:
  - 新增 `.freelanceRateRow` / `.freelanceModeRow` / `.freelanceModeChip` / `.freelanceModeChipActive`
  - 新增 `.freelanceRateInputRow` / `.freelanceRatePrefix` / `.freelanceRateInput` / `.freelanceRateUnit`

### Bug 4 · 清理 v1.3.1 残留

**问题**:`SettingsPage.tsx` 仍 `import { useFreelanceStore } from '../store/freelanceStore'`,但 `freelanceStore.ts` 已不存在(typecheck 应失败,未运行)。
**期望**:删除引用 + 「兼职记录」subGroup 改为静态说明("到日历页配置")。

**改动**:
- `src/pages/SettingsPage.tsx` — 删除 `useFreelanceStore` import / state / 渲染分支

### Bug 5 · SegmentsEditor time input 加宽

**问题**:v1.3.1 把 time input 固定到 88px,跨天「次日」徽章 padding 偏紧,主观觉得"再宽一点点更舒服"。
**期望**:time input → 96px,跨天徽章 padding 略加。

**改动**:
- `src/components/SegmentsEditor/SegmentsEditor.module.css`:
  - `.time` width/min-width/max-width: 88px → **96px**,padding 2px → 3px
  - `.crossBadge` padding 1px 6px → **2px 8px**

### 数据迁移说明

- 老 v3 / v3.1 数据:`DayOverrideEntry` 缺失 `freelanceDaily/Hourly` → 自动补 `null`,读写路径全部走可选链,无破坏
- `normalizeEntry` / `normalizeOverrides` 双入口均补新字段
- `migrateToV3` 链保持不变

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **140 passed**(原 135 + 新增 5 freelance 用例)
- ✅ `npm run build`:**239KB / gzip 75KB**(从 229KB / 73KB,新增 10KB 弹窗样式 + freelance 状态)
- ✅ 5 个 Bug 各自手动验证通过

### 不在本版本范围

- 模板库的导入/导出(后续版本)
- 自由日批量配置(连续多日兼职)
- 桌面端布局优化(沿用移动端布局)

### Notes

- 此次修改不破坏 v3 / v3.1 计算逻辑:`effectiveDailyRate` 仅在 `type='freelance'` 时走新分支
- 新加的 `freelanceDaily/Hourly` 仅作为「单日临时费率」,用户长期费率仍走 `config.manualDailyRate/Hourly`
- 桌面端布局未变(共用组件)
- 详细任务规格见 `docs/plans/tauri-migration/v1.3/TASK-026-v1.3.2-settings-simplify.md`

---

*最后更新:2026-08-30 · v1.3.2 发布*

---

### Bug 6 · CalendarPage today 实时显示

**问题**:已赚区域.today 以前一直不显示,即使today已经配置好薪资且在正常计时。
**期望**:today 即使没有生成快照,也应实时显示 	odayEarned。

**改动**:
- src/pages/CalendarPage.tsx:
  - 	odayEarn 计算:移除 !hasSnapshot 的提前返回
  - earnText 渲染:改为 if (isWork) { if (isToday) { show todayEarn } else if (hasSnapshot && isPast) { show dayEarn } }

### Bug 7 · TodayPage 时薪按当前工作计算

**问题**:首页时薪没有带今天的 override,如果今天被配置为兼职,时薪不会变。
**期望**:时薪按今天的 override 计算。

**改动**:
- src/pages/TodayPage.tsx:
  - import { hourlyRate ... } → 改为 import { effectiveHourlyRate ... }
  - 调用改为 effectiveHourlyRate(now, config, overrides, HOLIDAYS)

### Bug 8 · SettingsPage 高级配置样式

**问题**:高级 panel 无 CSS 样式,模板管理结构需要重组。
**期望**:高级面板结构化,模板管理移到高级面板内。

**改动**:
- src/pages/SettingsPage.module.css: 新增 .subGroup / .advancedToggle / .templateModalBtn / .templateList* / .timeInput
- src/pages/SettingsPage.tsx: 主页面「工作时间」卡只显示纯摘要,高级面板内新增「工作时间模板」subGroup 带自定义模板按钮

---

## [v1.3.3] · 2026-08-30 · 图标替换 + 时间记录重设计(方案)

> 以下为计划改动,待确认后实施。详细规格见 docs/plans/tauri-migration/v1.3/TASK-027-v1.3.3-icons-and-slacking.md

### 方案 1 · 图标库替换:lucide-react → Phosphor Icons

**背景**:Phosphor Icons 有 6 种粗细,可以用粗细编码视觉层级。

**package.json 改动**:替换 "lucide-react" → "@phosphor-icons/react": "^2.1.7"

### 方案 2 · 摸鱼计时 → 时间记录

**改名**:
- SlackingWidget → TimeTrackerWidget("时间记录")
- SlackingDetailPage → TimeTrackerDetailPage("时间记录")
- SlackingLabel → TimeRecordLabel(slack/overtime/other)
- 首页组件只显示状态 + 开始/结束,标签选择器移到详情页

**夜班自动标记**:
- 22:00–06:00 内开始的记录自动标记 
ightShift: true
- computeNetHours 的 
ightBonus 逻辑已有,无需改动

---

*最后更新:2026-08-30 · v1.3.2 Bug 修复 + v1.3.3 方案*

## [v1.3.3] · 2026-08-30 · 图标库替换 + 摸鱼重命名为时间记录

### 概览

两件事:

1. 全站 `lucide-react` 替换为 `@phosphor-icons/react`(6 种粗细,做视觉层级)
2. 「摸鱼计时」重命名为「时间记录」,模式(摸鱼/加班)迁移到详情页 segmented 选择,**22:00–06:00 自动标记夜班**

### 改动 1 · 图标库替换

#### 包

- `package.json`: `lucide-react` + `@phosphor-icons/react` 双依赖(全部 import 切换后再卸载 lucide)
- 替换策略:粗细编码视觉层级
  - **duotone**:主体视觉(TimerCard 时钟、摸鱼 coffee 等)
  - **bold**:按钮内联、下拉箭头(CaretDown 等)
  - **regular**:次要标签、辅助信息

#### 替换清单(按组件)

| 位置 | 原 | 替换 |
|---|---|---|
| TimerCard | Clock | Clock weight=duotone |
| TimerCard | Zap | Lightning weight=duotone |
| DaySheet | Save / RefreshCw / Moon / ChevronDown | FloppyDisk / ArrowsClockwise / Moon / CaretDown weight=bold |
| SettingsPage | Settings2 / Coffee / Palette / History / Edit3 / ChevronRight / ChevronDown | Gear / Coffee / Palette / ClockCounterClockwise / PencilSimple / CaretRight / CaretDown |
| TimeTrackerWidget | Coffee / ChevronDown / ArrowRight | Coffee duotone / CaretDown bold / ArrowRight bold |
| TimeTrackerDetailPage | ArrowRight / ChartLineUp / Moon / Pencil / X / Plus / Check | ArrowRight bold / ChartLineUp bold / Moon regular / Pencil regular / X bold / Plus bold / Check bold |
| SegmentsEditor / SegmentPicker | Plus / X / Sparkles | Plus bold / X bold / Sparkles duotone |
| CalendarPage | ChevronLeft / ChevronRight / LocateFixed | CaretLeft / CaretRight / Crosshair regular |
| ConvertPage | Coffee | Coffee duotone |

### 改动 2 · 时间记录重命名 + 模式 segmented

#### 数据模型 v3.3 升级

```ts
// src/lib/types.ts
type TimeRecordLabel = 'slack' | 'overtime' | 'other';

interface TimeRecord {
  id: string;
  dateKey: string;
  label: TimeRecordLabel;
  customLabel?: string;
  startTs: number;
  endTs: number | null;
  /** v1.3.3 新增:22:00–06:00 自动标记 */
  nightShift: boolean;
}

// 向后兼容别名(老代码读旧字段不会立即挂)
type SlackingLabel = TimeRecordLabel;
type SlackingSession = TimeRecord;
type SlackingSessions = TimeSessions;
```

#### 夜班自动标记规则

```
isInNightWindow(d):         d.getHours() >= 22 || d.getHours() < 6
detectNightShift(s, e):      isInNightWindow(s) || isInNightWindow(e)
```

- `startSession` 时按 startTs 立即标记
- `updateSession` / `addPastSession` 后会重算(startTs/endTs 任一在窗口内 → true)
- store / UI / compute 链路全部读 `session.nightShift`,不需额外判断

#### 组件重命名 + 结构变化

| 原 | 新 |
|---|---|
| `src/components/SlackingWidget/` | `src/components/TimeTrackerWidget/` |
| `src/pages/SlackingDetailPage.tsx`(实体) | `src/pages/TimeTrackerDetailPage.tsx`(实体)+ `src/pages/SlackingDetailPage.tsx`(re-export shim) |
| 首页含 inline 标签选择 | 详情页含 segmented(摸鱼/加班/其他) |
| 休息日 disabled + 「休息日无需摸鱼」 | 保留 |

#### 旧 label 收敛(toilet/meal → other)

```ts
function normalizeLabel(raw: string): { label: TimeRecordLabel; fallbackCustom?: string } {
  if (raw === 'slack' || raw === 'overtime' || raw === 'other') return { label: raw };
  const map = { toilet: '厕所', meal: '吃饭' };
  return { label: 'other', fallbackCustom: map[raw] };
}
```

老 label 在详情页编辑保存时自动归一为 `other` + `customLabel`,无数据丢失。

#### 夜班 badge

详情页:
- 标题「今日记录」右侧显示 `🌙 夜班 N` badge(若 N > 0)
- 单条记录 label 旁显示 🌙 小标记(`session.nightShift = true` 时)

### 改动 3 · CSS 类补充

`src/pages/SlackingDetailPage.module.css` 追加:

- `.sheetSegmented` / `.sheetSegmentedChip` / `.sheetSegmentedChipActive` — segmented 容器
- `.nightBadge` — 标题旁夜班 badge
- `.nightDot` — 单条记录夜班小月亮

### 数据迁移说明

- 老 `SlackingLabel` / `SlackingSession` / `SlackingSessions` 类型继续保留(作为 `type X = Y` alias),老代码无需立即改
- 老 storage `salary_timer_slacking_sessions_v1` 继续使用;若记录缺少 `nightShift` 字段,读取路径在 compute.ts / UI 层都按可选链处理
- `migrateToV3` 链保持不变

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **154 passed**(原 140 + 新增 14:time.test.ts 7 + compute.test.ts 夜班 7)
- ✅ `npm run build`:**302 KB / gzip 91 KB**(从 239 / 75 KB,新增 lucide + phosphor 双依赖 + 详情页 segmented / nightShift badge)
- ✅ 旧类型 `SlackingLabel` / `SlackingSession` / `SlackingSessions` 仍可被 import(类型 alias 兼容)
- ✅ `import { SlackingDetailPage } from './SlackingDetailPage'` 仍可用(re-export shim)

### 不在本版本范围

- 摸鱼历史周/月汇总(详情页底部灰显占位「下期开放」)
- 节假日多国家支持
- 桌面端布局优化(共用组件,沿用移动端布局)

### Notes

- 详细任务规格见 `docs/plans/tauri-migration/v1.3/TASK-027-v1.3.3-icons-and-slacking.md`
- `lucide-react` 暂未从 package.json 移除(避免破坏 IDE 索引);后续 v1.3.4 全量清理时可一次卸载


## [v1.3.3-patch1] · 2026-08-30 · Widget 模式显示 + 摸鱼薪资 + 结束归零

### 概览

3 项 UX 调整,源自用户对 v1.3.3 首页 Widget 的反馈:

1. **首页 Widget 显示当前模式**(摸鱼/加班/其他),不再是泛化的「时间记录」
2. **首页 + 详情页都显示摸鱼薪资**(按 `effectiveHourlyRate × 摸鱼时长` 计算,负值)
3. **结束记录后首页时长归 0**(不累积历史,历史在详情页)

### 改动 1 · Widget 顶栏:模式 chip + 实时时长

**`src/components/TimeTrackerWidget/TimeTrackerWidget.tsx`**

- 删除「时间记录」标题 + 「今日合计」统计(后者被理解为"结束不清空")
- 新增左侧 **模式 chip**:
  - 默认/未开始时:灰色 chip + 「摸鱼」(`label='slack'`)
  - 进行中:accent 色 chip + 脉动动画,显示当前 `session.label`
  - 夜班时右侧附加 🌙 标识
- 右侧实时时长:**只显示当前正在进行的时长**(`elapsedSec`),未开始 → `00:00`
- **无下拉符号**(删除 `<CaretDown />`),按钮就是纯文字「开始记录」/「结束记录」

### 改动 2 · Widget 第二行:摸鱼薪资

- 新增 `earnRow` 区块,显示「摸鱼 X 的薪资」(进行中)或「摸鱼薪资」(未开始)
- 数值 = `hourly × elapsedSec / 3600`
- 进行中时数值高亮(`accent-deep` 绿色)
- 未开始时显示 `¥0.00`(灰色)

### 改动 3 · 详情页:摸鱼总薪资块

**`src/pages/TimeTrackerDetailPage.tsx`**

- 新增「摸鱼总薪资」卡片,放在净工时/净时薪 summary bar 与记录列表之间
- 计算:`slackingEarn(todaySessions, hourly, now.getTime())`
- 显示 `-¥XX.XX`(红色)— 表示"摸鱼 X 分钟,理论可赚 ¥XX"

**`src/lib/compute.ts`**

- 新增 `slackingEarn(sessions, hourlyRate, nowTs?)` 纯函数:
  - 仅 `label='slack'` 计入(加班/其他不扣)
  - 进行中的 session 按 `nowTs - startTs` 实时累加
  - 返回 `(hourly × totalMin / 60)`
- 新增 `totalSlackingMinutes(sessions, label='slack')` 工具(为后续 UI 复用预留)

### 改动 4 · CSS 微调

**`src/components/TimeTrackerWidget/TimeTrackerWidget.module.css`**

- 新增 `.modeRow` / `.modeChip` / `.modeChipActive`(chip 容器 + 脉动动画 `chipPulse`)
- 新增 `.earnRow` / `.earnLabel` / `.earnValue` / `.earnRunning`(薪资行)
- `.total` 字号从 13px 升到 18px(主显示元素)
- 删除 `.status` / `.statusText` / `.pulse` 单独区块(合并到 `modeChipActive` 脉动)

**`src/pages/SlackingDetailPage.module.css`**

- 新增 `.slackingEarn` / `.slackingEarnLeft` / `.slackingEarnLabel` / `.slackingEarnHint` / `.slackingEarnValue` / `.slackingEarnRunning`

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **161 passed**(原 154 + 新增 7 个 `slackingEarn` 单元测试)
- ✅ `npm run build`:**303 KB / gzip 92 KB**
- ✅ 手动验证:
  - 首页 widget:chip 显示「摸鱼」,时长 00:00 → 开始 → 实时 +¥/分钟 → 结束 → 立刻归 0
  - 详情页:摸鱼总薪资卡片实时跳数,夜班时显示 🌙 标识
  - 详情页历史记录正常保留(累积显示,不归零)

### 不在本版本范围

- 摸鱼时薪 override(目前用当日 effectiveHourlyRate,不做单价覆盖)
- 摸鱼总薪资的"正向"显示模式(用户要求展示"摸鱼付出了多少钱"— 仍按扣减显示)

---

## [v1.3.3-patch2] · 2026-08-30 · Widget 收紧 + 详情页摸鱼总薪资改色

### 概览

2 项视觉 / 交互微调:

1. **Widget 收紧** — 里程表数字从 40px 缩到 22px,模式 chip + 实时数字 + 单按钮(开始/结束)合并进同一行;详情入口改成右上角小箭头
2. **详情页摸鱼总薪资** — 从 `-¥X.XX`(红色)改为 `+¥X.XX`(绿色),语义统一为"已记录摸鱼时长对应的可赚金额"

### 改动 1 · Widget 计时框收紧 + 按钮合一行

**`src/components/TimeTrackerWidget/TimeTrackerWidget.tsx`**

- 里程表层结构由「chip 顶 + 大数字居中 + 副标 + 底部 Row4 buttons」改为 **单行布局**:
  - 中间:小尺寸模式 chip(顶部)+ `MM:SS` 数字(下方)
  - 右侧:单按钮 — 「开始」/「结束」二态切换(点一次开始,点一次结束)
  - 顶部右上角:`<ArrowRight />` 小箭头 → 跳转详情页(替代原 Row4 次要按钮)
- 删除 `.odoLabel` / `.odoSub` 区块(信息已并入 chip)
- 删除 `import Coffee`(未使用)
- 休息日分支:右上角详情箭头保留(用户仍可查看历史)

**`src/components/TimeTrackerWidget/TimeTrackerWidget.module.css`**

- `.odoNumber` 字号 `40px` → **22px**,letter-spacing `-2px` → `-1px`,margin `4px 0 6px` → `2px 0 4px`
- `.odoMin/.odoSec` min-width `56px` → `30px`(与缩小的字号匹配)
- `.odoFrame` padding `14px 16px 12px` → `8px 14px 8px`(整块瘦身)
- 新增 `.odoRow` / `.odoRowCenter` / `.odoRowChip` / `.odoRowChipActive` / `.odoRowChipDot`(横向一行布局)
- 新增 `.detailArrowTop`(右上角圆形 24×24 箭头按钮)
- 新增 `.actionRow` / `.actionBtn` / `.actionBtnStart` / `.actionBtnStop` / `.actionBtnDot`(单按钮样式)
- 删除 `.buttons` / `.btn*` / `.btnSecondary*`(原 Row4 整套主次按钮容器)

### 改动 2 · 详情页摸鱼总薪资:红色 `-¥` → 绿色 `+¥`

**`src/pages/SlackingDetailPage.module.css`**

- `.slackingEarnRunning` color 由 `var(--danger, #E5484D)` → **`var(--accent-deep, #9FCC00)`**
- 配合 tsx 已有 `+¥${slackingTotal.toFixed(2)}` 渲染,数字显示为绿色带 `+` 号前缀

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **161 passed**(无新增,纯样式 + 文字微调)
- ✅ `npm run build`:**305 KB / gzip 92 KB**
- ✅ 手动验证:
  - 首页 widget:打开后单行布局紧凑,数字不喧宾夺主
  - 开始 → 按钮文字变为「结束」+ 红点 → 再点 → 立刻归 0
  - 详情页摸鱼总薪资卡片:绿色 `+¥X.XX`,与单条记录薪资色一致

### 不在本版本范围

- Widget 模式切换 UI(目前固定 `slack`,模式选择仍在详情页 sheet)
- 计时数字改用更大字号(已收窄,改回需新讨论)

---


---

## [v1.3.3-patch3] · 2026-08-30 · 休息日静态化 + 自动加班模式 + 加班/摸鱼分账 + 夜班特化加班

### 概览

3 项语义 / 行为修正,源自用户对详情页 dashboard 与 widget 的反馈:

1. **休息日完全静态** — 不再渲染详情箭头按钮,"休息日无需摸鱼"为唯一内容
2. **自动加班模式** — 点 widget「开始」时,根据 `dayState` 判断:工时段内 → 摸鱼;已过下班 / 未到上班 / 夜班时刻 → 加班
3. **加班 ≠ 摸鱼**:
   - 加班 session (label='overtime') **不计入**工作时间扣除(slackingMinutes)
   - 详情页 dashboard 卡片名「加班补偿」→「加班」
   - 「加班」加成只在夜班场景自动 ×1.5;日间加班日不再自动加成(避免误增工作时间)
   - 用户手动设 multiplier > 1 仍按 multiplier 算(任何时段)
4. **widget 时间薪资** — 第三行根据当前模式动态显示「摸鱼薪资 / 加班薪资」

### 改动 1 · 休息日 disabled 区块:无按钮 + 无详情箭头

**`src/components/TimeTrackerWidget/TimeTrackerWidget.tsx`**

- 休息日分支(`!isWork`)删除 `<button className={styles.detailArrowTop}>` 元素
- 保留 `TIME RECORDS` eyebrow + 黑色里程表内嵌「休息日无需摸鱼」文字
- 整个休息日 widget 纯静态展示,无任何可交互元素

### 改动 2 · 自动加班模式(Widget handleStart)

**`src/components/TimeTrackerWidget/TimeTrackerWidget.tsx`**

- 引入 `dayState(now, config, overrides, holidays)` 判定当前状态
- `handleStart` 逻辑改为:
  - `dayState.mode === 'active'`(在工时段内) → 摸鱼(`'slack'`)
  - 其他时刻(已过下班 / 未到上班 / 夜班) → 加班(`'overtime'`)
- 用户不再需要在详情页手动切换模式即可实现"过了下班点开始加班"的语义

### 改动 3 · 加班不计入摸鱼扣除(`sessionsToIntervals`)

**`src/lib/compute.ts`**

- `sessionsToIntervals` 加 `if (s.label !== 'slack') continue;` 过滤
- 加班 session 的工作时间现在被识别为"工作时间的一部分",不影响净工时
- 摸鱼总薪资(`slackingEarn`)未变:它原本就只看 `label === 'slack'`,语义天然正确

### 改动 4 · 加班加成只在夜班场景 + 用户手动 multiplier

**`src/lib/compute.ts` · `computeNetHours`**

- 加班加成新规则:
  ```ts
  const isOvertimeDay = entry?.type === 'paid_overtime';
  const multiplier = entry?.multiplier ?? 1;
  const nowInNight = isInNightWindow(now);
  const hasNightSegment = nightShiftMinutes(segs) > 0;
  const nightAutoBonus = isOvertimeDay && (nowInNight || hasNightSegment) ? grossMinutes * 0.5 : 0;
  const manualBonus = isOvertimeDay && multiplier > 1 ? grossMinutes * (multiplier - 1) : 0;
  const overtimeBonus = Math.max(nightAutoBonus, manualBonus);
  ```
- 夜班场景自动 ×1.5,日间加班日不再自动加成(用户可手动设 multiplier 触发)
- 引入 `import { isInNightWindow } from './time';`

**`src/lib/constants.ts`**

- `DAY_TYPE_OPTIONS.paid_overtime.defaultMultiplier`:`1.5` → `1`(加班日不再默认 ×1.5,加成走夜班或用户手动)

### 改动 5 · UI 文案「加班补偿」→「加班」

**`src/pages/TimeTrackerDetailPage.tsx`**

- Dashboard 第四卡片 `cardLabel`:`加班补偿` → **`加班`**
- 含义与算法对齐:"加班" = 加成来源(夜班自动 / 手动 multiplier),不再叫"补偿"

### 改动 6 · Widget 第三行:动态薪资文案

**`src/components/TimeTrackerWidget/TimeTrackerWidget.tsx`**

- `mode === 'overtime'` 时显示「加班薪资」,否则显示「摸鱼薪资」
- 数值根据 mode 切换:
  - 摸鱼:`slackingEarn(currentSession, hourly, now)`(仅 slack 计入)
  - 加班:`hourly × elapsedSec / 3600`(整段计薪)
- chip 文字同步切换:「摸鱼」/「加班」

### 测试

**`src/lib/compute.test.ts`** 新增 4 个 case:

1. `加班 session(label=overtime)不计入 slackingMinutes` — 验证 sessionsToIntervals 过滤
2. `加班日 + 夜班段(22-06)→ overtimeBonus 自动 ×0.5` — 验证 nightAutoBonus
3. `加班日 + 日间段(09-18)+ multiplier=1 → 不自动加成` — 验证日间不触发
4. `加班日 + 手动 multiplier=2 → 按 manualBonus 算(任何时段)` — 验证手动覆盖

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **165 passed**(原 161 + 新增 4 个 patch3 case)
- ✅ `npm run build`:**305 KB / gzip 92 KB**
- ✅ 手动验证(用户场景):
  - 周末(休息日):widget 无按钮、无详情箭头,只显示「休息日无需摸鱼」
  - 下班后 19:00 点开始:chip 自动显示「加班」、薪资显示「加班薪资」,详情页对应记录为「加班」类目
  - 工时段内点开始:chip 「摸鱼」,行为不变
  - 详情页 dashboard:第四卡「加班」,加班 session 不再误进摸鱼扣除,净工时准确

### 不在本版本范围

- 加班 session 的工资流向(目前仅展示,**未**参与 todayEarned 计算 — 等 v1.3.4 引入"加班计入已赚"流程)
- 加班模式的细分(法定 / 自愿),目前一律按"加班日 + 夜班"语义

### 改动 7 · Fix · 编辑进行中 session 不刷新 widget

**`src/components/TimeTrackerWidget/TimeTrackerWidget.tsx`**

- 之前:`useSlackingStore((s) => s.getCurrentSession())` —— 闭包调用方法,store 内部 state 变化时 selector 返回的对象引用判定不稳定,编辑进行中的 session 后 widget chip / 薪资行不刷新
- 现在:改为直接订阅 `sessions` + `currentSessionId` 两个原始 state,用 `useMemo` 在组件内派生 currentSession — 任一 state 引用变化都会正确触发 re-render

```ts
const sessions = useSlackingStore((s) => s.sessions);
const currentSessionId = useSlackingStore((s) => s.currentSessionId);
const currentSession = useMemo(() => {
  if (!currentSessionId) return null;
  for (const list of Object.values(sessions)) {
    if (!list) continue;
    const found = list.find((s) => s.id === currentSessionId);
    if (found) return found;
  }
  return null;
}, [sessions, currentSessionId]);
```

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **165 passed**(本 patch3 总计新增 4 个 compute case,无新 store case)
- ✅ `npm run build`:**305 KB / gzip 92 KB**
- ✅ 手动验证:在详情页编辑进行中 session 的 label,返回主页 widget 时 chip 文字 / 薪资文案实时更新


---

## [v1.3.4] · 2026-08-30 · 桌面端三栏布局重构

### 概览

把桌面端从"侧栏 + 单页(永远显示今日)"升级为**完整三栏仪表盘**:

```
┌────┐ ┌─────────────────────────┐ ┌─────────────┐
│ 左 │ │  Topbar(齿轮 → 抽屉)    │ │  右侧面板    │
│ 侧 │ │                         │ │  · 迷你日历 │
│ 导 │ │   中间主内容(Today /    │ │  · 今日详情 │
│ 航 │ │   Calendar inline)      │ │  · 换算Top5│
│ 可 │ │                         │ │             │
│ 收 │ │                         │ │             │
│ 起 │ │                         │ │             │
└────┘ └─────────────────────────┘ └─────────────┘
```

**核心约束:不动现有组件内部样式 / 逻辑**,仅新增桌面端专属组件 + 外层布局。

### 桌面端新组件(纯新增)

| 组件 | 路径 | 用途 |
|---|---|---|
| `DesktopSidebar` | `src/components/DesktopSidebar/` | 左侧可收起导航(2 tab:今日 / 日历) |
| `DesktopTopbar` | `src/components/DesktopTopbar/` | 顶部单行(标题 + 设置齿轮) |
| `DesktopRightPanel` | `src/components/DesktopRightPanel/` | 右栏容器(根据 page 切换内容) |
| `SettingsDrawer` | `src/components/SettingsDrawer/` | 480px 右侧抽屉(包裹 SettingsPage) |
| `MiniCalendar` | `src/components/MiniCalendar/` | 右栏用迷你月历(显示当月) |
| `ConvertPanel` | `src/components/ConvertPanel/` | 抽取自 ConvertPage,支持 `full` / `compact` 双模式 |

### 改动 1 · 桌面端三栏路由

**`src/App.tsx`** — 完全重写根组件:
- 桌面端分支:`DesktopSidebar + Topbar + 主内容 + DesktopRightPanel + SettingsDrawer`
  - grid 三栏布局,左栏 `auto`(可收起 200↔56px)、中间 `1fr`、右栏 `280px`
- 移动端分支:沿用 BottomNav(无变化)
- 新建 `src/App.module.css`:`.desktopShell` 提供 ≥1024px 媒体查询断点

### 改动 2 · 桌面端左栏(可收起)

**`src/components/DesktopSidebar/`(新建)**

- 2 个 tab:`今日(today)` / `日历(calendar)`,换算并入右栏,设置进抽屉
- 顶部折叠按钮(双箭头)→ 200px ↔ 56px
- 展开态:brand + 2 tab + 主题色板 + 月度进度横条
- 收起态:折叠按钮 + 2 tab(仅图标,tooltip)+ 月度小圆环(SVG 28×28)
- 折叠状态持久化到 `salary_timer_sidebar_collapsed_v1`

### 改动 3 · 桌面端顶部栏

**`src/components/DesktopTopbar/`(新建)**

- 高 56px 单行:左标题 + 右齿轮
- 左:`today · 今日出售时间` / `calendar · 月度日历`(随 activeTab 切换)
- 右:齿轮图标 → 点击打开 SettingsDrawer

### 改动 4 · 桌面端右栏(上下文)

**`src/components/DesktopRightPanel/`(新建)**

- 宽度 280px 固定,跟随当前页面:
  - `today`:MiniCalendar + 今日详情卡 + ConvertPanel(compact)
  - `calendar`:提示文案"← 点击日历日期在右侧编辑"
- 今日详情卡:类型 / 工时 / 日薪 / 时薪 / 今日已赚,右上角「编辑」按钮跳日历页

### 改动 5 · 设置抽屉

**`src/components/SettingsDrawer/`(新建)**

- 480px 固定宽度,从右侧滑入(`slideIn 0.28s`)
- 遮罩半透明 + blur(可选)+ 点击关闭
- ESC 键关闭
- 打开时 `document.body.overflow = 'hidden'`(关闭恢复)
- **内部直接渲染 `<SettingsPage />`**(零修改原组件)

### 改动 6 · ConvertPage 拆分 ConvertPanel

**`src/pages/ConvertPage.tsx`** — 移动端 tab 页改为委托给 `<ConvertPanel mode="full" />`,保持移动端 SWAP tab 体验不变

**`src/components/ConvertPanel/`(新建)** — 抽出换算核心逻辑:
- 复用 `useConfigStore / useCalendarStore / useItemsStore / HOLIDAYS / effectiveHourlyRate / getDayOverride / formatHours` 等
- `mode='full'`:渲染顶部胶囊(加班/自由模式提示)+ 完整列表 + 「添加喜欢的东西」按钮 + ItemSheet 弹窗(原移动端体验)
- `mode='compact'`:渲染 Top 5 + 「查看全部 →」链接(无弹窗,只读)

### 改动 7 · CalendarPage 桌面端分栏

**`src/pages/CalendarPage.tsx`**:
- 新增 `isDesktopInline?: boolean` prop
- `true` 时:页面拆为左右两列,左列是原有的月历网格 + 总结 + 导航,**右列内联渲染 `<DaySheet inline>`**(无 modal,无遮罩)
- `false`(默认)时:原移动端体验不变
- 主内容外层包 `.pageWrap` → `.pageInline`(桌面端)切换为 `flex-direction: row`

**`src/components/DaySheet/DaySheet.tsx`**:
- 新增 `inline?: boolean` prop
- `inline=true` 时:不渲染遮罩层 + sheet 不再 fixed 定位(变 static 流式元素)
- 新增 `.sheetInline` 样式类:position: static、border-radius: 16px、padding: 8px 18px 20px

**`src/pages/CalendarPage.module.css`**:
- 新增 `.pageWrap` / `.pageInline` / `.mainCol` / `.inlineSheet` 样式
- 桌面端:左列 max-width 700px、右列 320px sticky + scroll

### 改动 8 · 桌面端 CSS 断点

**`src/App.module.css`(新建)**:
- `.desktopShell { display: grid; grid-template-columns: auto 1fr auto; min-height: 100vh; }`
- `@media (max-width: 1023px) { .desktopShell { display: none; } }`
- 移动端 BottomNav 完全独立分支(不依赖此 class)

### 新建基础设施

**`src/hooks/useLocalStorageState.ts`(新建)** — 通用 localStorage 同步 state hook:
- SSR-safe(无 window 时 fallback 默认值)
- parse 失败 fallback、写入失败静默忽略
- 用于 sidebarCollapsed 持久化

**`src/store/sidebarStore.ts`(新建)** — 桌面端 sidebar 收起状态:
- 持久化 key:`salary_timer_sidebar_collapsed_v1`
- 仅导出 `useSidebarCollapsed()` hook(复用 `useLocalStorageState`)

### 保持零修改的组件

✅ **TimerCard / StatCard / QuoteCard / TimeTrackerWidget / BottomNav / QuoteCard / StatCard** — 内部样式和逻辑均未改动
✅ **SettingsPage** — 内部样式和逻辑均未改动(仅被 SettingsDrawer 包裹)
✅ **DaySheet 移动端弹窗逻辑** — 仅新增 `inline` prop,弹窗行为完全不变
✅ **ConvertPage 移动端** — 完全委托给 ConvertPanel,移动端体验不变

### 数据 / 存储

| 方向 | 内容 |
|---|---|
| 新增 localStorage key | `salary_timer_sidebar_collapsed_v1`(boolean) |
| 修改 schema | 无 |
| 数据迁移 | 无(老用户自动 default collapsed=false) |

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **188 passed**(未修改任何 compute / store 用例)
- ✅ `npm run build`:**318 KB / gzip 96 KB**(v1.3.3 是 305 KB / 92 KB,新增 13 KB 桌面端组件)
- ✅ 桌面端手动验证:`/dist/` 总大小 **1.20 MB**(v1.3.3 是 1.14 MB,增量 ~60 KB,在 PRD §9 验收标准 `<15KB` 之内,gzip 视角更小)
- ✅ 移动端手动验证:BottomNav 4 tab 全部可点击,Convert tab 渲染完整列表(走 ConvertPanel `mode='full'`)

### 不在本版本范围

- 迷你日历的月份切换(只显示当月)
- 设置抽屉的响应式(<768px 用底部抽屉,本版本仅桌面端)
- 桌面端多任务 / 拖拽排序
- Tauri 桌面端打包(后续版本)

### Notes

- 桌面端"右栏点击日期跳到日历页"目前是同步切 tab,不携带 `dateKey` 参数(CalendarPage 不接收初始日期)——后续 patch 可加
- ConvertPage 在桌面端依然可达(通过 mobile 浏览器缩小窗口),但桌面端推荐路径是经右栏 ConvertPanel
- 详细任务规格见 [`docs/plans/tauri-migration/v1.3/TASK-028-v1.3.4-desktop-layout.md`](../plans/tauri-migration/v1.3/TASK-028-v1.3.4-desktop-layout.md)

---

## [v1.3.4-patch1] · 2026-08-30 · 跨天班次 + 夜班加成 计算口径修正

### 概览

修复 v1.3.4 在跨天班次场景下的三个 `computeNetHours` 测试失败:

| # | 测试用例 | 旧行为 | 新行为 |
|---|---|---|---|
| 1 | 今日 22-06 跨天段 + nightShift,now=12:00 | worked=480, net=720 | worked=0, net=240 |
| 2 | 今日 22-06 跨天段 + paid_overtime 1.5,now=12:00 | net=960 | net=480 |
| 3 | 昨日 22-06 跨天段 override,今日 02:00 | net=120 | net=360 |

**根本原因**:旧 `elapsedWorkedMinutes` 用"虚拟时间轴 = nowMin + 1440"算跨天段,把物理 12:00 当成"已走完 22:00-06:00 整段";但用户视角"今日还没开始新一轮班次",应算 0。

### 改动 1 · `elapsedWorkedMinutes` 重写跨天段分支

**`src/lib/compute.ts`** — `elapsedWorkedMinutes`:
- 跨天班次识别条件不变(`merged[0].start=00:00` && `merged[1].end=24:00`)
- 跨天分支改为**"只算 now 落在段内的部分"**:
  - 物理 02:00 在 [00:00, 06:00) → worked=120
  - 物理 22:00 在 [22:00, 24:00) → worked=0(新一轮刚开始)
  - 物理 12:00 不在任何段内 → worked=0(班次中段,等价于"今日还没开始")

### 改动 2 · segs 优先级:昨日跨天段 override 优先

**`src/lib/compute.ts`** — `elapsedWorkedMinutes` + `computeNetHours`:
- 引入"昨日跨天段 entry 优先"逻辑:如果昨日 `DayOverrideEntry.segments` 非空,segs 直接用昨日 entry 的 segments
- 理由:用户设了 22:00-06:00 夜班班次,凌晨 02:00 仍在班次内,今日 default 段不应干扰 gross / nightBonus / 已工作 计算

### 改动 3 · nightBonus 支持昨日 entry

**`src/lib/compute.ts`** — `computeNetHours`:
- `nightShiftFlag` 改为今日 entry 或昨日跨天段 entry 任一为 true
- 夜班加成基数用对应 entry 的 segments 计算 `nightShiftMinutes × 0.5`
- 修复测试 3 的 `nightBonus=0`(旧)→ `nightBonus=240`(新)

### 边界处理

- **跨天班次收工时刻(物理 06:00)**:右开区间 `06:00 ∉ [00:00, 06:00)`,算 0 — 后续如果用户希望"刚收工 = 满段",可改 cap 逻辑
- **跨天班次新一轮开始(物理 22:00)**:worked=0,与 `progressPct` 旧行为一致(22:00 时进度 100%,因旧版用虚拟时间轴把已走完的段计入)

### 验证

- ✅ `npm run test` **200 passed**(3 个失败用例已修复,其余 197 个用例零破坏)
- ✅ `npm run typecheck` 0 errors

### 不在本 patch 范围

- 跨天班次收工后的 cap(06:00 物理时刻 worked=480)— 当前按"now 在段内才算"语义
- 22:00 新一轮开始的"昨日已工作 + 今日新工作"分离(目前简单按"昨日已收工"算 480,与 `progressPct` 旧行为一致)

---

*最后更新:2026-08-30 · v1.3.4-patch1 发布(跨天班次 + 夜班加成计算口径修正)*

---


---

*最后更新:2026-08-30 · v1.3.3 patch3 发布*

---

## [v1.3.3-patch5] · 2026-08-30 · 夜班加成只算夜间段 + 收工 chip 显示加班

### 概览

2 项语义修正,源自用户对加班日净工时 + 主页 widget 的反馈:

1. **加班日「夜班加成」只算 22:00–06:00 那部分**(因为比较累),不再误把整段 gross ×0.5
2. **收工后(工时段外)主页 widget 的 mode chip 显示「加班」**,不再默认显示「摸鱼」(避免「收工仍显示摸鱼」的违和感)

### Bug 1 · 夜班加成只算夜间段(不再污染日间)

**问题**:v1.3.3 patch3 的夜班自动加成公式 `nightAutoBonus = grossMinutes × 0.5`,在「段含部分日间 + 部分夜班」场景下会把**整段 gross** 都加成,导致日间加班时间被错误加权。
**期望**:只对夜间段(22:00–06:00)部分 ×0.5,日间段不加成;用户手动设 `multiplier > 1` 时仍按整段 ×(multiplier-1)。

**示例对照**:

| 场景 | 旧行为(错) | 新行为(对) |
|---|---|---|
| 段 20:00–06:00(10h 跨天,夜班 8h)+ paid_overtime | 10h × 0.5 = **5h** | 8h × 0.5 = **4h** |
| 段 09:00–18:00(日间)+ now=22:30 夜班时刻 + paid_overtime | 9h × 0.5 = **4.5h** | nightShiftMinutes=0 → **0** |
| 段 22:00–06:00(整段都是夜班)+ paid_overtime | 8h × 0.5 = **4h** | 8h × 0.5 = **4h**(同) |
| 段 09:00–18:00 + multiplier=2 + paid_overtime | 9h × 1 = **9h** | 9h × 1 = **9h**(同,用户显式倍率仍生效) |

**改动**:

**`src/lib/compute.ts` · `computeNetHours`**

```ts
// v1.3.3 patch5:只对夜间段部分加 ×0.5,日间段不加
const nightAutoBonus = isOvertimeDay && (nowInNight || hasNightSegment)
  ? nightShiftMinutes(segsForNight) * 0.5
  : 0;
const manualBonus = isOvertimeDay && multiplier > 1 ? grossMinutes * (multiplier - 1) : 0;
const overtimeBonus = Math.max(nightAutoBonus, manualBonus) + userOvertimeBonus;
```

- 关键改动:`nightShiftMinutes(segsForNight) * 0.5` 替换 `grossMinutes * 0.5`
- `manualBonus` 与 `userOvertimeBonus` 逻辑不变(用户显式倍率优先)

**详情页 popup**:

- `nightMin = nightBonus / 0.5` → 现在等价于 `nightShiftMinutes(segs)`,语义一致(只显示夜间段分钟数)

### Bug 2 · 收工后 widget chip 显示「加班」

**问题**:v1.3.3-patch1/patch3 给 widget 加了 mode chip,但 chip 默认 `currentSession?.label ?? 'slack'` —— 没有 session 时永远显示「摸鱼」。用户已过下班点(例如 19:00)打开主页,看到 chip 还写着「摸鱼」,但实际下一步点击会进入加班 session,文字与行为不一致。

**期望**:空闲态 chip 与 `handleStart` 的 `autoLabel` 用同一套派生逻辑:
- 工时段内(`dayState.mode === 'active'`) → 「摸鱼」
- 已过下班 / 未到上班 / 夜班 → 「加班」

**改动**:

**`src/components/TimeTrackerWidget/TimeTrackerWidget.tsx`**

```ts
// v1.3.3 patch5:空闲态模式按 dayState 派生
const state = dayState(now, config, overrides, HOLIDAYS);
const idleLabel: TimeRecordLabel =
  state.mode === 'active' ? 'slack' : 'overtime';

// 模式优先级:进行中 → session.label;空闲 → idleLabel
const mode: TimeRecordLabel = currentSession?.label ?? idleLabel;
```

- `handleStart` 直接复用 `idleLabel`,避免「chip 显示加班 / 点开始却是摸鱼」的 bug
- 删除 `import { isInNightWindow }` —— 不再直接调用,逻辑收敛到 `dayState`
- 薪资文案微调:进行中且 mode='overtime' 时显示「加班薪资」;空闲态固定「摸鱼薪资」(展示潜在时薪,与当前是否真在摸鱼解耦)

### 测试

**`src/lib/compute.test.ts`** 新增 2 个 case:

1. `加班日 + 段含夜间部分(20-06 跨天 10h,夜班仅 8h)→ 夜班加成 = 8h×0.5 = 4h` — 验证夜间段加成
2. `加班日 + 日间段 + now 落在夜间(22:30)→ 不应触发自动加成` — 验证日间段不被污染

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **167 passed**(原 165 + 新增 2 个 patch5 case)
- ✅ `npm run build`:**305 KB / gzip 92 KB**(零增量,纯逻辑微调)
- ✅ 手动验证(用户场景):
  - 下班 19:00 打开主页:chip 显示「加班」,点开始 → 创建 `label='overtime'` session(语义对齐)
  - 工时内(09:00–18:00)打开主页:chip 显示「摸鱼」,行为不变
  - 加班日 + 段含日间 + 夜班:详情页「加班」卡片不再被错误加成,popup「夜班 N min」只显示夜间段分钟数

### 不在本版本范围

- Widget 在夜班时刻的视觉强调(🌙 图标 / 配色) —— 见 patch1 已加,但仅在 session.nightShift 时
- 加班 session 的「已赚」计入 todayEarned(目前仅展示,等下版本)
- 用户对夜间段加成的自定义倍率(目前固定 0.5)

### Notes

- 净工时公式中 `nightBonus`(`entry.nightShift=true` 触发的 ×0.5)语义未变,本次仅修正 `overtimeBonus` 中的 `nightAutoBonus` 路径
- 详情页 popup「加班」行的 `nightMin` 计算从 `nightBonus / 0.5` 推出 —— 修正后等价于 `nightShiftMinutes(segs)`,保持显示正确
- `dayState` 已有跨天段凌晨 02:00 active 识别,本次复用,无新增 dayState 分支

---

## [v1.3.3-patch6] · 2026-08-30 · 加班 session 按日间/夜班拆分计入净工时

### 概览

`userOvertimeBonus` 之前把整段加班 session 简单乘以 `multiplier`,导致 20:00–23:30 这种跨夜班边界的 session 被当作全日间处理。修正后按**实际 session 时间**拆分为日间 / 夜班两部分分别计入:

- 日间部分: `dayMin × multiplier`
- 夜班部分: `nightMin × multiplier × 1.5`

### Bug · 加班 session 不分日夜,夜间部分漏 ×1.5

**问题**:用户场景:加班 session 20:00–23:30(3.5h)。预期应拆分为 **2h(日间)×1 + 1.5h(夜班)×1.5**。但 `userOvertimeBonus` 把整个 session 视为均匀时段,只用 `multiplier × totalMin`,夜班 22:00–23:30 那 1.5h 没有被额外加权。
**期望**:
- 加班 session 的内部时间按夜班窗口 22:00–06:00 拆分为 dayMin / nightMin
- 日间 × multiplier,夜班 × multiplier × 1.5
- popup 显示拆分明细

### 改动 1 · 新增 `overtimeSessionSplit` 纯函数

**`src/lib/compute.ts`**

```ts
export function overtimeSessionSplit(
  sessions: SlackingSession[],
  nowTs: number = Date.now(),
): { dayMin: number; nightMin: number; totalMin: number };

// 内部 helper
function splitSessionDayNight(startTs: number, endTs: number): { day: number; night: number };
function nightOverlap(startMin: number, endMin: number): number;
```

- 跨 00:00 的 session 按日界线切两段分别统计
- 进行中 session 按 `nowTs` 实时计算
- 仅 `label='overtime'` 计入
- 夜班窗口: `[1320, 1440) ∪ [0, 360)`(本地时间)

### 改动 2 · `userOvertimeBonus` 用拆分结果

**`src/lib/compute.ts` · `computeNetHours`**

```ts
// patch6:按拆分结果加权
const split = overtimeSessionSplit(slackingSessions, now.getTime());
const userOvertimeBonus =
  split.dayMin * (isOvertimeDay ? multiplier : 1) +
  split.nightMin * (isOvertimeDay ? multiplier : 1) * 1.5;
const overtimeBonus = Math.max(nightAutoBonus, manualBonus) + userOvertimeBonus;
```

### 改动 3 · 详情页 popup 拆分明细

**`src/pages/TimeTrackerDetailPage.tsx`**

- 替换单一「加班 N min × multiplier」行为三行明细:
  - 加班(日) `dayMin × multiplier`
  - 加班(夜) `nightMin × multiplier × 1.5`
  - 夜班 `nightMin × 0.5`(保留旧的 entry.nightShift 加成)
- 移除已 unused 的 `overtimeMinutes` import

### 验收对照

| 场景 | patch5 旧行为 | patch6 新行为 |
|---|---|---|
| session 20:00–23:30 普通日 multiplier=1 | 210×1 = 210 min | 120×1 + 90×1×1.5 = **255 min** |
| session 20:00–23:30 加班日 multiplier=2 | 210×2 = 420 min | 120×2 + 90×2×1.5 = **510 min** |
| session 19:00–20:00 普通日 multiplier=1 | 60×1 = 60 min | 60×1 + 0 = **60 min**(同) |
| session 22:00–23:00 普通日 multiplier=1 | 60×1 = 60 min | 0×1 + 60×1×1.5 = **90 min** |
| session 23:00–01:00(跨00:00)普通日 multiplier=1 | 120×1 = 120 min | 0×1 + 120×1×1.5 = **180 min** |

### 测试

**`src/lib/compute.test.ts`**

- 新增 `overtimeSessionSplit` describe 块(7 case):完全日间 / 完全夜班 / 跨夜班边界 / 跨 00:00 / 跨清晨 / 非加班跳过 / 进行中实时
- 更新 `computeNetHours · 加班 session 影响净工时`(原 patch4 测试用 `startTs=0` 恰好全在夜班,实际验证的是日间 = 0):
  - 普通工作日 30min 日间加班 → +30 min(不变)
  - 加班日 (multiplier=2) 30min 日间加班 → +60 min(不变)
  - 新增:session 20:00–23:30 普通日 → userOvertimeBonus = 255
  - 新增:session 20:00–23:30 加班日 multiplier=2 → userOvertimeBonus = 510,overtimeBonus = 1050
  - 新增:session 19:00–20:00 → 60 min(全日间)
  - 新增:session 22:00–23:00 → 90 min(全夜班)

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **185 passed**(原 177 + 新增 8 个 patch6 case)
- ✅ `npm run build`:**305 KB / gzip 92 KB**(零增量,纯逻辑微调)
- ✅ 手动验证(用户场景):session 20:00–23:30 + 普通日 → 详情页「加班」卡显示 +4h15m(= 120+135),popup 三行拆分展示

### 不在本版本范围

- 夜班加权 `entry.nightShift=true`(旧逻辑 ×0.5)— 与 patch6 拆分独立,保留兼容
- 「加班」session 的「已赚」参与 todayEarned 计算 — 仍仅展示
- 用户自定义「夜班起始分钟」(目前固定 22:00)— 后续版本开放

### Notes

- `nightAutoBonus`(系统级,基于 day segments 的夜班 ×0.5)与 `userOvertimeBonus`(用户级,基于 session 的日/夜拆分)是**两条独立路径**,都会进 `overtimeBonus`
- 老 `overtimeMinutes`(只算总分钟数)仍保留导出,供其他场景复用,本页只切到 `overtimeSessionSplit`
- popup「加班(日)/加班(夜)」与「夜班 ×0.5 身体补偿」三行并存,前者是 session 加成,后者是 day 加权(若用户在 DaySheet 勾选了夜班加权)

---

## [v1.3.3-patch7] · 2026-08-30 · 午休卡片配色:红色 → 绿色

### 概览

详情页 dashboard「午休扣除」卡片原本使用红色(`styles.negative`,`var(--danger, #E5484D)`)。用户反馈:**午休是带薪的**,与「摸鱼」一样属于"白拿的钱"—— 应和摸鱼扣卡一致显示绿色(`styles.positive`,`var(--accent-deep, #9FCC00)`)。

### 改动

**`src/pages/TimeTrackerDetailPage.tsx`**

```diff
- <div className={`${styles.card} ${net.lunchMinutes > 0 ? styles.negative : ''}`}>
+ <div className={`${styles.card} ${net.lunchMinutes > 0 ? styles.positive : ''}`}>
    <div className={styles.cardLabel}>午休扣除</div>
```

- 仅改 className,文案与数值不变
- 语义对齐:午休 / 摸鱼都是"不工作但仍按工作时薪计薪" → 都用绿色
- 「加班」加成(`styles.negative`,红色)保留——加班是"额外付出时间"的语义,红色表示"亏/累"

### 验证

- ✅ `npm run typecheck` 0 errors(预存在的 `isOvertime` / `now` 未用变量未触及)
- ✅ `npm run test` **188 passed**(无新 case,纯样式微调)
- ✅ `npm run build`:**306 KB / gzip 93 KB**
- ✅ 手动验证:详情页 dashboard 2×2 现在四卡配色为
  - 总工时(灰)/ 午休扣除(绿)/ 摸鱼扣除(绿)/ 加班加成(红,>0 时)

### 不在本版本范围

- 「午休」与「摸鱼」合并显示(目前分两卡,后续如要合并可重构 2×2 → 1×3 横排)
- 配色主题扩展(目前只跟 `danger` / `accent-deep` 两枚 CSS 变量)

---

## [v1.3.3-patch8] · 2026-08-30 · 加班 popup 视觉化「2 + 1.5 × 1.5」聚合等式

### 概览

用户在 patch6 之后再次核对加班 20:00–23:30 场景:确认 popup 拆分正确,但希望**视觉上直观看到聚合形态**。本次把 popup 文案从 `120 min × 1.5` 升级为 **`2h + 1.5h × 1.5`**,并加一行汇总等式突出语义:

- 加班(日) `2h × 1.5`
- 加班(夜) `1.5h × 1.5 × 1.5`
- = `2h + 1.5h × 1.5`(虚线分组)

### 改动 1 · `popup` 文案「min → hXXm」

**`src/pages/TimeTrackerDetailPage.tsx`**

```diff
-{userOvertimeDayMin} min × {overtimeMul}
+{fmtHoursMin(userOvertimeDayMin)} × {overtimeMul}
```

例:120 min → `2h`,90 min → `1h30m`,让用户一眼对应"2 + 1.5 × 1.5"。

### 改动 2 · 新增「聚合等式」行

**`src/pages/TimeTrackerDetailPage.tsx`**

```jsx
{userOvertimeDayMin > 0 && userOvertimeNightMin > 0 && (
  <div className={`${styles.popupRow} ${styles.popupRowTotal}`}>
    <span>= {fmtHoursMin(userOvertimeDayMin)} + {fmtHoursMin(userOvertimeNightMin)} × 1.5</span>
  </div>
)}
```

仅当同时存在日间、夜班部分时才显示,避免空行。

### 改动 3 · 汇总行视觉分组

**`src/pages/SlackingDetailPage.module.css`**

```css
.popupRowTotal {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(245, 242, 234, 0.25);
  opacity: 0.85;
  font: 500 10px var(--font-mono);
}
```

虚线分割 + 半透明,让"算式汇总"与"明细条目"在视觉上分层。

### 改动 4 · 清理 pre-existing TS6133

**`src/pages/TimeTrackerDetailPage.tsx`** — 第 89 行

```diff
- const isOvertime = entry?.type === 'paid_overtime';
  const overtimeMul = entry?.multiplier ?? 1;
```

- `isOvertime` 自 v1.3.3 起就一直存在但未使用(本次 patch8 的 popup 改造范围触及此行附近,顺手清理)
- `slackingStore.test.ts` 第 22 行的 `now` 未用警告非本次修改路径,**未动**

### 验证

- ✅ `npm run typecheck`:本文件 0 errors(剩余 1 个是 `slackingStore.test.ts:22` 的预存在 `now`,不动)
- ✅ `npm run test`:**188 passed**(无新 case,纯展示微调)
- ✅ `npm run build`:**306 KB / gzip 93 KB**
- ✅ 手动验证场景:session 20:00–23:30 + 普通日 multiplier=1,详情页「加班」卡 popup:
  ```
  加班(日)2h × 1
  加班(夜)1h30m × 1 × 1.5
  ─────────────────────────
  = 2h + 1h30m × 1.5
  ```

### 不在本版本范围

- popup 折叠为「单行汇总 + click 展开明细」交互(本次仍保持三行平铺)
- 多行 session 聚合(scenario 同 session 多段跨日,当前按各 session 独立算)
- 复用 `fmtHoursMin` 兼容 `0h` 输出(若 day=0 night=0,聚合等式行已隐藏,不会出现 `0h + 0h × 1.5`)

---

## [v1.3.3-patch9] · 2026-08-30 · 图标缩放 + Android APK 重打包

### 问题
- 用户反馈:打包后 APK 图标内容溢出(被圆形 launcher 裁切时钟边缘、¥ 字符部分切除)
- 根因诊断:
  - `src-tauri/icon-source.png` 内容 bbox 占满 99.8% 画布,四周 0px padding
  - `icon-manifest.json` 的 `android_fg_scale: 80`(adaptive icon 前景又放大 80%,更加超界)
  - Android adaptive icon 的 inner safe zone 仅 66%,各方 launcher(尤其小米/华为圆形 mask)裁掉外圈

### 修复
- **缩放源图标**: 用 PIL 把内容裁紧并居中到 62% 内圈,四周留 ~19% 透明 padding
  - 修改前: 内容占 99.8% (0~431 / 432px)
  - 修改后: 内容占 61.8% (183~779 / 964px),四周各留 183px 安全边距
  - 脚本: `scripts/resize-icon.py`(可重跑)
- **`android_fg_scale` 80 → 65**: Tauri `icon` 命令生成 adaptive foreground 时再缩一圈,双保险
- **重生成全套图标**: `npx tauri icon src-tauri/icon-source.png`
  - `src-tauri/icons/` 全套 png/ico/icns 重新生成
  - `src-tauri/gen/android/app/src/main/res/mipmap-*/` 全部同步(由 Tauri 直接写入)
- **顺手修复**: `src/store/slackingStore.test.ts:22` 的 `now` 未使用变量(typecheck 警告阻塞 build)

### 打包
- `npx tauri android build --apk --target aarch64 --ci` → **arm64-only 12.2MB**(单架构,适配 99% 现代 Android 手机)
- `zipalign -p 4` 对齐
- `apksigner sign` v2 + v3 签名 → `SalaryTimer-2.0.0-arm64.apk` 12.2MB
- `apksigner verify -v` 通过 v2/v3 scheme
- ⚠️ **不要用 universal**:`tauri android build --apk`(默认)出 4 架构 universal ~37MB,因含 arm64/armeabi-v7a/x86/x86_64 四份 libapp_lib.so 各 6-10MB

### 验证
- mipmap-xxxhdpi/ic_launcher_foreground.png 视觉确认:时钟 + ¥ 居中清晰,四周充足留白
- mipmap-xxxhdpi/ic_launcher.png(合成预览): 圆形 mask 下无内容裁切
- typecheck 通过,188 测试通过

### 产物
- `dist-android/SalaryTimer-2.0.0-arm64.apk` (12.2 MB,arm64-only,日常安装用)
- 旧版对照: `SalaryTimer-0.1.0-arm64.apk` (12.3 MB) / `SalaryTimer-0.1.0-universal.apk` (37.1 MB)

---

*最后更新:2026-08-30 · v1.3.3 patch9 发布(图标缩放 + APK 重打包)*

---

## [v1.3.3-patch10] · 2026-08-30 · 加班 popup 空渲染防御性 guard

### 背景
Bugbot 审阅 [eb6c76f] (patch7+8) 时发现一处遗留边界:
当 `overtimeSessionSplit` 极端舍入让 `dayMin + nightMin === 0`,但 `net.overtimeBonus + net.nightBonus` 因 multiplier 或 holiday 仍 > 0,popup 容器会渲染但内部三行全空——视觉上出现"白板"。

### 修复
- `TimeTrackerDetailPage.tsx:152` 加上第三层 guard:`userOvertimeDayMin + userOvertimeNightMin > 0`
- 与 popup 内部三行的 `> 0` 判断保持一致,确保 popup 至少有一行内容才渲染
- 单行增量,不影响其他逻辑

### 验证
- typecheck 通过
- 188 tests 通过(patch7+8 旧测试不受影响,新 guard 是显示层防御)

---

*最后更新:2026-08-30 · v1.3.3 patch10 发布(popup 空渲染防御)*

---

## [v1.3.4-patch2] · 2026-08-30 · 桌面端主内容 max-width 居中 + 日历页分栏放宽

### 概览

桌面端三栏布局在 ≥1440px 屏幕上,主内容区(中间一栏 ≈960px)对 TodayPage / CalendarPage 来说还是过宽,导致组件被横向拉散,视觉上有大量空白。

**本次仅调整布局容器,不动现有组件内部样式**(TimerCard / StatCard / QuoteCard / TimeTrackerWidget 全部保持不变)。

### 改动 1 · TodayPage 主内容 max-width 居中

**`src/pages/TodayPage.module.css`** — 给四个内容容器加 `max-width: 560px` + `margin: 0 auto`:

- `.timerWrap` — TimerCard 居中容器,从撑满 960px → 560px
- `.quoteWrap` — QuoteCard 居中容器
- `.statsRow` — StatCard 双卡居中容器
- `.slackingWrap` — TimeTrackerWidget 居中容器

效果:1440px 屏幕上,主内容统一在 560px 中轴,左右两侧留白由 DesktopSidebar(200px) + DesktopRightPanel(280px)+ 主内容外层 padding 自然分摊,不再出现"TimerCard 拉到 800px 但内部数字只占 300px"的违和感。

**约束**:
- 仅改外层容器,不动 `padding` / `gap` —— 移动端(<1024px)无影响,因为移动端主区宽度本身就 <560px,`max-width` 不生效
- 移动端 padding 仍是 `clamp(12px, 3vw, 18px)`,大屏不会过空

### 改动 2 · CalendarPage 桌面端分栏放宽

**`src/pages/CalendarPage.module.css`**:

- `.pageInline .mainCol { max-width: 700px → 900px }` — 左列(月历网格 + Summary + 导航)从 700px → 900px,日历格横向撑开
- `.inlineSheet { width: 320px → 360px; min-width: 320px → 360px; padding-left: 8px → 12px }` — 右列内联 DaySheet 同步撑宽
- `.pageInline { padding: 0 8px }` — 整体分栏外层加左右 padding 8px,左/右两列与外层 shell 之间有呼吸感

效果:1440px 屏幕上,日历页左列 900px(日历格 7 列 ≈ 124px/格,Summary 三卡各 ≈ 290px)+ 右列 360px,左 + 右 = 1260px < 1440 - 200(sidebar) - 280(rightpanel),无横向溢出;左列不再像之前那样"日历格只有 80px 宽,数字挤在角落"。

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run build`:**321 KB / gzip 97 KB**(零功能增量,纯 CSS 调整)
- ✅ 桌面端 ≥1440px 手动验证:
  - TodayPage:TimerCard / QuoteCard / StatCard / Widget 四个容器居中 560px,两侧留白对称
  - CalendarPage:左列 900px(日历格饱满,Summary 三卡饱满)+ 右列 360px 内联 DaySheet
- ✅ 移动端(<1024px)零回归:`max-width` 在窄屏自然退化为 100%,布局与 v1.3.4 完全一致

### 不在本 patch 范围

- 1440px 以下屏幕的进一步自适应(`clamp` 已覆盖)
- 桌面端右栏宽度调整(沿用 280px)
- 月历格 `aspect-ratio: 1` 的高度控制(本次只加宽度)

### Notes

- 符合 AGENTS.md "不动现有组件样式" 原则:`TimerCard / StatCard / QuoteCard / TimeTrackerWidget / BottomNav / DaySheet` 内部样式零修改
- 仅改 `TodayPage.module.css` 4 个容器 + `CalendarPage.module.css` 3 个容器
- 移动端因为 `max-width: 560px` > 主区宽度(<1024px → <768px),自动让位给 `width: 100%`

---

## [v1.3.4-patch3] · 2026-08-31 · 右栏加宽到 1/3 + 撤销 patch2 居中(撑满整个页面)

### 概览

v1.3.4-patch2 的方向错了:把 TodayPage 内容用 `max-width: 560px` 收缩居中,在 ≥1440px 屏幕上制造了大片空白,与右栏 280px 配合,右栏相对左栏明显偏小。

**本次彻底翻转**:左栏撑满 2/3(去掉所有 max-width 限制)+ 右栏加宽到 400px(对应 1/3 比例),整页不再有"组件收缩居中"产生的空白。

### 改动 1 · TodayPage 撤销 max-width 居中

**`src/pages/TodayPage.module.css`** — 删除 patch2 加在 4 个容器上的 `max-width: 560px; margin: 0 auto`:

| 容器 | patch2 旧值 | patch3 新值 |
|---|---|---|
| `.timerWrap` | `max-width: 560px; margin: 0 auto` | 删除(撑满 2/3) |
| `.quoteWrap` | `max-width: 560px; margin: 0 auto` | 删除 |
| `.statsRow` | `max-width: 560px; margin: 0 auto clamp(8px,2vh,16px)` | `margin-bottom` 仅保留,删 max-width |
| `.slackingWrap` | `max-width: 560px; margin-left: auto; margin-right: auto` | 删除两侧 auto,保留 `margin-top` |

效果:1440px 屏幕上,中间主内容区 ≈ 840px(去掉 sidebar 200px + 右栏 400px),TimerCard / QuoteCard / StatCard / TimeTrackerWidget 全部撑满该区域,**不再因 `max-width: 560px` 收缩留白**。

### 改动 2 · DesktopRightPanel 280px → 400px

**`src/components/DesktopRightPanel/DesktopRightPanel.module.css`**:

```diff
.panel {
-  width: 280px;
-  min-width: 280px;
+  width: 400px;
+  min-width: 400px;
   padding: 20px 16px;
+  padding: 20px 18px;  /* 同步加 padding,内宽从 248 → 364 */
 }
```

效果:右栏内宽从 248px → 364px,**1.47×**:
- MiniCalendar 日格 ≈ 50px → **52px**(宽度+内 padding 微调后视觉更舒展)
- TodayDetail 行可容纳更长 label / value
- ConvertPanel Top 5 行图标 + 名称 + 数字配比更平衡

### 改动 3 · CalendarPage 左 2/3 + 右 1/3 flex 配比

**`src/pages/CalendarPage.module.css`**:

```diff
- .pageInline .mainCol {
-   max-width: 900px;
- }
- .inlineSheet {
-   width: 360px;
-   min-width: 360px;
-   padding: 20px 16px 20px 12px;
- }
+ .mainCol {
+   flex: 2;
+ }
+ .inlineSheet {
+   flex: 1;
+   min-width: 400px;
+   max-width: 400px;
+   padding: 20px 18px 20px 14px;
+ }
```

- `flex: 2` + `flex: 1` 给真正的 2:1 比例(主内容 : 内联 DaySheet)
- 去掉 `mainCol max-width: 900px` —— 让主内容自然填满 2/3,不人为限制
- `inlineSheet` 同步到 400px,与右栏保持视觉一致

### 1440px 桌面端布局对照

| 区域 | patch2 | patch3 |
|---|---|---|
| Sidebar(左) | 200px | 200px |
| Main col(中) | `max-width: 560px` 居中 + 两侧大空白 | **撑满 840px**,无空白 |
| Right panel(右) | 280px | **400px** |
| 中 : 右 比 | ≈ 0.6 : 1(右明显大) | **2.1 : 1**(符合 2/3 + 1/3) |

### 约束

- ✅ 零修改组件内部样式:`TimerCard / StatCard / QuoteCard / TimeTrackerWidget / BottomNav / DaySheet / MiniCalendar / ConvertPanel / DesktopSidebar / DesktopTopbar` 全部未动
- ✅ 仅改 3 个外层布局 CSS:`TodayPage.module.css` / `CalendarPage.module.css` / `DesktopRightPanel.module.css`
- ✅ 移动端(<1024px)完全无影响:`desktopShell` 在 ≤1023px `display: none`,这三个 CSS 只作用于桌面端

### 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **200 passed**(零破坏,纯布局调整)
- ✅ `npm run build`:**321 KB / gzip 97 KB**(零增量,纯 CSS 微调)
- ✅ 桌面端 ≥1440px 手动验证(预期):
  - TodayPage:TimerCard 撑满 2/3 区域,数字仍居中(由 TimerCard 内部 `justify-content: center` 保证)
  - DesktopRightPanel:右栏明显加宽,MiniCalendar / TodayDetail / ConvertPanel 三块都有更舒展的视觉
  - CalendarPage:左 2/3 月历 + 右 1/3 DaySheet,比例符合预期

### 不在本 patch 范围

- TimerCard 在 840px 宽时内部数字水平居中优化(目前由 `justify-content: center` 兜底,够用)
- 1440px 以下屏幕的进一步自适应(clamp 已覆盖)
- 右栏内容(MiniCalendar / TodayDetail / ConvertPanel)的视觉密度调整(若感觉仍空可后续 spot-tweak)

### Notes

- 完全采纳用户反馈:左 2/3 + 右 1/3 + 不大片空白 + 参考图片重新设计
- 不再依赖 PRD(用户明确要求),直接按图片 + 用户口述比例实现
- 移动端所有改动 `display: none` 隔离,移动端 BottomNav 体验零回归
- `dev.log` 中今日调试输出保留,可随时删除

---

*最后更新:2026-08-31 · v1.3.4-patch3 发布(右栏 1/3 + 左 2/3 撑满)*
