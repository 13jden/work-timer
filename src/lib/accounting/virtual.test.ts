/**
 * @fileoverview Salary Timer — 虚拟资产分解单测（v2.4 · TASK-040 T-409）
 *
 * 覆盖 src/lib/accounting/virtual.ts：
 * 实际总额 / 未归入调整项 / 支出池预付未消耗 / 收入池已赚未到账 / 虚拟总额。
 */
import { describe, it, expect } from 'vitest';
import { calcVirtualAssets, isPoolDailyRecord } from './virtual';
import type { Account, AccountRecord, PoolConfig } from '../types';

let seq = 0;

function makeAccount(patch: Partial<Account> = {}): Account {
  seq += 1;
  return {
    id: `acc-${seq}`,
    name: '支付宝',
    type: 'alipay',
    balance: 0,
    color: '#1677FF',
    order: 0,
    createdAt: seq,
    ...patch,
  };
}

function makePool(patch: Partial<PoolConfig> = {}): PoolConfig {
  seq += 1;
  return {
    id: `pool-${seq}`,
    name: '房租',
    type: 'equalize',
    amount: 1000,
    cycleMonths: 12,
    createdAt: seq,
    ...patch,
  };
}

function makeRecord(patch: Partial<AccountRecord> = {}): AccountRecord {
  seq += 1;
  return {
    id: `rec-${seq}`,
    dateKey: '2026-09-01',
    amount: -100,
    type: 'expense',
    categoryId: 'cat-food',
    accountId: 'acc-1',
    createdAt: seq,
    updatedAt: seq,
    ...patch,
  };
}

describe('isPoolDailyRecord', () => {
  it('有 poolId 且无 poolStatus → 池逐日虚拟记录', () => {
    expect(isPoolDailyRecord(makeRecord({ poolId: 'pool-1' }))).toBe(true);
  });

  it('认领付款记录（poolStatus=claimed）不是虚拟记录', () => {
    expect(isPoolDailyRecord(makeRecord({ poolId: 'pool-1', poolStatus: 'claimed' }))).toBe(false);
  });

  it('普通手动记录不是虚拟记录', () => {
    expect(isPoolDailyRecord(makeRecord())).toBe(false);
  });
});

