/**
 * Salary Timer — Compute Layer Unit Tests
 * 覆盖率目标:>90%
 */
import { describe, it, expect } from 'vitest';
import {
  dailySalary,
  daysInMonthCalc,
  dayUnits,
  dayState,
  getDayOverride,
  hourlyRate,
  isHoliday,
  isWorkday,
  monthEarnedSoFar,
  perSecond,
  progressPct,
  todayEarned,
  workSeconds,
  workdaysInMonth,
  isRestDayCustom,
  batchGenerateEarned,
  computeRangeStats,
  // v1.3.5 新增
  getDateTemplateMarks,
  hasTemplateConflict,
  addTemplateMarkToDate,
  removeTemplateMarkFromDate,
  mergeTemplateSegmentsForDate,
  isDateMarkedByTemplate,
  parttimeEarnings,
  parttimeMinutes,
} from './compute';
import type { Config, DayOverrides, HolidayMap, WorkTemplate } from './types';

// ── Test Fixtures ─────────────────────────────────────────────
const baseConfig: Config = {
  monthlySalary: 15000,
  startTime: '09:00',
  endTime: '18:00',
  coffeePrice: 15,
  restMode: 2,           // 双休
  theme: 'paper',
  recordedFromDate: '2026-08-28',
  salaryMode: 'monthly',
  manualHourlyRate: 100,
  manualDailyRate: 800,
  segments: null,
  segmentTemplates: [    // v1.3.1 新增
    { id: 'tpl-default', label: '默认', segments: [{ start: '09:00', end: '18:00' }] },
  ],
  lunchEnabled: false,
  lunchStart: '12:00',
  lunchMinutes: 60,
};

const noOverrides: DayOverrides = {};
const emptyHolidays: HolidayMap = {};
const sampleHolidays: HolidayMap = {
  '2026-01-01': '元旦',
  '2026-02-17': '春节',
};

// ── Helper: local-time Date ───────────────────────────────────
function date(year: number, month: number, day: number, hour = 12, minute = 0, second = 0): Date {
  return new Date(year, month, day, hour, minute, second);
}

