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
  /** 多段工时。null = 使用 startTime/endTime 单段 fallback */
  segments: WorkSegment[] | null;
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

// ── Slacking Sessions(摸鱼记录,v1.3 新增) ──────────────────

/**
 * 摸鱼标签
 * - toilet:厕所
 * - slack:摸鱼(开小差)
 * - meal:吃饭
 * - other:其他(customLabel 必填)
 */
export type SlackingLabel = 'toilet' | 'slack' | 'meal' | 'other';

export interface SlackingSession {
  id: string;
  /** 归属日 YYYY-MM-DD(用于聚合到日) */
  dateKey: string;
  /** 摸鱼标签 */
  label: SlackingLabel;
  /** label='other' 时的自定义名称 */
  customLabel?: string;
  /** 开始时间戳(毫秒) */
  startTs: number;
  /** 结束时间戳(毫秒);null = 进行中 */
  endTs: number | null;
}

/** 摸鱼记录表:key=YYYY-MM-DD, value=SlackingSession[] */
export type SlackingSessions = Record<string /* YYYY-MM-DD */, SlackingSession[]>;

// ── Net Hours Breakdown(v1.3 新增) ─────────────────────────

/**
 * 净工时推导明细,供 UI 展示
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
}
