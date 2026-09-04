/**
 * Salary Timer — Accounting Layer Unit Tests
 *
 * 覆盖 src/lib/accounting/index.ts 中的纯函数。
 */
import { describe, it, expect } from 'vitest';
import {
  // 金额计算
  sumIncome,
  sumExpense,
  netAmount,
  // 日期聚合
  groupByDate,
  groupByMonth,
  // 分类聚合
  groupByCategory,
  // 统计
  calcMonthlyStats,
  calcDailyStats,
  // 池计算
  calcDailyVirtualAmount,
  calcPoolConfirmedAmount,
  calcPoolVirtualAmount,
  // 排序
  sortRecords,
  // 格式化
  formatAmount,
  formatMonth,
  formatDate,
  // 日期工具
  getTodayKey,
  getCurrentMonthKey,
  parseDateKey,
  getDaysInMonth,
  // 验证
  isValidAmount,
  isValidDateKey,
  isValidMonthKey,
} from './index';
import type { AccountRecord, Category, PoolConfig, PoolCycle, PoolTransaction } from '../types';

// ── Test Fixtures ─────────────────────────────────────────────

const mockCategories: Category[] = [
  { id: 'cat-food', name: '餐饮', icon: '🍜', color: '#FF9B8E', type: 'expense', order: 0 },
  { id: 'cat-transport', name: '交通', icon: '🚌', color: '#60A5FA', type: 'expense', order: 1 },
  { id: 'cat-salary', name: '工资', icon: '💰', color: '#34D399', type: 'income', order: 0 },
  { id: 'cat-bonus', name: '奖金', icon: '🎁', color: '#FBBF24', type: 'income', order: 1 },
];

