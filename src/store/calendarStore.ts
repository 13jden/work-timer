/**
 * Salary Timer — Calendar Store
 *
 * 管理日历页状态:
 *   - 当前查看的年/月
 *   - 手动调休 override(每天 可选 work / rest)
 *
 * 自动持久化到 localStorage。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OVERRIDES_KEY } from '../lib/constants';
import { loadJSON } from '../lib/storage';
import type { DayOverrideValue, DayOverrides } from '../lib/types';

// ── Store 形状 ──────────────────────────────────────────────
interface CalendarStore {
  /** 当前查看的年月 */
  year: number;
  month: number;

  /** 手动调休覆盖表 key=YYYY-MM-DD value=work|rest */
  dayOverrides: DayOverrides;

  /** 设置当前查看的年月 */
  setMonth: (year: number, month: number) => void;
  /** 跳到下个月 */
  nextMonth: () => void;
  /** 跳到上个月 */
  prevMonth: () => void;
  /** 跳到今天 */
  goToToday: () => void;

  /**
   * 切换某一天的工作 / 休息状态
   * - 如果当前是休息日(weekend / holiday)→ 设为 work
   * - 如果当前是工作日 → 设为 rest
   * - 移除 override(传入 undefined / null)→ 清除手动覆盖
   */
  toggleDay: (key: string, make: DayOverrideValue | null) => void;

  /** 清除某天的 override */
  clearOverride: (key: string) => void;

  /** 重置 */
  reset: () => void;
}

// ── 初始值 ──────────────────────────────────────────────────
function nowYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

const initialCal = (() => {
  const stored = loadJSON<DayOverrides | null>(OVERRIDES_KEY, null);
  return stored ?? {};
})();

// ── Store 实现 ──────────────────────────────────────────────
export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      ...nowYearMonth(),
      dayOverrides: initialCal,

      setMonth: (year, month) => set({ year, month }),

      nextMonth: () => {
        const { year, month } = get();
        if (month === 11) set({ year: year + 1, month: 0 });
        else set({ month: month + 1 });
      },

      prevMonth: () => {
        const { year, month } = get();
        if (month === 0) set({ year: year - 1, month: 11 });
        else set({ month: month - 1 });
      },

      goToToday: () => set(nowYearMonth()),

      toggleDay: (key, make) => {
        const overrides = { ...get().dayOverrides };
        if (make === null) {
          delete overrides[key];
        } else {
          overrides[key] = make;
        }
        set({ dayOverrides: overrides });
      },

      clearOverride: (key) => {
        const overrides = { ...get().dayOverrides };
        delete overrides[key];
        set({ dayOverrides: overrides });
      },

      reset: () => set({ ...nowYearMonth(), dayOverrides: {} }),
    }),
    {
      name: OVERRIDES_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);