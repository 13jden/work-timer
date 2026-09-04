/**
 * @fileoverview Salary Timer — 池机制纯函数层（v2.3 · TASK-039）
 *
 * v2.3 定稿模型（按用户反馈重设计）：
 * - 建池**不预生成**任何记录；虚拟只是统计/展示层概念
 * - 均摊消费记录在「那一天到来时」逐日生成（每天一条真实消费记录）
 * - 认领 = 实际付款记录关联池并打 'claimed' 标记（预付性质，不计入消费统计），
 *   与每日均摊记录相互独立，删付款不回滚均摊
 *
 * 纯函数、无副作用、无 DOM 依赖，单测覆盖（pool.test.ts）。
 */
import type {
  PoolConfig,
  PoolCycle,
  PoolCycleStatus,
  PoolTransaction,
  AccountRecord,
} from '../types';

// ── 日期工具 ──────────────────────────────────────────────

/** 某月天数 */
export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y ?? 2026, m ?? 1, 0).getDate();
}

/**
 * 周期内生效日期 dateKey 列表（升序）。
 * @param monthKey - 'YYYY-MM'
 * @param dayRange - 生效日区间（1 起）；未配置则整月
 */
export function buildCycleDateKeys(
  monthKey: string,
  dayRange?: { start: number; end: number },
): string[] {
  const total = daysInMonth(monthKey);
  const start = Math.max(1, dayRange?.start ?? 1);
  const end = Math.min(total, dayRange?.end ?? total);
  const keys: string[] = [];
  for (let d = start; d <= end; d += 1) {
    keys.push(`${monthKey}-${String(d).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * 总额按天数均摊（保留 2 位小数，尾差补到最后一天）。
 */
export function splitDailyAmount(total: number, dayCount: number): number[] {
  if (dayCount <= 0) return [];
  const base = Math.floor((total / dayCount) * 100) / 100;
  const amounts = Array.from({ length: dayCount }, () => base);
  const used = Math.round(base * dayCount * 100) / 100;
  const remainder = Math.round((total - used) * 100) / 100;
  amounts[amounts.length - 1] = Math.round((base + remainder) * 100) / 100;
  return amounts;
}

// ── 按日模式：完整日期范围 ────────────────────────────────

/**
 * 日期范围跨过的月份 monthKey 列表（升序，含首尾）。
 */
export function eachMonthInRange(dateRange: { start: string; end: string }): string[] {
  if (!dateRange.start || !dateRange.end || dateRange.end < dateRange.start) return [];
  const keys: string[] = [];
  let cursor = dateRange.start.slice(0, 7);
  const endMonth = dateRange.end.slice(0, 7);
  while (cursor <= endMonth) {
    keys.push(cursor);
    cursor = addMonthKey(cursor, 1);
  }
  return keys;
}

/** monthKey ± n 月（本地辅助） */
function addMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 某月内落在完整日期范围内的 dateKey 列表（升序）。
 */
export function buildDateRangeKeys(
  dateRange: { start: string; end: string },
  monthKey: string,
): string[] {
  return buildCycleDateKeys(monthKey).filter(
    (key) => key >= dateRange.start && key <= dateRange.end,
  );
}

/**
 * 周期生效日期统一入口：
 * - 按日模式（有 dateRange）→ 完整日期范围与当月交集
 * - 按月模式 → 每月几号到几号
 */
export function getCycleDateKeys(pool: PoolConfig, monthKey: string): string[] {
  if (pool.cycleMode === 'daily' && pool.dateRange) {
    return buildDateRangeKeys(pool.dateRange, monthKey);
  }
  return buildCycleDateKeys(monthKey, pool.dayRange);
}

// ── 周期草稿（建池只生成元数据，不生成记录） ──────────────

/** 未带 id 的周期草稿 */
export interface CycleDraft {
  monthKey: string;
  totalAmount: number;
  dayCount: number;
  dailyVirtual: number;
  paidAmount: 0;
  status: 'generating';
  /** 周期生效日期列表（到期生成用） */
  dateKeys: string[];
}

/**
 * 均摊型池单周期草稿：只有元数据 + 生效日期列表，**不生成任何记录**。
 * 日均 = 用户自填 dailyAmount 优先，否则总额/天数。
 */
export function buildEqualizeCycleDraft(
  pool: PoolConfig,
  monthKey: string,
): CycleDraft {
  const dateKeys = getCycleDateKeys(pool, monthKey);
  const dayCount = dateKeys.length;
  const dailyVirtual =
    pool.dailyAmount ?? (dayCount > 0 ? Math.round((pool.amount / dayCount) * 100) / 100 : 0);
  return {
    monthKey,
    totalAmount: pool.amount,
    dayCount,
    dailyVirtual,
    paidAmount: 0,
    status: 'generating',
    dateKeys,
  };
}

/**
 * 存池型池常驻周期草稿（空交易，建池当月创建，承载后续存入/取出）。
 */
export function buildDepositCycleDraft(
  pool: PoolConfig,
  monthKey: string,
): CycleDraft {
  return {
    monthKey,
    totalAmount: pool.amount,
    dayCount: 0,
    dailyVirtual: 0,
    paidAmount: 0,
    status: 'generating',
    dateKeys: [],
  };
}

// ── 到期生成 ──────────────────────────────────────────────

/**
 * 到期生成计划：周期内「已到来且尚未生成」的日期。
 * @param cycle - 周期（transactions 记录已生成日期）
 * @param dateKeys - 周期生效日期列表
 * @param todayKey - 今天（只生成 <= 今天的）
 */
export function planDailyRecords(
  cycle: Pick<PoolCycle, 'transactions'>,
  dateKeys: string[],
  todayKey: string,
): string[] {
  const done = new Set(cycle.transactions.map((t) => t.dateKey));
  return dateKeys.filter((key) => key <= todayKey && !done.has(key));
}

// ── 状态派生 ──────────────────────────────────────────────

/**
 * 周期状态派生（按已认领额 + 是否结束）：
 * - 已认领 >= 总额 → confirmed
 * - 已到期未认领足 → overdue
 * - 其余 → generating
 */
export function deriveCycleStatus(
  paidAmount: number,
  totalAmount: number,
  ended: boolean,
): PoolCycleStatus {
  if (paidAmount + 1e-9 >= totalAmount) return 'confirmed';
  if (ended) return 'overdue';
  return 'generating';
}

/**
 * 周期是否已结束：最后生效日 < 今天。
 */
export function isCycleEnded(dateKeys: string[], todayKey: string): boolean {
  if (dateKeys.length === 0) return false;
  const last = dateKeys[dateKeys.length - 1] ?? '';
  return last < todayKey;
}

// ── 存池余额 / 进度 ───────────────────────────────────────

/**
 * 存池型池余额 = Σ(in 已确认) − Σ(out 已确认)。
 */
export function depositBalance(transactions: PoolTransaction[]): number {
  let balance = 0;
  for (const t of transactions) {
    if (t.status !== 'confirmed') continue;
    balance += t.direction === 'in' ? t.amount : -t.amount;
  }
  return Math.round(balance * 100) / 100;
}

/** 均摊型池认领进度：已认领 / 总额（0-1） */
export function equalizeProgress(cycles: PoolCycle[]): number {
  let total = 0;
  let paid = 0;
  for (const c of cycles) {
    total += c.totalAmount;
    paid += c.paidAmount ?? 0;
  }
  return total > 0 ? Math.min(1, paid / total) : 0;
}

// ── 记录分类辅助 ──────────────────────────────────────────

/** 旧预生成虚拟记录（存量兼容） */
export function isVirtualPoolRecord(record: AccountRecord): boolean {
  return record.poolStatus === 'virtual';
}

/**
 * 均摊池认领的付款记录（预付性质）：
 * 不计入消费统计，仅作为资金流水存在。
 */
export function isPoolPrepaidRecord(record: AccountRecord): boolean {
  return record.poolStatus === 'claimed';
}
