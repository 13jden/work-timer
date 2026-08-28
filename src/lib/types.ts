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
}

// ── Day Overrides(手动调休) ─────────────────────────────────
export type DayOverrideValue = 'work' | 'rest';
export type DayOverrides = Record<string /* YYYY-MM-DD */, DayOverrideValue>;

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

// ── Monthly Record ──────────────────────────────────────────
export interface MonthlyRecord {
  yyyy: number;
  mm: number;
  salary: number;
  workDays: number;
  dailyRate: number;
  hourlyRate: number;
  totalEarned: number;
  locked: boolean;
  generatedAt: string;
}

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