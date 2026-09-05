/**
 * @fileoverview Salary Timer — 池机制 store 业务流程集成测试（v2.3 · TASK-039 重设计后）
 *
 * 模型：建池不预生成记录；到期逐日生成真实消费记录；
 * 认领 = 付款记录打 'claimed' 标记（预付，不计消费统计），与均摊记录相互独立。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountStore } from './accountStore';
import { depositBalance } from '../lib/accounting/pool';
import { getCurrentMonthKey, getTodayKey, visibleRecords, calcVirtualAssets } from '../lib/accounting';
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

    // 均摊池的逐日记录只表示消耗，不应立即增减账户或虚拟资产；
    // 只有实际付款记录 claimToPool 后，才进入已付/已认领分解。
    const breakdown = calcVirtualAssets({
      accounts: state.accounts,
      records: state.records,
      pools: state.pools,
    });
    expect(state.getAccountBalance(accountId)).toBe(10000);
    expect(breakdown.actualTotal).toBe(10000);
    expect(breakdown.virtualTotal).toBe(10000);
    expect(breakdown.prepaidUnconsumed).toBe(0);
    expect(breakdown.unpaidConsumed).toBeCloseTo(todayDay * 100, 2);
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

  // v2.5-patch3 T-473：均摊池跨月 → 总金额不应被复制到每个 cycle
  it('T-473：跨月总额按各月天数比例分配,cycle totalAmount 之和 = pool.amount', () => {
    const { categoryId } = setupBase();
    const monthKey = getCurrentMonthKey();
    const nextMonth = shiftMonthForTest(monthKey, 1);
    const nextNextMonth = shiftMonthForTest(nextMonth, 1);
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '跨 3 月房租', type: 'equalize', amount: 3000, cycleMonths: 3,
      cycleMode: 'daily',
      // 当月 25 号 ~ 次次月 5 号（跨 3 个自然月）
      dateRange: { start: `${monthKey}-25`, end: `${nextNextMonth}-05` },
      categoryId,
    });
    const state = useAccountStore.getState();
    const cycles = state.cycles.filter((c) => c.poolId === pool.id);
    expect(cycles).toHaveLength(3);
    // 各 cycle.totalAmount 之和 = pool.amount（不被复制成 3000 × 3 = 9000）
    const sumCycleTotals = cycles.reduce((s, c) => s + c.totalAmount, 0);
    expect(sumCycleTotals).toBeCloseTo(3000, 2);
    // 每个 cycle.dailyVirtual 必须 = 该月 totalAmount / 该月天数
    for (const c of cycles) {
      expect(c.dailyVirtual).toBeCloseTo(c.totalAmount / c.dayCount, 2);
    }
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

  // ── T-043：unclaimToPool（编辑模式解绑池关联） ──────────

  it('T-043：均摊池 claimed 付款记录 unclaimToPool → paidAmount 回退 + 池字段清空', () => {
    const { accountId, categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });
    const record = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -3000, type: 'expense', categoryId, accountId,
    });
    useAccountStore.getState().claimToPool(record.id, pool.id);

    // 周期已满 → 池自动退休（记录保留完整快照）
    const beforePool = useAccountStore.getState().pools.some((p) => p.id === pool.id);
    const beforeCycle = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(beforePool).toBe(true);
    expect(beforeCycle?.paidAmount).toBe(3000);

    // 解绑池关联
    expect(useAccountStore.getState().unclaimToPool(record.id)).toBe(3000);

    const state = useAccountStore.getState();
    // 记录上所有池字段清空
    const after = state.records.find((r) => r.id === record.id);
    expect(after?.poolId).toBeUndefined();
    expect(after?.poolStatus).toBeUndefined();
    expect(after?.poolDirection).toBeUndefined();
    expect(after?.poolName).toBeUndefined();
    expect(after?.poolCycleStart).toBeUndefined();
    expect(after?.poolCycleEnd).toBeUndefined();
    expect(after?.poolCycleTotal).toBeUndefined();
    expect(after?.poolSettledAt).toBeUndefined();
    expect(after?.poolSettledAmount).toBeUndefined();
    // 其他字段保留
    expect(after?.amount).toBe(-3000);
    expect(after?.accountId).toBe(accountId);
  });

  it('T-043：存池 confirmed 记录 unclaimToPool → 对应 transaction 移除 + 池字段清空', () => {
    const { accountId } = setupBase();
    const homeCategory = useAccountStore.getState().addCategory({
      name: '押金', icon: 'vault', color: '#888', type: 'expense', order: 1,
    });
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '租房押金', type: 'deposit', amount: 2000, cycleMonths: 1, targetAccountId: accountId,
    });
    const pay = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -2000, type: 'expense', categoryId: homeCategory.id, accountId,
    });
    useAccountStore.getState().claimToPool(pay.id, pool.id);
    let cycle = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(depositBalance(cycle?.transactions ?? [])).toBe(2000);

    // 解绑
    expect(useAccountStore.getState().unclaimToPool(pay.id)).toBe(2000);

    cycle = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(depositBalance(cycle?.transactions ?? [])).toBe(0);

    const after = useAccountStore.getState().records.find((r) => r.id === pay.id);
    expect(after?.poolId).toBeUndefined();
    expect(after?.poolStatus).toBeUndefined();
    expect(after?.poolDirection).toBeUndefined();
  });

  it('T-043：每日均摊记录 unclaimToPool → transaction.recordId 清空（防 sync 重新生成）+ 池字段清空', () => {
    const { categoryId } = setupBase();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId,
    });
    const daily = useAccountStore
      .getState()
      .records.find((r) => r.poolId === pool.id && !r.poolStatus);
    expect(daily).toBeDefined();

    expect(useAccountStore.getState().unclaimToPool(daily!.id)).toBe(100);

    // 对应 transaction 保留但 recordId 清空（防 sync 重新生成）
    const cycle = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(cycle?.transactions.some((t) => t.dateKey === daily!.dateKey && !t.recordId)).toBe(true);

    // 记录池字段清空，但记录本身保留（用户可再编辑或删除）
    const after = useAccountStore.getState().records.find((r) => r.id === daily!.id);
    expect(after?.poolId).toBeUndefined();
    expect(after?.poolCycleStart).toBeUndefined();
    expect(after?.poolName).toBeUndefined();
  });

  it('T-043：已退休池的均摊记录 unclaimToPool → 池业务跳过，记录池字段清空', () => {
    const { accountId, categoryId } = setupBase();
    const prevMonth = shiftMonthForTest(getCurrentMonthKey(), -1);
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '上月订阅', type: 'equalize', amount: 500, cycleMonths: 1,
      cycleMode: 'daily',
      dateRange: { start: `${prevMonth}-25`, end: `${prevMonth}-26` },
      dailyAmount: 250, categoryId, targetAccountId: accountId,
    });
    const pay = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -500, type: 'expense', categoryId, accountId,
    });
    useAccountStore.getState().claimToPool(pay.id, pool.id);
    // 池已退休（pools/cycles 都不存在该池）
    expect(useAccountStore.getState().pools.some((p) => p.id === pool.id)).toBe(false);
    expect(useAccountStore.getState().cycles.some((c) => c.poolId === pool.id)).toBe(false);

    // 解绑：池业务（paidAmount/transactions）无需处理，记录池字段清空即可
    expect(useAccountStore.getState().unclaimToPool(pay.id)).toBe(500);
    const after = useAccountStore.getState().records.find((r) => r.id === pay.id);
    expect(after?.poolId).toBeUndefined();
    expect(after?.poolStatus).toBeUndefined();
    expect(after?.poolName).toBeUndefined();
  });

  it('T-043：切换池 → unclaim 旧池 + claim 新池，cycles 业务和记录字段正确', () => {
    const { accountId, categoryId } = setupBase();
    const poolA = useAccountStore.getState().createPoolWithCycles({
      name: 'A池', type: 'equalize', amount: 1000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });
    const poolB = useAccountStore.getState().createPoolWithCycles({
      name: 'B池', type: 'equalize', amount: 2000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });

    const record = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -500, type: 'expense', categoryId, accountId,
    });
    useAccountStore.getState().claimToPool(record.id, poolA.id);
    expect(useAccountStore.getState().cycles.find((c) => c.poolId === poolA.id)?.paidAmount).toBe(500);

    // 切换到 B 池
    expect(useAccountStore.getState().unclaimToPool(record.id)).toBe(500);
    expect(useAccountStore.getState().cycles.find((c) => c.poolId === poolA.id)?.paidAmount).toBe(0);
    expect(useAccountStore.getState().claimToPool(record.id, poolB.id)).toBe(500);

    const after = useAccountStore.getState().records.find((r) => r.id === record.id);
    expect(after?.poolId).toBe(poolB.id);
    expect(after?.poolStatus).toBe('claimed');
    expect(after?.poolName).toBe('B池');
    expect(useAccountStore.getState().cycles.find((c) => c.poolId === poolB.id)?.paidAmount).toBe(500);
  });

  it('T-043：未关联池的记录 unclaimToPool → 返回 0，无副作用', () => {
    const { accountId, categoryId } = setupBase();
    const record = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -100, type: 'expense', categoryId, accountId,
    });
    expect(useAccountStore.getState().unclaimToPool(record.id)).toBe(0);
    const after = useAccountStore.getState().records.find((r) => r.id === record.id);
    expect(after?.amount).toBe(-100);
  });

  // ── v2.5 TASK-046 T-501：time → accounting 联动 ──────

  it('T-501-1：ensureSalaryPool 幂等创建工资池（income equalize）', () => {
    const s = useAccountStore.getState();
    const poolId1 = s.ensureSalaryPool();
    const poolId2 = useAccountStore.getState().ensureSalaryPool();
    expect(poolId1).toBe(poolId2);
    const salaryPool = useAccountStore.getState().pools.find((p) => p.id === poolId1);
    expect(salaryPool?.name).toBe('工资池');
    expect(salaryPool?.type).toBe('equalize');
    expect(salaryPool?.direction).toBe('income');
    expect(salaryPool?.categoryId).toBe('cat-salary');
  });

  it('T-501-2：upsertSalaryLinkageForDate 首次写入新增 / 重复写入覆盖 amount 不变 id', () => {
    const s = useAccountStore.getState();
    const poolId = s.ensureSalaryPool();
    const dateKey = '2026-08-15';

    s.upsertSalaryLinkageForDate(dateKey, 100);
    let link = useAccountStore.getState().records.find(
      (r) => r.linkageSource === 'salary-time-mode' && r.dateKey === dateKey,
    );
    expect(link).toBeDefined();
    expect(link?.amount).toBe(100);
    expect(link?.type).toBe('income');
    expect(link?.poolId).toBe(poolId);
    expect(link?.poolStatus).toBe('confirmed');
    const idFirst = link!.id;

    // 覆盖更新 amount，id / createdAt 不变
    s.upsertSalaryLinkageForDate(dateKey, 250.5);
    link = useAccountStore.getState().records.find(
      (r) => r.linkageSource === 'salary-time-mode' && r.dateKey === dateKey,
    );
    expect(link?.id).toBe(idFirst);
    expect(link?.amount).toBe(250.5);

    // amount = 0 → 删除当天联动记录；手动记账的同日期记录保留
    const manual = useAccountStore.getState().addRecord({
      dateKey,
      amount: -50,
      type: 'expense',
      categoryId: 'cat-food',
      accountId: useAccountStore.getState().accounts[0]!.id,
    });
    s.upsertSalaryLinkageForDate(dateKey, 0);
    const after = useAccountStore.getState().records.find(
      (r) => r.linkageSource === 'salary-time-mode' && r.dateKey === dateKey,
    );
    expect(after).toBeUndefined();
    // 手动记账的同日期记录依然在
    expect(useAccountStore.getState().records.find((r) => r.id === manual.id)).toBeDefined();
  });

  it('T-501-3：联动记录不写账户余额, 但进入工资池 transactions / cycle.totalAmount 累加', () => {
    const s = useAccountStore.getState();
    const account = s.addAccount({ name: '到账账户', balance: 1000, color: '#888', type: 'card', order: 0 });
    const balanceBefore = useAccountStore.getState().getAccountBalance(account.id);
    const poolId = s.ensureSalaryPool();

    s.upsertSalaryLinkageForDate('2026-08-20', 800);

    // 账户余额不变：联动走 income equalize 池，不动 account.balance
    expect(useAccountStore.getState().getAccountBalance(account.id)).toBe(balanceBefore);

    // 工资池 cycle.totalAmount 累加 = 800
    const cyc = useAccountStore.getState().cycles.find((c) => c.poolId === poolId);
    expect(cyc).toBeDefined();
    expect(cyc?.totalAmount).toBe(800);

    // cycle 有一笔 confirmed in
    const confirmed = (cyc?.transactions ?? []).filter((t) => t.status === 'confirmed' && t.direction === 'in');
    const totalIn = confirmed.reduce((sum, t) => sum + t.amount, 0);
    expect(totalIn).toBe(800);

    // 覆盖更新：cycle.totalAmount 累加差额
    s.upsertSalaryLinkageForDate('2026-08-20', 500);
    expect(useAccountStore.getState().cycles.find((c) => c.poolId === poolId)?.totalAmount).toBe(500);

    // 删除(amount=0)：cycle.totalAmount -= 500
    s.upsertSalaryLinkageForDate('2026-08-20', 0);
    expect(useAccountStore.getState().cycles.find((c) => c.poolId === poolId)?.totalAmount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// v2.5-patch2 T-505：池级别「部分到账」(partialClaimToPool)
// ────────────────────────────────────────────────────────────

describe('accountStore · partialClaimToPool (T-505)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
  });

  it('income equalize 池：partial claim 创建独立 claimed record,联动 records 不动', () => {
    const s = useAccountStore.getState();
    const account = s.addAccount({ name: '工资卡', balance: 0, color: '#888', type: 'card', order: 0 });
    const poolId = s.ensureSalaryPool();

    // 模拟 3 天联动记录(累计已赚 = 1500)
    s.upsertSalaryLinkageForDate('2026-08-01', 500);
    s.upsertSalaryLinkageForDate('2026-08-02', 500);
    s.upsertSalaryLinkageForDate('2026-08-03', 500);

    let state = useAccountStore.getState();
    const linkageCount = state.records.filter(
      (r) => r.poolId === poolId && r.poolStatus === 'confirmed' && r.amount > 0,
    ).length;
    expect(linkageCount).toBe(3);

    // partial claim 700 元(50% 未发)
    const written = s.partialClaimToPool(poolId, 700, { accountId: account.id });
    expect(written).toBe(700);

    state = useAccountStore.getState();
    // 联动 records 全部保留(仍 confirmed)
    const afterLinkage = state.records.filter(
      (r) => r.poolId === poolId && r.poolStatus === 'confirmed' && r.amount > 0,
    );
    expect(afterLinkage).toHaveLength(3);

    // 新增一条独立 claimed record,amount = 700
    const claimed = state.records.filter(
      (r) => r.poolId === poolId && r.poolStatus === 'claimed' && r.amount > 0,
    );
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.amount).toBe(700);
    expect(claimed[0]?.type).toBe('income');
    expect(claimed[0]?.note).toBe('部分到账');

    // cycle.paidAmount += 700
    const cyc = state.cycles.find((c) => c.poolId === poolId);
    expect(cyc?.paidAmount).toBe(700);
    const txIn = (cyc?.transactions ?? []).filter(
      (t) => t.direction === 'in' && t.status === 'confirmed',
    );
    expect(txIn.reduce((sum, t) => sum + t.amount, 0)).toBe(700 + 1500);

    // 账户余额 += 700(真实到账)
    expect(state.getAccountBalance(account.id)).toBe(700);
  });

  it('partial claim 超过未到账剩余 → 自动夹到 remaining,返回实际写入', () => {
    const s = useAccountStore.getState();
    s.addAccount({ name: '卡', balance: 0, color: '#888', type: 'card', order: 0 });
    const poolId = s.ensureSalaryPool();

    s.upsertSalaryLinkageForDate('2026-08-01', 1000);

    // 想要 claim 2000,但剩余只有 1000
    const written = s.partialClaimToPool(poolId, 2000);
    expect(written).toBe(1000);

    const state = useAccountStore.getState();
    const claimed = state.records.filter(
      (r) => r.poolId === poolId && r.poolStatus === 'claimed',
    );
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.amount).toBe(1000);
  });

  it('partial claim 后 calcVirtualAssets 口径:未到账 = 已赚 - 已发', () => {
    const s = useAccountStore.getState();
    s.addAccount({ name: '卡', balance: 0, color: '#888', type: 'card', order: 0 });
    const poolId = s.ensureSalaryPool();

    // 已赚 3000,实发 1000
    s.upsertSalaryLinkageForDate('2026-08-01', 1000);
    s.upsertSalaryLinkageForDate('2026-08-02', 1000);
    s.upsertSalaryLinkageForDate('2026-08-03', 1000);
    s.partialClaimToPool(poolId, 1000);

    const state = useAccountStore.getState();
    const breakdown = calcVirtualAssets({
      accounts: state.accounts,
      records: state.records,
      pools: state.pools,
    });

    // earnedUnarrived = 3000 - 1000 = 2000
    expect(breakdown.earnedUnarrived).toBe(2000);

    // virtualTotal = actualTotal(账户余额 1000)+ earnedUnarrived(2000)+ depositRefundable(0)= 3000
    expect(breakdown.virtualTotal).toBe(3000);
  });

  it('非 income equalize 池:partial claim 不生效,返回 0', () => {
    const s = useAccountStore.getState();
    const { accountId, categoryId } = (() => {
      const acc = s.addAccount({ name: '卡', balance: 10000, color: '#888', type: 'card', order: 0 });
      const cat = s.addCategory({ name: '房租', icon: 'house', color: '#C04A3A', type: 'expense', order: 0 });
      return { accountId: acc.id, categoryId: cat.id };
    })();

    // 支出 equalize 池
    const pool = s.createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId, targetAccountId: accountId,
    });

    const written = s.partialClaimToPool(pool.id, 500);
    expect(written).toBe(0);

    // 没有新增 claimed record
    const state = useAccountStore.getState();
    const claimed = state.records.filter(
      (r) => r.poolId === pool.id && r.poolStatus === 'claimed',
    );
    expect(claimed).toHaveLength(0);
  });

  it('多次 partial claim 累加:cycle.paidAmount 与 claimed records 同步增长', () => {
    const s = useAccountStore.getState();
    s.addAccount({ name: '卡', balance: 0, color: '#888', type: 'card', order: 0 });
    const poolId = s.ensureSalaryPool();

    s.upsertSalaryLinkageForDate('2026-08-01', 1000);
    s.partialClaimToPool(poolId, 300); // 实发 300
    s.partialClaimToPool(poolId, 200); // 实发 200

    const state = useAccountStore.getState();
    const claimed = state.records.filter(
      (r) => r.poolId === poolId && r.poolStatus === 'claimed' && r.amount > 0,
    );
    expect(claimed).toHaveLength(2);
    expect(claimed.reduce((sum, r) => sum + r.amount, 0)).toBe(500);

    const cyc = state.cycles.find((c) => c.poolId === poolId);
    expect(cyc?.paidAmount).toBe(500);

    // 联动 records 仍是 1 条,amount=1000
    const linkage = state.records.filter(
      (r) => r.poolId === poolId && r.poolStatus === 'confirmed',
    );
    expect(linkage).toHaveLength(1);
    expect(linkage[0]?.amount).toBe(1000);

    // 账户余额 = 500
    expect(state.getAccountBalance(state.accounts[0]?.id ?? '')).toBe(500);
  });

  it('没有联动记录时 partial claim 不写新 record', () => {
    const s = useAccountStore.getState();
    s.addAccount({ name: '卡', balance: 0, color: '#888', type: 'card', order: 0 });
    const poolId = s.ensureSalaryPool();

    const written = s.partialClaimToPool(poolId, 500);
    expect(written).toBe(0);

    const state = useAccountStore.getState();
    const all = state.records.filter((r) => r.poolId === poolId);
    expect(all).toHaveLength(0);
  });

  // ── T-505-fixbug：删工资池不再凭空扣账户余额 ─────────────────────────

  it('T-505-fixbug：删工资池(仅联动 records)账户余额不变', () => {
    const s = useAccountStore.getState();
    const account = s.addAccount({ name: '支付宝', balance: 0, color: '#888', type: 'alipay', order: 0 });
    const poolId = s.ensureSalaryPool();

    // 3 天联动 records,累计 1500 元「已赚」(但未到账,账户余额应为 0)
    s.upsertSalaryLinkageForDate('2026-08-01', 500);
    s.upsertSalaryLinkageForDate('2026-08-02', 500);
    s.upsertSalaryLinkageForDate('2026-08-03', 500);
    expect(useAccountStore.getState().getAccountBalance(account.id)).toBe(0);

    // 删工资池 —— 联动 records 从未真实加过余额,删除不能凭空扣钱
    s.deletePool(poolId);

    const state = useAccountStore.getState();
    expect(state.pools.some((p) => p.id === poolId)).toBe(false);
    expect(state.records.filter((r) => r.poolId === poolId)).toHaveLength(0);
    // 核心断言：账户余额不被反向扣减
    expect(state.getAccountBalance(account.id)).toBe(0);
  });

  it('T-505-fixbug：删工资池(联动 + partial claim)只回退 partial claim 部分', () => {
    const s = useAccountStore.getState();
    const account = s.addAccount({ name: '支付宝', balance: 0, color: '#888', type: 'alipay', order: 0 });
    const poolId = s.ensureSalaryPool();

    // 已赚 3000(联动 records,不写余额)
    s.upsertSalaryLinkageForDate('2026-08-01', 1000);
    s.upsertSalaryLinkageForDate('2026-08-02', 1000);
    s.upsertSalaryLinkageForDate('2026-08-03', 1000);
    // partial claim 700(走 addRecord,余额 +700)
    s.partialClaimToPool(poolId, 700, { accountId: account.id });

    expect(useAccountStore.getState().getAccountBalance(account.id)).toBe(700);

    // 删工资池
    s.deletePool(poolId);

    const state = useAccountStore.getState();
    expect(state.pools.some((p) => p.id === poolId)).toBe(false);
    // 联动 records 和 partial claim record 全部删除
    expect(state.records.filter((r) => r.poolId === poolId)).toHaveLength(0);
    // 账户余额：partial claim 部分 700 被回退,联动 records 不扣
    expect(state.getAccountBalance(account.id)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// v2.5-patch4 N-483：池可编辑（rebuildPoolCycles）
// ────────────────────────────────────────────────────────────

describe('accountStore · 池可编辑 (N-483)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
  });

  /** 当前是几号 */
  const todayDay = parseInt(getTodayKey().slice(8), 10);

  it('N-483：updatePool 改 amount → 自动重建 cycles，新 dailyVirtual 按新总额/天数', () => {
    const { categoryId } = (() => {
      const s = useAccountStore.getState();
      const cat = s.addCategory({ name: '房租', icon: 'house', color: '#C04A3A', type: 'expense', order: 0 });
      return { categoryId: cat.id };
    })();
    const monthKey = getCurrentMonthKey();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId,
    });
    // 初始 cycle：总额 3000
    const cycle0 = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(cycle0?.totalAmount).toBe(3000);

    // 改金额为 4500
    useAccountStore.getState().updatePool(pool.id, { amount: 4500 });
    const cycle1 = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id);
    expect(cycle1?.totalAmount).toBe(4500);
    // dailyVirtual 按当月天数等分
    const days = new Date(
      parseInt(monthKey.slice(0, 4), 10),
      parseInt(monthKey.slice(5, 7), 10),
      0,
    ).getDate();
    expect(cycle1?.dailyVirtual).toBeCloseTo(4500 / days, 2);
  });

  it('N-483：updatePool 改非结构字段（name）→ 不重建 cycles', () => {
    const { categoryId } = (() => {
      const cat = useAccountStore.getState().addCategory({
        name: '房租', icon: 'house', color: '#C04A3A', type: 'expense', order: 0,
      });
      return { categoryId: cat.id };
    })();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId,
    });
    const cycleIdBefore = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id)?.id;

    useAccountStore.getState().updatePool(pool.id, { name: '房租改' });
    const cycleIdAfter = useAccountStore.getState().cycles.find((c) => c.poolId === pool.id)?.id;
    // 周期 id 不变（未重建）
    expect(cycleIdAfter).toBe(cycleIdBefore);
    expect(useAccountStore.getState().pools.find((p) => p.id === pool.id)?.name).toBe('房租改');
  });

  it('N-483：rebuildPoolCycles 直接调用 → 清掉该池所有 cycles 并按当前 pool 配置重建', () => {
    const { categoryId } = (() => {
      const cat = useAccountStore.getState().addCategory({
        name: '房租', icon: 'house', color: '#C04A3A', type: 'expense', order: 0,
      });
      return { categoryId: cat.id };
    })();
    const monthKey = getCurrentMonthKey();
    const nextMonth = shiftMonthForTest(monthKey, 1);
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '跨月', type: 'equalize', amount: 1000, cycleMonths: 2,
      cycleMode: 'daily',
      dateRange: { start: `${monthKey}-15`, end: `${nextMonth}-14` },
      categoryId,
    });
    expect(useAccountStore.getState().cycles.filter((c) => c.poolId === pool.id)).toHaveLength(2);

    // 缩短日期范围
    useAccountStore.getState().updatePool(pool.id, {
      dateRange: { start: `${monthKey}-20`, end: `${monthKey}-25` },
    });
    const cyclesAfter = useAccountStore.getState().cycles.filter((c) => c.poolId === pool.id);
    // 跨月池缩到当月只剩 6 天 → 重建后只剩 1 个 cycle
    expect(cyclesAfter).toHaveLength(1);
    expect(cyclesAfter[0]?.monthKey).toBe(monthKey);
    // 该 cycle.totalAmount = 1000 × (6 / totalDays in original range) ≈ 1000 × 6/31
    expect(cyclesAfter[0]?.dayCount).toBe(6);
  });

  it('N-483：重建 cycles 不会丢失已生成的均摊 record（保留 poolCycleStart/End 快照）', () => {
    const { categoryId } = (() => {
      const cat = useAccountStore.getState().addCategory({
        name: '房租', icon: 'house', color: '#C04A3A', type: 'expense', order: 0,
      });
      return { categoryId: cat.id };
    })();
    const pool = useAccountStore.getState().createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId,
    });
    const recordsBefore = useAccountStore
      .getState()
      .records.filter((r) => r.poolId === pool.id && !r.poolStatus);
    expect(recordsBefore).toHaveLength(todayDay);

    // 改 amount 触发 rebuild
    useAccountStore.getState().updatePool(pool.id, { amount: 6000 });

    // 旧 record 仍在：rebuild 不删 record,但 rebuild 末尾 syncPoolCycles
    // 会按新 pool 配置重新生成已到期的均摊 record。
    // 这里验证:重建前生成的 5 条 record 全部保留(原 amount / poolCycleStart/End 不变),
    // 且总数 ≥ todayDay(sync 可能补齐未生成的剩余天数,但 today 之前的都已存在)。
    const recordsAfter = useAccountStore
      .getState()
      .records.filter((r) => r.poolId === pool.id && !r.poolStatus);
    expect(recordsAfter.length).toBeGreaterThanOrEqual(todayDay);

    // 重建前已存在的 dateKey + amount 全部保留
    const beforeByDate = new Map(recordsBefore.map((r) => [r.dateKey, r.amount]));
    for (const r of recordsAfter) {
      if (beforeByDate.has(r.dateKey)) {
        expect(r.amount).toBe(beforeByDate.get(r.dateKey));
      }
    }
  });
});

