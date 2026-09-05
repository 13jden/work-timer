/**
 * @fileoverview Salary Timer — 池机制纯函数单测（v2.3 · TASK-039 重设计后）
 *
 * 覆盖 src/lib/accounting/pool.ts：
 * 周期日期/均摊拆分/周期草稿（不生成记录）/到期生成计划/状态派生/存池余额。
 */
import { describe, it, expect } from 'vitest';
import {
  daysInMonth,
  buildCycleDateKeys,
  splitDailyAmount,
  eachMonthInRange,
  buildDateRangeKeys,
  getCycleDateKeys,
  buildEqualizeCycleDraft,
  buildDepositCycleDraft,
  planDailyRecords,
  deriveCycleStatus,
  isCycleEnded,
  depositBalance,
  equalizeProgress,
  isVirtualPoolRecord,
  isPoolPrepaidRecord,
  splitPoolTotalAcrossMonths,
} from './pool';
import type { PoolConfig, PoolCycle, PoolTransaction } from '../types';

let seq = 0;

function makePool(patch: Partial<PoolConfig> = {}): PoolConfig {
  seq += 1;
  return {
    id: `pool-${seq}`,
    name: '房租',
    type: 'equalize',
    amount: 3000,
    cycleMonths: 12,
    createdAt: seq,
    ...patch,
  };
}

function makeTx(patch: Partial<PoolTransaction> & { id: string }): PoolTransaction {
  return {
    cycleId: 'cycle-1',
    dateKey: '2026-09-01',
    amount: 100,
    direction: 'out',
    status: 'confirmed',
    ...patch,
  };
}

// ── 日期 / 均摊 ───────────────────────────────────────────

describe('daysInMonth', () => {
  it('大小月与闰年二月', () => {
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2026-01')).toBe(31);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
  });
});

describe('buildCycleDateKeys', () => {
  it('未配置 dayRange 则整月', () => {
    const keys = buildCycleDateKeys('2026-09');
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe('2026-09-01');
    expect(keys[keys.length - 1]).toBe('2026-09-30');
  });

  it('dayRange 限定生效区间（几号到几号）', () => {
    const keys = buildCycleDateKeys('2026-09', { start: 10, end: 14 });
    expect(keys).toHaveLength(5);
    expect(keys[0]).toBe('2026-09-10');
    expect(keys[keys.length - 1]).toBe('2026-09-14');
  });

  it('dayRange 越界自动裁剪', () => {
    expect(buildCycleDateKeys('2026-02', { start: 30, end: 40 })).toHaveLength(0);
    expect(buildCycleDateKeys('2026-01', { start: 28, end: 35 })).toHaveLength(4);
  });
});

describe('splitDailyAmount', () => {
  it('整除情况每天相等', () => {
    expect(splitDailyAmount(500, 5)).toEqual([100, 100, 100, 100, 100]);
  });

  it('不整除时尾差补到最后一天，总和精确', () => {
    const amounts = splitDailyAmount(100, 3);
    expect(amounts[0]).toBe(33.33);
    expect(amounts[2]).toBeCloseTo(33.34, 2);
    const sum = Math.round(amounts.reduce((s, a) => s + a, 0) * 100) / 100;
    expect(sum).toBe(100);
  });
});

// ── 按日模式：完整日期范围 ────────────────────────────────

describe('eachMonthInRange', () => {
  it('单月范围', () => {
    expect(eachMonthInRange({ start: '2026-09-10', end: '2026-09-14' })).toEqual(['2026-09']);
  });

  it('跨月/跨年范围', () => {
    expect(eachMonthInRange({ start: '2026-09-25', end: '2026-11-05' })).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(eachMonthInRange({ start: '2026-12-30', end: '2027-01-02' })).toEqual([
      '2026-12',
      '2027-01',
    ]);
  });

  it('非法范围返回空', () => {
    expect(eachMonthInRange({ start: '2026-09-14', end: '2026-09-10' })).toEqual([]);
  });
});

describe('buildDateRangeKeys', () => {
  it('只取当月与范围的交集', () => {
    const keys = buildDateRangeKeys({ start: '2026-09-25', end: '2026-10-05' }, '2026-09');
    expect(keys).toHaveLength(6); // 25-30
    expect(keys[0]).toBe('2026-09-25');
    expect(keys[keys.length - 1]).toBe('2026-09-30');
  });

  it('范围外的月份返回空', () => {
    expect(
      buildDateRangeKeys({ start: '2026-09-25', end: '2026-10-05' }, '2026-11'),
    ).toEqual([]);
  });
});

describe('getCycleDateKeys', () => {
  it('按日模式用 dateRange 交集', () => {
    const pool = makePool({
      cycleMode: 'daily',
      dateRange: { start: '2026-09-28', end: '2026-10-03' },
    });
    expect(getCycleDateKeys(pool, '2026-09')).toHaveLength(3);
    expect(getCycleDateKeys(pool, '2026-10')).toHaveLength(3);
  });

  it('按月模式用 dayRange', () => {
    const pool = makePool({ cycleMode: 'monthly', dayRange: { start: 10, end: 14 } });
    expect(getCycleDateKeys(pool, '2026-09')).toHaveLength(5);
  });
});

