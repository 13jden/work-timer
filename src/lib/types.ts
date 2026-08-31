/**
 * Salary Timer — Core Type Definitions
 * 单一来源真理:所有跨模块类型在此定义。
 *
 * v1.3 扩展:
 *   - WorkSegment(多段工时)
 *   - DayOverrideEntry 增加 segments / nightShift
 *   - Config 增加 salaryMode / manualHourlyRate / manualDailyRate / segments / lunch*
 *   - SlackingSession / SlackingSessions(摸鱼会话)
 *   - SalaryMode 联合类型
 */

// ── User Config ─────────────────────────────────────────────

/**
 * 薪资模式
 * - monthly:按月结(现有模型,月薪 + 固定上下班)
 * - hourly:按时结(兼职,manualHourlyRate 决定时薪)
 * - daily:按日结(兼职/日薪,manualDailyRate 决定日薪)
 */
export type SalaryMode = 'monthly' | 'hourly' | 'daily';

/** 一段工时(不区分跨天,end < start 时自动识别为跨天) */
export interface WorkSegment {
  /** "HH:MM",例如 "09:00" */
  start: string;
  /** "HH:MM",允许 < start 表示跨天(如 22:00 - 06:00) */
  end: string;
}

/**
 * 多段工时模板(v1.3.1 bug fix 引入)
 *
 * 设计:
 *   - 用户在「设置」页配置 N 个模板(每个模板 = 命名 + 段列表)
 *   - 在「日历」页点击日期 → 选择「自定义」→ 勾选需要的模板 → 合并写入当日 segments
 *   - 解耦"全局默认工时"与"日历页可选模板"
 *
 * 模板示例:
 *   { id: 'tpl-1', label: '早班', segments: [{ start: '06:00', end: '14:00' }] }
 *   { id: 'tpl-2', label: '夜班', segments: [{ start: '22:00', end: '06:00' }] }  // 跨天
 */
export interface SegmentTemplate {
  id: string;
  label: string;          // 用户命名,如 "早班"/"晚班"/"周末加班"
  segments: WorkSegment[];
}

export interface Config {
  /** 月薪总额(monthly 模式使用) */
  monthlySalary: number;
  /** 上班时间 "HH:MM"(单段 fallback) */
  startTime: string;
  /** 下班时间 "HH:MM"(单段 fallback) */
  endTime: string;
  /** 咖啡默认单价(¥) */
  coffeePrice: number;
  /** 休息模式:0=无休,1=单休,2=双休(monthly 模式) */
  restMode: 0 | 1 | 2;
  /** 主题 ID */
  theme: 'paper' | 'obsidian' | 'gold';
  /**
   * 用户首次打开 App 的日期(ISO "YYYY-MM-DD"),用于"用户记录区间"。
   * 空字符串表示未初始化,store 初始化时写入今天。
   */
  recordedFromDate: string;

  // ── v1.3 新增字段(老数据迁移时补默认值) ──
  /** 薪资模式 */
  salaryMode: SalaryMode;
  /** hourly 模式手动时薪 */
  manualHourlyRate: number;
  /** daily 模式手动日薪 */
  manualDailyRate: number;
  /**
   * 多段工时。null = 使用 startTime/endTime 单段 fallback
   * (v1.3.1 后:仅作为兜底;用户配置主要走 segmentTemplates)
   */
  segments: WorkSegment[] | null;
  /**
   * 多段工时模板库(v1.3.1 新增)
   *
   * 日历页"自定义"模式下,从这里勾选需要的模板。
   * 默认含 1 个模板(09:00-18:00),用户可自由增删。
   */
  segmentTemplates: SegmentTemplate[];
  /** 是否扣除午休 */
  lunchEnabled: boolean;
  /** 午休开始时间 "HH:MM" */
  lunchStart: string;
  /** 午休时长(分钟) */
  lunchMinutes: number;
}

// ── Day Overrides(手动调休 / 加班 / 请假) ───────────────────
/**
 * 工作日类型
 * - work: 正常工作日,默认倍率 1
 * - paid_overtime: 有偿加班,默认倍率 1.5,可手动改
 * - leave: 请假,倍率 0(不计入日均,但从已赚中扣除)
 * - rest: 休息日,倍率 0
 * - freelance: 自由/兼职日(hourly/daily 模式专用,monthly 模式无意义)
 */
