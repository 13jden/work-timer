/**
 * Salary Timer — Calendar Store
 *
 * 管理日历页状态:
 *   - 当前查看的年/月
 *   - 手动调休/加班/请假 override(每天 可选 work / paid_overtime / leave / rest)
 *   - 月度休息模式覆盖(每月可选 0无休/1单休/2双休,优先级高于全局 config.restMode)
 *
 * 自动持久化到 localStorage(v2 key)。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
// ── 持久化 key v3(老 v2 key 保留作备份) ────────────────────
import { OVERRIDES_KEY_V2, OVERRIDES_KEY_V3 } from '../lib/constants';
import { loadJSON } from '../lib/storage';
import type { DayOverrideEntry, DayOverrides, WorkSegment } from '../lib/types';

// ── Store 形状 ──────────────────────────────────────────────
type RestMode = 0 | 1 | 2;

interface CalendarStore {
  /** 当前查看的年月 */
  year: number;
  month: number;

  /** 手动调休覆盖表 key=YYYY-MM-DD value=DayOverrideEntry */
  dayOverrides: DayOverrides;

  /** 月度休息模式覆盖表 key=YYYY-MM value=restMode(0无休/1单休/2双休) */
  monthlyRestModes: Record<string, RestMode>;

  /** 设置当前查看的年月 */
  setMonth: (year: number, month: number) => void;
  /** 跳到下个月 */
  nextMonth: () => void;
  /** 跳到上个月 */
  prevMonth: () => void;
  /** 跳到今天 */
  goToToday: () => void;

  /**
   * 设置某一天的 override entry
   * - 传入 entry → 设置 override
   * - 传入 null → 清除 override
   *
   * 兼容旧 v1:'work'|'rest' 字符串自动转换
   */
  setDayOverride: (key: string, entry: DayOverrideEntry | null) => void;

  /**
   * 兼容旧 toggleDay:只支持 work/rest 切换
   * @deprecated 请用 setDayOverride
   */
  toggleDay: (key: string, make: 'work' | 'rest' | null) => void;

  /** 清除某天的 override */
  clearOverride: (key: string) => void;

  /** 设置/清除某月份的休息模式覆盖;null=清除覆盖 */
  setMonthlyRestMode: (key: string, mode: RestMode | null) => void;

  /** 重置 */
  reset: () => void;
}

// ── 初始值 ──────────────────────────────────────────────────
function nowYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

const initialCal = (() => {
  // 优先 v3 key,fallback v2 key(兼容老数据)
  const stored = loadJSON<DayOverrides | null>(OVERRIDES_KEY_V3, null)
    ?? loadJSON<DayOverrides | null>(OVERRIDES_KEY_V2, null);
  return stored ?? {};
})();

// ── 归一化:兼容旧 v1/v2 数据 ─────────────────────────────
// 旧 storage key 里的数据可能是 'work' | 'rest' 字符串(v1)
// 或 { type, multiplier } 缺字段(v2);读取时统一归一化为完整 DayOverrideEntry
function normalizeOverrides(raw: unknown): DayOverrides {
  if (!raw || typeof raw !== 'object') return {};
  const result: DayOverrides = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  for (const [key, val] of entries) {
    if (!val) continue;
    if (typeof val === 'string') {
      if (val === 'work' || val === 'rest') {
        result[key] = { type: val, multiplier: val === 'work' ? 1 : 0, segments: null, nightShift: false };
      }
    } else if (typeof val === 'object' && val !== null) {
      const entry = val as Record<string, unknown>;
      const type = entry.type as string;
      const multiplier = Number(entry.multiplier ?? 1);
      if (['work', 'paid_overtime', 'leave', 'rest', 'freelance'].includes(type) && Number.isFinite(multiplier)) {
        const segments = Array.isArray(entry.segments)
          ? (entry.segments as WorkSegment[]).filter(
              (s) => s && typeof s.start === 'string' && typeof s.end === 'string',
            )
          : null;
        const nightShift = entry.nightShift === true;
        // v1.3.2:freelance 临时费率(缺省时 null)
        const fd = entry.freelanceDaily;
        const fh = entry.freelanceHourly;
        const freelanceDaily = typeof fd === 'number' && Number.isFinite(fd) ? fd : null;
        const freelanceHourly = typeof fh === 'number' && Number.isFinite(fh) ? fh : null;
        result[key] = {
          type: type as DayOverrideEntry['type'],
          multiplier,
          segments,
          nightShift,
          freelanceDaily,
          freelanceHourly,
        };
      }
    }
  }
  return result;
}

const normalizedInitial = normalizeOverrides(initialCal);

// ── Store 实现 ──────────────────────────────────────────────
export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      ...nowYearMonth(),
      dayOverrides: normalizedInitial,
      monthlyRestModes: {},

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

      setDayOverride: (key, entry) => {
        const overrides = { ...get().dayOverrides };
        if (entry === null) {
          delete overrides[key];
        } else {
          overrides[key] = entry;
        }
        set({ dayOverrides: overrides });
      },

      // 兼容旧 v1:只支持 work/rest
      toggleDay: (key, make) => {
        const overrides = { ...get().dayOverrides };
        if (make === null) {
          delete overrides[key];
        } else {
          overrides[key] = {
            type: make,
            multiplier: make === 'work' ? 1 : 0,
            segments: null,
            nightShift: false,
          };
        }
        set({ dayOverrides: overrides });
      },

      clearOverride: (key) => {
        const overrides = { ...get().dayOverrides };
        delete overrides[key];
        set({ dayOverrides: overrides });
      },

      setMonthlyRestMode: (key, mode) => {
        const all = { ...get().monthlyRestModes };
        if (mode === null) {
          delete all[key];
        } else {
          all[key] = mode;
        }
        set({ monthlyRestModes: all });
      },

      reset: () => set({ ...nowYearMonth(), dayOverrides: {}, monthlyRestModes: {} }),
    }),
    {
      name: OVERRIDES_KEY_V3,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, _version) => {
        // 老 v2 / v1 数据通过 normalizeOverrides 归一化,内置已补 segments/nightShift
        return persistedState as CalendarStore;
      },
    },
  ),
);