// ── 周期草稿（不生成记录） ────────────────────────────────

describe('buildEqualizeCycleDraft', () => {
  it('只有元数据：日均 = 总额/天数，不产生记录', () => {
    const pool = makePool();
    const draft = buildEqualizeCycleDraft(pool, '2026-09');
    expect(draft.monthKey).toBe('2026-09');
    expect(draft.dayCount).toBe(30);
    expect(draft.dailyVirtual).toBe(100);
    expect(draft.paidAmount).toBe(0);
    expect(draft.status).toBe('generating');
    expect(draft.dateKeys).toHaveLength(30);
  });

  it('用户自填日均优先（日均 100 × 5 天区间）', () => {
    const pool = makePool({ amount: 500, dailyAmount: 100, dayRange: { start: 10, end: 14 } });
    const draft = buildEqualizeCycleDraft(pool, '2026-09');
    expect(draft.dayCount).toBe(5);
    expect(draft.dailyVirtual).toBe(100);
    expect(draft.dateKeys[0]).toBe('2026-09-10');
  });

  it('按月模式带 dayRange', () => {
    const pool = makePool({ dayRange: { start: 1, end: 10 } });
    const draft = buildEqualizeCycleDraft(pool, '2026-09');
    expect(draft.dayCount).toBe(10);
    expect(draft.dailyVirtual).toBe(300);
  });

  // v2.5-patch3 T-473：overrideTotalAmount 在「按日模式跨月」场景下避免重复
  it('overrideTotalAmount：按日模式单月，totalAmount 取 override 而非 pool.amount', () => {
    const pool = makePool({
      amount: 3000,
      cycleMode: 'daily',
      dateRange: { start: '2026-09-01', end: '2026-09-30' },
    });
    const draft = buildEqualizeCycleDraft(pool, '2026-09', { overrideTotalAmount: 900 });
    expect(draft.totalAmount).toBe(900);
    // dailyVirtual 按 override 算,不再被 pool.amount 3000 干扰
    expect(draft.dailyVirtual).toBe(30);
  });

  it('overrideTotalAmount：跨月场景,各月 dailyVirtual 都基于本月的 override', () => {
    const pool = makePool({
      amount: 2100,
      cycleMode: 'daily',
      dateRange: { start: '2026-09-25', end: '2026-10-05' },
    });
    const sept = buildEqualizeCycleDraft(pool, '2026-09', { overrideTotalAmount: 1260 });
    const oct = buildEqualizeCycleDraft(pool, '2026-10', { overrideTotalAmount: 840 });
    expect(sept.totalAmount).toBe(1260);
    expect(sept.dayCount).toBe(6); // 9/25 ~ 9/30
    expect(sept.dailyVirtual).toBe(210);
    expect(oct.totalAmount).toBe(840);
    expect(oct.dayCount).toBe(5); // 10/1 ~ 10/5
    expect(oct.dailyVirtual).toBe(168);
  });
});

// ── splitPoolTotalAcrossMonths（v2.5-patch3 T-473） ─────

describe('splitPoolTotalAcrossMonths', () => {
  it('单月：直接返回 [pool.amount]', () => {
    const pool = makePool({
      amount: 3000,
      cycleMode: 'daily',
      dateRange: { start: '2026-09-01', end: '2026-09-30' },
    });
    expect(splitPoolTotalAcrossMonths(pool, ['2026-09'])).toEqual([3000]);
  });

  it('跨月：按各月在范围内天数比例分配,尾差补到最后一月', () => {
    const pool = makePool({
      amount: 2100,
      cycleMode: 'daily',
      dateRange: { start: '2026-09-25', end: '2026-10-05' },
    });
    const result = splitPoolTotalAcrossMonths(pool, ['2026-09', '2026-10']);
    // 9 月 6 天 / 10 月 5 天,11 天总
    // 9 月分到 2100 × 6 / 11 = 1145.45；10 月补尾差 = 954.55
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(1145.45, 2);
    expect(result[1]).toBeCloseTo(954.55, 2);
    // 合计 = pool.amount（无丢失精度）
    expect(result[0]! + result[1]!).toBeCloseTo(2100, 2);
  });

  it('跨 3 月：按比例分配,各月日均 = 总额 / 总天数一致', () => {
    const pool = makePool({
      amount: 3000,
      cycleMode: 'daily',
      dateRange: { start: '2026-08-01', end: '2026-10-31' },
    });
    const result = splitPoolTotalAcrossMonths(pool, ['2026-08', '2026-09', '2026-10']);
    expect(result).toHaveLength(3);
    // 31 + 30 + 31 = 92 天
    expect(result[0]).toBeCloseTo((3000 * 31) / 92, 1);
    expect(result[1]).toBeCloseTo((3000 * 30) / 92, 1);
    expect(result[2]).toBeCloseTo(3000 - result[0]! - result[1]!, 2);
    expect(result[0]! + result[1]! + result[2]!).toBeCloseTo(3000, 2);
  });

  it('总额 0 或 0 天 → 全部返回 0', () => {
    const pool = makePool({ amount: 0 });
    expect(splitPoolTotalAcrossMonths(pool, ['2026-09', '2026-10'])).toEqual([0, 0]);
  });

  it('空 monthKeys 数组 → 返回空数组', () => {
    const pool = makePool({ amount: 3000 });
    expect(splitPoolTotalAcrossMonths(pool, [])).toEqual([]);
  });
});

