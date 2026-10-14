/**
 * @fileoverview Salary Timer — 记账统计聚合纯函数单测（v2.2 · TASK-038）
 *
 * 覆盖 src/lib/accounting/stats.ts。
 */
import { describe, it, expect } from 'vitest';
import {
  UNCATEGORIZED_ID,
  filterByRange,
  aggregateByDay,
  aggregateByMonth,
  aggregateByCategory,
  groupByDay,
  groupByMonth,
  sumRecords,
  shiftDay,
  shiftMonth,
  listableRecords,
  recordAffectsBalance,
} from './stats';
import type { AccountRecord } from '../types';

let seq = 0;

/** 构造测试记录（支出传负数，与 store 约定一致） */
function makeRecord(
  partial: Pick<AccountRecord, 'dateKey' | 'amount' | 'type'> & Partial<AccountRecord>,
): AccountRecord {
  seq += 1;
  return {
    id: `rec-${seq}`,
    categoryId: 'cat-food',
    accountId: 'acc-1',
    createdAt: seq,
    updatedAt: seq,
    ...partial,
  };
}

describe('filterByRange', () => {
  const records = [
    makeRecord({ dateKey: '2026-08-31', amount: -10, type: 'expense' }),
    makeRecord({ dateKey: '2026-09-01', amount: -20, type: 'expense' }),
    makeRecord({ dateKey: '2026-09-15', amount: 100, type: 'income' }),
    makeRecord({ dateKey: '2026-09-30', amount: -30, type: 'expense' }),
    makeRecord({ dateKey: '2026-10-01', amount: -40, type: 'expense' }),
  ];

  it('按闭区间过滤（含起止边界）', () => {
    const result = filterByRange(records, '2026-09-01', '2026-09-30');
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.dateKey)).toEqual(['2026-09-01', '2026-09-15', '2026-09-30']);
  });

  it('范围外记录全部排除', () => {
    expect(filterByRange(records, '2027-01-01', '2027-01-31')).toHaveLength(0);
  });
});

describe('aggregateByDay', () => {
  it('按日聚合收支，支出输出正数', () => {
    const records = [
      makeRecord({ dateKey: '2026-09-01', amount: -12.5, type: 'expense' }),
      makeRecord({ dateKey: '2026-09-01', amount: -7.5, type: 'expense' }),
      makeRecord({ dateKey: '2026-09-01', amount: 100, type: 'income' }),
      makeRecord({ dateKey: '2026-09-02', amount: -3, type: 'expense' }),
    ];
    const map = aggregateByDay(records);
    expect(map.size).toBe(2);
    expect(map.get('2026-09-01')).toEqual({ income: 100, expense: 20 });
    expect(map.get('2026-09-02')).toEqual({ income: 0, expense: 3 });
  });

  it('默认过滤虚拟池记录，开启开关后纳入', () => {
    const records = [
      makeRecord({ dateKey: '2026-09-01', amount: -10, type: 'expense', poolStatus: 'virtual' }),
      makeRecord({ dateKey: '2026-09-01', amount: -5, type: 'expense' }),
    ];
    expect(aggregateByDay(records).get('2026-09-01')?.expense).toBe(5);
    expect(
      aggregateByDay(records, { includeVirtualPool: true }).get('2026-09-01')?.expense,
    ).toBe(15);
  });
});

describe('aggregateByMonth', () => {
  it('按月聚合（YYYY-MM）', () => {
    const records = [
      makeRecord({ dateKey: '2026-08-20', amount: -10, type: 'expense' }),
      makeRecord({ dateKey: '2026-09-01', amount: -20, type: 'expense' }),
      makeRecord({ dateKey: '2026-09-25', amount: 300, type: 'income' }),
    ];
    const map = aggregateByMonth(records);
    expect(map.size).toBe(2);
    expect(map.get('2026-08')).toEqual({ income: 0, expense: 10 });
    expect(map.get('2026-09')).toEqual({ income: 300, expense: 20 });
  });
});