export type DayType = 'work' | 'paid_overtime' | 'leave' | 'rest' | 'freelance';

/** 不同类型的默认倍率 */
export const DEFAULT_MULTIPLIER: Record<DayType, number> = {
  work: 1,
  paid_overtime: 1.5,
  leave: 0,
  rest: 0,
  freelance: 1,
};

/**
 * 单日 override entry
 */
export interface DayOverrideEntry {
  type: DayType;
  /** 倍率(默认 1 / 1.5 / 0) */
  multiplier: number;
  // ── v1.3 新增(均可选,不填表示继承全局) ──
  /** null = 用全局 config.segments(或 startTime/endTime 单段) */
  segments: WorkSegment[] | null;
  /** 启用夜班加权(22:00–06:00 段 × 0.5 计入净工时) */
  nightShift: boolean;
  // ── v1.3.2 新增(freelance 类型专用,其他类型忽略) ──
  /**
   * freelance 日临时日薪(¥)。type='freelance' 且 freelancer 选了「按日薪」时使用。
   * 优先级:override.freelanceDaily > config.manualDailyRate。
   * 非 freelance 类型:忽略。
   */
  freelanceDaily?: number | null;
  /**
   * freelance 日临时时薪(¥)。type='freelance' 且 freelancer 选了「按时薪」时使用。
   * 计算:feeHourly × segmentsHours × multiplier。
   * 优先级:override.freelanceHourly > config.manualHourlyRate。
   * 非 freelance 类型:忽略。
   */
  freelanceHourly?: number | null;
}

/**
 * DayOverrides: key=YYYY-MM-DD, value=DayOverrideEntry
 * 为保持 v1 兼容,运行时类型是 DayOverrideEntry;兼容老数据时
 * 由 compute/store 入口处转换。
 */
export type DayOverrides = Record<string /* YYYY-MM-DD */, DayOverrideEntry>;

/**
 * 旧版 override 值(只用于兼容过渡)
 * @deprecated
 */
export type DayOverrideValue = 'work' | 'rest';

// ── Holiday Map ─────────────────────────────────────────────
export type HolidayMap = Record<string /* YYYY-MM-DD */, string /* 节日名 */>;

// ── Convert Items ───────────────────────────────────────────
export interface Item {
  id: string;
  name: string;
  price: number;
  icon: string;
  order: number;
}

// ── Monthly Record / Snapshot ───────────────────────────────
/**
 * 月度薪资快照 —— 用户手动点击"生成"时固化。
 * 历史月份用此快照,不受 config 后续变化影响。
 *
 * key 格式 "YYYY-MM"(如 "2026-08")
 */
export interface MonthlySnapshot {
  /** YYYY-MM(如 "2026-08") */
  key: string;
  /** 该月月薪 */
  salary: number;
  /** 该月工作日数(根据生成时 overrides 计算) */
  workDays: number;
  /** 该月日均(根据生成时 overrides 计算) */
  dailyRate: number;
  /** 该月总工作单位(每个工作日 × 倍率累加) */
  totalUnits: number;
  /** 快照生成时间(ISO) */
  generatedAt: string;
}

/**
 * 快照表:key=YYYY-MM, value=MonthlySnapshot
 */
export type MonthlySnapshots = Record<string, MonthlySnapshot>;

// ── Timer Day State ─────────────────────────────────────────
export type DayStateMode = 'rest' | 'done' | 'active';

export interface DayStateActive {
  mode: 'active';
  display: string;       // "HH:MM:SS"
  label: string;         // "距离今天下班"
  status: string;        // "工作计价中"
}

export interface DayStateDone {
  mode: 'done';
  display: string;       // "HH:MM:SS"
  label: string;         // "今日完成"
  status: string;        // "今日收工"
  totalSeconds: number;
}

export interface DayStateRest {
  mode: 'rest';
}

export type DayState = DayStateActive | DayStateDone | DayStateRest;

