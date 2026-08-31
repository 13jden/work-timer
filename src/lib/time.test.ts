/**
 * Salary Timer — Time Utilities Unit Tests
 *
 * v1.3.3 新增:
 *   - isInNightWindow 单元测试
 *   - detectNightShift 单元测试
 */
import { describe, it, expect } from 'vitest';
import { isInNightWindow, detectNightShift } from './time';

function dateAt(h: number, m: number): Date {
  return new Date(2026, 7, 30, h, m, 0);
}

describe('isInNightWindow · v1.3.3 夜班窗口判断', () => {
  it('22:00 整点 → true(夜班开始)', () => {
    expect(isInNightWindow(dateAt(22, 0))).toBe(true);
  });

  it('23:59 → true(夜班内)', () => {
    expect(isInNightWindow(dateAt(23, 59))).toBe(true);
  });

  it('00:00 整点 → true(凌晨开始)', () => {
    expect(isInNightWindow(dateAt(0, 0))).toBe(true);
  });

  it('05:59 → true(夜班末)', () => {
    expect(isInNightWindow(dateAt(5, 59))).toBe(true);
  });

  it('06:00 整点 → false(夜班结束)', () => {
    expect(isInNightWindow(dateAt(6, 0))).toBe(false);
  });

  it('09:00 → false(工作时间)', () => {
    expect(isInNightWindow(dateAt(9, 0))).toBe(false);
  });

  it('21:59 → false(夜班前一刻)', () => {
    expect(isInNightWindow(dateAt(21, 59))).toBe(false);
  });
});

describe('detectNightShift · v1.3.3 自动夜班标记', () => {
  it('startTs 22:00 → true', () => {
    const s = dateAt(22, 0).getTime();
    const e = dateAt(22, 30).getTime();
    expect(detectNightShift(s, e)).toBe(true);
  });

  it('endTs 23:00(startTs 21:00)→ true', () => {
    const s = dateAt(21, 0).getTime();
    const e = dateAt(23, 0).getTime();
    expect(detectNightShift(s, e)).toBe(true);
  });

  it('startTs 03:00 → true(凌晨)', () => {
    const s = dateAt(3, 0).getTime();
    const e = dateAt(3, 30).getTime();
    expect(detectNightShift(s, e)).toBe(true);
  });

  it('startTs 09:00 + endTs 18:00 → false', () => {
    const s = dateAt(9, 0).getTime();
    const e = dateAt(18, 0).getTime();
    expect(detectNightShift(s, e)).toBe(false);
  });

  it('startTs 06:00 + endTs 14:00 → false(边界 06:00 排除)', () => {
    const s = dateAt(6, 0).getTime();
    const e = dateAt(14, 0).getTime();
    expect(detectNightShift(s, e)).toBe(false);
  });
});