describe('aggregateByCategory', () => {
  const records = [
    makeRecord({ dateKey: '2026-09-01', amount: -50, type: 'expense', categoryId: 'cat-food' }),
    makeRecord({ dateKey: '2026-09-02', amount: -30, type: 'expense', categoryId: 'cat-transport' }),
    makeRecord({ dateKey: '2026-09-03', amount: -20, type: 'expense', categoryId: 'cat-deleted', isUncategorized: true }),
    makeRecord({ dateKey: '2026-09-04', amount: 100, type: 'income', categoryId: 'cat-salary' }),
  ];

  it('按类型过滤 + 总额降序 + 占比正确', () => {
    const result = aggregateByCategory(records, 'expense');
    expect(result.map((r) => r.categoryId)).toEqual(['cat-food', 'cat-transport', UNCATEGORIZED_ID]);
    expect(result[0]).toMatchObject({ total: 50, count: 1 });
    expect(result[0]?.percent).toBeCloseTo(50, 5);
    expect(result[1]?.percent).toBeCloseTo(30, 5);
    expect(result[2]?.percent).toBeCloseTo(20, 5);
  });

  it('未分类记录归入虚拟分类', () => {
    const result = aggregateByCategory(records, 'expense');
    const uncat = result.find((r) => r.categoryId === UNCATEGORIZED_ID);
    expect(uncat?.total).toBe(20);
  });

  it('收入类型单独聚合', () => {
    const result = aggregateByCategory(records, 'income');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ categoryId: 'cat-salary', total: 100, percent: 100 });
  });

  it('虚拟池记录默认不参与，开关可放开', () => {
    const withVirtual = [
      ...records,
      makeRecord({ dateKey: '2026-09-05', amount: -40, type: 'expense', categoryId: 'cat-food', poolStatus: 'virtual' }),
    ];
    expect(aggregateByCategory(withVirtual, 'expense')[0]?.total).toBe(50);
    expect(
      aggregateByCategory(withVirtual, 'expense', { includeVirtualPool: true })[0]?.total,
    ).toBe(90);
  });

  it('空列表返回空数组', () => {
    expect(aggregateByCategory([], 'expense')).toEqual([]);
  });
});

