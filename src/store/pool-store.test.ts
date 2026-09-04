/**
 * @fileoverview Salary Timer — 池机制 store 业务流程集成测试（v2.3 · TASK-039 重设计后）
 *
 * 模型：建池不预生成记录；到期逐日生成真实消费记录；
 * 认领 = 付款记录打 'claimed' 标记（预付，不计消费统计），与均摊记录相互独立。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountStore } from './accountStore';
import { depositBalance } from '../lib/accounting/pool';
import { getCurrentMonthKey, getTodayKey, visibleRecords } from '../lib/accounting';
import { shiftMonth as shiftMonthForTest } from '../lib/accounting/stats';

describe('accountStore · 池业务（v2.3 重设计）', () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
  });

  /** 建一个可用的账户和分类，返回 id */
  function setupBase() {
    const s = useAccountStore.getState();
    const account = s.addAccount({ name: '现金', balance: 10000, color: '#888', type: 'cash', order: 0 });
    const category = s.addCategory({ name: '房租', icon: 'house', color: '#C04A3A', type: 'expense', order: 0 });
    return { accountId: account.id, categoryId: category.id };
  }

  /** 当前是几号 */
  const todayDay = parseInt(getTodayKey().slice(8), 10);

  // ── 建池：不预生成 + 到期逐日生成 ──────────────────────

  it('均摊池创建：不预生成未来记录，只为已到来日期生成消费记录', () => {
    const { accountId, categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });

    const state = useAccountStore.getState();
    const cycles = state.cycles.filter((c) => c.poolId === pool.id);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.monthKey).toBe(getCurrentMonthKey());

    // 只生成 1 号～今天的消费记录（今天 9 月 4 日 → 4 条）
    const dailyRecords = state.records.filter(
      (r) => r.poolId === pool.id && !r.poolStatus,
    );
    expect(dailyRecords).toHaveLength(todayDay);
    expect(dailyRecords[0]?.dateKey).toBe(`${getCurrentMonthKey()}-01`);
    expect(dailyRecords[0]?.amount).toBe(-100); // 3000/30
    // 普通消费记录：无池状态标记 → 计入统计、可编辑删除
    expect(dailyRecords[0]?.poolStatus).toBeUndefined();

    // 账户余额不受均摊记录影响（真实扣减由用户付款时产生）
    expect(state.getAccountBalance(accountId)).toBe(10000);
  });

  it('按日模式：完整日期范围内每天一条，范围外不生成', () => {
    const { categoryId } = setupBase();
    // 当月 1~2 号（必然已到来）
    const monthKey = getCurrentMonthKey();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '短期订阅', type: 'equalize', amount: 500, cycleMonths: 1,
      cycleMode: 'daily',
      dateRange: { start: `${monthKey}-01`, end: `${monthKey}-02` },
      dailyAmount: 250, categoryId,
    });
    const state = useAccountStore.getState();
    const dailyRecords = state.records.filter((r) => r.poolId === pool.id);
    expect(dailyRecords).toHaveLength(2);
    expect(dailyRecords.every((r) => r.amount === -250)).toBe(true);
  });

  it('按日模式跨月：按月拆周期，生成范围内记录', () => {
    const { categoryId } = setupBase();
    const monthKey = getCurrentMonthKey();
    const nextMonth = shiftMonthForTest(monthKey, 1);
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '跨月订阅', type: 'equalize', amount: 600, cycleMonths: 2,
      cycleMode: 'daily',
      // 当月 25 号 ~ 次月 5 号（当月部分已到来，次月部分未到）
      dateRange: { start: `${monthKey}-25`, end: `${nextMonth}-05` },
      categoryId,
    });
    const state = useAccountStore.getState();
    const cycles = state.cycles.filter((c) => c.poolId === pool.id);
    expect(cycles.map((c) => c.monthKey)).toEqual([monthKey, nextMonth]);
    // 只生成当月 25 号～今天（今天 >= 25 号才成立；今天 < 25 号则为 0 条）
    const todayKey = getTodayKey();
    const expectedDue =
      todayKey >= `${monthKey}-25`
        ? parseInt(todayKey.slice(8), 10) - 25 + 1
        : 0;
    expect(state.records.filter((r) => r.poolId === pool.id)).toHaveLength(expectedDue);
  });

  it('syncPoolCycles 幂等：重复调用不重复生成', () => {
    const { categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId,
    });
    useAccountStore.getState().syncPoolCycles();
    useAccountStore.getState().syncPoolCycles();
    const count = useAccountStore
      .getState()
      .records.filter((r) => r.poolId === pool.id).length;
    expect(count).toBe(todayDay);
  });

  // ── 认领：关联标记，不产生第二条记录 ────────────────────

  it('认领：付款记录打 claimed 标记、周期认领额累计', () => {
    const { accountId, categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });

    // 交房租 ¥3000（实际付款，扣账户余额）
    const record = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -3000, type: 'expense', categoryId, accountId,
    });
    expect(useAccountStore.getState().claimToPool(record.id, pool.id)).toBe(3000);

    const state = useAccountStore.getState();
    const claimed = state.records.find((r) => r.id === record.id);
    expect(claimed?.poolStatus).toBe('claimed');
    expect(claimed?.poolDirection).toBe('out');

    const cycle = state.cycles.find((c) => c.poolId === pool.id);
    expect(cycle?.paidAmount).toBe(3000);
    expect(cycle?.status).toBe('confirmed');

    // 认领不产生第二条记录：总记录 = 每日均摊 + 1 条付款
    const poolRecords = state.records.filter((r) => r.poolId === pool.id);
    expect(poolRecords).toHaveLength(todayDay + 1);
  });

  it('claimed 付款记录不计入消费统计，每日均摊记录计入', () => {
    const { accountId, categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });
    const record = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -3000, type: 'expense', categoryId, accountId,
    });
    useAccountStore.getState().claimToPool(record.id, pool.id);

    const visible = visibleRecords(useAccountStore.getState().records);
    // 付款记录被过滤，每日均摊保留
    expect(visible.some((r) => r.id === record.id)).toBe(false);
    expect(visible.filter((r) => r.poolId === pool.id)).toHaveLength(todayDay);
  });

  // ── 相互独立：删付款不回滚均摊 ──────────────────────────

  it('删除付款记录：认领额回退，每日均摊记录不受影响', () => {
    const { accountId, categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });
    const record = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -3000, type: 'expense', categoryId, accountId,
    });
    useAccountStore.getState().claimToPool(record.id, pool.id);

    useAccountStore.getState().deleteRecord(record.id);

    const state = useAccountStore.getState();
    const cycle = state.cycles.find((c) => c.poolId === pool.id);
    expect(cycle?.paidAmount).toBe(0);
    expect(cycle?.status).toBe('generating');
    // 每日均摊记录仍在
    expect(
      state.records.filter((r) => r.poolId === pool.id && !r.poolStatus),
    ).toHaveLength(todayDay);
  });

  it('删除每日均摊记录：交易保留防止重新生成', () => {
    const { categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId,
    });
    const first = useAccountStore
      .getState()
      .records.find((r) => r.poolId === pool.id && !r.poolStatus);
    expect(first).toBeDefined();

    useAccountStore.getState().deleteRecord(first!.id);
    useAccountStore.getState().syncPoolCycles();

    const state = useAccountStore.getState();
    // 被删那天不会重新生成
    expect(
      state.records.filter((r) => r.poolId === pool.id && !r.poolStatus),
    ).toHaveLength(todayDay - 1);
    const cycle = state.cycles.find((c) => c.poolId === pool.id);
    expect(cycle?.transactions.some((t) => t.dateKey === first!.dateKey)).toBe(true);
  });

  // ── 存池型 ────────────────────────────────────────────

  it('存池型：存入/取出余额流转，删除记录回滚交易', () => {
    const { accountId } = setupBase();
    const homeCategory = useAccountStore.getState().addCategory({
      name: '押金', icon: 'vault', color: '#888', type: 'expense', order: 1,
    });
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '租房押金', type: 'deposit', amount: 2000, cycleMonths: 1, targetAccountId: accountId,
    });

    // 存入 ¥2000（支出挂池，计入统计）
    const payRecord = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -2000, type: 'expense', categoryId: homeCategory.id, accountId,
    });
    expect(useAccountStore.getState().claimToPool(payRecord.id, pool.id)).toBe(2000);
    let cycle = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(depositBalance(cycle?.transactions ?? [])).toBe(2000);
    expect(useAccountStore.getState().records.find((r) => r.id === payRecord.id)?.poolDirection).toBe('in');

    // 取出 ¥2000（收入挂池）
    const refundCategory = useAccountStore.getState().addCategory({
      name: '押金退回', icon: 'vault', color: '#888', type: 'income', order: 0,
    });
    const refundRecord = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 2000, type: 'income', categoryId: refundCategory.id, accountId,
    });
    useAccountStore.getState().claimToPool(refundRecord.id, pool.id);
    cycle = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(depositBalance(cycle?.transactions ?? [])).toBe(0);

    // 删除存入记录 → 交易移除
    useAccountStore.getState().deleteRecord(payRecord.id);
    cycle = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(depositBalance(cycle?.transactions ?? [])).toBe(-2000);
  });

  // ── 重复认领防护 ──────────────────────────────────────

  it('已关联记录不能重复认领', () => {
    const { accountId, categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });
    const record = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -100, type: 'expense', categoryId, accountId,
    });
    expect(useAccountStore.getState().claimToPool(record.id, pool.id)).toBe(100);
    expect(useAccountStore.getState().claimToPool(record.id, pool.id)).toBe(0);
  });

  // ── v2.4 T-410：周期快照 / 结算回写 / 满额过期自动移除 ────

  it('T-410：均摊记录自带周期快照与池名', () => {
    const { accountId, categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });
    const daily = useAccountStore
      .getState()
      .records.filter((r) => r.poolId === pool.id && !r.poolStatus);
    expect(daily.length).toBeGreaterThan(0);
    const monthKey = getCurrentMonthKey();
    const lastDay = new Date(
      parseInt(monthKey.slice(0, 4), 10),
      parseInt(monthKey.slice(5, 7), 10),
      0,
    ).getDate();
    expect(daily[0]?.poolCycleStart).toBe(`${monthKey}-01`);
    expect(daily[0]?.poolCycleEnd).toBe(`${monthKey}-${String(lastDay).padStart(2, '0')}`);
    expect(daily[0]?.poolCycleTotal).toBe(3000);
    expect(daily[0]?.poolName).toBe('房租');
    expect(daily[0]?.poolSettledAt).toBeUndefined();
  });

  it('T-410：满额且周期已过 → 池自动删除，记录保留完整快照', () => {
    const { accountId, categoryId } = setupBase();
    // 上月 25~26 号的按日池（必然整段已过去）
    const prevMonth = shiftMonthForTest(getCurrentMonthKey(), -1);
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '上月订阅', type: 'equalize', amount: 500, cycleMonths: 1,
      cycleMode: 'daily',
      dateRange: { start: `${prevMonth}-25`, end: `${prevMonth}-26` },
      dailyAmount: 250, categoryId, targetAccountId: accountId,
    });

    const daily = useAccountStore
      .getState()
      .records.filter((r) => r.poolId === pool.id && !r.poolStatus);
    expect(daily).toHaveLength(2);

    // 真实付款 ¥500 → 周期满额 → 池自动移除
    const pay = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -500, type: 'expense', categoryId, accountId,
    });
    useAccountStore.getState().claimToPool(pay.id, pool.id);

    const state = useAccountStore.getState();
    expect(state.pools.some((p) => p.id === pool.id)).toBe(false);
    expect(state.cycles.some((c) => c.poolId === pool.id)).toBe(false);

    // 记录全部保留：2 条均摊 + 1 条认领
    const kept = state.records.filter((r) => r.poolId === pool.id);
    expect(kept).toHaveLength(3);

    // 均摊记录「虚拟变实际」：关联时间与金额回写
    const keptDaily = kept.filter((r) => !r.poolStatus);
    expect(keptDaily.every((r) => typeof r.poolSettledAt === 'number')).toBe(true);
    expect(keptDaily.every((r) => r.poolSettledAmount === 500)).toBe(true);
    expect(keptDaily.every((r) => r.poolCycleStart === `${prevMonth}-25`)).toBe(true);
    expect(keptDaily.every((r) => r.poolCycleEnd === `${prevMonth}-26`)).toBe(true);

    // 认领记录：已关联池（不参与统计），带周期快照与池名
    const claimed = state.records.find((r) => r.id === pay.id);
    expect(claimed?.poolStatus).toBe('claimed');
    expect(claimed?.poolName).toBe('上月订阅');
    expect(claimed?.poolCycleStart).toBe(`${prevMonth}-25`);
    expect(claimed?.poolCycleEnd).toBe(`${prevMonth}-26`);
    expect(claimed?.poolCycleTotal).toBe(500);
    expect(visibleRecords(state.records).some((r) => r.id === pay.id)).toBe(false);
  });

  it('T-410：未满额的过期池不自动删除', () => {
    const { accountId, categoryId } = setupBase();
    const prevMonth = shiftMonthForTest(getCurrentMonthKey(), -1);
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '未付清订阅', type: 'equalize', amount: 500, cycleMonths: 1,
      cycleMode: 'daily',
      dateRange: { start: `${prevMonth}-25`, end: `${prevMonth}-26` },
      dailyAmount: 250, categoryId, targetAccountId: accountId,
    });
    const pay = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -100, type: 'expense', categoryId, accountId,
    });
    useAccountStore.getState().claimToPool(pay.id, pool.id);
    useAccountStore.getState().retireFinishedPools();

    // 只付了 100/500 → 池保留
    expect(useAccountStore.getState().pools.some((p) => p.id === pool.id)).toBe(true);
  });

  it('T-410：编辑/删除均摊记录不移动账户余额', () => {
    const { accountId, categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });
    const first = useAccountStore
      .getState()
      .records.find((r) => r.poolId === pool.id && !r.poolStatus);
    expect(first).toBeDefined();

    const before = useAccountStore.getState().getAccountBalance(accountId);
    useAccountStore.getState().updateRecord(first!.id, { amount: -999 });
    expect(useAccountStore.getState().getAccountBalance(accountId)).toBe(before);
    useAccountStore.getState().deleteRecord(first!.id);
    expect(useAccountStore.getState().getAccountBalance(accountId)).toBe(before);
  });
});