const createRecord = (overrides: Partial<AccountRecord> = {}): AccountRecord => ({
  id: 'rec-1',
  dateKey: '2026-09-01',
  amount: -50,
  type: 'expense',
  categoryId: 'cat-food',
  accountId: 'acc-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const mockRecords: AccountRecord[] = [
  createRecord({ id: 'rec-1', dateKey: '2026-09-01', amount: -50, type: 'expense', categoryId: 'cat-food' }),
  createRecord({ id: 'rec-2', dateKey: '2026-09-01', amount: -20, type: 'expense', categoryId: 'cat-transport' }),
  createRecord({ id: 'rec-3', dateKey: '2026-09-01', amount: 15000, type: 'income', categoryId: 'cat-salary' }),
  createRecord({ id: 'rec-4', dateKey: '2026-09-02', amount: -100, type: 'expense', categoryId: 'cat-food' }),
  createRecord({ id: 'rec-5', dateKey: '2026-09-02', amount: 5000, type: 'income', categoryId: 'cat-bonus' }),
];

// ── 金额计算测试 ─────────────────────────────────────────────

describe('金额计算', () => {
  it('sumIncome 计算总收入', () => {
    expect(sumIncome(mockRecords)).toBe(20000);
  });

  it('sumExpense 计算总支出', () => {
    expect(sumExpense(mockRecords)).toBe(170); // 50+20+100
  });

  it('netAmount 计算净收支', () => {
    expect(netAmount(mockRecords)).toBe(19830); // 20000-170
  });

  it('空数组返回 0', () => {
    expect(sumIncome([])).toBe(0);
    expect(sumExpense([])).toBe(0);
    expect(netAmount([])).toBe(0);
  });
});

// ── 日期聚合测试 ─────────────────────────────────────────────

describe('日期聚合', () => {
  it('groupByDate 按日期分组', () => {
    const grouped = groupByDate(mockRecords);
    expect(Object.keys(grouped).sort()).toEqual(['2026-09-01', '2026-09-02']);
    expect(grouped['2026-09-01']?.length).toBe(3);
    expect(grouped['2026-09-02']?.length).toBe(2);
  });

  it('groupByMonth 按月份分组', () => {
    const grouped = groupByMonth(mockRecords);
    expect(Object.keys(grouped)).toEqual(['2026-09']);
    expect(grouped['2026-09']?.length).toBe(5);
  });

  it('空数组返回空对象', () => {
    expect(groupByDate([])).toEqual({});
    expect(groupByMonth([])).toEqual({});
  });
});

// ── 分类聚合测试 ─────────────────────────────────────────────

describe('分类聚合', () => {
  it('groupByCategory 按分类分组', () => {
    const grouped = groupByCategory(mockRecords, mockCategories);
    expect(grouped.length).toBe(4);

    // 餐饮分类
    const foodCat = grouped.find(g => g.categoryId === 'cat-food');
    expect(foodCat).toBeDefined();
    expect((foodCat as { total: number; count: number }).total).toBe(-150); // 50+100
    expect((foodCat as { total: number; count: number }).count).toBe(2);

    // 工资分类
    const salaryCat = grouped.find(g => g.categoryId === 'cat-salary');
    expect(salaryCat).toBeDefined();
    expect((salaryCat as { total: number; count: number }).total).toBe(15000);
    expect((salaryCat as { total: number; count: number }).count).toBe(1);
  });

  it('groupByCategory 可按类型过滤', () => {
    const incomeOnly = groupByCategory(mockRecords, mockCategories, 'income');
    expect(incomeOnly.length).toBe(2);
    expect(incomeOnly.every(g => g.type === 'income')).toBe(true);

    const expenseOnly = groupByCategory(mockRecords, mockCategories, 'expense');
    expect(expenseOnly.length).toBe(2);
    expect(expenseOnly.every(g => g.type === 'expense')).toBe(true);
  });

  it('按金额降序排列', () => {
    const grouped = groupByCategory(mockRecords, mockCategories);
    expect(grouped.length).toBeGreaterThan(0);
    expect(grouped[0]?.categoryId).toBe('cat-salary'); // 15000，最大
    // 最后一个是金额最小的分类（-150 < -20，所以 cat-food 在最后）
    expect(grouped[grouped.length - 1]?.categoryId).toBe('cat-food');
  });
});

// ── 统计测试 ───────────────────────────────────────────────

describe('月度统计', () => {
  it('calcMonthlyStats 计算月度统计', () => {
    const stats = calcMonthlyStats(mockRecords, 2026, 8); // 9月 = month 8
    expect(stats.monthKey).toBe('2026-09');
    expect(stats.income).toBe(20000);
    expect(stats.expense).toBe(170);
    expect(stats.net).toBe(19830);
    expect(stats.recordCount).toBe(5);
  });

  it('空月份返回空统计', () => {
    const stats = calcMonthlyStats(mockRecords, 2026, 0); // 1月
    expect(stats.income).toBe(0);
    expect(stats.expense).toBe(0);
    expect(stats.net).toBe(0);
    expect(stats.recordCount).toBe(0);
  });
});

describe('每日统计', () => {
  it('calcDailyStats 计算每日统计', () => {
    const stats = calcDailyStats(mockRecords, '2026-09-01');
    expect(stats.dateKey).toBe('2026-09-01');
    expect(stats.income).toBe(15000);
    expect(stats.expense).toBe(70); // 50+20
    expect(stats.net).toBe(14930);
    expect(stats.recordCount).toBe(3);
  });

  it('空日期返回空统计', () => {
    const stats = calcDailyStats(mockRecords, '2026-09-30');
    expect(stats.income).toBe(0);
    expect(stats.expense).toBe(0);
    expect(stats.recordCount).toBe(0);
  });
});

// ── 池计算测试 ─────────────────────────────────────────────

describe('池计算', () => {
  const mockPool: PoolConfig = {
    id: 'pool-1',
    name: '房租池',
    type: 'equalize',
    amount: 3000,
    cycleMonths: 1,
    dayRange: { start: 1, end: 30 },
    createdAt: Date.now(),
  };

  const mockCycle: PoolCycle = {
    id: 'cycle-1',
    poolId: 'pool-1',
    monthKey: '2026-09',
    totalAmount: 3000,
    dayCount: 30,
    dailyVirtual: 100,
    paidAmount: 0,
    status: 'generating',
    transactions: [],
  };

  it('calcDailyVirtualAmount 计算日均虚拟金额', () => {
    expect(calcDailyVirtualAmount(mockPool, mockCycle)).toBe(100);
  });

  it('calcDailyVirtualAmount 零天数返回0', () => {
    expect(calcDailyVirtualAmount(mockPool, { ...mockCycle, dayCount: 0 })).toBe(0);
  });

  it('calcPoolConfirmedAmount 计算已确认金额', () => {
    const transactions: PoolTransaction[] = [
      { id: 't1', cycleId: 'cycle-1', dateKey: '2026-09-01', amount: 100, direction: 'in', status: 'confirmed' },
      { id: 't2', cycleId: 'cycle-1', dateKey: '2026-09-02', amount: 100, direction: 'in', status: 'confirmed' },
      { id: 't3', cycleId: 'cycle-1', dateKey: '2026-09-03', amount: 100, direction: 'in', status: 'virtual' },
    ];
    expect(calcPoolConfirmedAmount(transactions, 'in')).toBe(200);
  });

  it('calcPoolVirtualAmount 计算虚拟金额', () => {
    const transactions: PoolTransaction[] = [
      { id: 't1', cycleId: 'cycle-1', dateKey: '2026-09-01', amount: 100, direction: 'in', status: 'confirmed' },
      { id: 't2', cycleId: 'cycle-1', dateKey: '2026-09-02', amount: 100, direction: 'in', status: 'virtual' },
      { id: 't3', cycleId: 'cycle-1', dateKey: '2026-09-03', amount: 100, direction: 'in', status: 'virtual' },
    ];
    expect(calcPoolVirtualAmount(transactions, 'in')).toBe(200);
  });
});

// ── 排序测试 ───────────────────────────────────────────────

describe('排序', () => {
  it('sortRecords 按日期降序', () => {
    const sorted = sortRecords(mockRecords, { field: 'dateKey', order: 'desc' });
    expect(sorted.length).toBeGreaterThan(0);
    expect(sorted[0]?.dateKey).toBe('2026-09-02');
    expect(sorted[sorted.length - 1]?.dateKey).toBe('2026-09-01');
  });

  it('sortRecords 按日期升序', () => {
    const sorted = sortRecords(mockRecords, { field: 'dateKey', order: 'asc' });
    expect(sorted.length).toBeGreaterThan(0);
    expect(sorted[0]?.dateKey).toBe('2026-09-01');
  });

  it('sortRecords 按金额降序', () => {
    const sorted = sortRecords(mockRecords, { field: 'amount', order: 'desc' });
    expect(sorted.length).toBeGreaterThan(0);
    expect(sorted[0]?.amount).toBe(15000);
    expect(sorted[sorted.length - 1]?.amount).toBe(-100);
  });

  it('sortRecords 不修改原数组', () => {
    const copy = [...mockRecords];
    sortRecords(mockRecords, { field: 'dateKey', order: 'desc' });
    expect(mockRecords).toEqual(copy);
  });
});

// ── 格式化测试 ─────────────────────────────────────────────

describe('格式化', () => {
  it('formatAmount 格式化金额', () => {
    expect(formatAmount(1234)).toBe('1,234.00');
    expect(formatAmount(0)).toBe('0.00');
    expect(formatAmount(-50.5)).toBe('50.50');
  });

  it('formatAmount 显示正负号', () => {
    expect(formatAmount(100, true)).toBe('+100.00');
    expect(formatAmount(-100, true)).toBe('-100.00');
    expect(formatAmount(0, true)).toBe('0.00');
  });

  it('formatMonth 格式化月份', () => {
    expect(formatMonth('2026-09')).toBe('2026年9月');
    expect(formatMonth('2026-01')).toBe('2026年1月');
  });

  it('formatDate 格式化日期', () => {
    expect(formatDate('2026-09-15')).toBe('9月15日');
    expect(formatDate('2026-01-01')).toBe('1月1日');
  });
});

// ── 日期工具测试 ─────────────────────────────────────────────

describe('日期工具', () => {
  it('getTodayKey 返回正确格式', () => {
    const key = getTodayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getCurrentMonthKey 返回正确格式', () => {
    const key = getCurrentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  it('parseDateKey 解析日期', () => {
    const parsed = parseDateKey('2026-09-15');
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(8); // 0-indexed
    expect(parsed.day).toBe(15);
  });

  it('getDaysInMonth 获取天数', () => {
    // JavaScript 月份是 0-indexed，month=8 是 9 月
    expect(getDaysInMonth(2026, 8)).toBe(30);  // 9月
    expect(getDaysInMonth(2026, 1)).toBe(28);  // 2月非闰年
    expect(getDaysInMonth(2024, 1)).toBe(29);  // 2月闰年
    expect(getDaysInMonth(2026, 11)).toBe(31); // 12月
  });
});

// ── 验证测试 ───────────────────────────────────────────────

describe('验证', () => {
  it('isValidAmount 验证金额', () => {
    expect(isValidAmount(100)).toBe(true);
    expect(isValidAmount(-50)).toBe(true);
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(NaN)).toBe(false);
    expect(isValidAmount(Infinity)).toBe(false);
  });

  it('isValidDateKey 验证日期格式', () => {
    expect(isValidDateKey('2026-09-15')).toBe(true);
    expect(isValidDateKey('2026-9-15')).toBe(false);
    expect(isValidDateKey('26-09-15')).toBe(false);
    expect(isValidDateKey('2026/09/15')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });

  it('isValidMonthKey 验证月份格式', () => {
    expect(isValidMonthKey('2026-09')).toBe(true);
    expect(isValidMonthKey('2026-9')).toBe(false);
    expect(isValidMonthKey('26-09')).toBe(false);
    expect(isValidMonthKey('')).toBe(false);
  });
});
