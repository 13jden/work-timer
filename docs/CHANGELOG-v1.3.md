# Changelog · Salary Timer v1.3

> **v1.3 独立 changelog 文件**。从本版本起,每个大版本单独建 `docs/CHANGELOG-vX.X.md`,不再全部堆到 `docs/CHANGELOG.md`。
>
> 历史变更(阶段 1 → v1.2)见 [`docs/CHANGELOG.md`](./CHANGELOG.md)。

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

*最后更新:2026-08-29 · v1.3 发布*