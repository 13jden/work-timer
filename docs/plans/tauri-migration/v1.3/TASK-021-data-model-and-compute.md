# TASK-021 · 数据模型 v3 升级 + compute.ts 重构

> **状态**:⏳ 进行中
> **分支**:`feat/v1.3-enhanced-time-model`
> **依赖**:-
> **估时**:1.5 天

## 目标

升级 types / constants / compute 三层基础,落地 PRD §5 数据模型变更 + §6 计算规则。

## 改动清单

### 1. `src/lib/types.ts` — 类型扩展

#### 新增类型

```ts
/** 一段工时(不区分跨天) */
export interface WorkSegment {
  start: string; // "HH:MM"
  end: string;   // "HH:MM",允许 < start(跨天)
}

/** 薪资模式 */
export type SalaryMode = 'monthly' | 'hourly' | 'daily';
```

#### `Config` 接口扩展(v2 → v3)

新增字段(带默认值保证向后兼容):

```ts
export interface Config {
  // v2 已有字段(全部保留)
  monthlySalary: number;
  startTime: string;
  endTime: string;
  coffeePrice: number;
  restMode: 0 | 1 | 2;
  theme: 'paper' | 'obsidian' | 'gold';
  recordedFromDate: string;

  // v3 新增
  salaryMode: SalaryMode;              // 默认 'monthly'
  manualHourlyRate: number;            // hourly 模式时薪,默认 100
  manualDailyRate: number;             // daily 模式日薪,默认 800
  segments: WorkSegment[] | null;      // null = 使用 startTime/endTime 单段;非 null = 覆盖全局多段
  lunchEnabled: boolean;               // 是否扣除午休,默认 false
  lunchStart: string;                  // "HH:MM",默认 "12:00"
  lunchMinutes: number;                // 默认 60
}
```

#### `DayOverrideEntry` 扩展

```ts
export interface DayOverrideEntry {
  type: DayType;
  multiplier: number;
  // v3 新增(均为可空,不填表示继承全局)
  segments: WorkSegment[] | null; // null = 用全局 segments
  nightShift: boolean;             // 启用夜班加权
}
```

#### 新增摸鱼会话类型

```ts
export type SlackingLabel = 'toilet' | 'slack' | 'meal' | 'other';

export interface SlackingSession {
  id: string;
  dateKey: string;          // YYYY-MM-DD(归属日)
  label: SlackingLabel;
  customLabel?: string;     // label='other' 时
  startTs: number;          // 毫秒时间戳
  endTs: number | null;     // null = 进行中
}

export type SlackingSessions = Record<string /* YYYY-MM-DD */, SlackingSession[]>;
```

### 2. `src/lib/constants.ts` — 新增常量

```ts
// v3 keys
export const STORAGE_KEY_V3    = 'salary_timer_config_v3';
export const OVERRIDES_KEY_V3  = 'salary_timer_day_overrides_v3';
export const SLACKING_KEY      = 'salary_timer_slacking_sessions_v1';

// DEFAULT_CONFIG 扩展
export const DEFAULT_CONFIG: Config = {
  // ...v2 字段
  salaryMode: 'monthly',
  manualHourlyRate: 100,
  manualDailyRate: 800,
  segments: null,
  lunchEnabled: false,
  lunchStart: '12:00',
  lunchMinutes: 60,
};

// Slacking 标签
export const SLACKING_LABELS: Record<SlackingLabel, string> = {
  toilet: '厕所',
  slack: '摸鱼',
  meal: '吃饭',
  other: '其他',
};

// 夜班窗口(固定 22:00–06:00)
export const NIGHT_SHIFT_START_MIN = 22 * 60; // 1320
export const NIGHT_SHIFT_END_MIN   = 6 * 60;  // 360
```

### 3. `src/lib/compute.ts` — 重构核心

#### 保留函数(签名不变)

`isWorkday` / `dailySalary` / `progressPct` / `workdaysInMonth` / `workSeconds` / `hourlyRate` / `perSecond` / `monthEarnedSoFar` / `todayEarned` / `dayState` / `getDayOverride`

**关键策略**:
- `hourlyRate` / `perSecond` / `todayEarned` / `monthEarnedSoFar` 内部使用 `effectiveSegmentsOn(today)` 替换 `startTime/endTime` 单段,保证调用方零改动。
- `workSeconds` 改为基于 segments 计算(单段或多段都支持,跨天段拆分累加)。

#### 新增函数

