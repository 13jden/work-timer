/**
 * @fileoverview time → accounting 工资联动同步回归测试。
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SalaryLinkageSync } from './useSalaryLinkageSync';
import { DEFAULT_CONFIG } from '../lib/constants';
import { useAccountStore } from '../store/accountStore';
import { useCalendarStore } from '../store/calendarStore';
import { useConfigStore } from '../store/configStore';
import { useMonthlyStore } from '../store/monthlyStore';

describe('SalaryLinkageSync', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 31, 20, 0, 0)); // 周一，下班后金额已定格
    localStorage.clear();
    useAccountStore.getState().reset();
    useConfigStore.setState({ ...DEFAULT_CONFIG, salaryLinkageEnabled: true });
    useCalendarStore.setState({ year: 2026, month: 7, dayOverrides: {}, monthlyRestModes: {} });
    useMonthlyStore.setState({ snapshots: {} });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  /**
   * v2.5-patch17 T-532 关键回归点:**同月**跨天(9-1 23:59 → 9-2 00:00)。
   * 这是 T-532 必须独立工作的场景——否则月度守卫 `if (py !== y || pm !== m) continue`
   * 也匹配通过(同月),然后 isWorkday 通过 → 昨日联动 record 会被错杀。
   *
   * 复现方式:
   *   1) 把系统时间拨到 9-1(周二)20:00,挂载 SalaryLinkageSync,
   *      等 1 秒,确认 9-1 联动 record(amount > 0)已写入;
   *   2) 把系统时间拨到 9-1 23:59:30,advance 90 秒 → 现在 9-2 00:01:00,
   *      y/m 仍是 (2026, 8)(同月),但 todayKey 从 9-1 翻到 9-2;
   *   3) 验证 9-1 联动 record **没被删除**,id 不变,amount 不变。
   */
  it('跨天守卫:同月跨日(9-1 → 9-2)时昨日联动记录不会被清空', async () => {
    // 1) 9-1 20:00:00 挂载
    vi.setSystemTime(new Date(2026, 8, 1, 20, 0, 0));
    await act(async () => {
      root.render(<SalaryLinkageSync />);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const yesterdayKey = '2026-09-01';
    const yesterdayBefore = useAccountStore.getState().records.find(
      (record) => record.linkageSource === 'salary-time-mode' && record.dateKey === yesterdayKey,
    );
    expect(yesterdayBefore?.amount).toBeGreaterThan(0);
    const yesterdayId = yesterdayBefore!.id;

    // 2) 把系统时间拨到 9-1 23:59:30,advance 90 秒 → 9-2 00:01:00(同月,m 仍是 8)
    vi.setSystemTime(new Date(2026, 8, 1, 23, 59, 30));
    await act(async () => {
      vi.advanceTimersByTime(90_000);
    });

    // 3) 9-1 联动 record 必须存在,id / amount 都不变。
    //    —— T-532 守卫生效的核心断言;
    //    若 T-532 失效,月度守卫因为「同月」形同虚设,9-1 会被错杀。
    const yesterdayAfter = useAccountStore.getState().records.find(
      (record) => record.linkageSource === 'salary-time-mode' && record.dateKey === yesterdayKey,
    );
    expect(yesterdayAfter).toBeDefined();
    expect(yesterdayAfter?.id).toBe(yesterdayId);
    expect(yesterdayAfter?.amount).toBe(yesterdayBefore?.amount);

    // 4) 9-2(今日)的联动 record 在凌晨 00:01 还没到工作段,
    //    todayEarned 返回 0 → upsert 路径不进 record 创建分支,也可能被今日实时 0 清掉。
    //    关键反证:9-1 的记录绝不能因此被牵连删除。
    const allSep1 = useAccountStore.getState().records.filter(
      (record) =>
        record.linkageSource === 'salary-time-mode' && record.dateKey === '2026-09-01',
    );
    expect(allSep1.length).toBe(1);
  });

  it('首次挂载后也会自动写入已定格的今日记录', async () => {
    await act(async () => {
      root.render(<SalaryLinkageSync />);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const linkage = useAccountStore.getState().records.find(
      (record) => record.linkageSource === 'salary-time-mode' && record.dateKey === '2026-08-31',
    );
    expect(linkage?.amount).toBeGreaterThan(0);
  });

  /**
   * v2.5-patch17 T-532 跨天守卫回归:跨午夜时昨日(8-31)的 salary-time-mode
   * 联动记录必须保留;今日(9-1)允许从 0 开始。
   *
   * 复现方式:挂载在 8-31 20:00 → 让 prev 写满 8 月 → vi.setSystemTime 把
   * 系统时间拨到 8-31 23:59:30 → advanceTimersByTime 跳 60 秒(useNow setInterval
   * 会触发 → setNow(new Date()) → React 重渲 → y/m 跨月 → effect 重新跑)。
   * 如果 patch17 的 T-532 守卫失效,8-31 联动 record 会被错杀,这条用例即失败。
   */
  it('跨天守卫:跨午夜时昨日联动记录不会被清空', async () => {
    // 1) 8-31 20:00 挂载,1s 内让 effect 跑一次,生成 8 月所有工作日联动 record
    await act(async () => {
      root.render(<SalaryLinkageSync />);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const yesterdayKey = '2026-08-31';
    const yesterdayBefore = useAccountStore.getState().records.find(
      (record) => record.linkageSource === 'salary-time-mode' && record.dateKey === yesterdayKey,
    );
    expect(yesterdayBefore?.amount).toBeGreaterThan(0);
    const yesterdayId = yesterdayBefore!.id;

    // prevMonthlyRef 仅记录「快照 + 今日实时」,没快照时上月就只有 todayKey 一条
    const augRecordsBefore = useAccountStore.getState().records.filter(
      (record) =>
        record.linkageSource === 'salary-time-mode' && record.dateKey.startsWith('2026-08-'),
    );
    expect(augRecordsBefore.length).toBeGreaterThanOrEqual(1);

    // 2) 拨系统时间到 8-31 23:59:30,advance 60s 跨午夜到 9-1 00:00:30
    vi.setSystemTime(new Date(2026, 7, 31, 23, 59, 30));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    // 3) 8-31(昨日)的联动 record 必须仍存在且 amount / id 不变
    //    —— T-532 守卫不失效,这是核心断言
    const yesterdayAfter = useAccountStore.getState().records.find(
      (record) => record.linkageSource === 'salary-time-mode' && record.dateKey === yesterdayKey,
    );
    expect(yesterdayAfter).toBeDefined();
    expect(yesterdayAfter?.id).toBe(yesterdayId);
    expect(yesterdayAfter?.amount).toBe(yesterdayBefore?.amount);

    // 4) 8 月的联动 record 数量必须仍是 prev 里的那一批
    const augRecordsAfter = useAccountStore.getState().records.filter(
      (record) =>
        record.linkageSource === 'salary-time-mode' && record.dateKey.startsWith('2026-08-'),
    );
    expect(augRecordsAfter.length).toBe(augRecordsBefore.length);

    // 5) 9-1(今日)允许不存在(凌晨 00:00 还在工作段外)——
    //    若存在,只能是同 dateKey 的单条,不该把任意历史 record 拉过来
    const todayKey = '2026-09-01';
    const todayRecords = useAccountStore.getState().records.filter(
      (record) => record.linkageSource === 'salary-time-mode' && record.dateKey === todayKey,
    );
    expect(todayRecords.length).toBeLessThanOrEqual(1);
  });

  /**
   * v3.0 TASK-058 T-507 回归：用户改名工资池后,ensureSalaryPool 仍应找到它,
   * 而不是再创建空池导致联动 record 写到新空池。
   *
   * 模拟 v2.5 旧版损坏状态:[改名后有 records 的旧池] + [broken code 创建的空池]
   * 共存,新版 ensureSalaryPool 必须:
   *   1) 选有 records 的池作为 keeper
   *   2) 把空池 + 它的 cycle 清掉
   *   3) 返回 keeper.id,后续联动 record 仍写到旧池
   */
  it('ensureSalaryPool:多个候选池时优先选有 records 的并清理空池', () => {
    const store = useAccountStore.getState();
    // 手动建一个「改名后有 records 的旧池」
    const oldPool = store.addPool({
      name: '我的工资',
      type: 'equalize',
      amount: 0,
      cycleMonths: 12,
      cycleMode: 'monthly',
      dayRange: { start: 1, end: 31 },
      direction: 'income',
      noDailyVirtual: true,
      settleMode: 'prepay',
      categoryId: 'cat-salary',
    });
    // 给旧池加 2 条联动 record
    const oldId = oldPool.id;
    useAccountStore.setState((s) => ({
      records: [
        ...s.records,
        {
          id: 'rec-old-1',
          dateKey: '2026-08-30',
          amount: 100,
          type: 'income' as const,
          categoryId: 'cat-salary',
          note: 'time 模式联动',
          accountId: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          poolId: oldId,
          poolDirection: 'in' as const,
          poolStatus: 'confirmed' as const,
          poolName: '我的工资',
          linkageSource: 'salary-time-mode' as const,
        },
        {
          id: 'rec-old-2',
          dateKey: '2026-08-31',
          amount: 200,
          type: 'income' as const,
          categoryId: 'cat-salary',
          note: 'time 模式联动',
          accountId: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          poolId: oldId,
          poolDirection: 'in' as const,
          poolStatus: 'confirmed' as const,
          poolName: '我的工资',
          linkageSource: 'salary-time-mode' as const,
        },
      ],
    }));

    // 模拟 v2.5 broken code 已经创建了空池 + 空 cycle
    const emptyPool = useAccountStore.getState().addPool({
      name: '工资池',
      type: 'equalize',
      amount: 0,
      cycleMonths: 12,
      cycleMode: 'monthly',
      dayRange: { start: 1, end: 31 },
      direction: 'income',
      noDailyVirtual: true,
      settleMode: 'prepay',
      categoryId: 'cat-salary',
    });

    // 调 ensureSalaryPool,期望返回旧池 id 且清掉空池
    const keeperId = useAccountStore.getState().ensureSalaryPool();
    expect(keeperId).toBe(oldId);
    const after = useAccountStore.getState();
    expect(after.pools.find((p) => p.id === emptyPool.id)).toBeUndefined();
    expect(after.pools.find((p) => p.id === oldId)).toBeDefined();
    // 旧池的 records 仍在
    expect(after.records.filter((r) => r.poolId === oldId).length).toBe(2);
  });
});
