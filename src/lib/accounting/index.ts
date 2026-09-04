/**
 * Salary Timer — Accounting Utility Functions
 *
 * 记账相关的纯函数，不依赖 Zustand store。
 * 用于计算、聚合、格式化等逻辑，便于单元测试。
 */
import type {
  AccountRecord,
  Category,
  PoolConfig,
  PoolCycle,
  PoolTransaction,
} from '../types';

// v2.3：默认可见记录过滤（排除池虚拟记录）
// v2.4 T-410：列表可见过滤（含认领）+ 余额影响判定
export { visibleRecords, listableRecords, recordAffectsBalance } from './stats';

// v2.4：虚拟资产分解（实际 + 预付未消耗 + 已赚未到账）
export { calcVirtualAssets, isPoolDailyRecord } from './virtual';
export type { VirtualAssetsBreakdown } from './virtual';

// ── 金额计算 ────────────────────────────────────────────────

/**
 * 计算一组记录的总收入
 */
export function sumIncome(records: AccountRecord[]): number {
  return records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
}

/**
 * 计算一组记录的总支出
 */
export function sumExpense(records: AccountRecord[]): number {
  return records.filter(r => r.type === 'expense').reduce((sum, r) => sum + Math.abs(r.amount), 0);
}

/**
 * 计算净收支（收入 - 支出）
 */
export function netAmount(records: AccountRecord[]): number {
  return sumIncome(records) - sumExpense(records);
}

// ── 日期聚合 ────────────────────────────────────────────────

/**
 * 按日期聚合记录
 * @returns Record<YYYY-MM-DD, AccountRecord[]>
 */
export function groupByDate(records: AccountRecord[]): Record<string, AccountRecord[]> {
  return records.reduce((acc, record) => {
    const date = record.dateKey;
    if (!acc[date]) acc[date] = [];
    acc[date].push(record);
    return acc;
  }, {} as Record<string, AccountRecord[]>);
}

/**
 * 按月份聚合记录
 * @returns Record<YYYY-MM, AccountRecord[]>
 */
export function groupByMonth(records: AccountRecord[]): Record<string, AccountRecord[]> {
  return records.reduce((acc, record) => {
    const month = record.dateKey.slice(0, 7); // YYYY-MM
    if (!acc[month]) acc[month] = [];
    acc[month].push(record);
    return acc;
  }, {} as Record<string, AccountRecord[]>);
}

// ── 分类聚合 ────────────────────────────────────────────────

/**
 * 按分类聚合记录，返回每个分类的总金额
 * @param records 记录列表
 * @param categories 分类列表（用于获取名称和图标）
 * @param type 可选，按类型过滤
 */
