/**
 * Salary Timer — Monthly Store
 *
 * 管理月度薪资快照:用户手动点击"生成"时创建,
 * 历史月份用快照实时不受 config 影响。
 */
import { create } from 'zustand';
import { SNAPSHOTS_KEY } from '../lib/constants';
import { loadJSON, saveJSON } from '../lib/storage';
import type { MonthlySnapshot, MonthlySnapshots } from '../lib/types';
import { workdaysInMonth, dayUnits, daysInMonthCalc } from '../lib/compute';
import type { Config, DayOverrides, HolidayMap } from '../lib/types';

interface MonthlyStore {
  /** 快照表 key=YYYY-MM */
  snapshots: MonthlySnapshots;

  /**
   * 创建或更新某月快照
   * @param year 年
   * @param month 月(0-11)
   * @param salary 该月月薪(用户输入)
   */
  createSnapshot: (year: number, month: number, salary: number, config: Config, overrides: DayOverrides, holidays: HolidayMap) => void;

  /** 删除某月快照 */
  removeSnapshot: (year: number, month: number) => void;

  /** 读某月快照 */
  getSnapshot: (year: number, month: number) => MonthlySnapshot | null;

  /** 获取入职以来所有月份快照列表(用于弹窗展示) */
  getAllSnapshots: () => MonthlySnapshot[];
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function computeSnapshot(
  year: number,
  month: number,
  salary: number,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): MonthlySnapshot {
  // 计算 totalUnits:遍历当月每天累加
  const days = daysInMonthCalc(year, month);
  let totalUnits = 0;
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    totalUnits += dayUnits(date, config, overrides, holidays);
  }

  const workDays = workdaysInMonth(year, month, config, overrides, holidays);
  const dailyRate = salary / Math.max(workDays, 1);
  const key = monthKey(year, month);

  return {
    key,
    salary,
    workDays,
    dailyRate,
    totalUnits,
    generatedAt: new Date().toISOString(),
  };
}

const initialSnapshots = (() => {
  const stored = loadJSON<MonthlySnapshots | null>(SNAPSHOTS_KEY, null);
  return stored ?? {};
})();

export const useMonthlyStore = create<MonthlyStore>()((set, get) => ({
  snapshots: initialSnapshots,

  createSnapshot: (year, month, salary, config, overrides, holidays) => {
    const key = monthKey(year, month);
    const snapshot = computeSnapshot(year, month, salary, config, overrides, holidays);
    const newSnapshots = { ...get().snapshots, [key]: snapshot };
    set({ snapshots: newSnapshots });
    saveJSON(SNAPSHOTS_KEY, newSnapshots);
  },

  removeSnapshot: (year, month) => {
    const key = monthKey(year, month);
    const newSnapshots = { ...get().snapshots };
    delete newSnapshots[key];
    set({ snapshots: newSnapshots });
    saveJSON(SNAPSHOTS_KEY, newSnapshots);
  },

  getSnapshot: (year, month) => {
    const key = monthKey(year, month);
    return get().snapshots[key] ?? null;
  },

  getAllSnapshots: () => {
    const all = Object.values(get().snapshots);
    return all.sort((a, b) => a.key.localeCompare(b.key));
  },
}));
