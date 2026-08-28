/**
 * Salary Timer — Compute Layer Unit Tests
 * 覆盖率目标:>90%
 */
import { describe, it, expect } from 'vitest';
import {
  dailySalary,
  daysInMonthCalc,
  dayState,
  hourlyRate,
  isHoliday,
  isWorkday,
  monthEarnedSoFar,
  perSecond,
  progressPct,
  todayEarned,
  workSeconds,
  workdaysInMonth,
} from './compute';
import type { Config, DayOverrides, HolidayMap } from './types';

// ── Test Fixtures ─────────────────────────────────────────────
const baseConfig: Config = {
  monthlySalary: 15000,
  startTime: '09:00',
  endTime: '18:00',
  coffeePrice: 15,
  restMode: 2,           // 双休
  theme: 'paper',
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

  it('override "rest" → false', () => {
    expect(isWorkday(date(2026, 7, 31), baseConfig, { '2026-08-31': 'rest' }, emptyHolidays)).toBe(false);
  });

  it('override "work" → true even on Saturday', () => {
    expect(isWorkday(date(2026, 7, 29), baseConfig, { '2026-08-29': 'work' }, emptyHolidays)).toBe(true);
  });

  it('holiday → false even on Monday', () => {
    // 2026-01-01 is Thursday(周四)
    expect(isWorkday(date(2026, 0, 1), baseConfig, noOverrides, sampleHolidays)).toBe(false);
  });

  it('override takes priority over holiday', () => {
    expect(isWorkday(date(2026, 0, 1), baseConfig, { '2026-01-01': 'work' }, sampleHolidays)).toBe(true);
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

  it('respects overrides', () => {
    // 2026-08-28 is Friday (工作日),override 为 rest → 应扣 1 天
    const overrides: DayOverrides = { '2026-08-28': 'rest' };
    expect(workdaysInMonth(2026, 7, baseConfig, overrides, emptyHolidays)).toBe(20); // 21 - 1
  });
});

// ══════════════════════════════════════════════════════════════
// daysInMonthCalc
// ══════════════════════════════════════════════════════════════
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
    const now = date(2026, 7, 5, 12, 0, 0);
    const earned = monthEarnedSoFar(2026, 7, now, baseConfig, noOverrides, emptyHolidays);
    // 5 天内的工作日(8/1 周六、8/2 周日)→ 实际只有 8/3-8/5 (周一、周二、周三)
    const daily = dailySalary(2026, 7, baseConfig, noOverrides, emptyHolidays);
    expect(earned).toBeCloseTo(daily * 3, 2);
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