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
  sumRecords,
  shiftDay,
  shiftMonth,
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
