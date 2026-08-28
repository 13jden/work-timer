/**
 * Salary Timer — Monthly Store
 *
 * 管理月度薪资记录:当月实时累计、跨月自动锁定历史记录。
 */
import { create } from 'zustand';
import { MONTHLY_KEY } from '../lib/constants';
import { saveJSON } from '../lib/storage';
import type { MonthlyRecord } from '../lib/types';
import {
  workdaysInMonth,
  dailySalary,
  workSeconds,
  monthEarnedSoFar,
} from '../lib/compute';
import type { Config, DayOverrides, HolidayMap } from '../lib/types';

interface MonthlyStore {
  /** key = "YYYYMM"(如 "202608") */
  records: Record<string, MonthlyRecord>;

  /** 生成当月记录(若不存在) */
  generateForMonth: (year: number, month: number, config: Config, overrides: DayOverrides, holidays: HolidayMap) => void;

  /** 锁定上月(每月初自动调用) */
  lockPrevMonth: () => void;

  /** 读某月记录 */
  getRecord: (year: number, month: number) => MonthlyRecord | null;
}

export const useMonthlyStore = create<MonthlyStore>()((set, get) => ({
  records: {},

  generateForMonth: (year, month, config, overrides, holidays) => {
    const key = String(year * 100 + month);
    if (get().records[key]) return;

    const workDays = workdaysInMonth(year, month, config, overrides, holidays);
    const daily = dailySalary(year, month, config, overrides, holidays);
    const hours = Math.max(workSeconds(config) / 3600, 0.01);
    const hourly = daily / hours;
    const now = new Date();
    const isCurrent = year === now.getFullYear() && month === now.getMonth();

    const totalEarned = isCurrent
      ? monthEarnedSoFar(year, month, now, config, overrides, holidays)
      : daily * workDays;

    const record: MonthlyRecord = {
      yyyy: year,
      mm: month,
      salary: config.monthlySalary,
      workDays,
      dailyRate: daily,
      hourlyRate: hourly,
      totalEarned,
      locked: !isCurrent,
      generatedAt: new Date().toISOString(),
    };

    const newRecords = { ...get().records, [key]: record };
    set({ records: newRecords });
    saveJSON(MONTHLY_KEY, newRecords);
  },

  lockPrevMonth: () => {
    const now = new Date();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const key = String(prevYear * 100 + prevMonth);
    const records = get().records;
    if (records[key] && !records[key].locked) {
      const updated = { ...records, [key]: { ...records[key]!, locked: true } };
      set({ records: updated });
      saveJSON(MONTHLY_KEY, updated);
    }
  },

  getRecord: (year, month) => {
    const key = String(year * 100 + month);
    return get().records[key] ?? null;
  },
}));