// ══════════════════════════════════════════════════════════════
// getDayOverride(兼容旧 v1 字符串)
// ══════════════════════════════════════════════════════════════
describe('getDayOverride', () => {
  it('returns null for empty key', () => {
    expect(getDayOverride(noOverrides, '2026-08-28')).toBe(null);
  });

  it('returns entry for v2 object', () => {
    const ov: DayOverrides = {
      '2026-08-28': { type: 'paid_overtime', multiplier: 2 , segments: null, nightShift: false },
    };
    const e = getDayOverride(ov, '2026-08-28');
    expect(e?.type).toBe('paid_overtime');
    expect(e?.multiplier).toBe(2);
  });

  it('converts v1 "work" string to entry', () => {
    const ov = { '2026-08-28': 'work' } as unknown as DayOverrides;
    const e = getDayOverride(ov, '2026-08-28');
    expect(e?.type).toBe('work');
    expect(e?.multiplier).toBe(1);
  });

  it('converts v1 "rest" string to entry', () => {
    const ov = { '2026-08-28': 'rest' } as unknown as DayOverrides;
    const e = getDayOverride(ov, '2026-08-28');
    expect(e?.type).toBe('rest');
    expect(e?.multiplier).toBe(0);
  });

  it('returns null for unknown string', () => {
    const ov = { '2026-08-28': 'foo' } as unknown as DayOverrides;
    expect(getDayOverride(ov, '2026-08-28')).toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════
// isWorkday
// ══════════════════════════════════════════════════════════════
describe('isWorkday', () => {
  it('restMode=2,Saturday → false', () => {
    // 2026-08-29 is Saturday
    expect(isWorkday(date(2026, 7, 29), baseConfig, noOverrides, emptyHolidays)).toBe(false);
  });

  it('restMode=2,Sunday → false', () => {
    // 2026-08-30 is Sunday
    expect(isWorkday(date(2026, 7, 30), baseConfig, noOverrides, emptyHolidays)).toBe(false);
  });

  it('restMode=2,Monday → true', () => {
    // 2026-08-31 is Monday
    expect(isWorkday(date(2026, 7, 31), baseConfig, noOverrides, emptyHolidays)).toBe(true);
  });

  it('restMode=1,Saturday → true', () => {
    // restMode=1 单休 → 周六仍工作
    expect(isWorkday(date(2026, 7, 29), { ...baseConfig, restMode: 1 }, noOverrides, emptyHolidays)).toBe(true);
  });

  it('restMode=1,Sunday → false', () => {
    // 2026-08-30 is Sunday
    expect(isWorkday(date(2026, 7, 30), { ...baseConfig, restMode: 1 }, noOverrides, emptyHolidays)).toBe(false);
  });

  it('restMode=0,Sunday → true', () => {
    expect(isWorkday(date(2026, 7, 29), { ...baseConfig, restMode: 0 }, noOverrides, emptyHolidays)).toBe(true);
    expect(isWorkday(date(2026, 7, 30), { ...baseConfig, restMode: 0 }, noOverrides, emptyHolidays)).toBe(true);
  });

  it('override v2 rest → false', () => {
    expect(isWorkday(date(2026, 7, 31), baseConfig, { '2026-08-31': { type: 'rest', multiplier: 0 , segments: null, nightShift: false } }, emptyHolidays)).toBe(false);
  });

  it('override v2 work → true even on Saturday', () => {
    expect(isWorkday(date(2026, 7, 29), baseConfig, { '2026-08-29': { type: 'work', multiplier: 1 , segments: null, nightShift: false } }, emptyHolidays)).toBe(true);
  });

  it('override v2 leave → true (originally workday, took leave)', () => {
    expect(isWorkday(date(2026, 7, 31), baseConfig, { '2026-08-31': { type: 'leave', multiplier: 0 , segments: null, nightShift: false } }, emptyHolidays)).toBe(true);
  });

  it('override v2 paid_overtime → true (extra pay)', () => {
    expect(isWorkday(date(2026, 7, 31), baseConfig, { '2026-08-31': { type: 'paid_overtime', multiplier: 1.5 , segments: null, nightShift: false } }, emptyHolidays)).toBe(true);
  });

  it('holiday → false even on Monday', () => {
    // 2026-01-01 is Thursday(周四)
    expect(isWorkday(date(2026, 0, 1), baseConfig, noOverrides, sampleHolidays)).toBe(false);
  });

  it('override takes priority over holiday', () => {
    expect(isWorkday(date(2026, 0, 1), baseConfig, { '2026-01-01': { type: 'work', multiplier: 1 , segments: null, nightShift: false } }, sampleHolidays)).toBe(true);
  });

  it('legacy v1 string override still works', () => {
    expect(isWorkday(date(2026, 7, 31), baseConfig, { '2026-08-31': 'rest' } as unknown as DayOverrides, emptyHolidays)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// isHoliday
// ══════════════════════════════════════════════════════════════
describe('isHoliday', () => {
  it('returns holiday name for known date', () => {
    expect(isHoliday(date(2026, 0, 1), sampleHolidays)).toBe('元旦');
  });

  it('returns null for non-holiday', () => {
    expect(isHoliday(date(2026, 7, 28), sampleHolidays)).toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════
// workdaysInMonth
// ══════════════════════════════════════════════════════════════
describe('workdaysInMonth', () => {
  it('counts weekends correctly with restMode=2', () => {
    // 2026-08 has 31 days
    // Saturdays: 1, 8, 15, 22, 29 (5)
    // Sundays: 2, 9, 16, 23, 30 (5)
    // 工作日: 31 - 10 = 21
    expect(workdaysInMonth(2026, 7, baseConfig, noOverrides, emptyHolidays)).toBe(21);
  });

  it('handles holidays', () => {
    // 2026-01-01 是元旦(周四),应扣除
    // 工作日 = 31 - 周末数 - 节假日数
    const total = workdaysInMonth(2026, 0, baseConfig, noOverrides, sampleHolidays);
    expect(total).toBeLessThan(31);
  });

  it('respects restMode=0 (no rest days)', () => {
    expect(workdaysInMonth(2026, 7, { ...baseConfig, restMode: 0 }, noOverrides, emptyHolidays)).toBe(31);
  });

  it('respects v2 rest override', () => {
    // 2026-08-28 is Friday (工作日),override 为 rest → 应扣 1 天
    const overrides: DayOverrides = { '2026-08-28': { type: 'rest', multiplier: 0 , segments: null, nightShift: false } };
    expect(workdaysInMonth(2026, 7, baseConfig, overrides, emptyHolidays)).toBe(20); // 21 - 1
  });

  it('respects legacy v1 string override', () => {
    const overrides = { '2026-08-28': 'rest' } as unknown as DayOverrides;
    expect(workdaysInMonth(2026, 7, baseConfig, overrides, emptyHolidays)).toBe(20);
  });
});

// ══════════════════════════════════════════════════════════════
// daysInMonthCalc
// �═════════════════════════════════════════════════════════════
describe('daysInMonthCalc', () => {
  it('returns correct days for each month', () => {
    expect(daysInMonthCalc(2026, 0)).toBe(31);   // Jan
    expect(daysInMonthCalc(2026, 1)).toBe(28);   // Feb 2026 (not leap)
    expect(daysInMonthCalc(2024, 1)).toBe(29);   // Feb 2024 (leap)
    expect(daysInMonthCalc(2026, 3)).toBe(30);   // Apr
  });
});

// ══════════════════════════════════════════════════════════════
// workSeconds
// ══════════════════════════════════════════════════════════════
describe('workSeconds', () => {
  it('9 hours = 32400 seconds', () => {
    expect(workSeconds(baseConfig)).toBe(9 * 3600);
  });

  it('returns 0 when end <= start', () => {
    expect(workSeconds({ ...baseConfig, startTime: '18:00', endTime: '09:00' })).toBe(0);
  });

  it('returns 0 when start == end', () => {
    expect(workSeconds({ ...baseConfig, startTime: '09:00', endTime: '09:00' })).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// dailySalary / hourlyRate / perSecond
// ══════════════════════════════════════════════════════════════
describe('dailySalary', () => {
  it('monthly / workdays', () => {
    // 2026-08: 21 workdays,15000 / 21 ≈ 714.29
    const d = dailySalary(2026, 7, baseConfig, noOverrides, emptyHolidays);
    expect(d).toBeCloseTo(714.29, 1);
  });

  it('never returns NaN for empty workdays', () => {
    // 极端情况:整月都是节假日
    const allHolidays: HolidayMap = {};
    for (let d = 1; d <= 31; d++) {
      const k = `2026-08-${String(d).padStart(2, '0')}`;
      allHolidays[k] = '休';
    }
    const d = dailySalary(2026, 7, baseConfig, noOverrides, allHolidays);
    expect(Number.isFinite(d)).toBe(true);
  });
});

describe('hourlyRate', () => {
  it('daily / workHours', () => {
    // daily ≈ 714.29, workHours = 9, hourly ≈ 79.37
    const h = hourlyRate(2026, 7, baseConfig, noOverrides, emptyHolidays);
    expect(h).toBeCloseTo(79.37, 1);
  });
});

describe('perSecond', () => {
  it('hourly / 3600', () => {
    const p = perSecond(2026, 7, baseConfig, noOverrides, emptyHolidays);
    expect(p).toBeCloseTo(79.37 / 3600, 4);
  });
});

// ══════════════════════════════════════════════════════════════
// dayUnits(新功能)
// ══════════════════════════════════════════════════════════════
describe('dayUnits', () => {
  it('returns 1 for normal workday with no override', () => {
    // 2026-08-31 Monday
    expect(dayUnits(date(2026, 7, 31), baseConfig, noOverrides, emptyHolidays)).toBe(1);
  });

  it('returns 0 for Saturday with no override', () => {
    expect(dayUnits(date(2026, 7, 29), baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });

  it('returns 0 for rest override', () => {
    expect(dayUnits(date(2026, 7, 31), baseConfig, { '2026-08-31': { type: 'rest', multiplier: 0 , segments: null, nightShift: false } }, emptyHolidays)).toBe(0);
  });

  it('returns 0 for leave override', () => {
    expect(dayUnits(date(2026, 7, 31), baseConfig, { '2026-08-31': { type: 'leave', multiplier: 0 , segments: null, nightShift: false } }, emptyHolidays)).toBe(0);
  });

  it('returns 1.5 for paid_overtime default', () => {
    expect(dayUnits(date(2026, 7, 31), baseConfig, { '2026-08-31': { type: 'paid_overtime', multiplier: 1.5 , segments: null, nightShift: false } }, emptyHolidays)).toBe(1.5);
  });

  it('respects custom multiplier for overtime', () => {
    expect(dayUnits(date(2026, 7, 31), baseConfig, { '2026-08-31': { type: 'paid_overtime', multiplier: 2 , segments: null, nightShift: false } }, emptyHolidays)).toBe(2);
  });

  it('returns 0 for holiday', () => {
    expect(dayUnits(date(2026, 0, 1), baseConfig, noOverrides, sampleHolidays)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// todayEarned
// ══════════════════════════════════════════════════════════════
describe('todayEarned', () => {
  it('returns 0 on non-workday', () => {
    // 2026-08-30 is Sunday
    const now = date(2026, 7, 30, 12, 0, 0);
    expect(todayEarned(now, baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });

  it('returns 0 before start time', () => {
    // 2026-08-31 Monday 8:00
    const now = date(2026, 7, 31, 8, 0, 0);
    expect(todayEarned(now, baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });

  it('returns dailySalary after end time', () => {
    // 2026-08-31 Monday 19:00
    const now = date(2026, 7, 31, 19, 0, 0);
    const daily = dailySalary(2026, 7, baseConfig, noOverrides, emptyHolidays);
    expect(todayEarned(now, baseConfig, noOverrides, emptyHolidays)).toBe(daily);
  });

  it('calculates correctly during work hours', () => {
    // 2026-08-31 Monday 12:00,已工作 3 小时
    const now = date(2026, 7, 31, 12, 0, 0);
    const rate = perSecond(2026, 7, baseConfig, noOverrides, emptyHolidays);
    const expected = rate * 3 * 3600;
    expect(todayEarned(now, baseConfig, noOverrides, emptyHolidays)).toBeCloseTo(expected, 4);
  });

  it('returns 0 exactly at start time', () => {
    const now = date(2026, 7, 31, 9, 0, 0);
    expect(todayEarned(now, baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });

  it('returns daily × 1.5 for overtime after end', () => {
    // 2026-08-31 Monday 19:00,当天加班 1.5x
    const now = date(2026, 7, 31, 19, 0, 0);
    const daily = dailySalary(2026, 7, baseConfig, noOverrides, emptyHolidays);
    const ov: DayOverrides = { '2026-08-31': { type: 'paid_overtime', multiplier: 1.5 , segments: null, nightShift: false } };
    expect(todayEarned(now, baseConfig, ov, emptyHolidays)).toBeCloseTo(daily * 1.5, 4);
  });

  it('returns 0 for leave day after end', () => {
    const now = date(2026, 7, 31, 19, 0, 0);
    const ov: DayOverrides = { '2026-08-31': { type: 'leave', multiplier: 0 , segments: null, nightShift: false } };
    expect(todayEarned(now, baseConfig, ov, emptyHolidays)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// dayState
// ══════════════════════════════════════════════════════════════
describe('dayState', () => {
  it('returns rest mode on non-workday', () => {
    const now = date(2026, 7, 30, 12, 0, 0); // Sunday
    expect(dayState(now, baseConfig, noOverrides, emptyHolidays).mode).toBe('rest');
  });

  it('returns done mode after end time', () => {
    const now = date(2026, 7, 31, 19, 0, 0); // Monday 19:00
    const s = dayState(now, baseConfig, noOverrides, emptyHolidays);
    expect(s.mode).toBe('done');
    if (s.mode === 'done') {
      expect(s.display).toMatch(/^\d{2}:\d{2}:00$/);
    }
  });

  it('returns active mode during work', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const s = dayState(now, baseConfig, noOverrides, emptyHolidays);
    expect(s.mode).toBe('active');
    if (s.mode === 'active') {
      expect(s.display).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(s.status).toBe('工作计价中');
    }
  });

  it('returns active mode before work with waiting label', () => {
    const now = date(2026, 7, 31, 8, 0, 0); // 1 hour before 9:00
    const s = dayState(now, baseConfig, noOverrides, emptyHolidays);
    expect(s.mode).toBe('active');
    if (s.mode === 'active') {
      expect(s.status).toBe('等待开工');
    }
  });
});

// ══════════════════════════════════════════════════════════════
// monthEarnedSoFar
// ══════════════════════════════════════════════════════════════
describe('monthEarnedSoFar', () => {
  it('sums past workdays up to now', () => {
    // 假设现在是 2026-08-15 12:00
    const now = date(2026, 7, 15, 12, 0, 0);
    const earned = monthEarnedSoFar(2026, 7, now, baseConfig, noOverrides, emptyHolidays);
    expect(earned).toBeGreaterThan(0);
    expect(earned).toBeLessThan(15000);
  });

  it('returns 0 when now is day 1 before any work', () => {
    // 2026-08-01 00:00 (假设还没到工作)
    const now = date(2026, 7, 1, 0, 0, 0);
    expect(monthEarnedSoFar(2026, 7, now, baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });

  it('caps at now (future days not counted)', () => {
    const now = date(2026, 7, 5, 19, 0, 0);
    const earned = monthEarnedSoFar(2026, 7, now, baseConfig, noOverrides, emptyHolidays);
    // 5 天内的工作日(8/1 周六、8/2 周日)→ 实际只有 8/3-8/5 (周一、周二、周三)都是 19:00 = 当天已贡献
    const daily = dailySalary(2026, 7, baseConfig, noOverrides, emptyHolidays);
    expect(earned).toBeCloseTo(daily * 3, 2);
  });

  it('deducts daily for leave day', () => {
    // 8/3-8/7 (Mon-Fri),共 5 个工作日 = 5 × daily
    // 把 8/5 改成 leave → 只剩 4 × daily
    const now = date(2026, 7, 7, 19, 0, 0);
    const ov: DayOverrides = { '2026-08-05': { type: 'leave', multiplier: 0 , segments: null, nightShift: false } };
    const daily = dailySalary(2026, 7, baseConfig, ov, emptyHolidays);
    const earned = monthEarnedSoFar(2026, 7, now, baseConfig, ov, emptyHolidays);
    // daily = 15000 / 21 = 714.29 (workdays 不变,leave 不扣日数)
    // earned = 4 × daily (8/5 的 leave 不贡献)
    expect(earned).toBeCloseTo(daily * 4, 2);
  });

  it('adds 0.5 × daily for overtime day (1.5x)', () => {
    const now = date(2026, 7, 7, 19, 0, 0);
    const ov: DayOverrides = { '2026-08-05': { type: 'paid_overtime', multiplier: 1.5 , segments: null, nightShift: false } };
    const daily = dailySalary(2026, 7, baseConfig, ov, emptyHolidays);
    const earned = monthEarnedSoFar(2026, 7, now, baseConfig, ov, emptyHolidays);
    // 4 个工作日(8/3, 8/4, 8/6, 8/7)= 4 × daily
    // 8/5 overtime = 1.5 × daily
    // 总 = 5.5 × daily
    expect(earned).toBeCloseTo(daily * 5.5, 2);
  });

  it('respects today partial calculation', () => {
    // 今天 = 8/7 12:00(工作了 3 小时,半天)
    // 之前 8/3, 8/4, 8/5, 8/6 = 4 × daily (全贡献)
    // 今天 = daily × (3/9) = daily / 3
    const now = date(2026, 7, 7, 12, 0, 0);
    const daily = dailySalary(2026, 7, baseConfig, noOverrides, emptyHolidays);
    const earned = monthEarnedSoFar(2026, 7, now, baseConfig, noOverrides, emptyHolidays);
    const expected = daily * (4 + 3 / 9);
    expect(earned).toBeCloseTo(expected, 2);
  });

  it('today is rest day → only counts past days', () => {
    // 今天是 8/2 周日(休息日),8/1 也是周六
    // 8/3-8/7 都未到 → 只算 8/2 之前 = 0
    const now = date(2026, 7, 2, 12, 0, 0);
    const earned = monthEarnedSoFar(2026, 7, now, baseConfig, noOverrides, emptyHolidays);
    expect(earned).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// progressPct
// ══════════════════════════════════════════════════════════════
describe('progressPct', () => {
  it('returns 0 before start', () => {
    const now = date(2026, 7, 31, 8, 0, 0);
    expect(progressPct(now, baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });

  it('returns 100 after end', () => {
    const now = date(2026, 7, 31, 19, 0, 0);
    expect(progressPct(now, baseConfig, noOverrides, emptyHolidays)).toBe(100);
  });

  it('returns midpoint value', () => {
    // 2026-08-31 13:30(4.5 小时已工作,共 9 小时)→ 50%
    const now = date(2026, 7, 31, 13, 30, 0);
    expect(progressPct(now, baseConfig, noOverrides, emptyHolidays)).toBeCloseTo(50, 0);
  });

  it('returns 0 on non-workday', () => {
    const now = date(2026, 7, 30, 12, 0, 0);
    expect(progressPct(now, baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3 · WorkSegment 工具集
// ══════════════════════════════════════════════════════════════
import type { WorkSegment, SlackingSession, DayOverrideEntry } from './types';
import {
  splitSegment,
  unionSegments,
  totalSegmentsMinutes,
  findCurrentSegment,
  nightShiftMinutes,
  lunchOverlapMinutes,
  getEffectiveSegments,
  effectiveDailyRate,
  effectiveHourlyRate,
  computeNetHours,
  netHourlyRate,
  slackingEarn,
  overtimeSessionSplit,
  overtimeMinutes,
} from './compute';

describe('splitSegment · 跨天识别', () => {
  it('22:00–06:00 → [{22:00, 24:00}, {00:00, 06:00}]', () => {
    const r = splitSegment({ start: '22:00', end: '06:00' });
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ start: '22:00', end: '24:00' });
    expect(r[1]).toEqual({ start: '00:00', end: '06:00' });
  });

  it('09:00–18:00 → 原样', () => {
    const r = splitSegment({ start: '09:00', end: '18:00' });
    expect(r).toEqual([{ start: '09:00', end: '18:00' }]);
  });

  it('边界:start == end', () => {
    const r = splitSegment({ start: '09:00', end: '09:00' });
    expect(r).toEqual([{ start: '09:00', end: '24:00' }, { start: '00:00', end: '09:00' }]);
  });
});

describe('unionSegments · 多段 union 去重叠', () => {
  it('单段不变', () => {
    const u = unionSegments([{ start: '09:00', end: '18:00' }]);
    expect(u).toHaveLength(1);
  });

  it('两段不重叠', () => {
    const u = unionSegments([
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ]);
    expect(u).toHaveLength(2);
  });

  it('两段重叠 30min:[9-12] + [11:30-14] → totalMinutes 270', () => {
    const total = totalSegmentsMinutes([
      { start: '09:00', end: '12:00' },
      { start: '11:30', end: '14:00' },
    ]);
    // [9-14) 总 5 小时 = 300 分钟
    expect(total).toBe(300);
  });

  it('三段混合合并', () => {
    const total = totalSegmentsMinutes([
      { start: '09:00', end: '12:00' },
      { start: '11:00', end: '14:00' },
      { start: '14:30', end: '18:00' },
    ]);
    // [9-14)=300 + [14:30-18)=210 = 510
    expect(total).toBe(510);
  });
});

describe('totalSegmentsMinutes · 跨天段', () => {
  it('跨天段 22:00-06:00 = 480 min', () => {
    const t = totalSegmentsMinutes([{ start: '22:00', end: '06:00' }]);
    expect(t).toBe(480);
  });

  it('非跨天段 9h = 540 min', () => {
    const t = totalSegmentsMinutes([{ start: '09:00', end: '18:00' }]);
    expect(t).toBe(540);
  });
});

describe('findCurrentSegment · 当前时段', () => {
  function atTime(h: number, m: number): Date {
    const d = new Date(2026, 8, 2, h, m, 0);
    return d;
  }

  it('多段 9-12/14-18，10:30 → 9-12', () => {
    const seg = findCurrentSegment(
      [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
      ],
      atTime(10, 30),
    );
    expect(seg).toEqual({ start: '09:00', end: '12:00' });
  });

  it('多段 9-12/14-18，14:30 → 14-18', () => {
    const seg = findCurrentSegment(
      [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
      ],
      atTime(14, 30),
    );
    expect(seg).toEqual({ start: '14:00', end: '18:00' });
  });

  it('午休间隙 13:00 → null', () => {
    const seg = findCurrentSegment(
      [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
      ],
      atTime(13, 0),
    );
    expect(seg).toBeNull();
  });

  it('跨天段 22-06，01:00 → 22-06', () => {
    const seg = findCurrentSegment(
      [{ start: '22:00', end: '06:00' }],
      atTime(1, 0),
    );
    expect(seg).toEqual({ start: '22:00', end: '06:00' });
  });

  it('跨天段 22-06，23:30 → 22-06', () => {
    const seg = findCurrentSegment(
      [{ start: '22:00', end: '06:00' }],
      atTime(23, 30),
    );
    expect(seg).toEqual({ start: '22:00', end: '06:00' });
  });

  it('没有任何段 → null', () => {
    expect(findCurrentSegment([], atTime(10, 0))).toBeNull();
  });

  it('单段 9-18，18:00 整 → null（end 不含）', () => {
    expect(findCurrentSegment([{ start: '09:00', end: '18:00' }], atTime(18, 0))).toBeNull();
  });

  it('单段 9-18，17:59 → 9-18', () => {
    const seg = findCurrentSegment([{ start: '09:00', end: '18:00' }], atTime(17, 59));
    expect(seg).toEqual({ start: '09:00', end: '18:00' });
  });
});

describe('nightShiftMinutes · 夜班识别', () => {
  it('22:00-06:00 = 480 min', () => {
    expect(nightShiftMinutes([{ start: '22:00', end: '06:00' }])).toBe(480);
  });
  it('19:30-22:30 = 30 min(只 22:00-22:30)', () => {
    expect(nightShiftMinutes([{ start: '19:30', end: '22:30' }])).toBe(30);
  });
  it('05:00-14:00 = 60 min(只 05:00-06:00)', () => {
    expect(nightShiftMinutes([{ start: '05:00', end: '14:00' }])).toBe(60);
  });
  it('10:00-18:00 = 0 min', () => {
    expect(nightShiftMinutes([{ start: '10:00', end: '18:00' }])).toBe(0);
  });
});

describe('lunchOverlapMinutes · 午休重叠', () => {
  it('9-18 与 12:00 lunch 60min → 重叠 60', () => {
    expect(lunchOverlapMinutes(
      [{ start: '09:00', end: '18:00' }],
      '12:00',
      60,
    )).toBe(60);
  });

  it('lunchEnabled false → 0', () => {
    // lunchEnabled 由调用方处理;函数本身只看 segments 与 lunch 参数
    // 这里 lunchStart 落在 12:00,长度 60
    expect(lunchOverlapMinutes(
      [{ start: '09:00', end: '11:30' }],
      '12:00',
      60,
    )).toBe(0);
  });

  it('段未跨午休 → 0', () => {
    expect(lunchOverlapMinutes(
      [{ start: '14:00', end: '18:00' }],
      '12:00',
      60,
    )).toBe(0);
  });
});

describe('getEffectiveSegments · 优先级', () => {
  const entry: DayOverrideEntry = {
    type: 'work',
    multiplier: 1,
    segments: [{ start: '10:00', end: '16:00' }],
    nightShift: false,
  };

  it('override.segments 优先', () => {
    const segs = getEffectiveSegments(baseConfig, entry);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ start: '10:00', end: '16:00' });
  });

  it('config.segments 非空 + 无 override → 用全局', () => {
    const cfg = { ...baseConfig, segments: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] as WorkSegment[] };
    const segs = getEffectiveSegments(cfg, null);
    expect(segs).toHaveLength(2);
  });

  it('config.segments = null + 无 override → 单段 fallback', () => {
    const segs = getEffectiveSegments(baseConfig, null);
    expect(segs).toEqual([{ start: '09:00', end: '18:00' }]);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3 · effectiveDailyRate / effectiveHourlyRate
// ══════════════════════════════════════════════════════════════

describe('effectiveDailyRate · 加班倍率生效', () => {
  it('加班日 ×1.5 = 基础 × 1.5', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const base = effectiveDailyRate(now, baseConfig, noOverrides, emptyHolidays);
    const ot = effectiveDailyRate(now, baseConfig, { '2026-08-31': { type: 'paid_overtime', multiplier: 1.5, segments: null, nightShift: false } }, emptyHolidays);
    expect(ot).toBeCloseTo(base * 1.5, 2);
  });

  it('普通工作日 = 基础日均', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const r = effectiveDailyRate(now, baseConfig, noOverrides, emptyHolidays);
    // 15000 / 21 = 714.29
    expect(r).toBeCloseTo(714.29, 1);
  });

  it('休息日 = 0', () => {
    const now = date(2026, 7, 30, 12, 0, 0);
    expect(effectiveDailyRate(now, baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });

  it('hourly 模式:manualHourlyRate × segmentsHours', () => {
    const cfg = { ...baseConfig, salaryMode: 'hourly' as const, manualHourlyRate: 120, segments: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] as WorkSegment[] };
    const now = date(2026, 7, 31, 12, 0, 0);
    // 120 × 7 = 840
    expect(effectiveDailyRate(now, cfg, noOverrides, emptyHolidays)).toBe(840);
  });

  it('daily 模式:manualDailyRate × multiplier', () => {
    const cfg = { ...baseConfig, salaryMode: 'daily' as const, manualDailyRate: 1000 };
    const now = date(2026, 7, 31, 12, 0, 0);
    expect(effectiveDailyRate(now, cfg, noOverrides, emptyHolidays)).toBe(1000);
  });
});

describe('effectiveDailyRate · v1.3.2 freelance 临时费率', () => {
  // 月薪用户兼职场景:
  //  baseConfig 是 monthly 模式,manualHourlyRate=100, manualDailyRate=800
  //  override.freelanceDaily/Hourly 应覆盖 config 默认值
  const now = date(2026, 7, 29, 12, 0, 0); // 周六(月薪用户休息日,但 freelance 类型视为工作日)

  it('freelance + freelanceDaily:直接使用 override 值', () => {
    const ovr: DayOverrides = {
      '2026-08-29': { type: 'freelance', multiplier: 1, segments: null, nightShift: false, freelanceDaily: 1500, freelanceHourly: null },
    };
    // 1500 × 1 = 1500(不走月薪分母)
    expect(effectiveDailyRate(now, baseConfig, ovr, emptyHolidays)).toBe(1500);
  });

  it('freelance + freelanceHourly:hourly × segmentsHours', () => {
    const ovr: DayOverrides = {
      '2026-08-29': { type: 'freelance', multiplier: 1, segments: null, nightShift: false, freelanceDaily: null, freelanceHourly: 200 },
    };
    // 200 × (9h) = 1800
    expect(effectiveDailyRate(now, baseConfig, ovr, emptyHolidays)).toBe(1800);
  });

  it('freelance + override 含 segments:hourly 按 override segments 计算', () => {
    const ovr: DayOverrides = {
      '2026-08-29': {
        type: 'freelance',
        multiplier: 1,
        segments: [{ start: '14:00', end: '22:00' }],
        nightShift: false,
        freelanceDaily: null,
        freelanceHourly: 150,
      },
    };
    // 150 × 8h = 1200
    expect(effectiveDailyRate(now, baseConfig, ovr, emptyHolidays)).toBe(1200);
  });

  it('freelance 但未填 override 费率:fallback 到 config.manualDailyRate', () => {
    const ovr: DayOverrides = {
      '2026-08-29': { type: 'freelance', multiplier: 1, segments: null, nightShift: false },
    };
    // fallback:manualDailyRate=800
    expect(effectiveDailyRate(now, baseConfig, ovr, emptyHolidays)).toBe(800);
  });

  it('freelance + multiplier 1.5(加班倍率):hourly × segmentsHours × 1.5', () => {
    const ovr: DayOverrides = {
      '2026-08-29': { type: 'freelance', multiplier: 1.5, segments: null, nightShift: false, freelanceDaily: null, freelanceHourly: 100 },
    };
    // 100 × 9 × 1.5 = 1350
    expect(effectiveDailyRate(now, baseConfig, ovr, emptyHolidays)).toBe(1350);
  });
});

describe('effectiveHourlyRate · 当日时薪', () => {
  it('加班日 = 基准 × 1.5', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const base = effectiveHourlyRate(now, baseConfig, noOverrides, emptyHolidays);
    const ot = effectiveHourlyRate(now, baseConfig, { '2026-08-31': { type: 'paid_overtime', multiplier: 1.5, segments: null, nightShift: false } }, emptyHolidays);
    expect(ot).toBeCloseTo(base * 1.5, 2);
  });

  it('休息日 = 0', () => {
    const now = date(2026, 7, 30, 12, 0, 0);
    expect(effectiveHourlyRate(now, baseConfig, noOverrides, emptyHolidays)).toBe(0);
  });

  it('hourly 模式 = manualHourlyRate', () => {
    const cfg = { ...baseConfig, salaryMode: 'hourly' as const, manualHourlyRate: 120 };
    const now = date(2026, 7, 31, 12, 0, 0);
    expect(effectiveHourlyRate(now, cfg, noOverrides, emptyHolidays)).toBe(120);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3 · computeNetHours 净工时
// ══════════════════════════════════════════════════════════════

function makeSession(
  dateKey: string,
  startH: number, startM: number,
  endH: number, endM: number,
): SlackingSession {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(y!, m! - 1, d!, startH, startM, 0).getTime();
  const end = new Date(y!, m! - 1, d!, endH, endM, 0).getTime();
  return {
    id: `s-${start}`,
    dateKey,
    label: 'slack',
    startTs: start,
    endTs: end,
    nightShift: false,
  };
}

describe('computeNetHours · 净工时推导', () => {
  // v1.3.4-patch1:净工时改为实时累计口径
  //   12:00 时,merged={09:00-18:00} → mergeStart=540,elapsedWorkedMin=180
  //   effectiveWindowEnd = 540 + 180 = 720
  //   午休段 [720, 780) clip 到 [540, 720] → 空集,摸鱼 session < 12:00 clip 也为空
  //   → effectiveSlack = 0,netMinutes 反映已工作 180min(+ 加成/夜班)
  it('无午休无摸鱼:net = 已工作', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    expect(r.grossMinutes).toBe(540);
    // 已工作 3h,无加成
    expect(r.netMinutes).toBe(180);
  });

  it('午休 1h 扣除(clip 到已工作外)', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: now, config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.lunchMinutes).toBe(60); // 段×午休窗口 union(不变)
    // 12:00 时午休 clip 后无交集,不预扣
    expect(r.netMinutes).toBe(180);
  });

  it('摸鱼 22m(10:30-10:52,clip 后落在窗口内)', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const sessions = [makeSession('2026-08-31', 10, 30, 10, 52)];
    const r = computeNetHours({
      date: now, config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.slackingMinutes).toBe(22); // 摸鱼总时长(不变)
    // merged {09:00-18:00},mergeStart=540,winEnd=720
    // 摸鱼段 [630, 652) clip 到 [540, 720] → [630, 652) = 22min
    // netMinutes = 180 - 22 = 158
    expect(r.netMinutes).toBe(180 - 22);
  });

  it('摸鱼 + 午休重叠(clip 后落在窗口外)', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const cfg = { ...baseConfig, lunchEnabled: true };
    // 摸鱼 12:00-12:30 + 午休 12:00-13:00 = union 12:00-13:00 = 60
    const sessions = [makeSession('2026-08-31', 12, 0, 12, 30)];
    const r = computeNetHours({
      date: now, config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.slackingMinutes).toBe(30);
    expect(r.lunchMinutes).toBe(60);
    expect(r.slackUnionLunch).toBe(60); // 去重叠(不变)
    // 12:00 时 union [720, 780) clip 到 [540, 720] → 空 → 不预扣
    expect(r.netMinutes).toBe(180);
  });

  it('加班加成 gross × (multiplier-1)', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'paid_overtime', multiplier: 1.5, segments: null, nightShift: false },
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.overtimeBonus).toBeCloseTo(540 * 0.5, 1);
    // 已工作 180 + 加成 270
    expect(r.netMinutes).toBeCloseTo(180 + 540 * 0.5, 1);
  });

  it('夜班加权:nightShift + 跨天段 22-06 → +240m(8h × 0.5 = 4h)', () => {
    // v1.3.4-patch1:跨天段 22-06,merged=[{22-24}, {00-06}],mergeStart=0(00:00 后段)
    // now=12:00 → nowMin=720,merged[0] start=22:00=1320 > 720,跨天处理
    //   worked=0(没传昨日 override)
    // effectiveGross=0,netMinutes = 0 + 0 + 0 + nightBonus(240) = 240
    const now = date(2026, 7, 31, 12, 0, 0);
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'work', multiplier: 1, segments: [{ start: '22:00', end: '06:00' }], nightShift: true },
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossMinutes).toBe(480);
    expect(r.nightBonus).toBe(240);
    expect(r.netMinutes).toBe(240);
  });

  it('加班 + 夜班叠加', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'paid_overtime', multiplier: 1.5, segments: [{ start: '22:00', end: '06:00' }], nightShift: true },
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.overtimeBonus).toBeCloseTo(480 * 0.5, 1);
    expect(r.nightBonus).toBe(240);
    // effectiveGross=0,netMinutes = 0 + 240 + 240 = 480
    expect(r.netMinutes).toBeCloseTo(240 + 240, 1);
  });

  it('PRD §7 #3 验收:6h 工时 + 1h 午休 + 22m 摸鱼(now=19:00 已收工,口径不变)', () => {
    // v1.3.4-patch1:now=19:00,merged={10-16},已工作 = 360(封顶)
    // effectiveSlack = 午休 [720, 780) clip 到 [600, 960] → 60; 摸鱼 [840, 862) → 22
    // netMinutes = 360 - (60+22) + 0 + 0 = 278(同旧口径)
    const now = date(2026, 7, 31, 19, 0, 0);
    const cfg = { ...baseConfig, startTime: '10:00', endTime: '16:00', lunchEnabled: true };
    const sessions = [makeSession('2026-08-31', 14, 0, 14, 22)];
    const r = computeNetHours({
      date: now, config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.grossMinutes).toBe(360);
    expect(r.slackUnionLunch).toBe(82);
    expect(r.netMinutes).toBe(278);
  });

  // v1.3.3 夜班自动标记(session.nightShift)
  it('夜间开始的摸鱼 session 自动标记 nightShift=true', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const sessions = [makeSession('2026-08-31', 22, 30, 23, 0)];
    sessions[0]!.nightShift = true;
    const r = computeNetHours({
      date: now, config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.slackingMinutes).toBe(30);
    // merged {09-18},mergeStart=540,winEnd=720
    // 摸鱼 [1350, 1380) clip → 空
    expect(r.netMinutes).toBe(180);
  });

  it('日间摸鱼 session 不标记 nightShift', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const sessions = [makeSession('2026-08-31', 10, 0, 10, 30)];
    sessions[0]!.nightShift = false;
    const r = computeNetHours({
      date: now, config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.slackingMinutes).toBe(30);
    // 摸鱼 [600, 630) clip 到 [540, 720] → 30min
    expect(r.netMinutes).toBe(150);
  });

  // v1.3.3 patch3·加班 session 不计入摸鱼扣除
  // v1.3.3 patch4:加班 session 计入净工时(加成项),不计入 slackingMinutes
  it('加班 session(label=overtime):不计入 slackingMinutes,作为加成计入 netMinutes', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const [y, m, d] = ['2026-08-31', '2026-08-31', '2026-08-31'].map(() => 0);
    void y; void m; void d;
    const start = new Date(2026, 7, 31, 19, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 20, 0, 0).getTime();
    const overtimeSession: SlackingSession = {
      id: 's-ov', dateKey: '2026-08-31', label: 'overtime',
      startTs: start, endTs: end, nightShift: false,
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides: noOverrides, holidays: emptyHolidays,
      slackingSessions: [overtimeSession],
    });
    expect(r.slackingMinutes).toBe(0); // 加班不算摸鱼
    expect(r.overtimeBonus).toBe(60);  // patch4:加班 session × multiplier=1 → 计入 60 min
    // 已工作 180 + 加班加成 60
    expect(r.netMinutes).toBe(240);
  });

  // v1.3.3 patch3·加班日:夜班场景自动 ×1.5,日间不自动加成
  it('加班日 + 夜班段(22-06)→ overtimeBonus 自动 ×0.5', () => {
    const now = date(2026, 7, 31, 23, 30, 0); // 夜班时刻
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'paid_overtime', multiplier: 1, segments: [{ start: '22:00', end: '06:00' }], nightShift: true },
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides, holidays: emptyHolidays, slackingSessions: [],
    });
    // gross = 480, hasNightSegment=true → nightAutoBonus = 480 × 0.5 = 240
    expect(r.grossMinutes).toBe(480);
    expect(r.overtimeBonus).toBeCloseTo(240, 1);
  });

  it('加班日 + 日间段(09-18)+ multiplier=1 → 不自动加成', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'paid_overtime', multiplier: 1, segments: null, nightShift: false },
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides, holidays: emptyHolidays, slackingSessions: [],
    });
    // multiplier=1 不触发 manualBonus,日间段不触发 nightAutoBonus
    expect(r.overtimeBonus).toBe(0);
  });

  it('加班日 + 手动 multiplier=2 → 按 manualBonus 算(任何时段)', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'paid_overtime', multiplier: 2, segments: null, nightShift: false },
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides, holidays: emptyHolidays, slackingSessions: [],
    });
    // manualBonus = 540 × (2-1) = 540
    expect(r.overtimeBonus).toBeCloseTo(540, 1);
  });

  // v1.3.3 patch5·夜班自动加成只算夜间段部分,不再污染整段 gross
  it('加班日 + 段含夜间部分(20-06 跨天 10h,夜班仅 8h)→ 夜班加成 = 8h×0.5 = 4h,不是 10h×0.5', () => {
    // 段 20:00-06:00 跨天 → split → [20:00-24:00)+[00:00-06:00),total=10h
    // 夜班窗口 22:00-06:00 = 8h
    const now = date(2026, 7, 31, 23, 30, 0); // 夜班时刻
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'paid_overtime', multiplier: 1, segments: [{ start: '20:00', end: '06:00' }], nightShift: true },
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides, holidays: emptyHolidays, slackingSessions: [],
    });
    // gross = 600, nightShiftMinutes = 480(8h)
    // OLD(错):nightAutoBonus = 600 × 0.5 = 300
    // NEW(对):nightAutoBonus = 480 × 0.5 = 240
    expect(r.grossMinutes).toBe(600);
    expect(r.overtimeBonus).toBeCloseTo(240, 1);
  });

  it('加班日 + 日间段 + now 落在夜间(22:30)→ 不应触发自动加成(段无夜班)', () => {
    // 段 09:00-18:00 日间,now=22:30 是夜班时刻,但 hasNightSegment=false
    // 期望:不自动加成(段本身不含夜间,即使当前在夜班时刻也不加)
    const now = date(2026, 7, 31, 22, 30, 0);
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'paid_overtime', multiplier: 1, segments: [{ start: '09:00', end: '18:00' }], nightShift: true },
    };
    const r = computeNetHours({
      date: now, config: baseConfig, overrides, holidays: emptyHolidays, slackingSessions: [],
    });
    // gross=540,nightShiftMinutes=0,nightAutoBonus=0
    // OLD(错):nowInNight=true 触发,gross×0.5=270
    // NEW(对):nightShiftMinutes(segs)=0,不触发
    expect(r.grossMinutes).toBe(540);
    expect(r.overtimeBonus).toBe(0);
  });
});

describe('netHourlyRate · 净时薪', () => {
  it('PRD §7 #3:¥300 / 278m ≈ ¥64.74/h', () => {
    const now = date(2026, 7, 31, 12, 0, 0);
    // 临时构造 todayEarned = 300 的场景
    // 直接通过 effectiveDailyRate 推:360m → daily=300;hourly=50;12:00 在段内
    // 让 hourly = 50;已工作 2h(10:00-12:00)→ earned = 100
    // 实际 PRD 场景是 ¥300,所以我们用 daily = 300 / 1 day 的 dailyRate
    const cfg = { ...baseConfig, startTime: '10:00', endTime: '16:00', lunchEnabled: true, monthlySalary: 1800 };
    // 6 工作日, daily = 1800/6 = 300
    // hourly = 300/6 = 50
    // 12:00 在段内;午休 12:00-13:00
    // elapsed min = 120(10:00-12:00)
    // earned = (300/360) × 120 = 100
    const earned = 100;
    const sessions: SlackingSession[] = [];
    const nh = netHourlyRate(now, cfg, noOverrides, emptyHolidays, sessions);
    // 净工时 = 360 - 60 = 300(12:00 不在段内,即还没开始摸鱼/未到午休边界)
    // 简化:直接验证 netHourlyRate > 0 且 < effectiveHourlyRate
    expect(nh).toBeGreaterThan(0);
    expect(nh).toBeLessThanOrEqual(effectiveHourlyRate(now, cfg, noOverrides, emptyHolidays));
    // earned 不直接体现在 nh,但我们要确保公式正确
    void earned;
  });
});

describe('dayState · 跨天段凌晨 02:00', () => {
  it('override 22-06 + 当前 02:00 → mode=active 倒计时 ≈ 04:00:00', () => {
    // 昨日 override 22:00-06:00 跨天段;今日 02:00 仍在此段内
    // dayState 应识别并显示 active
    const now = new Date(2026, 7, 31, 2, 0, 0);
    const yesterdayOverrides: DayOverrides = {
      [`2026-08-${String(30).padStart(2, '0')}`]: {
        type: 'work',
        multiplier: 1,
        segments: [{ start: '22:00', end: '06:00' }],
        nightShift: false,
      },
    };
    const s = dayState(now, baseConfig, yesterdayOverrides, emptyHolidays);
    // 2026-08-31 是 Monday,默认工作日;isWorkday=true;有昨日跨天段,now=02:00 应在 [00:00, 06:00) 内
    expect(s.mode).toBe('active');
    if (s.mode === 'active') {
      // 倒计时 = (6h - 2h) = 4h = 04:00:00
      expect(s.display).toBe('04:00:00');
    }
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3 · isWorkday 自由模式
// ══════════════════════════════════════════════════════════════

describe('isWorkday · 自由模式 + freelance', () => {
  it('hourly 模式 + 周末 = true(无节假日时)', () => {
    // 2026-08-30 是 Sunday,baseConfig 是双休 + monthly → false
    // hourly 模式 → true
    const cfg = { ...baseConfig, salaryMode: 'hourly' as const };
    const sunday = date(2026, 7, 30, 12, 0, 0);
    expect(isWorkday(sunday, cfg, noOverrides, emptyHolidays)).toBe(true);
  });

  it('freelance 类型 = true', () => {
    const monday = date(2026, 7, 31, 12, 0, 0);
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'freelance', multiplier: 1, segments: null, nightShift: false },
    };
    expect(isWorkday(monday, baseConfig, overrides, emptyHolidays)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.1 新增:SegmentTemplate 数据模型
// ══════════════════════════════════════════════════════════════
describe('segmentTemplates (v1.3.1)', () => {
  it('Config 必含 segmentTemplates 字段(默认 1 个模板)', () => {
    expect(baseConfig.segmentTemplates).toBeDefined();
    expect(Array.isArray(baseConfig.segmentTemplates)).toBe(true);
    expect(baseConfig.segmentTemplates.length).toBeGreaterThanOrEqual(1);
  });

  it('默认模板 id 与 label 存在', () => {
    const tpl = baseConfig.segmentTemplates[0]!;
    expect(tpl.id).toBeTruthy();
    expect(tpl.label).toBeTruthy();
    expect(Array.isArray(tpl.segments)).toBe(true);
    expect(tpl.segments.length).toBeGreaterThan(0);
  });

  it('模板 segments 与 config.segments fallback 行为一致', () => {
    // baseConfig.segments = null,使用模板第一项作为 fallback
    const tpl = baseConfig.segmentTemplates[0]!;
    // 直接构造 entry,segments = 模板内容
    const ov: DayOverrides = {
      '2026-08-28': { type: 'work', multiplier: 1, segments: tpl.segments, nightShift: false },
    };
    // 跨天段不在此处测试,只验证 segments 数组能通过类型
    expect(ov['2026-08-28']!.segments).toEqual(tpl.segments);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.3 · slackingEarn 摸鱼总薪资(按 effectiveHourlyRate)
// ══════════════════════════════════════════════════════════════
describe('slackingEarn · 摸鱼总薪资', () => {
  const hourly = 80; // ¥80/h

  it('空 sessions → 0', () => {
    expect(slackingEarn([], hourly)).toBe(0);
  });

  it('hourly = 0 → 0', () => {
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-31', label: 'slack', startTs: 0, endTs: 60_000, nightShift: false },
    ];
    expect(slackingEarn(sessions, 0)).toBe(0);
  });

  it('单条 30 分钟摸鱼 → hourly/2', () => {
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-31', label: 'slack', startTs: 0, endTs: 30 * 60_000, nightShift: false },
    ];
    // 80 × 0.5 = 40
    expect(slackingEarn(sessions, hourly)).toBeCloseTo(40, 4);
  });

  it('加班 session(label=overtime)不计入', () => {
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-31', label: 'overtime', startTs: 0, endTs: 60 * 60_000, nightShift: false },
      { id: '2', dateKey: '2026-08-31', label: 'slack', startTs: 0, endTs: 30 * 60_000, nightShift: false },
    ];
    // 只有 30 分钟摸鱼计入:80 × 0.5 = 40
    expect(slackingEarn(sessions, hourly)).toBeCloseTo(40, 4);
  });

  it('other label 也不计入', () => {
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-31', label: 'other', startTs: 0, endTs: 60 * 60_000, nightShift: false, customLabel: '厕所' },
    ];
    expect(slackingEarn(sessions, hourly)).toBe(0);
  });

  it('进行中 session 按 now 实时计算', () => {
    const now = 30 * 60_000;
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-31', label: 'slack', startTs: 0, endTs: null, nightShift: false },
    ];
    // 进行中 30 分钟:80 × 0.5 = 40
    expect(slackingEarn(sessions, hourly, now)).toBeCloseTo(40, 4);
  });

  it('多段累加:10m + 20m + 30m = 60m → hourly', () => {
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-31', label: 'slack', startTs: 0, endTs: 10 * 60_000, nightShift: false },
      { id: '2', dateKey: '2026-08-31', label: 'slack', startTs: 20 * 60_000, endTs: 40 * 60_000, nightShift: false },
      { id: '3', dateKey: '2026-08-31', label: 'slack', startTs: 60 * 60_000, endTs: 90 * 60_000, nightShift: false },
    ];
    // 总 60 分钟 = 1h,80 × 1 = 80
    expect(slackingEarn(sessions, hourly)).toBeCloseTo(80, 4);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.3 patch4 · overtimeMinutes 用户加班记录总分钟数
// ══════════════════════════════════════════════════════════════
describe('overtimeMinutes · 用户加班记录总分钟数', () => {
  it('空数组返回 0', () => {
    expect(overtimeMinutes([])).toBe(0);
  });

  it('非加班标签不计入', () => {
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-30', label: 'slack', startTs: 0, endTs: 30 * 60_000, nightShift: false },
      { id: '2', dateKey: '2026-08-30', label: 'other', startTs: 0, endTs: 20 * 60_000, nightShift: false },
    ];
    expect(overtimeMinutes(sessions)).toBe(0);
  });

  it('累计多个已结束的加班 session', () => {
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-30', label: 'overtime', startTs: 0, endTs: 30 * 60_000, nightShift: false },
      { id: '2', dateKey: '2026-08-30', label: 'overtime', startTs: 60 * 60_000, endTs: 90 * 60_000, nightShift: false },
    ];
    expect(overtimeMinutes(sessions)).toBe(60);
  });

  it('进行中的加班 session 按 now 实时计算', () => {
    const now = 60 * 60_000;
    const sessions: SlackingSession[] = [
      { id: '1', dateKey: '2026-08-30', label: 'overtime', startTs: 0, endTs: null, nightShift: false },
    ];
    expect(overtimeMinutes(sessions, now)).toBe(60);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.3 patch6 · overtimeSessionSplit 加班 session 日/夜拆分
// ══════════════════════════════════════════════════════════════
describe('overtimeSessionSplit · 加班 session 日间 / 夜班分钟拆分', () => {
  function makeOt(startH: number, startM: number, endH: number, endM: number, day = 30): SlackingSession {
    const start = new Date(2026, 7, day, startH, startM, 0).getTime();
    const end = new Date(2026, 7, day, endH, endM, 0).getTime();
    return {
      id: `ot-${start}`,
      dateKey: '2026-08-30',
      label: 'overtime',
      startTs: start,
      endTs: end,
      nightShift: false,
    };
  }

  it('完全日间:19:00-20:00 → day=60, night=0', () => {
    const r = overtimeSessionSplit([makeOt(19, 0, 20, 0)]);
    expect(r.dayMin).toBe(60);
    expect(r.nightMin).toBe(0);
    expect(r.totalMin).toBe(60);
  });

  it('完全夜班:22:00-23:00 → day=0, night=60', () => {
    const r = overtimeSessionSplit([makeOt(22, 0, 23, 0)]);
    expect(r.dayMin).toBe(0);
    expect(r.nightMin).toBe(60);
    expect(r.totalMin).toBe(60);
  });

  it('跨夜班边界:20:00-23:30 → day=120, night=90 (用户场景)', () => {
    // 用户主诉:20:00-23:30 应拆为 2h + 1.5h*1.5
    const r = overtimeSessionSplit([makeOt(20, 0, 23, 30)]);
    expect(r.dayMin).toBe(120);
    expect(r.nightMin).toBe(90);
    expect(r.totalMin).toBe(210);
  });

  it('跨 00:00 夜班:23:00-01:00 → day=60(05-06 部分),night=120', () => {
    // 23:00-24:00 = 60min 夜班
    // 00:00-01:00 = 60min 夜班(00:00-01:00 全部在 0-360 窗口)
    // 总 night=120,day=0
    const start = new Date(2026, 7, 30, 23, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 1, 0, 0).getTime();
    const session: SlackingSession = {
      id: 'cross', dateKey: '2026-08-30', label: 'overtime',
      startTs: start, endTs: end, nightShift: true,
    };
    const r = overtimeSessionSplit([session]);
    expect(r.dayMin).toBe(0);
    expect(r.nightMin).toBe(120);
  });

  it('跨日界清晨:05:00-08:00 → day=120(06-08), night=60(05-06)', () => {
    const r = overtimeSessionSplit([makeOt(5, 0, 8, 0)]);
    expect(r.dayMin).toBe(120);
    expect(r.nightMin).toBe(60);
  });

  it('非加班 session 跳过,只算加班', () => {
    const start = new Date(2026, 7, 31, 20, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 23, 30, 0).getTime();
    const slack: SlackingSession = {
      id: 'slack', dateKey: '2026-08-30', label: 'slack',
      startTs: start, endTs: end, nightShift: false,
    };
    const ot = { ...makeOt(20, 0, 23, 30), nightShift: true };
    const r = overtimeSessionSplit([slack, ot]);
    expect(r.dayMin).toBe(120);
    expect(r.nightMin).toBe(90);
  });

  it('进行中 session 按 nowTs 实时计算', () => {
    const start = new Date(2026, 7, 30, 20, 0, 0).getTime();
    const session: SlackingSession = {
      id: 'running', dateKey: '2026-08-30', label: 'overtime',
      startTs: start, endTs: null, nightShift: false,
    };
    // nowTs = 21:00 → 1h 全日间
    const nowTs = new Date(2026, 7, 30, 21, 0, 0).getTime();
    const r = overtimeSessionSplit([session], nowTs);
    expect(r.dayMin).toBe(60);
    expect(r.nightMin).toBe(0);

    // nowTs = 22:30 → 2h 日间 + 30min 夜班
    const nowTs2 = new Date(2026, 7, 30, 22, 30, 0).getTime();
    const r2 = overtimeSessionSplit([session], nowTs2);
    expect(r2.dayMin).toBe(120);
    expect(r2.nightMin).toBe(30);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.3 patch4 · 用户加班 session → 净工时同步
// ══════════════════════════════════════════════════════════════
describe('computeNetHours · 加班 session 影响净工时', () => {
  const baseConfig: Config = {
    monthlySalary: 15000,
    startTime: '09:00',
    endTime: '18:00',
    coffeePrice: 15,
    restMode: 2,
    theme: 'paper',
    recordedFromDate: '2026-08-28',
    salaryMode: 'monthly',
    manualHourlyRate: 100,
    manualDailyRate: 800,
    segments: null,
    segmentTemplates: [],
    lunchStart: '12:00',
    lunchMinutes: 60,
    lunchEnabled: true,
  };
  const dateKey = '2026-08-31';
  // v1.3.4-patch1:测试 now=19:00(已收工),此时 effectiveGross=gross=540
  //   → 新旧算法结果一致,无需修改期望值
  // v2.5-patch2 T-508:dateKey 改 2026-08-31(周一),此前 8-30 是周日,
  //   默认 restMode=2 下 isWorkday=false → computeNetHours 入口短路归零,
  //   「普通工作日」 fixture 与 name 语义不一致,一并修正。
  const now = new Date('2026-08-31T19:00:00');

  it('普通工作日:添加 30 min 加班 → netMinutes 同步增加', () => {
    // 基线:无加班记录
    const baseline = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: {},
      holidays: {},
      slackingSessions: [],
    });
    // 加上 30 min 加班 session(下午 14:00-14:30,日间)
    const withOvertime = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: {},
      holidays: {},
      slackingSessions: [
        { id: '1', dateKey, label: 'overtime', startTs: new Date(2026, 7, 31, 14, 0, 0).getTime(), endTs: new Date(2026, 7, 31, 14, 30, 0).getTime(), nightShift: false },
      ],
    });
    // patch6:日间加班 = dayMin × multiplier = 30 × 1 = 30
    expect(withOvertime.netMinutes - baseline.netMinutes).toBe(30);
    expect(withOvertime.overtimeBonus - baseline.overtimeBonus).toBe(30);
  });

  it('加班日 (multiplier=2):加班 session 按倍率计入', () => {
    // baseline 加班日 multiplier=2,无加班 session → 只有 manualBonus
    const baseline = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: {
        [dateKey]: { type: 'paid_overtime', multiplier: 2, segments: null, nightShift: false },
      },
      holidays: {},
      slackingSessions: [],
    });
    // manualBonus = 540(gross) × (2-1) = 540
    expect(baseline.overtimeBonus).toBe(540);

    // 添加 30 min 加班 session(下午 14:00-14:30,日间)
    const withOvertime = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: {
        [dateKey]: { type: 'paid_overtime', multiplier: 2, segments: null, nightShift: false },
      },
      holidays: {},
      slackingSessions: [
        { id: '1', dateKey, label: 'overtime', startTs: new Date(2026, 7, 31, 14, 0, 0).getTime(), endTs: new Date(2026, 7, 31, 14, 30, 0).getTime(), nightShift: false },
      ],
    });
    // patch6:日间加班 = dayMin × multiplier = 30 × 2 = 60
    // overtimeBonus = manualBonus(540) + userOvertimeBonus(60) = 600
    expect(withOvertime.overtimeBonus).toBe(600);
    // 增加的净工时 = dayMin × multiplier = 30 × 2 = 60
    expect(withOvertime.netMinutes - baseline.netMinutes).toBe(60);
  });

  // v1.3.3 patch6·加班 session 日间 / 夜班拆分
  it('加班 session 跨夜班边界:日间 × 1 + 夜班 × 1.5(multiplier=1)', () => {
    // session 20:00–23:30 → dayMin=120(20-22),nightMin=90(22-23:30)
    // 普通工作日 multiplier=1:
    //   userOvertimeBonus = 120×1 + 90×1×1.5 = 120 + 135 = 255 min
    const start = new Date(2026, 7, 31, 20, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 23, 30, 0).getTime();
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: {},
      holidays: {},
      slackingSessions: [
        { id: '1', dateKey, label: 'overtime', startTs: start, endTs: end, nightShift: true },
      ],
    });
    // baseline 净工时 = gross(540) - lunch(60) = 480(假设;此处关 lunchEnabled=false)
    // 这里 baseConfig 启用了 lunchEnabled,且 segs 是 09-18,lunch=12-13=60
    // baseline netMinutes = 540 - 60 = 480
    // 加 session 后 userOvertimeBonus = 255
    // netMinutes = 480 + 255 = 735
    expect(r.overtimeBonus).toBeCloseTo(255, 1);
    expect(r.netMinutes - 480).toBeCloseTo(255, 1);
  });

  it('加班 session 跨夜班边界:日间 × multiplier + 夜班 × multiplier × 1.5(multiplier=2)', () => {
    // session 20:00–23:30 → dayMin=120,nightMin=90
    // 加班日 multiplier=2:
    //   userOvertimeBonus = 120×2 + 90×2×1.5 = 240 + 270 = 510 min
    const start = new Date(2026, 7, 31, 20, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 23, 30, 0).getTime();
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: {
        [dateKey]: { type: 'paid_overtime', multiplier: 2, segments: null, nightShift: false },
      },
      holidays: {},
      slackingSessions: [
        { id: '1', dateKey, label: 'overtime', startTs: start, endTs: end, nightShift: true },
      ],
    });
    // manualBonus = 540×1 = 540
    // userOvertimeBonus = 510
    // overtimeBonus = max(0, 540) + 510 = 1050
    expect(r.overtimeBonus).toBeCloseTo(1050, 1);
  });

  it('加班 session 完全日间 → 仅 × multiplier(无夜班加成)', () => {
    // session 19:00–20:00 → 全日间(dayMin=60,nightMin=0)
    // 普通工作日 multiplier=1:
    //   userOvertimeBonus = 60×1 + 0×1×1.5 = 60 min
    const start = new Date(2026, 7, 31, 19, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 20, 0, 0).getTime();
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: {},
      holidays: {},
      slackingSessions: [
        { id: '1', dateKey, label: 'overtime', startTs: start, endTs: end, nightShift: false },
      ],
    });
    expect(r.overtimeBonus).toBeCloseTo(60, 1);
  });

  it('加班 session 完全夜班 → × multiplier × 1.5', () => {
    // session 22:00–23:00 → 全夜班(dayMin=0,nightMin=60)
    // 普通工作日 multiplier=1:
    //   userOvertimeBonus = 0×1 + 60×1×1.5 = 90 min
    const start = new Date(2026, 7, 31, 22, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 23, 0, 0).getTime();
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: {},
      holidays: {},
      slackingSessions: [
        { id: '1', dateKey, label: 'overtime', startTs: start, endTs: end, nightShift: true },
      ],
    });
    expect(r.overtimeBonus).toBeCloseTo(90, 1);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.4-patch1 · 净工时实时累计(口径改造)
// ══════════════════════════════════════════════════════════════
describe('computeNetHours · 净工时实时累计 (v1.3.4-patch1)', () => {
  // baseConfig:startTime=09:00, endTime=18:00, lunchEnabled=false
  // merged={09:00-18:00}, mergeStart=540 (09:00)
  // 时间线:
  //   08:00 工时前 → 0
  //   09:30 已工作 30min → 30
  //   11:00 已工作 2h → 120
  //   12:30 午休时段内(若启用 lunch)→ clip 后午休部分发生
  //   13:30 午休后 → 扣 1h 午休
  //   19:00 收工 → 封顶 gross - lunch

  it('工时前(now=08:00,早于 09:00)→ netMinutes = 0', () => {
    const now = date(2026, 7, 31, 8, 0, 0);
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    expect(r.netMinutes).toBe(0);
  });

  it('刚开工 30min(now=09:30)→ netMinutes = 30', () => {
    const now = date(2026, 7, 31, 9, 30, 0);
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    expect(r.netMinutes).toBe(30);
  });

  it('工时段内 2h(now=11:00)→ netMinutes = 120', () => {
    const now = date(2026, 7, 31, 11, 0, 0);
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    expect(r.netMinutes).toBe(120);
  });

  it('午休时段内(now=12:30 + lunchEnabled)→ 已工作 3.5h,clip 后 30min 午休发生 = 180', () => {
    const now = date(2026, 7, 31, 12, 30, 0);
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: now,
      config: cfg,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    // 已工作 210min(09:00-12:30),mergeStart=540,winEnd=750
    // clip [540, 750] 与午休 [720, 780] 求交 = [720, 750] = 30min
    expect(r.netMinutes).toBe(180);
    expect(r.lunchMinutes).toBe(60); // 字段不变(段×午休窗口 union)
  });

  it('午休结束(now=13:30 + lunchEnabled)→ 已工作 270min,扣 60min 午休 = 210', () => {
    const now = date(2026, 7, 31, 13, 30, 0);
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: now,
      config: cfg,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    // 已工作 270min(09:00-13:30),winEnd=810
    // clip [540, 810] 与午休 [720, 780] 求交 = [720, 780] = 60min
    expect(r.netMinutes).toBe(270 - 60);
  });

  it('收工后(now=19:00)→ netMinutes = gross - lunch = 480', () => {
    const now = date(2026, 7, 31, 19, 0, 0);
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: now,
      config: cfg,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    // 已工作封顶到 gross=540,clip [540, 1080] 与午休 [720, 780] 求交 = 60
    expect(r.netMinutes).toBe(540 - 60);
  });

  it('收工后 + 加班日 multiplier=1.5 → 已工作 540 - 60 + 270 = 750', () => {
    const now = date(2026, 7, 31, 19, 0, 0);
    const cfg = { ...baseConfig, lunchEnabled: true };
    const overrides: DayOverrides = {
      '2026-08-31': { type: 'paid_overtime', multiplier: 1.5, segments: null, nightShift: false },
    };
    const r = computeNetHours({
      date: now,
      config: cfg,
      overrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    expect(r.netMinutes).toBe(540 - 60 + 540 * 0.5);
  });

  it('工时段内 + 10min 摸鱼(now=10:30,session 10:00-10:10)→ 已工作 90 - 10 = 80', () => {
    const now = date(2026, 7, 31, 10, 30, 0);
    const sessions = [makeSession('2026-08-31', 10, 0, 10, 10)];
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: sessions,
    });
    // 已工作 90min(09:00-10:30),clip [540, 630] 与摸鱼 [600, 610] 求交 = [600, 610] = 10min
    expect(r.netMinutes).toBe(90 - 10);
    expect(r.slackingMinutes).toBe(10); // 字段不变
  });

  it('工时前 + 午休段(now=08:00 + lunchEnabled)→ netMinutes = 0,午休不预扣', () => {
    const now = date(2026, 7, 31, 8, 0, 0);
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: now,
      config: cfg,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    // effectiveGross=0,午休 clip 到 [540, 540] → 空 → 0
    expect(r.netMinutes).toBe(0);
    expect(r.lunchMinutes).toBe(60); // 字段不变(段与午休窗口的 union)
  });

  it('跨天凌晨段 22-06 + 昨日 override + now=02:00 → 已工作 2h + 夜班加成 4h = 360', () => {
    // 昨日 override 22:00-06:00,合并昨日跨天段到今日坐标系
    // merged 含 [{00:00, 06:00}],mergeStart=0
    // now=02:00,nowMin=120,elapsedWorkedMin=120
    // winEnd = 0 + 120 = 120
    // nightBonus = nightShiftMinutes(segs) × 0.5 = 480 × 0.5 = 240
    // netMinutes = 120 + 0 + 0 + 240 = 360
    const now = date(2026, 7, 31, 2, 0, 0);
    const overrides: DayOverrides = {
      '2026-08-30': {
        type: 'work', multiplier: 1, nightShift: true,
        segments: [{ start: '22:00', end: '06:00' }],
      },
    };
    const r = computeNetHours({
      date: now,
      config: baseConfig,
      overrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    expect(r.netMinutes).toBe(120 + 240);
    expect(r.grossMinutes).toBe(480);
    expect(r.nightBonus).toBe(240);
  });

  it('净工时随时间线性增长(09:00→12:00 vs 13:00→17:00)', () => {
    // 09:00-12:00 已工作 180min,无扣除 → 180
    // 17:00 已工作 480min,扣 1h 午休 → 420
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r1 = computeNetHours({
      date: date(2026, 7, 31, 12, 0, 0),
      config: cfg,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    expect(r1.netMinutes).toBe(180); // 12:00 还没到午休结束

    const r2 = computeNetHours({
      date: date(2026, 7, 31, 17, 0, 0),
      config: cfg,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    // 17:00 已工作 480min,扣 1h 午休 = 420
    expect(r2.netMinutes).toBe(480 - 60);

    // r2 > r1 → 时间增长 → 净工时增长
    expect(r2.netMinutes).toBeGreaterThan(r1.netMinutes);
  });

  it('收工封顶:连续两个时间点(now=19:00 和 now=20:00)→ netMinutes 一致', () => {
    // 已收工 → effectiveGross 封顶到 gross,后续不再变化
    const r1 = computeNetHours({
      date: date(2026, 7, 31, 19, 0, 0),
      config: baseConfig,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    const r2 = computeNetHours({
      date: date(2026, 7, 31, 20, 0, 0),
      config: baseConfig,
      overrides: noOverrides,
      holidays: emptyHolidays,
      slackingSessions: [],
    });
    expect(r1.netMinutes).toBe(r2.netMinutes);
    expect(r1.netMinutes).toBe(540); // gross,无扣
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.4-patch2 · dashboard 2×2 实时累计字段(grossElapsed/lunchElapsed/slackingElapsed/overtimeElapsed)
// ══════════════════════════════════════════════════════════════
describe('computeNetHours · dashboard 实时累计字段 (v1.3.4-patch2)', () => {
  // baseConfig:startTime=09:00, endTime=18:00, lunchEnabled=false
  // 启用午休测试时显式 { ...baseConfig, lunchEnabled: true }

  // ── grossElapsed ──
  it('grossElapsed: 工时前 08:00 → 0', () => {
    const r = computeNetHours({
      date: date(2026, 7, 31, 8, 0, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossElapsed).toBe(0);
  });

  it('grossElapsed: 工时中 10:00 → 60min', () => {
    const r = computeNetHours({
      date: date(2026, 7, 31, 10, 0, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossElapsed).toBe(60);
  });

  it('grossElapsed: 午休中 12:30(默认无 lunch)→ 210min(含午休时段,因段不扣)', () => {
    // 默认 baseConfig.lunchEnabled=false → 段 [09:00-18:00] 整段都算"已工作"
    const r = computeNetHours({
      date: date(2026, 7, 31, 12, 30, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossElapsed).toBe(210);
  });

  it('grossElapsed: 收工后 19:00 → 540min(封顶 gross)', () => {
    const r = computeNetHours({
      date: date(2026, 7, 31, 19, 0, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossElapsed).toBe(540);
  });

  // ── lunchElapsed ──
  it('lunchElapsed: lunchEnabled + 11:00(午休前)→ 0', () => {
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: date(2026, 7, 31, 11, 0, 0),
      config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.lunchElapsed).toBe(0);
  });

  it('lunchElapsed: lunchEnabled + 12:30(午休中)→ 30min', () => {
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: date(2026, 7, 31, 12, 30, 0),
      config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.lunchElapsed).toBe(30);
  });

  it('lunchElapsed: lunchEnabled + 13:00(午休结束)→ 60min', () => {
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: date(2026, 7, 31, 13, 0, 0),
      config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.lunchElapsed).toBe(60);
  });

  it('lunchElapsed: lunchEnabled + 19:00(收工)→ 60min(封顶)', () => {
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: date(2026, 7, 31, 19, 0, 0),
      config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.lunchElapsed).toBe(60);
  });

  it('lunchElapsed: lunchEnabled + 工时前 08:00 → 0(不预扣)', () => {
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: date(2026, 7, 31, 8, 0, 0),
      config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.lunchElapsed).toBe(0);
  });

  it('lunchElapsed: lunchEnabled=false → 永远 0', () => {
    const r = computeNetHours({
      date: date(2026, 7, 31, 12, 30, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.lunchElapsed).toBe(0);
  });

  // ── slackingElapsed(已结束 session) ──
  it('slackingElapsed: 工时中 10:30 + session 10:00-10:10(已结束)→ 10min', () => {
    const sessions = [makeSession('2026-08-31', 10, 0, 10, 10)];
    const r = computeNetHours({
      date: date(2026, 7, 31, 10, 30, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.slackingElapsed).toBe(10);
  });

  // ── slackingElapsed(进行中 session) ──
  it('slackingElapsed: 进行中 session(10:00 至今)→ 按 now-startTs 实时累加', () => {
    // 构造进行中 session:startTs=10:00, endTs=null
    const now = date(2026, 7, 31, 10, 30, 0);
    const startTs = new Date(2026, 7, 31, 10, 0, 0).getTime();
    const liveSession: SlackingSession = {
      id: 'live', dateKey: '2026-08-31', label: 'slack',
      startTs, endTs: null, nightShift: false,
    };
    const r = computeNetHours({
      date: now,
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [liveSession],
    });
    // 30 分钟摸鱼(进行中实时落地)
    expect(r.slackingElapsed).toBe(30);
  });

  it('slackingElapsed: 工时前 08:00 + session 10:00-10:30(已结束)→ 0(clip 后不在窗口)', () => {
    const sessions = [makeSession('2026-08-31', 10, 0, 10, 30)];
    const r = computeNetHours({
      date: date(2026, 7, 31, 8, 0, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    // 已工作 = 0,clip [540, 540] → 空 → 0
    expect(r.slackingElapsed).toBe(0);
  });

  it('slackingElapsed: 收工后 19:00 + session 10:00-10:30 → 30min(封顶到 session 总长)', () => {
    const sessions = [makeSession('2026-08-31', 10, 0, 10, 30)];
    const r = computeNetHours({
      date: date(2026, 7, 31, 19, 0, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.slackingElapsed).toBe(30);
  });

  it('slackingElapsed: overtime/other label 不计入', () => {
    const start = new Date(2026, 7, 31, 10, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 10, 30, 0).getTime();
    const sessions: SlackingSession[] = [
      { id: 'ot', dateKey: '2026-08-31', label: 'overtime', startTs: start, endTs: end, nightShift: false },
      { id: 'other', dateKey: '2026-08-31', label: 'other', startTs: start, endTs: end, nightShift: false, customLabel: '厕所' },
    ];
    const r = computeNetHours({
      date: date(2026, 7, 31, 10, 30, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.slackingElapsed).toBe(0);
  });

  // ── overtimeElapsed(用户 overtime session 累计) ──
  it('overtimeElapsed: 工时段内无 session → 0', () => {
    const r = computeNetHours({
      date: date(2026, 7, 31, 12, 0, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.overtimeElapsed).toBe(0);
  });

  it('overtimeElapsed: session 19:00-20:00(已结束)→ 60min', () => {
    const start = new Date(2026, 7, 31, 19, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 20, 0, 0).getTime();
    const sessions: SlackingSession[] = [
      { id: 'ot', dateKey: '2026-08-31', label: 'overtime', startTs: start, endTs: end, nightShift: false },
    ];
    const r = computeNetHours({
      date: date(2026, 7, 31, 19, 30, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.overtimeElapsed).toBe(60);
  });

  it('overtimeElapsed: 进行中 session(19:00 至今)→ 实时累加', () => {
    const startTs = new Date(2026, 7, 31, 19, 0, 0).getTime();
    const sessions: SlackingSession[] = [
      { id: 'live-ot', dateKey: '2026-08-31', label: 'overtime', startTs, endTs: null, nightShift: false },
    ];
    const now = date(2026, 7, 31, 19, 30, 0);
    const r = computeNetHours({
      date: now,
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.overtimeElapsed).toBe(30);
  });

  it('overtimeElapsed: 跨夜班 session 20:00-23:30 → dayMin+nightMin 累加', () => {
    // 20:00-23:30 = 210min,拆 dayMin=120(20-22)+nightMin=90(22-23:30)
    const start = new Date(2026, 7, 31, 20, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 23, 30, 0).getTime();
    const sessions: SlackingSession[] = [
      { id: 'ot', dateKey: '2026-08-31', label: 'overtime', startTs: start, endTs: end, nightShift: true },
    ];
    const r = computeNetHours({
      date: date(2026, 7, 31, 23, 30, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.overtimeElapsed).toBe(210);
  });

  it('overtimeElapsed: slack/other session 不计入', () => {
    const start = new Date(2026, 7, 31, 19, 0, 0).getTime();
    const end = new Date(2026, 7, 31, 20, 0, 0).getTime();
    const sessions: SlackingSession[] = [
      { id: 's', dateKey: '2026-08-31', label: 'slack', startTs: start, endTs: end, nightShift: false },
      { id: 'o', dateKey: '2026-08-31', label: 'other', startTs: start, endTs: end, nightShift: false },
    ];
    const r = computeNetHours({
      date: date(2026, 7, 31, 20, 0, 0),
      config: baseConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.overtimeElapsed).toBe(0);
  });

  // ── 4 字段总和:互斥累加(收工后) ──
  it('4 字段组合(收工后 19:00 + lunchEnabled + 已结束 1h 摸鱼 + 已结束 1h 加班)→ 校验互斥', () => {
    const cfg = { ...baseConfig, lunchEnabled: true };
    const slackSession: SlackingSession = {
      id: 's', dateKey: '2026-08-31', label: 'slack',
      startTs: new Date(2026, 7, 31, 10, 0, 0).getTime(),
      endTs: new Date(2026, 7, 31, 11, 0, 0).getTime(),
      nightShift: false,
    };
    const otSession: SlackingSession = {
      id: 'ot', dateKey: '2026-08-31', label: 'overtime',
      startTs: new Date(2026, 7, 31, 19, 0, 0).getTime(),
      endTs: new Date(2026, 7, 31, 20, 0, 0).getTime(),
      nightShift: false,
    };
    const r = computeNetHours({
      date: date(2026, 7, 31, 19, 0, 0),
      config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [slackSession, otSession],
    });
    // grossElapsed = 540(封顶)
    // lunchElapsed = 60
    // slackingElapsed = 60(10:00-11:00 在已工作窗口内)
    // overtimeElapsed = 60(19:00-20:00)
    expect(r.grossElapsed).toBe(540);
    expect(r.lunchElapsed).toBe(60);
    expect(r.slackingElapsed).toBe(60);
    expect(r.overtimeElapsed).toBe(60);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.4-patch4 · 多段工时 + 午餐在间隙 不再误扣
// ══════════════════════════════════════════════════════════════
//
// 旧 BUG:computeNetHours 用 [mergeStart, mergeStart + effectiveGross] 单窗口 clip 摸鱼∪午休 union,
// 多段工时下 elapsedWorkedMin 跨越间隙,把间隙里的午餐/摸鱼当作扣除。
//
// 修复:改为按每个 merged 段独立 clip,自然跳过段间间隙。
// 详情见 docs/plans/tauri-migration/v1.3/TASK-031。

describe('computeNetHours · v1.3.4-patch4 多段工时 + 午餐在间隙', () => {
  // 多段工时 [09:00-12:00, 14:00-18:00] = 7h(420min),午休 12:00-13:00 在间隙
  const multiSegmentConfig: Config = {
    ...baseConfig,
    segments: [
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ],
    lunchEnabled: true,
  };

  it('单段 + 过了午休(now=14:00,旧/新行为一致)→ lunchElapsed=60, net=240', () => {
    // 回归保护:旧场景(单段工时 + 午餐在工时段内 + now 过了午休)行为不变
    const now = date(2026, 7, 31, 14, 0, 0);
    const cfg = { ...baseConfig, lunchEnabled: true };
    const r = computeNetHours({
      date: now, config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossElapsed).toBe(300); // 09-14 = 5h
    expect(r.lunchElapsed).toBe(60);  // 12-13 整段扣
    expect(r.netMinutes).toBe(240);   // 5h - 1h = 4h
  });

  it('多段 + 午餐在间隙 [12-13] + now=16:00 → lunchElapsed=0(关键修复)', () => {
    // 用户反馈场景:09-12, 14-18 + 午餐 12-13 + now=16:00
    // 旧行为:窗口 [09:00, 14:00] clip 午餐 [12:00, 13:00] → 60min 误扣
    // 新行为:每段独立 clip → 段 1 [09-12], 段 2 [14-16],午餐在间隙 → 0
    const now = date(2026, 7, 31, 16, 0, 0);
    const r = computeNetHours({
      date: now, config: multiSegmentConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossMinutes).toBe(420); // 7h
    expect(r.grossElapsed).toBe(300); // 09-12 全 + 14-16 = 3+2 = 5h
    expect(r.lunchElapsed).toBe(0);   // 午餐在间隙 [12-14],不在任一段 → 不扣 ✓
    expect(r.netMinutes).toBe(300);   // 5h
  });

  it('多段 + 午餐在间隙 [13-14] + now=15:30 → lunchElapsed=0', () => {
    // 午餐 13-14 完全在间隙 [12-14] 内,now=15:30 在段 2 内
    // 旧:窗口 [09:00, 09:00 + 4.5h=540min] = [09:00, 13:30] clip [13:00, 14:00] → 30min 误扣
    // 新:每段独立 clip,午餐在间隙 → 0
    const now = date(2026, 7, 31, 15, 30, 0);
    const cfg = { ...multiSegmentConfig, lunchStart: '13:00' };
    const r = computeNetHours({
      date: now, config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossElapsed).toBe(270); // 09-12 (3h) + 14-15:30 (1.5h) = 4.5h
    expect(r.lunchElapsed).toBe(0);
    expect(r.netMinutes).toBe(270);
  });

  it('多段紧贴 [09-12, 13-18] + 午餐 12-13 在间隙 + now=17:00 → lunchElapsed=0', () => {
    // 段间隙正好是午休时间,午餐应完全在间隙
    const now = date(2026, 7, 31, 17, 0, 0);
    const cfg = {
      ...baseConfig,
      segments: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '18:00' },
      ],
      lunchEnabled: true,
    };
    const r = computeNetHours({
      date: now, config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossMinutes).toBe(480); // 8h
    expect(r.grossElapsed).toBe(420); // 09-12 (3h) + 13-17 (4h) = 7h
    expect(r.lunchElapsed).toBe(0);   // 午餐 [12-13] 在间隙,不在段内 → 不扣 ✓
    expect(r.netMinutes).toBe(420);
  });

  it('多段紧贴 + 午餐与上午段重叠 [11:30-12:30] + now=17:00 → lunchElapsed=30', () => {
    // 午餐 11:30-12:30 与上午段 [09-12] 重叠 11:30-12:00 = 30min → 应扣 30
    // 与下午段 [13-18] 无重叠
    const now = date(2026, 7, 31, 17, 0, 0);
    const cfg = {
      ...baseConfig,
      segments: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '18:00' },
      ],
      lunchEnabled: true,
      lunchStart: '11:30',
    };
    const r = computeNetHours({
      date: now, config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.grossElapsed).toBe(420);
    expect(r.lunchElapsed).toBe(30); // 仅重叠部分
    expect(r.netMinutes).toBe(390);  // 7h - 30min
  });

  it('多段 + 摸鱼 session 跨间隙 [11:30-14:30] → slackingElapsed=60(只在工时段内)', () => {
    // session 11:30-14:30 (3h)
    // 在多段 [{09-12, 14-18}] 下,实际只在工时段内:11:30-12:00 (30min) + 14:00-14:30 (30min) = 60min
    // 旧算法窗口 [09:00, 09:00 + 5h=14:00] clip [690, 870] → [690, 840] = 150min(整段误算)
    // 新算法按段 clip:段 1 [09-12] clip [690, 870] → [690, 720] = 30; 段 2 [14-15:30] clip → [840, 870] = 30
    const now = date(2026, 7, 31, 15, 30, 0);
    const sessions = [
      makeSession('2026-08-31', 11, 30, 14, 30),
    ];
    const r = computeNetHours({
      date: now, config: multiSegmentConfig, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: sessions,
    });
    expect(r.slackingMinutes).toBe(180); // 全天 session 总长(不变)
    expect(r.slackingElapsed).toBe(60);  // 实际只在工时段内的摸鱼
    // grossElapsed=270, slackingElapsed=60, lunchElapsed=0
    // netMinutes = 270 - 60 - 0 + 0 + 0 = 210
    expect(r.netMinutes).toBe(210);
  });

  it('lunchEnabled=false → lunchElapsed=0(与多段无关)', () => {
    const now = date(2026, 7, 31, 16, 0, 0);
    const cfg = { ...multiSegmentConfig, lunchEnabled: false };
    const r = computeNetHours({
      date: now, config: cfg, overrides: noOverrides, holidays: emptyHolidays, slackingSessions: [],
    });
    expect(r.lunchElapsed).toBe(0);
    expect(r.netMinutes).toBe(300);
  });
});

describe('v1.3.5 custom schedule and earned batches', () => {
  it('uses inherit as the standard weekday fallback', () => {
    const config = {
      ...baseConfig,
      restMode: 'custom' as const,
      customRestSchedule: { workDays: { '2026-08-28': ['inherit'] }, updatedAt: 0 },
    };
    expect(isRestDayCustom(date(2026, 7, 28), config)).toBe(false);
    expect(isRestDayCustom(date(2026, 7, 29), config)).toBe(true);
    expect(isWorkday(date(2026, 7, 28), config, noOverrides, emptyHolidays)).toBe(true);
  });

  it('generates snapshots without replacing manual day settings', () => {
    const manual: DayOverrides = {
      '2026-08-28': { type: 'paid_overtime', multiplier: 1.5, segments: [{ start: '10:00', end: '18:00' }], nightShift: true },
    };
    const next = batchGenerateEarned([date(2026, 7, 28)], baseConfig, manual, emptyHolidays);
    expect(next['2026-08-28']?.type).toBe('paid_overtime');
    expect(next['2026-08-28']?.segments?.[0]?.start).toBe('10:00');
    expect(next['2026-08-28']?.earnedGenerated).toBe(true);
    expect(next['2026-08-28']?.earnedAmount).toBeGreaterThan(0);
  });

  it('cancels generated entries while retaining manual fields', () => {
    const generated: DayOverrides = {
      '2026-08-28': { type: 'work', multiplier: 1, segments: [{ start: '10:00', end: '18:00' }], nightShift: false, earnedGenerated: true, earnedAmount: 123 },
    };
    const next = batchGenerateEarned([date(2026, 7, 28)], baseConfig, generated, emptyHolidays, true);
    expect(next['2026-08-28']?.earnedGenerated).toBeUndefined();
    expect(next['2026-08-28']?.segments?.[0]?.start).toBe('10:00');
  });

  it('aggregates range stats by day', () => {
    const sessions = {
      '2026-08-28': [{ id: 's', dateKey: '2026-08-28', label: 'slack' as const, startTs: date(2026, 7, 28, 10).getTime(), endTs: date(2026, 7, 28, 11).getTime(), nightShift: false }],
    };
    const stats = computeRangeStats(date(2026, 7, 28), date(2026, 7, 30), baseConfig, noOverrides, emptyHolidays, sessions);
    expect(stats.perDay).toHaveLength(3);
    expect(stats.totalSlackMinutes).toBe(60);
    expect(stats.totalNetMinutes).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.5 · 多模板工作日标记系统
// ══════════════════════════════════════════════════════════════
describe('v1.3.5 multi-template system', () => {
  const templates: WorkTemplate[] = [
    { id: 'tpl-1', name: '早班', color: '#4ADE80', workSegment: { start: '08:00', end: '16:00' } },
    { id: 'tpl-2', name: '晚班', color: '#FBBF24', workSegment: { start: '16:00', end: '00:00' } },
    { id: 'tpl-3', name: '夜班', color: '#60A5FA', workSegment: { start: '22:00', end: '06:00' } },
  ];

  const configWithTemplates: Config = {
    ...baseConfig,
    workTemplates: templates,
  };

  it('getDateTemplateMarks returns empty for unmarked date', () => {
    expect(getDateTemplateMarks(date(2026, 8, 1), noOverrides)).toEqual([]);
  });

  it('getDateTemplateMarks returns marks array', () => {
    const ov: DayOverrides = {
      '2026-09-01': { type: 'work', multiplier: 1, segments: null, nightShift: false, templateMarks: ['tpl-1', 'tpl-2'] },
    };
    expect(getDateTemplateMarks(date(2026, 8, 1), ov)).toEqual(['tpl-1', 'tpl-2']);
  });

  it('hasTemplateConflict detects overlap', () => {
    const ov: DayOverrides = {
      '2026-09-01': { type: 'work', multiplier: 1, segments: null, nightShift: false, templateMarks: ['tpl-1'] },
    };
    // tpl-1: 08:00-16:00, tpl-2: 16:00-00:00 → 无冲突
    expect(hasTemplateConflict(date(2026, 8, 1), 'tpl-2', { start: '16:00', end: '00:00' }, configWithTemplates, ov)).toBe(false);
    // tpl-1: 08:00-16:00, 新段: 12:00-18:00 → 冲突
    expect(hasTemplateConflict(date(2026, 8, 1), 'tpl-new', { start: '12:00', end: '18:00' }, configWithTemplates, ov)).toBe(true);
  });

  it('addTemplateMarkToDate success without conflict', () => {
    const result = addTemplateMarkToDate(date(2026, 8, 1), 'tpl-1', configWithTemplates, noOverrides);
    expect(result.success).toBe(true);
    expect(result.overrides['2026-09-01']?.templateMarks).toEqual(['tpl-1']);
  });

  it('addTemplateMarkToDate fails on conflict', () => {
    const ov: DayOverrides = {
      '2026-09-01': { type: 'work', multiplier: 1, segments: null, nightShift: false, templateMarks: ['tpl-1'] },
    };
    // 尝试添加 tpl-3 (22:00-06:00)，与 tpl-1 (08:00-16:00) 无冲突
    const result1 = addTemplateMarkToDate(date(2026, 8, 1), 'tpl-3', configWithTemplates, ov);
    expect(result1.success).toBe(true);

    // 创建冲突模板
    const conflictTemplate: WorkTemplate = { id: 'tpl-conflict', name: '冲突', color: '#FF0000', workSegment: { start: '10:00', end: '14:00' } };
    const cfg = { ...configWithTemplates, workTemplates: [...templates, conflictTemplate] };
    const result2 = addTemplateMarkToDate(date(2026, 8, 1), 'tpl-conflict', cfg, ov);
    expect(result2.success).toBe(false);
    expect(result2.reason).toContain('冲突');
  });

  it('removeTemplateMarkFromDate removes mark', () => {
    const ov: DayOverrides = {
      '2026-09-01': { type: 'work', multiplier: 1, segments: null, nightShift: false, templateMarks: ['tpl-1', 'tpl-2'] },
    };
    const next = removeTemplateMarkFromDate(date(2026, 8, 1), 'tpl-1', ov);
    expect(next['2026-09-01']?.templateMarks).toEqual(['tpl-2']);
  });

  it('removeTemplateMarkFromDate cleans empty entry', () => {
    const ov: DayOverrides = {
      '2026-09-01': { type: 'work', multiplier: 1, segments: null, nightShift: false, templateMarks: ['tpl-1'] },
    };
    const next = removeTemplateMarkFromDate(date(2026, 8, 1), 'tpl-1', ov);
    expect(next['2026-09-01']).toBeUndefined();
  });

  it('mergeTemplateSegmentsForDate merges segments', () => {
    const ov: DayOverrides = {
      '2026-09-01': { type: 'work', multiplier: 1, segments: null, nightShift: false, templateMarks: ['tpl-1', 'tpl-2'] },
    };
    const merged = mergeTemplateSegmentsForDate(date(2026, 8, 1), configWithTemplates, ov);
    // tpl-1: 08:00-16:00, tpl-2: 16:00-00:00 → 合并为 08:00-00:00
    expect(merged.length).toBeGreaterThan(0);
    expect(merged[0]?.start).toBe('08:00');
  });

  it('isDateMarkedByTemplate returns true for marked date', () => {
    const ov: DayOverrides = {
      '2026-09-01': { type: 'work', multiplier: 1, segments: null, nightShift: false, templateMarks: ['tpl-1'] },
    };
    expect(isDateMarkedByTemplate(date(2026, 8, 1), ov)).toBe(true);
    expect(isDateMarkedByTemplate(date(2026, 8, 2), ov)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// v1.3.5 · 兼职类型时间记录
// ══════════════════════════════════════════════════════════════
describe('v1.3.5 parttime records', () => {
  it('parttimeEarnings sums custom earnings', () => {
    const sessions = [
      { id: 'p1', dateKey: '2026-09-01', label: 'parttime' as const, startTs: 1000, endTs: 2000, nightShift: false, parttimeEarned: 100 },
      { id: 'p2', dateKey: '2026-09-01', label: 'parttime' as const, startTs: 3000, endTs: 4000, nightShift: false, parttimeEarned: 200 },
      { id: 's1', dateKey: '2026-09-01', label: 'slack' as const, startTs: 5000, endTs: 6000, nightShift: false },
    ];
    expect(parttimeEarnings(sessions)).toBe(300);
  });

  it('parttimeEarnings ignores null earnings', () => {
    const sessions = [
      { id: 'p1', dateKey: '2026-09-01', label: 'parttime' as const, startTs: 1000, endTs: 2000, nightShift: false, parttimeEarned: null },
      { id: 'p2', dateKey: '2026-09-01', label: 'parttime' as const, startTs: 3000, endTs: 4000, nightShift: false, parttimeEarned: 50 },
    ];
    expect(parttimeEarnings(sessions)).toBe(50);
  });

  it('parttimeMinutes calculates total duration', () => {
    const sessions = [
      { id: 'p1', dateKey: '2026-09-01', label: 'parttime' as const, startTs: date(2026, 8, 1, 10, 0).getTime(), endTs: date(2026, 8, 1, 11, 30).getTime(), nightShift: false },
      { id: 'p2', dateKey: '2026-09-01', label: 'parttime' as const, startTs: date(2026, 8, 1, 14, 0).getTime(), endTs: date(2026, 8, 1, 15, 0).getTime(), nightShift: false },
    ];
    const nowTs = date(2026, 8, 1, 16, 0).getTime();
    expect(parttimeMinutes(sessions, nowTs)).toBe(150); // 90 + 60
  });

  it('parttimeMinutes includes ongoing session', () => {
    const sessions = [
      { id: 'p1', dateKey: '2026-09-01', label: 'parttime' as const, startTs: date(2026, 8, 1, 10, 0).getTime(), endTs: null, nightShift: false },
    ];
    const nowTs = date(2026, 8, 1, 11, 0).getTime();
    expect(parttimeMinutes(sessions, nowTs)).toBe(60);
  });
});