describe('buildDepositCycleDraft', () => {
  it('空日期常驻周期', () => {
    const pool = makePool({ type: 'deposit', name: '租房押金', amount: 2000 });
    const draft = buildDepositCycleDraft(pool, '2026-09');
    expect(draft.dateKeys).toEqual([]);
    expect(draft.paidAmount).toBe(0);
  });
});

// ── 到期生成 ──────────────────────────────────────────────

describe('planDailyRecords', () => {
  const dateKeys = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];

  it('只生成已到来且未生成的日期', () => {
    const cycle = { transactions: [makeTx({ id: 't1', dateKey: '2026-09-01' })] };
    expect(planDailyRecords(cycle, dateKeys, '2026-09-03')).toEqual([
      '2026-09-02',
      '2026-09-03',
    ]);
  });

  it('未来日期不生成', () => {
    expect(planDailyRecords({ transactions: [] }, dateKeys, '2026-09-02')).toEqual([
      '2026-09-01',
      '2026-09-02',
    ]);
  });

  it('全部已生成则返回空', () => {
    const cycle = {
      transactions: dateKeys.map((k, i) => makeTx({ id: `t${i}`, dateKey: k })),
    };
    expect(planDailyRecords(cycle, dateKeys, '2026-09-30')).toEqual([]);
  });
});

// ── 状态派生 ──────────────────────────────────────────────

describe('deriveCycleStatus', () => {
  it('认领足额 → confirmed（无论是否到期）', () => {
    expect(deriveCycleStatus(3000, 3000, false)).toBe('confirmed');
    expect(deriveCycleStatus(3000, 3000, true)).toBe('confirmed');
  });

  it('到期未认领足 → overdue', () => {
    expect(deriveCycleStatus(2100, 3000, true)).toBe('overdue');
  });

  it('未到期未认领足 → generating', () => {
    expect(deriveCycleStatus(2100, 3000, false)).toBe('generating');
    expect(deriveCycleStatus(0, 3000, false)).toBe('generating');
  });
});

describe('isCycleEnded', () => {
  it('最后生效日早于今天 → 结束', () => {
    expect(isCycleEnded(['2026-09-01', '2026-09-10'], '2026-09-11')).toBe(true);
    expect(isCycleEnded(['2026-09-01', '2026-09-10'], '2026-09-10')).toBe(false);
    expect(isCycleEnded([], '2026-09-11')).toBe(false);
  });
});

// ── 存池余额 / 进度 ───────────────────────────────────────

describe('depositBalance', () => {
  it('Σin − Σout，仅统计已确认', () => {
    const txs = [
      makeTx({ id: 't1', direction: 'in', amount: 2000 }),
      makeTx({ id: 't2', direction: 'out', amount: 500 }),
      makeTx({ id: 't3', direction: 'out', amount: 300, status: 'virtual' }),
    ];
    expect(depositBalance(txs)).toBe(1500);
  });
});

describe('equalizeProgress', () => {
  it('已认领 / 总额', () => {
    const cycles: PoolCycle[] = [
      { id: 'c1', poolId: 'p1', monthKey: '2026-09', totalAmount: 3000, dayCount: 30, dailyVirtual: 100, paidAmount: 2000, status: 'generating', transactions: [] },
      { id: 'c2', poolId: 'p1', monthKey: '2026-10', totalAmount: 3000, dayCount: 31, dailyVirtual: 96.77, paidAmount: 1000, status: 'generating', transactions: [] },
    ];
    expect(equalizeProgress(cycles)).toBeCloseTo(0.5, 5);
  });

  it('认领超额不超 1', () => {
    const cycles: PoolCycle[] = [
      { id: 'c1', poolId: 'p1', monthKey: '2026-09', totalAmount: 100, dayCount: 1, dailyVirtual: 100, paidAmount: 200, status: 'confirmed', transactions: [] },
    ];
    expect(equalizeProgress(cycles)).toBe(1);
  });

  it('空周期返回 0', () => {
    expect(equalizeProgress([])).toBe(0);
  });
});

// ── 记录分类辅助 ──────────────────────────────────────────

describe('记录分类辅助', () => {
  it('识别旧虚拟记录与认领付款记录', () => {
    expect(isVirtualPoolRecord({ poolStatus: 'virtual' } as never)).toBe(true);
    expect(isPoolPrepaidRecord({ poolStatus: 'claimed' } as never)).toBe(true);
    expect(isPoolPrepaidRecord({ poolStatus: 'confirmed' } as never)).toBe(false);
    expect(isPoolPrepaidRecord({} as never)).toBe(false);
  });
});
