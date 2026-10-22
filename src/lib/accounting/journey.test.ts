/**
 * @fileoverview journeyTotals 单测（v3.0 TASK-059 T-592）
 */
import { describe, it, expect } from 'vitest';
import {
  journeyTotals, availableJourneys, canAttachToJourney,
  groupJourneyRecordsByDay, journeyStampDate, journeyWeekday,
} from './journey';
import type { AccountRecord, Journey } from '../types';

const mkRecord = (
  id: string,
  journeyId: string,
  amount: number,
  type: 'income' | 'expense',
  dateKey: string,
  poolStatus?: 'claimed',
): AccountRecord => ({
  id, journeyId, amount, type, dateKey,
  categoryId: 'cat-food',
  accountId: 'acc-1',
  createdAt: 0, updatedAt: 0,
  ...(poolStatus ? { poolStatus } : {}),
});

const mkJourney = (id: string, title: string, type: 'income' | 'expense'): Journey => ({
  id, title, type,
  createdAt: 0, updatedAt: 0,
});

describe('journeyTotals', () => {
  it('空记录返回零值', () => {
    const journeys = [mkJourney('j1', '旅行', 'expense')];
    const totals = journeyTotals(journeys, []);
    expect(totals.get('j1')).toEqual({
      journeyId: 'j1', count: 0, total: 0,
      expenseTotal: 0, incomeTotal: 0,
      firstKey: '', lastKey: '',
      claimedCount: 0, claimedTotal: 0,
    });
  });

  it('总额 = Σ|amount|，按类型分组，claimed 单独累计', () => {
    const journeys = [mkJourney('j1', '旅行', 'expense')];
    const records = [
      mkRecord('r1', 'j1', 500, 'expense', '2026-10-01'),
      mkRecord('r2', 'j1', 300, 'expense', '2026-10-03'),
      mkRecord('r3', 'j1', 200, 'expense', '2026-10-05', 'claimed'),
    ];
    const totals = journeyTotals(journeys, records);
    expect(totals.get('j1')).toMatchObject({
      count: 3,
      total: 1000,
      expenseTotal: 1000,
      incomeTotal: 0,
      firstKey: '2026-10-01',
      lastKey: '2026-10-05',
      claimedCount: 1,
      claimedTotal: 200,
    });
  });

  it('收入与支出分别累计到 incomeTotal / expenseTotal', () => {
    const journeys = [mkJourney('j1', '杂项', 'expense')];
    const records = [
      mkRecord('r1', 'j1', 500, 'expense', '2026-10-01'),
      mkRecord('r2', 'j1', 200, 'income', '2026-10-03'),
    ];
    const totals = journeyTotals(journeys, records);
    expect(totals.get('j1')).toMatchObject({
      count: 2,
      total: 700,
      expenseTotal: 500,
      incomeTotal: 200,
    });
  });

  it('firstKey/lastKey 取关联记录的 min/max dateKey', () => {
    const journeys = [mkJourney('j1', '旅行', 'expense')];
    const records = [
      mkRecord('r1', 'j1', 100, 'expense', '2026-10-10'),
      mkRecord('r2', 'j1', 200, 'expense', '2026-10-05'),
    ];
    const totals = journeyTotals(journeys, records);
    expect(totals.get('j1')?.firstKey).toBe('2026-10-05');
    expect(totals.get('j1')?.lastKey).toBe('2026-10-10');
  });

  it('不关联任何记录的一程返回 startKey/endKey', () => {
    const journey: Journey = {
      id: 'j1', title: '兼职', type: 'income',
      startKey: '2026-10-01', endKey: '2026-10-15',
      createdAt: 0, updatedAt: 0,
    };
    const totals = journeyTotals([journey], []);
    expect(totals.get('j1')).toMatchObject({
      firstKey: '2026-10-01',
      lastKey: '2026-10-15',
    });
  });
});

describe('availableJourneys', () => {
  it('按类型过滤并按 updatedAt 降序', () => {
    const journeys: Journey[] = [
      { id: 'j1', title: '旅行', type: 'expense', createdAt: 0, updatedAt: 100 },
      { id: 'j2', title: '兼职', type: 'income', createdAt: 0, updatedAt: 200 },
      { id: 'j3', title: '周末游', type: 'expense', createdAt: 0, updatedAt: 50 },
    ];
    const result = availableJourneys(journeys, 'expense');
    expect(result.map((j) => j.id)).toEqual(['j1', 'j3']);
  });
});

describe('canAttachToJourney', () => {
  it('同 type 可以挂', () => {
    const journey = mkJourney('j1', '旅行', 'expense');
    const record = mkRecord('r1', '', 100, 'expense', '2026-10-01');
    expect(canAttachToJourney(record, journey)).toBe(true);
  });

  it('不同 type 不可以挂', () => {
    const journey = mkJourney('j1', '兼职', 'income');
    const record = mkRecord('r1', '', 100, 'expense', '2026-10-01');
    expect(canAttachToJourney(record, journey)).toBe(false);
  });
});

describe('groupJourneyRecordsByDay', () => {
  it('空数组返回空分组', () => {
    expect(groupJourneyRecordsByDay([])).toEqual([]);
  });

  it('按 dateKey 分组，组内保持入参顺序', () => {
    const records = [
      mkRecord('r1', 'j1', 100, 'expense', '2026-10-21'),
      mkRecord('r2', 'j1', 200, 'expense', '2026-10-20'),
      mkRecord('r3', 'j1', 300, 'expense', '2026-10-21'),
    ];
    const groups = groupJourneyRecordsByDay(records);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-10-21', '2026-10-20']);
    expect(groups[0]!.items.map((r) => r.id)).toEqual(['r1', 'r3']);
    expect(groups[1]!.items.map((r) => r.id)).toEqual(['r2']);
  });

  it('当日支出 / 收入分别按绝对值累计', () => {
    const records = [
      mkRecord('r1', 'j1', -100, 'expense', '2026-10-21'),
      mkRecord('r2', 'j1', -50.5, 'expense', '2026-10-21'),
      mkRecord('r3', 'j1', 300, 'income', '2026-10-21'),
    ];
    const groups = groupJourneyRecordsByDay(records);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.expense).toBe(150.5);
    expect(groups[0]!.income).toBe(300);
  });

  it('支出 / 收入分属不同日期时互不串账', () => {
    const records = [
      mkRecord('r1', 'j1', -100, 'expense', '2026-10-21'),
      mkRecord('r2', 'j1', 300, 'income', '2026-10-20'),
    ];
    const groups = groupJourneyRecordsByDay(records);
    expect(groups[0]!.expense).toBe(100);
    expect(groups[0]!.income).toBe(0);
    expect(groups[1]!.expense).toBe(0);
    expect(groups[1]!.income).toBe(300);
  });
});

describe('journeyStampDate / journeyWeekday', () => {
  it('日期章文本取 M/D', () => {
    expect(journeyStampDate('2026-10-21')).toBe('10/21');
    expect(journeyStampDate('2026-01-05')).toBe('01/05');
  });

  it('非法日期原样返回', () => {
    expect(journeyStampDate('bad-key')).toBe('bad-key');
  });

  it('星期换算正确（2026-10-21 是周三）', () => {
    expect(journeyWeekday('2026-10-21')).toBe('周三');
    expect(journeyWeekday('2026-10-18')).toBe('周日');
  });

  it('非法日期返回空串', () => {
    expect(journeyWeekday('bad-key')).toBe('');
  });
});