export function groupByCategory(
  records: AccountRecord[],
  categories: Category[],
  type?: 'income' | 'expense',
): Array<{
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  type: 'income' | 'expense';
  total: number;
  count: number;
}> {
  const filtered = type ? records.filter(r => r.type === type) : records;
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const grouped = filtered.reduce((acc, record) => {
    const key = record.categoryId;
    if (!acc[key]) {
      const cat = categoryMap.get(key);
      acc[key] = {
        categoryId: key,
        categoryName: cat?.name ?? '未知',
        categoryIcon: cat?.icon ?? '❓',
        categoryColor: cat?.color ?? '#9CA3AF',
        type: record.type,
        total: 0,
        count: 0,
      };
    }
    acc[key].total += record.amount;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, {
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    type: 'income' | 'expense';
    total: number;
    count: number;
  }>);

  return Object.values(grouped).sort((a, b) => b.total - a.total);
}

// ── 月度统计 ────────────────────────────────────────────────

export interface MonthlyStats {
  monthKey: string;       // YYYY-MM
  income: number;
  expense: number;
  net: number;
  recordCount: number;
}

/**
 * 计算指定月份的统计数据
 */
export function calcMonthlyStats(records: AccountRecord[], year: number, month: number): MonthlyStats {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthRecords = records.filter(r => r.dateKey.startsWith(prefix));

  return {
    monthKey: prefix,
    income: sumIncome(monthRecords),
    expense: sumExpense(monthRecords),
    net: netAmount(monthRecords),
    recordCount: monthRecords.length,
  };
}

// ── 每日统计 ────────────────────────────────────────────────

export interface DailyStats {
  dateKey: string;
  income: number;
  expense: number;
  net: number;
  recordCount: number;
}

/**
 * 计算指定日期的统计数据
 */
export function calcDailyStats(records: AccountRecord[], dateKey: string): DailyStats {
  const dayRecords = records.filter(r => r.dateKey === dateKey);

  return {
    dateKey,
    income: sumIncome(dayRecords),
    expense: sumExpense(dayRecords),
    net: netAmount(dayRecords),
    recordCount: dayRecords.length,
  };
}

// ── 池计算 ─────────────────────────────────────────────────

/**
 * 计算均摊池的日均虚拟金额
 * @param pool 池配置
 * @param cycle 池周期
 */
export function calcDailyVirtualAmount(pool: PoolConfig, cycle: PoolCycle): number {
  if (pool.type !== 'equalize') return 0;

  // 日均 = 总金额 / 实际天数
  return cycle.dayCount > 0 ? cycle.totalAmount / cycle.dayCount : 0;
}

/**
 * 为均摊池生成指定日期的虚拟交易记录
 */
export function generateVirtualTransaction(
  cycleId: string,
  dateKey: string,
  dailyAmount: number,
  direction: 'in' | 'out' = 'in',
): PoolTransaction {
  return {
    id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cycleId,
    dateKey,
    amount: dailyAmount,
    direction,
    status: 'virtual',
  };
}

/**
 * 计算池的已确认金额
 */
export function calcPoolConfirmedAmount(
  transactions: PoolTransaction[],
  direction: 'in' | 'out',
): number {
  return transactions
    .filter(t => t.direction === direction && t.status === 'confirmed')
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * 计算池的虚拟金额（未确认）
 */
export function calcPoolVirtualAmount(
  transactions: PoolTransaction[],
  direction: 'in' | 'out',
): number {
  return transactions
    .filter(t => t.direction === direction && t.status === 'virtual')
    .reduce((sum, t) => sum + t.amount, 0);
}

// ── 排序 ────────────────────────────────────────────────────

export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: 'dateKey' | 'amount' | 'createdAt';
  order: SortOrder;
}

/**
 * 对记录列表排序
 */
export function sortRecords(
  records: AccountRecord[],
  config: SortConfig,
): AccountRecord[] {
  const sorted = [...records];
  const multiplier = config.order === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    if (config.field === 'dateKey') {
      return multiplier * a.dateKey.localeCompare(b.dateKey);
    }
    if (config.field === 'amount') {
      return multiplier * (a.amount - b.amount);
    }
    return multiplier * (a.createdAt - b.createdAt);
  });

  return sorted;
}

// ── 格式化 ─────────────────────────────────────────────────

/**
 * 格式化金额显示
 * @param amount 金额
 * @param showSign 是否显示正负号
 */
export function formatAmount(amount: number, showSign = false): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (!showSign) return formatted;

  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

/**
 * 格式化月度显示
 * @param monthKey YYYY-MM 格式
 */
export function formatMonth(monthKey: string): string {
  const parts = monthKey.split('-');
  const year = parts[0] ?? '';
  const month = parts[1] ?? '01';
  const monthNum = parseInt(month, 10);
  return `${year}年${monthNum}月`;
}

/**
 * 格式化日期显示
 * @param dateKey YYYY-MM-DD 格式
 */
export function formatDate(dateKey: string): string {
  const parts = dateKey.split('-');
  const month = parts[1] ?? '01';
  const day = parts[2] ?? '01';
  return `${parseInt(month, 10)}月${parseInt(day, 10)}日`;
}

// ── 日期工具 ────────────────────────────────────────────────

/**
 * 获取今天的日期 key
 */
export function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 获取当月的月份 key
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 解析日期 key 为年、月、日
 */
export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const parts = dateKey.split('-').map(Number);
  return {
    year: parts[0] ?? 0,
    month: (parts[1] ?? 1) - 1,
    day: parts[2] ?? 1,
  };
}

/**
 * 获取月份的天数
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * 判断是否为今天
 */
export function isToday(dateKey: string): boolean {
  return dateKey === getTodayKey();
}

// ── 验证 ────────────────────────────────────────────────────

/**
 * 验证金额是否为有效数字
 */
export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount !== 0;
}

/**
 * 验证日期格式
 */
export function isValidDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

/**
 * 验证月份格式
 */
export function isValidMonthKey(monthKey: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthKey);
}