describe('calcVirtualAssets', () => {
  it('空数据 → 全 0', () => {
    const r = calcVirtualAssets({ accounts: [], records: [], pools: [] });
    expect(r).toEqual({
      actualTotal: 0,
      pendingAdjust: 0,
      prepaidUnconsumed: 0,
      unpaidConsumed: 0,
      earnedUnarrived: 0,
      depositRefundable: 0,
      depositPending: 0,
      virtualTotal: 0,
    });
  });

  it('用户示例：房租 1000 已付消耗半月 + 工资 3000 挣半月未发 + 资产 3000', () => {
    const acc = makeAccount({ balance: 3000 });
    const rent = makePool({ name: '房租', amount: 1000, direction: 'expense' });
    const salary = makePool({ name: '工资', amount: 3000, direction: 'income' });

    const records: AccountRecord[] = [
      // 房租认领付款 1000（预付，实际已支付）
      makeRecord({ accountId: acc.id, amount: -1000, poolId: rent.id, poolStatus: 'claimed' }),
      // 房租已消耗半个月（15 条日均记录合计 500）
      ...Array.from({ length: 15 }, () =>
        makeRecord({ accountId: acc.id, amount: -33.33, poolId: rent.id }),
      ),
      // 工资已赚半个月（15 条日均记录合计 1500），未认领
      ...Array.from({ length: 15 }, () =>
        makeRecord({ accountId: acc.id, amount: 100, type: 'income', poolId: salary.id }),
      ),
    ];

    const r = calcVirtualAssets({ accounts: [acc], records, pools: [rent, salary] });
    expect(r.actualTotal).toBe(3000);
    expect(r.prepaidUnconsumed).toBeCloseTo(1000 - 15 * 33.33, 2); // ≈ 500.05
    expect(r.earnedUnarrived).toBe(1500);
    expect(r.virtualTotal).toBeCloseTo(3000 + (1000 - 15 * 33.33) + 1500, 2);
  });

  it('均摊支出逐日生成但无实际认领：只计入未支付，不增加虚拟资产', () => {
    const acc = makeAccount({ balance: 2000 });
    const rent = makePool({ amount: 1000, direction: 'expense' });
    const records: AccountRecord[] = Array.from({ length: 4 }, () =>
      makeRecord({ accountId: acc.id, amount: -70, poolId: rent.id }),
    );

    const r = calcVirtualAssets({ accounts: [acc], records, pools: [rent] });
    expect(r.actualTotal).toBe(2000);
    expect(r.prepaidUnconsumed).toBe(0);
    expect(r.unpaidConsumed).toBe(280);
    expect(r.virtualTotal).toBe(2000);
  });

  it('均摊支出全额认领：实际付款后才扣减资产，不把未付款消费提前加到资产', () => {
    const acc = makeAccount({ balance: 720 });
    const rent = makePool({ amount: 1000, direction: 'expense' });
    const records: AccountRecord[] = [
      ...Array.from({ length: 4 }, () =>
        makeRecord({ accountId: acc.id, amount: -70, poolId: rent.id }),
      ),
      makeRecord({ accountId: acc.id, amount: -280, poolId: rent.id, poolStatus: 'claimed' }),
    ];

    const r = calcVirtualAssets({ accounts: [acc], records, pools: [rent] });
    expect(r.actualTotal).toBe(720);
    expect(r.prepaidUnconsumed).toBe(0);
    expect(r.unpaidConsumed).toBe(0);
    expect(r.virtualTotal).toBe(720);
  });

  it('收入池部分到账：已赚 1500、到账 1000 → 未到账 500', () => {
    const acc = makeAccount({ balance: 1000 });
    const salary = makePool({ amount: 3000, direction: 'income' });
    const records: AccountRecord[] = [
      ...Array.from({ length: 15 }, () =>
        makeRecord({ accountId: acc.id, amount: 100, type: 'income', poolId: salary.id }),
      ),
      makeRecord({ accountId: acc.id, amount: 1000, type: 'income', poolId: salary.id, poolStatus: 'claimed' }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [salary] });
    expect(r.earnedUnarrived).toBe(500);
    expect(r.virtualTotal).toBe(1500);
  });

  it('先用后付：支出池未付款（认领 0）→ 已消耗计入未支付，不扣虚拟总额', () => {
    const acc = makeAccount({ balance: 2000 });
    const rent = makePool({ amount: 1000, direction: 'expense' });
    const records: AccountRecord[] = [
      makeRecord({ accountId: acc.id, amount: -500, poolId: rent.id }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [rent] });
    expect(r.prepaidUnconsumed).toBe(0);
    expect(r.unpaidConsumed).toBe(500);
    expect(r.virtualTotal).toBe(2000);
  });

  it('用户示例：房租 2100（1-30 号，日均 70），4 号已消耗 280 未支付', () => {
    const acc = makeAccount({ balance: 3000 });
    const rent = makePool({
      name: '房租',
      amount: 2100,
      direction: 'expense',
      dateRange: { start: '2026-09-01', end: '2026-09-30' },
    });
    // 4 天日均消耗（9/1 ~ 9/4）
    const records: AccountRecord[] = Array.from({ length: 4 }, (_, i) =>
      makeRecord({
        dateKey: `2026-09-0${i + 1}`,
        accountId: acc.id,
        amount: -70,
        poolId: rent.id,
      }),
    );
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [rent] });
    expect(r.unpaidConsumed).toBe(280);
    expect(r.prepaidUnconsumed).toBe(0);
    expect(r.virtualTotal).toBe(3000);
  });

  it('先用后付部分支付：消耗 280、只认领 100 → 未支付 180', () => {
    const acc = makeAccount({ balance: 3000 });
    const rent = makePool({ amount: 2100, direction: 'expense' });
    const records: AccountRecord[] = [
      ...Array.from({ length: 4 }, () =>
        makeRecord({ accountId: acc.id, amount: -70, poolId: rent.id }),
      ),
      makeRecord({ accountId: acc.id, amount: -100, poolId: rent.id, poolStatus: 'claimed' }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [rent] });
    expect(r.unpaidConsumed).toBe(180);
    expect(r.prepaidUnconsumed).toBe(0);
  });

  it('收入池到账超过已赚 → 未到账不为负', () => {
    const acc = makeAccount({ balance: 2000 });
    const salary = makePool({ amount: 3000, direction: 'income' });
    const records: AccountRecord[] = [
      makeRecord({ accountId: acc.id, amount: 500, type: 'income', poolId: salary.id }),
      makeRecord({ accountId: acc.id, amount: 2000, type: 'income', poolId: salary.id, poolStatus: 'claimed' }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [salary] });
    expect(r.earnedUnarrived).toBe(0);
  });

  it('未归入账户的实际记录 → 带符号调整项（支出为负）', () => {
    const acc = makeAccount({ balance: 3000 });
    const records: AccountRecord[] = [
      // accountId 不存在于账户列表（未归入）
      makeRecord({ accountId: '', amount: -1000 }),
      makeRecord({ accountId: '', amount: 200, type: 'income' }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [] });
    expect(r.pendingAdjust).toBe(-800);
    // 调整项不并入虚拟总额，仅展示
    expect(r.virtualTotal).toBe(3000);
  });

  it('池逐日虚拟记录即使账户失效也不计入未归入调整项', () => {
    const acc = makeAccount({ balance: 3000 });
    const rent = makePool({ amount: 1000, direction: 'expense' });
    const records: AccountRecord[] = [
      makeRecord({ accountId: 'acc-deleted', amount: -500, poolId: rent.id }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [rent] });
    expect(r.pendingAdjust).toBe(0);
  });

  it('多池合计 + 押金先付存池计入绿色待退（v2.5 T-416）', () => {
    const acc = makeAccount({ balance: 1000 });
    const rent1 = makePool({ amount: 600, direction: 'expense' });
    const rent2 = makePool({ amount: 300, direction: 'expense' });
    const deposit = makePool({ type: 'deposit', amount: 800 });
    const records: AccountRecord[] = [
      makeRecord({ accountId: acc.id, amount: -600, poolId: rent1.id, poolStatus: 'claimed' }),
      // rent2 只有消耗没有付款 → 预付未消耗为 0
      makeRecord({ accountId: acc.id, amount: -300, poolId: rent2.id }),
      makeRecord({ accountId: acc.id, amount: -800, poolId: deposit.id, poolStatus: 'confirmed' }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [rent1, rent2, deposit] });
    expect(r.prepaidUnconsumed).toBe(600); // rent1 全额预付未消耗
    expect(r.unpaidConsumed).toBe(300); // rent2 消耗 300 未付款
    expect(r.earnedUnarrived).toBe(0);
    expect(r.depositRefundable).toBe(800); // 押金已付 → 待退
    expect(r.virtualTotal).toBe(2400); // 未支付不扣虚拟总额，待退计入
  });

  it('押金先付：存入 2000 取出 500 → 待退 1500', () => {
    const acc = makeAccount({ balance: 3000 });
    const deposit = makePool({ type: 'deposit', amount: 2000, settleMode: 'prepay' });
    const records: AccountRecord[] = [
      makeRecord({ accountId: acc.id, amount: -2000, poolId: deposit.id, poolStatus: 'confirmed' }),
      makeRecord({ accountId: acc.id, amount: 500, type: 'income', poolId: deposit.id, poolStatus: 'confirmed' }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [deposit] });
    expect(r.depositRefundable).toBe(1500);
    expect(r.depositPending).toBe(0);
    expect(r.virtualTotal).toBe(4500);
  });

  it('押金先付：建池即声明已付，无认领记录也显示待退（回归）', () => {
    const acc = makeAccount({ balance: 3000 });
    const deposit = makePool({ type: 'deposit', amount: 2000, settleMode: 'prepay' });
    const r = calcVirtualAssets({ accounts: [acc], records: [], pools: [deposit] });
    expect(r.depositRefundable).toBe(2000);
    expect(r.depositPending).toBe(0);
    expect(r.virtualTotal).toBe(5000);
  });

  it('先用后付：押金 2000 未支付 → 待付 2000，不扣虚拟总额', () => {
    const acc = makeAccount({ balance: 3000 });
    const deposit = makePool({ type: 'deposit', amount: 2000, settleMode: 'postpay' });
    const r = calcVirtualAssets({ accounts: [acc], records: [], pools: [deposit] });
    expect(r.depositPending).toBe(2000);
    expect(r.depositRefundable).toBe(0);
    expect(r.virtualTotal).toBe(3000);
  });

  it('先用后付部分支付：押金 2000 已存 800 → 待付 1200 + 待退 800', () => {
    const acc = makeAccount({ balance: 3000 });
    const deposit = makePool({ type: 'deposit', amount: 2000, settleMode: 'postpay' });
    const records: AccountRecord[] = [
      makeRecord({ accountId: acc.id, amount: -800, poolId: deposit.id, poolStatus: 'confirmed' }),
    ];
    const r = calcVirtualAssets({ accounts: [acc], records, pools: [deposit] });
    expect(r.depositPending).toBe(1200);
    expect(r.depositRefundable).toBe(800);
    expect(r.virtualTotal).toBe(3800);
  });
});