// ── Time Records(时间记录,v1.3.3 重命名自 SlackingSessions) ────────────

/**
 * 时间记录标签(v1.3.3 重命名自 SlackingLabel)
 * - slack:摸鱼(开小差)
 * - overtime:加班
 * - other:其他(customLabel 必填)
 *
 * 设计变化:v1.3.0-1.3.2 的 toilet/meal 已合并到 other(customLabel 区分)
 *   保留 SlackingLabel 别名兼容旧数据。
 */
export type TimeRecordLabel = 'slack' | 'overtime' | 'other';

/** @deprecated 自 v1.3.3 起改用 TimeRecordLabel(toilet/meal 已合并到 other) */
export type SlackingLabel = TimeRecordLabel;

export interface TimeRecord {
  id: string;
  /** 归属日 YYYY-MM-DD(用于聚合到日) */
  dateKey: string;
  /** 时间记录标签 */
  label: TimeRecordLabel;
  /** label='other' 时的自定义名称 */
  customLabel?: string;
  /** 开始时间戳(毫秒) */
  startTs: number;
  /** 结束时间戳(毫秒);null = 进行中 */
  endTs: number | null;
  /**
   * 夜班自动标记(v1.3.3 新增)
   * true 表示该时段跨入 22:00–06:00 窗口,后续可计入 nightBonus。
   * 规则:startTs 或 endTs 落在 [22:00, 06:00) 窗口即标 true。
   */
  nightShift: boolean;
}

/** @deprecated 自 v1.3.3 起改用 TimeRecord */
export type SlackingSession = TimeRecord;

/** 时间记录表:key=YYYY-MM-DD, value=TimeRecord[] */
export type TimeSessions = Record<string /* YYYY-MM-DD */, TimeRecord[]>;

/** @deprecated 自 v1.3.3 起改用 TimeSessions */
export type SlackingSessions = TimeSessions;

// ── Net Hours Breakdown(v1.3 新增) ─────────────────────────

/**
 * 净工时推导明细,供 UI 展示
 *
 * v1.3.4-patch2 扩展:4 张 dashboard 卡片所需的"已发生"实时累计字段。
 * - `*Minutes` 系列:**全天总数**(UI 仅用于"已收工"场景对照/详情页 footer)
 * - `*Elapsed` 系列:**已发生**(实时累加,dashboard 2×2 主用)
 *
 * 关系:
 *   grossElapsed   = min(elapsedWorkedMin, grossMinutes)         // ≤ grossMinutes
 *   lunchElapsed   = 已发生午休(lunch 时段 ∩ 已工作窗口)
 *   slackingElapsed = 已发生摸鱼(含进行中 session,endTs===null 按 now 算)
 *   overtimeElapsed = 用户 overtime session 累计(含进行中 dayMin + nightMin)
 */
export interface NetHoursBreakdown {
  /** 总工时(分钟,跨天段 union 去重叠) */
  grossMinutes: number;
  /** 午休扣除(分钟) */
  lunchMinutes: number;
  /** 摸鱼扣除(分钟,union 去重叠) */
  slackingMinutes: number;
  /** 摸鱼∪午休(去重叠) */
  slackUnionLunch: number;
  /** 加班加成(分钟):加班日 gross × (multiplier - 1) */
  overtimeBonus: number;
  /** 夜班补偿(分钟):nightShift 时 nightMinutes × 0.5 */
  nightBonus: number;
  /** 当日是否启用夜班加权 */
  nightShiftFlag: boolean;
  /** 净工时(分钟)= gross - slackUnionLunch + overtimeBonus + nightBonus */
  netMinutes: number;

  // ── v1.3.4-patch2 新增:实时累计字段 ──
  /** 已工作分钟数(已含午休时段,封顶 grossMinutes) */
  grossElapsed: number;
  /** 已发生午休分钟数(0..lunchMinutes) */
  lunchElapsed: number;
  /** 已发生摸鱼分钟数(含进行中 session,按 now 实时累加) */
  slackingElapsed: number;
  /** 用户 overtime session 累计分钟数(含进行中 dayMin + nightMin) */
  overtimeElapsed: number;
}