```ts
/** 获取某日有效的多段工时(全局 segments 优先,否则用 start/end 单段) */
export function getEffectiveSegments(config: Config, dateKey?: string): WorkSegment[]

/** 单段跨天拆分(end<start) */
export function splitSegment(seg: WorkSegment): WorkSegment[]
/** e.g. 22:00-06:00 → [{22:00, 24:00}, {00:00, 06:00}] */

/** 多段总分钟数(跨天段自动拆分后求和,union 去重叠) */
export function totalSegmentsMinutes(segments: WorkSegment[]): number

/** 段落在夜间窗口(22:00-06:00)的分钟数 */
export function nightShiftMinutes(segments: WorkSegment[]): number

/** 段落在午休窗口的分钟数 */
export function lunchOverlapMinutes(segments: WorkSegment[], lunchStart: string, lunchMinutes: number): number

/** 多段 union(去重叠) */
export function unionSegments(segments: WorkSegment[]): WorkSegment[]

/**
 * 净工时计算(分钟)
 * gross - slackUnionLunch + overtimeBonus + nightBonus
 */
export interface NetHoursInput {
  date: Date;
  config: Config;
  overrides: DayOverrides;
  holidays: HolidayMap;
  slackingSessions: SlackingSession[];
}
export interface NetHoursBreakdown {
  grossMinutes: number;
  lunchMinutes: number;
  slackingMinutes: number;
  slackUnionLunch: number;
  overtimeBonus: number;
  nightBonus: number;
  nightShiftFlag: boolean;
  netMinutes: number;
}
export function computeNetHours(input: NetHoursInput): NetHoursBreakdown

/** 净时薪 */
export function netHourlyRate(input: NetHoursInput, todayEarnedValue: number): number

/** 当日 effective 时薪(加班倍率生效) */
export function effectiveHourlyRate(
  date: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number
```

#### 核心公式(PRD §6)

```ts
grossMinutes     = union(segments).total
lunchMinutes     = lunchEnabled ? overlap(union, lunchWindow) : 0
slackingMinutes  = sum(complete sessions minutes)
slackUnionLunch  = minutesUnion(slackingMinutes, lunchMinutes) // 去重叠
overtimeBonus    = overtimeDay ? (grossMinutes * (multiplier - 1)) : 0
nightBonus       = nightShift ? nightShiftMinutes(segments) * 0.5 : 0
netMinutes       = grossMinutes - slackUnionLunch + overtimeBonus + nightBonus
netHourly        = todayEarned / (netMinutes / 60)
```

#### 关键决策

- **现有函数签名不变**,内部用 effectiveSegments 替换 startTime/endTime。
- **`dayUnits`**:hourly/daily 模式下,任意非 rest 日 units = multiplier(沿用 DayOverrideEntry.multiplier)。
- **`isWorkday`**:freelance 类型视为工作日,返回 true。
- **`workdaysInMonth`**:freelance 不计入月工作日(因为 monthly 模式下无意义)。

### 4. `src/lib/compute.test.ts` — 新增用例

至少 30 个新用例覆盖:

| 编号 | 用例 |
|---|---|
| 1 | effectiveHourlyRate · 加班日 × 1.5 |
| 2 | effectiveHourlyRate · 普通工作日 × 1 |
| 3 | effectiveHourlyRate · 休息日 = 0 |
| 4 | effectiveHourlyRate · hourly 模式使用 manualHourlyRate |
| 5 | effectiveHourlyRate · daily 模式 = manualDailyRate / segmentsHours |
| 6 | splitSegment · 22:00–06:00 → [22–24] + [00–06] |
| 7 | splitSegment · 09:00–18:00 → 原样 |
| 8 | totalSegmentsMinutes · 单段 9h |
| 9 | totalSegmentsMinutes · 多段 union 去重叠 |
| 10 | totalSegmentsMinutes · 跨天段 480 min |
| 11 | nightShiftMinutes · 22:00–06:00 = 480 |
| 12 | nightShiftMinutes · 19:30–22:30 = 30 |
| 13 | nightShiftMinutes · 05:00–14:00 = 60 |
| 14 | nightShiftMinutes · 10:00–18:00 = 0 |
| 15 | lunchOverlapMinutes · 9-18 / 12-13 lunchEnabled = 60 |
| 16 | lunchOverlapMinutes · lunchEnabled false = 0 |
| 17 | unionSegments · 单段 |
| 18 | unionSegments · 两段不重叠 |
| 19 | unionSegments · 两段重叠 |
| 20 | unionSegments · 三段混合 |
| 21 | computeNetHours · 无午休无摸鱼 |
| 22 | computeNetHours · 午休 1h 扣除 |
| 23 | computeNetHours · 摸鱼 22m 扣除 |
| 24 | computeNetHours · 摸鱼+午休重叠取 union |
| 25 | computeNetHours · 加班加成 |
| 26 | computeNetHours · 夜班加权 +4h |
| 27 | computeNetHours · 加班+夜班叠加 |
| 28 | netHourlyRate · 验证 PRD §7 #3 |
| 29 | dayState · 跨天段 02:00 显示 active 4:00:00 |
| 30 | getEffectiveSegments · 优先 override |
| 31 | getEffectiveSegments · 全局 null fallback 单段 |
| 32 | isWorkday · freelance 类型 true |

## 验证

- [ ] `npm run typecheck` 0 errors
- [ ] `npm run test` 全部通过(原 93 + 新增 ≥ 32 = ≥ 125)
- [ ] 覆盖率:compute.ts > 90%

## 出口

切换到 TASK-022。
