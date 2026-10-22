/**
 * @fileoverview 一程（Journey）聚合纯函数（v3.0 TASK-059 T-592）
 *
 * 纯函数，无副作用，可直接单测。
 * 金额口径：总额 = Σ |amount|（绝对值求和），符号由 Journey.type 决定展示。
 * claimed（已关联定期账）记录计入一程总额，与统计页口径差异在详情页标注。
 */
import type { AccountRecord, Journey, RecordType } from '../types';

export interface JourneySummary {
  journeyId: string;
  count: number;
  /** 总额（Σ |amount|） */
  total: number;
  /** v3.0 TASK-059 fix: 按类型分别汇总，用于详情页推断实际类型 */
  expenseTotal: number;
  incomeTotal: number;
  firstKey: string;   // 最早 dateKey
  lastKey: string;    // 最晚 dateKey
  /** 已关联定期账的笔数（详情页标注用） */
  claimedCount: number;
  claimedTotal: number;
}

/**
 * 按一程聚合：总额 = Σ |record.amount|，符号由 type 决定。
 * startKey / endKey 从关联记录的 min/max dateKey 推导。
 */
export function journeyTotals(
  journeys: Journey[],
  records: AccountRecord[],
): Map<string, JourneySummary> {
  const result = new Map<string, JourneySummary>();

  for (const journey of journeys) {
    const linked = records.filter((r) => r.journeyId === journey.id);
    if (linked.length === 0) {
      result.set(journey.id, {
        journeyId: journey.id,
        count: 0,
        total: 0,
        expenseTotal: 0,
        incomeTotal: 0,
        firstKey: journey.startKey ?? '',
        lastKey: journey.endKey ?? '',
        claimedCount: 0,
        claimedTotal: 0,
      });
      continue;
    }

    const sorted = [...linked].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const firstKey = sorted[0]!.dateKey;
    const lastKey = sorted[sorted.length - 1]!.dateKey;

    let total = 0;
    let expenseTotal = 0;
    let incomeTotal = 0;
    let claimedCount = 0;
    let claimedTotal = 0;
    for (const r of linked) {
      const abs = Math.abs(r.amount);
      total += abs;
      if (r.type === 'expense') expenseTotal += abs;
      else incomeTotal += abs;
      if (r.poolStatus === 'claimed') {
        claimedCount++;
        claimedTotal += abs;
      }
    }

    result.set(journey.id, {
      journeyId: journey.id,
      count: linked.length,
      total: Math.round(total * 100) / 100,
      expenseTotal: Math.round(expenseTotal * 100) / 100,
      incomeTotal: Math.round(incomeTotal * 100) / 100,
      firstKey,
      lastKey,
      claimedCount,
      claimedTotal: Math.round(claimedTotal * 100) / 100,
    });
  }

  return result;
}

/**
 * 获取某类型的可挂一程列表（排除空程）—— 用于 AddRecordModal 选择器。
 * 按最近更新时间降序（最近使用的排前面）。
 */
export function availableJourneys(
  journeys: Journey[],
  type: RecordType,
): Journey[] {
  return journeys
    .filter((j) => j.type === type)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 验证：记录是否可以挂到指定一程（同 type 才可挂）。
 */
export function canAttachToJourney(record: AccountRecord, journey: Journey): boolean {
  return record.type === journey.type;
}

// ── v3.0 TASK-060：详情页按日期分组 ───────────────────────────────

export interface JourneyDayGroup {
  /** YYYY-MM-DD */
  dateKey: string;
  /** 当日记录（保持入参顺序） */
  items: AccountRecord[];
  /** 当日支出合计（Σ|amount|，仅 expense） */
  expense: number;
  /** 当日收入合计（Σ|amount|，仅 income） */
  income: number;
}

/**
 * 把一程的关联记录按日期分组（详情页「某一天消费了什么」用）。
 *
 * 约定：
 * - 分组顺序 = 首次出现顺序（调用方传入已按 dateKey 降序的记录即可得到倒序日期）
 * - 组内记录保持入参顺序
 * - expense / income 均为绝对值求和（金额符号由 RecordRow 的 type 决定）
 */
export function groupJourneyRecordsByDay(records: AccountRecord[]): JourneyDayGroup[] {
  const map = new Map<string, AccountRecord[]>();
  for (const r of records) {
    const list = map.get(r.dateKey);
    if (list) list.push(r);
    else map.set(r.dateKey, [r]);
  }
  return Array.from(map.entries()).map(([dateKey, items]) => {
    let expense = 0;
    let income = 0;
    for (const r of items) {
      if (r.type === 'expense') expense += Math.abs(r.amount);
      else income += Math.abs(r.amount);
    }
    return {
      dateKey,
      items,
      expense: Math.round(expense * 100) / 100,
      income: Math.round(income * 100) / 100,
    };
  });
}

/** 星期索引 → 中文（周日 = 0） */
export const JOURNEY_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** dateKey → 星期（非法日期返回空串） */
export function journeyWeekday(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return JOURNEY_WEEKDAYS[d.getDay()] ?? '';
}

/** dateKey → 日期章文本（10/21） */
export function journeyStampDate(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[1]}/${parts[2]}`;
}
