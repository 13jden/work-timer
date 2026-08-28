/**
 * Salary Timer — Core Type Definitions
 * 单一来源真理:所有跨模块类型在此定义。
 */

// ── User Config ─────────────────────────────────────────────
export interface Config {
  /** 月薪总额 */
  monthlySalary: number;
  /** 上班时间 "HH:MM" */
  startTime: string;
  /** 下班时间 "HH:MM" */
  endTime: string;
  /** 咖啡默认单价(¥) */
  coffeePrice: number;
  /** 休息模式:0=无休,1=单休,2=双休 */
  restMode: 0 | 1 | 2;
  /** 主题 ID */
  theme: 'paper' | 'obsidian' | 'gold';
  /**
   * 用户首次打开 App 的日期(ISO "YYYY-MM-DD"),用于"用户记录区间"。
   * 空字符串表示未初始化,store 初始化时写入今天。
   */
  recordedFromDate: string;
}

// ── Day Overrides(手动调休 / 加班 / 请假) ───────────────────
/**
 * 工作日类型
 * - work: 正常工作日,默认倍率 1
 * - paid_overtime: 有偿加班,默认倍率 1.5,可手动改
 * - leave: 请假,倍率 0(不计入日均,但从已赚中扣除)
 * - rest: 休息日,倍率 0
 */
export type DayType = 'work' | 'paid_overtime' | 'leave' | 'rest';

/** 不同类型的默认倍率 */
export const DEFAULT_MULTIPLIER: Record<DayType, number> = {
  work: 1,
  paid_overtime: 1.5,
  leave: 0,
  rest: 0,
};

/**
 * 单日 override entry
 */
export interface DayOverrideEntry {
  type: DayType;
  /** 倍率(默认 1 / 1.5 / 0) */
  multiplier: number;
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