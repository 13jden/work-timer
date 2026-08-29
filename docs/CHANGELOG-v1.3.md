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

---

*最后更新:2026-08-29 · v1.3 发布*