// ────────────────────────────────────────────────────────────
// v2.5-patch4 N-484：资产清零（resetAssets）
// ────────────────────────────────────────────────────────────

describe('accountStore · resetAssets (N-484)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
  });

  it('N-484：把所有账户余额清零，records / pools / cycles 全部保留', () => {
    const s = useAccountStore.getState();
    const acc1 = s.addAccount({ name: '支付宝', balance: 1000, color: '#888', type: 'alipay', order: 0 });
    const acc2 = s.addAccount({ name: '微信', balance: 500, color: '#888', type: 'wechat', order: 1 });
    const cat = s.addCategory({ name: '午饭', icon: 'fork', color: '#FFA', type: 'expense', order: 0 });

    // 记一笔支出，让余额变
    s.addRecord({ dateKey: getTodayKey(), amount: -200, type: 'expense', categoryId: cat.id, accountId: acc1.id });
    expect(useAccountStore.getState().getAccountBalance(acc1.id)).toBe(800);
    expect(useAccountStore.getState().getAccountBalance(acc2.id)).toBe(500);

    // 加一个池
    const pool = s.createPoolWithCycles({
      name: '房租', type: 'equalize', amount: 3000, cycleMonths: 1,
      cycleMode: 'monthly', categoryId: cat.id, targetAccountId: acc1.id,
    });

    // 重置资产
    useAccountStore.getState().resetAssets();

    const after = useAccountStore.getState();
    expect(after.getAccountBalance(acc1.id)).toBe(0);
    expect(after.getAccountBalance(acc2.id)).toBe(0);
    // record 保留
    expect(after.records.find((r) => r.accountId === acc1.id)).toBeDefined();
    // pool 保留
    expect(after.pools.some((p) => p.id === pool.id)).toBe(true);
    // cycles 保留
    expect(after.cycles.filter((c) => c.poolId === pool.id)).toHaveLength(1);
  });

  it('N-484：清零后 calcVirtualAssets 的 actualTotal 为 0（账户余额合计为 0）', () => {
    const s = useAccountStore.getState();
    const acc = s.addAccount({ name: '卡', balance: 5000, color: '#888', type: 'card', order: 0 });
    expect(useAccountStore.getState().getAccountBalance(acc.id)).toBe(5000);

    useAccountStore.getState().resetAssets();

    const after = useAccountStore.getState();
    const breakdown = calcVirtualAssets({
      accounts: after.accounts,
      records: after.records,
      pools: after.pools,
    });
    expect(breakdown.actualTotal).toBe(0);
  });
});
