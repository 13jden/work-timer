/**
 * @fileoverview Salary Timer — 记账统计聚合纯函数（v2.2 · TASK-038）
 *
 * 统计页三视图 / 记账日历共用的数据聚合逻辑。
 * 纯函数、无副作用、无 DOM 依赖，100% 单测覆盖（stats.test.ts）。
 *
 * 约定：
 * - 支出在 AccountRecord.amount 中存负数，聚合结果统一输出正数
 * - 未分类记录（isUncategorized=true）归入 UNCATEGORIZED_ID 虚拟分类
 * - 虚拟池记录（poolStatus='virtual'）默认不参与统计（v2.3 池机制启用，预留开关）
 */
import type { AccountRecord, RecordType } from '../types';

/** 未分类虚拟分类 ID（排行 / 分类记录页共用） */
export const UNCATEGORIZED_ID = '__uncategorized__';

/** 统计聚合选项 */
export interface StatsOptions {
  /** 是否纳入虚拟池记录（poolStatus='virtual'），默认 false（v2.3 前不统计） */
  includeVirtualPool?: boolean;
}

/** 单日 / 单月收支聚合结果（均为正数） */
export interface PeriodAggregate {
  income: number;
  expense: number;
}

/** 分类聚合结果 */
export interface CategoryAggregate {
  /** 分类 ID；未分类记录为 UNCATEGORIZED_ID */
  categoryId: string;
  /** 总金额（正数） */
  total: number;
  /** 占本期该类型总额百分比（0-100，未舍入） */
  percent: number;
  /** 记录笔数 */
  count: number;
}

/** 收支汇总 */
export interface RecordsSummary {
  income: number;
  expense: number;
  net: number;
}

/** 虚拟池开关：默认过滤掉池虚拟记录与均摊认领付款记录（预付不计消费） */
function isVisible(record: AccountRecord, options?: StatsOptions): boolean {
  if (!options?.includeVirtualPool && record.poolStatus === 'virtual') return false;
  // v2.3：均摊池认领的付款记录是预付性质，永远不计入消费统计
  if (record.poolStatus === 'claimed') return false;
  return true;
}

/**
 * 默认可见记录：排除池虚拟记录 + 均摊认领付款记录（v2.3）。
 * UI 组件读取 records 做展示聚合时统一先过此函数，
 * 避免虚拟预扣 / 预付流水污染今日流水 / 分类统计 / 未分类区。
 */
export function visibleRecords(records: AccountRecord[]): AccountRecord[] {
  return records.filter((r) => r.poolStatus !== 'virtual' && r.poolStatus !== 'claimed');
}

/**
 * 按 dateKey 范围过滤（闭区间，YYYY-MM-DD 字符串可直接比较）。
 * @param records - 记录列表
 * @param startKey - 起始日期（含），如 '2026-09-01'
 * @param endKey - 结束日期（含），如 '2026-09-30'
 */
export function filterByRange(
  records: AccountRecord[],
  startKey: string,
  endKey: string,
): AccountRecord[] {
  return records.filter((r) => r.dateKey >= startKey && r.dateKey <= endKey);
}

/**
 * 按日聚合收支。
 * @returns Map<dateKey, { income, expense }>，支出为正数
 */
export function aggregateByDay(
  records: AccountRecord[],
  options?: StatsOptions,
): Map<string, PeriodAggregate> {
  const map = new Map<string, PeriodAggregate>();
  for (const r of records) {
    if (!isVisible(r, options)) continue;
    const slot = map.get(r.dateKey) ?? { income: 0, expense: 0 };
    if (r.type === 'income') slot.income += r.amount;
    else slot.expense += Math.abs(r.amount);
    map.set(r.dateKey, slot);
  }
  return map;
}

/**
 * 按月聚合收支。
 * @returns Map<monthKey(YYYY-MM), { income, expense }>，支出为正数
 */
export function aggregateByMonth(
  records: AccountRecord[],
  options?: StatsOptions,
): Map<string, PeriodAggregate> {
  const map = new Map<string, PeriodAggregate>();
  for (const r of records) {
    if (!isVisible(r, options)) continue;
    const monthKey = r.dateKey.slice(0, 7);
    const slot = map.get(monthKey) ?? { income: 0, expense: 0 };
    if (r.type === 'income') slot.income += r.amount;
    else slot.expense += Math.abs(r.amount);
    map.set(monthKey, slot);
  }
  return map;
}

/**
 * 按分类聚合指定类型的记录，总额降序。
 *
 * 未分类记录（isUncategorized=true）归入 UNCATEGORIZED_ID 虚拟分类。
 * @param records - 记录列表（本期已过滤）
 * @param type - 'expense' | 'income'
 * @returns 分类聚合数组，含占比（相对本期该类型总额）
 */
export function aggregateByCategory(
  records: AccountRecord[],
  type: RecordType,
  options?: StatsOptions,
): CategoryAggregate[] {
  const totals = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;

  for (const r of records) {
    if (r.type !== type || !isVisible(r, options)) continue;
    const key = r.isUncategorized ? UNCATEGORIZED_ID : r.categoryId;
    const amount = Math.abs(r.amount);
    const slot = totals.get(key) ?? { total: 0, count: 0 };
    slot.total += amount;
    slot.count += 1;
    totals.set(key, slot);
    grandTotal += amount;
  }

  return Array.from(totals.entries())
    .map(([categoryId, slot]) => ({
      categoryId,
      total: slot.total,
      percent: grandTotal > 0 ? (slot.total / grandTotal) * 100 : 0,
      count: slot.count,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * 日期平移：dateKey ± n 天。
 * @param dateKey - 'YYYY-MM-DD'
 * @param delta - 天数偏移（负数为往前）
 */
export function shiftDay(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * 月份平移：monthKey ± n 月。
 * @param monthKey - 'YYYY-MM'
 * @param delta - 月数偏移（负数为往前）
 */
export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 汇总一组记录的总收入 / 总支出 / 净额。
 * @returns { income, expense, net }，支出为正数，net = income - expense
 */
export function sumRecords(
  records: AccountRecord[],
  options?: StatsOptions,
): RecordsSummary {
  let income = 0;
  let expense = 0;
  for (const r of records) {
    if (!isVisible(r, options)) continue;
    if (r.type === 'income') income += r.amount;
    else expense += Math.abs(r.amount);
  }
  return { income, expense, net: income - expense };
}