describe('shiftDay / shiftMonth', () => {
  it('日期前后平移，跨月跨年正确', () => {
    expect(shiftDay('2026-09-01', -1)).toBe('2026-08-31');
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('月份前后平移，跨年正确', () => {
    expect(shiftMonth('2026-09', -1)).toBe('2026-08');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('sumRecords', () => {
  it('总收入 / 总支出 / 净额', () => {
    const records = [
      makeRecord({ dateKey: '2026-09-01', amount: 200, type: 'income' }),
      makeRecord({ dateKey: '2026-09-01', amount: -30.5, type: 'expense' }),
      makeRecord({ dateKey: '2026-09-02', amount: -19.5, type: 'expense' }),
    ];
    expect(sumRecords(records)).toEqual({ income: 200, expense: 50, net: 150 });
  });

  it('默认排除虚拟池记录', () => {
    const records = [
      makeRecord({ dateKey: '2026-09-01', amount: -10, type: 'expense' }),
      makeRecord({ dateKey: '2026-09-01', amount: -90, type: 'expense', poolStatus: 'virtual' }),
    ];
    expect(sumRecords(records).expense).toBe(10);
    expect(sumRecords(records, { includeVirtualPool: true }).expense).toBe(100);
  });
});

describe('listableRecords（v2.4 T-410）', () => {
  it('保留认领付款记录（列表展示「已关联池」），仅排除存量虚拟预扣', () => {
    const manual = makeRecord({ dateKey: '2026-09-01', amount: -10, type: 'expense' });
    const claimed = makeRecord({ dateKey: '2026-09-01', amount: -3000, type: 'expense', poolId: 'pool-1', poolStatus: 'claimed' });
    const virtual = makeRecord({ dateKey: '2026-09-01', amount: -100, type: 'expense', poolStatus: 'virtual' });
    const poolDaily = makeRecord({ dateKey: '2026-09-01', amount: -100, type: 'expense', poolId: 'pool-1' });
    const result = listableRecords([manual, claimed, virtual, poolDaily]);
    expect(result.map((r) => r.id)).toEqual([manual.id, claimed.id, poolDaily.id]);
  });
});

describe('recordAffectsBalance（v2.4 T-410）', () => {
  it('池逐日均摊记录与存量虚拟预扣不动余额', () => {
    expect(recordAffectsBalance(makeRecord({ dateKey: '2026-09-01', amount: -100, type: 'expense', poolId: 'pool-1' }))).toBe(false);
    expect(recordAffectsBalance(makeRecord({ dateKey: '2026-09-01', amount: -100, type: 'expense', poolStatus: 'virtual' }))).toBe(false);
  });

  it('手动记录 / 认领付款 / 存池存取动余额', () => {
    expect(recordAffectsBalance(makeRecord({ dateKey: '2026-09-01', amount: -10, type: 'expense' }))).toBe(true);
    expect(recordAffectsBalance(makeRecord({ dateKey: '2026-09-01', amount: -3000, type: 'expense', poolId: 'pool-1', poolStatus: 'claimed' }))).toBe(true);
    expect(recordAffectsBalance(makeRecord({ dateKey: '2026-09-01', amount: -2000, type: 'expense', poolId: 'pool-2', poolStatus: 'confirmed' }))).toBe(true);
  });
});

describe('groupByDay（v3.0 TASK-055 T-552）', () => {
  it('按天分组,日期降序,组内记录按 createdAt 降序', () => {
    const a = makeRecord({ dateKey: '2026-09-01', amount: -10, type: 'expense', createdAt: 1 });
    const b = makeRecord({ dateKey: '2026-09-01', amount: -20, type: 'expense', createdAt: 2 });
    const c = makeRecord({ dateKey: '2026-09-02', amount: 100, type: 'income', createdAt: 3 });
    const groups = groupByDay([a, c, b]);
    expect(groups).toHaveLength(2);
    // 9/2 在前(降序)
    expect(groups[0]?.dateKey).toBe('2026-09-02');
    expect(groups[0]?.income).toBe(100);
    expect(groups[0]?.expense).toBe(0);
    expect(groups[1]?.dateKey).toBe('2026-09-01');
    // 组内按 createdAt 降序:b (2) 在 a (1) 之前
    expect(groups[1]?.records.map((r) => r.id)).toEqual([b.id, a.id]);
    expect(groups[1]?.expense).toBe(30);
  });

  it('虚拟预扣不计入小计(但仍出现在 records 中),认领付款展示但不计金额', () => {
    const manual = makeRecord({ dateKey: '2026-09-01', amount: -10, type: 'expense' });
    const virtual = makeRecord({ dateKey: '2026-09-01', amount: -100, type: 'expense', poolStatus: 'virtual' });
    const claimed = makeRecord({ dateKey: '2026-09-01', amount: -3000, type: 'expense', poolId: 'pool-1', poolStatus: 'claimed' });
    const groups = groupByDay([manual, virtual, claimed]);
    expect(groups).toHaveLength(1);
    // records 全展示
    expect(groups[0]?.records).toHaveLength(3);
    // 金额小计只算 manual = 10
    expect(groups[0]?.expense).toBe(10);
  });

  it('空列表返回空数组', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('groupByMonth（v3.0 TASK-055 T-553）', () => {
  it('按月分组,月份降序,组内 days 也降序', () => {
    const a = makeRecord({ dateKey: '2026-08-30', amount: -10, type: 'expense' });
    const b = makeRecord({ dateKey: '2026-09-15', amount: 100, type: 'income' });
    const c = makeRecord({ dateKey: '2026-09-01', amount: -20, type: 'expense' });
    const groups = groupByMonth([a, b, c]);
    expect(groups).toHaveLength(2);
    // 9月在前
    expect(groups[0]?.monthKey).toBe('2026-09');
    expect(groups[0]?.days).toHaveLength(2);
    expect(groups[0]?.days[0]?.dateKey).toBe('2026-09-15');
    expect(groups[0]?.days[1]?.dateKey).toBe('2026-09-01');
    expect(groups[0]?.income).toBe(100);
    expect(groups[0]?.expense).toBe(20);
    // 8月在后
    expect(groups[1]?.monthKey).toBe('2026-08');
    expect(groups[1]?.expense).toBe(10);
  });

  it('跨年分组正确', () => {
    const a = makeRecord({ dateKey: '2025-12-31', amount: -1, type: 'expense' });
    const b = makeRecord({ dateKey: '2026-01-01', amount: -2, type: 'expense' });
    const groups = groupByMonth([a, b]);
    expect(groups.map((g) => g.monthKey)).toEqual(['2026-01', '2025-12']);
  });

  it('月份小计 = 各天小计之和', () => {
    const r1 = makeRecord({ dateKey: '2026-09-01', amount: -10, type: 'expense' });
    const r2 = makeRecord({ dateKey: '2026-09-01', amount: -20, type: 'expense' });
    const r3 = makeRecord({ dateKey: '2026-09-15', amount: 100, type: 'income' });
    const groups = groupByMonth([r1, r2, r3]);
    expect(groups[0]?.expense).toBe(30);
    expect(groups[0]?.income).toBe(100);
    // 与 sumRecords 输出一致
    const monthGroup = groups[0]!;
    expect(monthGroup.expense + monthGroup.income).toBe(
      sumRecords([r1, r2, r3]).income + sumRecords([r1, r2, r3]).expense,
    );
  });

  it('空列表返回空数组', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
