/**
 * @fileoverview Salary Timer — 多账户钱包 + 存钱目标 store 集成测试（v2.4 · TASK-040）
 *
 * 覆盖：
 * - 记录关联目标自动累计 / 回退（收入+ / 支出−）
 * - 编辑记录：金额变化 / 换目标 / 解除关联 / 换账户
 * - 删目标仅解除关联，记录保留
 * - 删账户连带删记录并回退目标进度
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountStore } from './accountStore';
import { getTodayKey } from '../lib/accounting';

describe('accountStore · 存钱目标 + 钱包（v2.4）', () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
  });

  function setupBase() {
    const s = useAccountStore.getState();
    const account = s.addAccount({ name: '现金', balance: 10000, color: '#888', type: 'cash', order: 0 });
    const salaryCat = s.addCategory({ name: '工资', icon: 'coin', color: '#34D399', type: 'income', order: 0 });
    const foodCat = s.addCategory({ name: '餐饮', icon: 'bowl', color: '#FF9B8E', type: 'expense', order: 0 });
    const goal = s.addSavingsGoal({ name: '买相机', targetAmount: 5000, currentAmount: 0 });
    return { accountId: account.id, salaryCatId: salaryCat.id, foodCatId: foodCat.id, goalId: goal.id };
  }

  // ── 自动累计 ─────────────────────────────────────────────

  it('收入记录关联目标：进度自动增加', () => {
    const { accountId, salaryCatId, goalId } = setupBase();
    useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 800, type: 'income',
      categoryId: salaryCatId, accountId, goalId,
    });
    const goal = useAccountStore.getState().savingsGoals.find((g) => g.id === goalId);
    expect(goal?.currentAmount).toBe(800);
  });

  it('支出记录关联目标：进度自动减少（动用存款）', () => {
    const { accountId, foodCatId, goalId } = setupBase();
    useAccountStore.getState().updateSavingsGoal(goalId, { currentAmount: 1000 });
    useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: -300, type: 'expense',
      categoryId: foodCatId, accountId, goalId,
    });
    const goal = useAccountStore.getState().savingsGoals.find((g) => g.id === goalId);
    expect(goal?.currentAmount).toBe(700);
  });

  it('未关联目标的记录不影响任何目标', () => {
    const { accountId, salaryCatId, goalId } = setupBase();
    useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 500, type: 'income',
      categoryId: salaryCatId, accountId,
    });
    const goal = useAccountStore.getState().savingsGoals.find((g) => g.id === goalId);
    expect(goal?.currentAmount).toBe(0);
  });

  // ── 删除回退 ─────────────────────────────────────────────

  it('删除关联记录：目标进度回退', () => {
    const { accountId, salaryCatId, goalId } = setupBase();
    const rec = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 800, type: 'income',
      categoryId: salaryCatId, accountId, goalId,
    });
    useAccountStore.getState().deleteRecord(rec.id);
    const goal = useAccountStore.getState().savingsGoals.find((g) => g.id === goalId);
    expect(goal?.currentAmount).toBe(0);
  });

  // ── 编辑差量 ─────────────────────────────────────────────

  it('编辑金额：目标进度按差量调整', () => {
    const { accountId, salaryCatId, goalId } = setupBase();
    const rec = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 800, type: 'income',
      categoryId: salaryCatId, accountId, goalId,
    });
    useAccountStore.getState().updateRecord(rec.id, { amount: 1000 });
    const goal = useAccountStore.getState().savingsGoals.find((g) => g.id === goalId);
    expect(goal?.currentAmount).toBe(1000);
  });

  it('编辑时换目标：贡献从旧目标移到新目标', () => {
    const { accountId, salaryCatId, goalId } = setupBase();
    const goal2 = useAccountStore.getState().addSavingsGoal({
      name: '旅行基金', targetAmount: 3000, currentAmount: 0,
    });
    const rec = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 600, type: 'income',
      categoryId: salaryCatId, accountId, goalId,
    });
    useAccountStore.getState().updateRecord(rec.id, { goalId: goal2.id });

    const goals = useAccountStore.getState().savingsGoals;
    expect(goals.find((g) => g.id === goalId)?.currentAmount).toBe(0);
    expect(goals.find((g) => g.id === goal2.id)?.currentAmount).toBe(600);
  });

  it('编辑时解除关联：进度回退', () => {
    const { accountId, salaryCatId, goalId } = setupBase();
    const rec = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 800, type: 'income',
      categoryId: salaryCatId, accountId, goalId,
    });
    useAccountStore.getState().updateRecord(rec.id, { goalId: undefined });
    const state = useAccountStore.getState();
    expect(state.savingsGoals.find((g) => g.id === goalId)?.currentAmount).toBe(0);
    expect(state.records.find((r) => r.id === rec.id)?.goalId).toBeUndefined();
  });

  it('编辑时换账户：余额从旧账户移到新账户', () => {
    const { accountId, salaryCatId } = setupBase();
    const acc2 = useAccountStore.getState().addAccount({
      name: '银行卡2', balance: 0, color: '#2D2D2D', type: 'card', order: 1,
    });
    const rec = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 500, type: 'income',
      categoryId: salaryCatId, accountId,
    });
    useAccountStore.getState().updateRecord(rec.id, { accountId: acc2.id });

    // 旧账户回退到记账前（10000+500-500），新账户承接 +500
    const state = useAccountStore.getState();
    expect(state.getAccountBalance(accountId)).toBe(10000);
    expect(state.getAccountBalance(acc2.id)).toBe(500);
  });

  // ── 删目标 / 删账户 ──────────────────────────────────────

  it('删除目标：记录保留但解除关联', () => {
    const { accountId, salaryCatId, goalId } = setupBase();
    const rec = useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 800, type: 'income',
      categoryId: salaryCatId, accountId, goalId,
    });
    useAccountStore.getState().deleteSavingsGoal(goalId);

    const state = useAccountStore.getState();
    expect(state.savingsGoals).toHaveLength(0);
    const kept = state.records.find((r) => r.id === rec.id);
    expect(kept).toBeDefined();
    expect(kept?.goalId).toBeUndefined();
    // 账户余额不受删目标影响
    expect(state.getAccountBalance(accountId)).toBe(10800);
  });

  it('删除账户：连带删除记录并回退目标进度', () => {
    const { accountId, salaryCatId, goalId } = setupBase();
    useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 800, type: 'income',
      categoryId: salaryCatId, accountId, goalId,
    });
    useAccountStore.getState().deleteAccount(accountId);

    const state = useAccountStore.getState();
    expect(state.accounts.find((a) => a.id === accountId)).toBeUndefined();
    expect(state.records.filter((r) => r.accountId === accountId)).toHaveLength(0);
    // 目标进度随记录删除回退
    expect(state.savingsGoals.find((g) => g.id === goalId)?.currentAmount).toBe(0);
  });

  // ── 总资产 ───────────────────────────────────────────────

  it('总资产 = 各账户余额合计，随记账联动', () => {
    const { accountId, salaryCatId } = setupBase();
    useAccountStore.getState().addAccount({ name: '微信', balance: 200, color: '#07C160', type: 'wechat', order: 1 });
    expect(useAccountStore.getState().getTotalBalance()).toBe(10200);

    useAccountStore.getState().addRecord({
      dateKey: getTodayKey(), amount: 300, type: 'income',
      categoryId: salaryCatId, accountId,
    });
    expect(useAccountStore.getState().getTotalBalance()).toBe(10500);
  });
});
