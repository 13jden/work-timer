/**
 * @fileoverview Salary Timer — 虚拟资产分解单测（v3.0 TASK-057 T-575）
 *
 * v3.0 改造：actualTotal 来源从 `accounts[].balance` 求和 改为 `totalAssets`（用户手动维护）；
 * pendingAdjust 概念移除（记账记录不再与资产对账）。
 */
import { describe, it, expect } from 'vitest';
import { calcVirtualAssets, isPoolDailyRecord } from './virtual';
import type { AccountRecord, PoolConfig } from '../types';

let seq = 0;

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
    accountId: '',
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

describe('calcVirtualAssets（v3.0 TASK-057 手动总资产口径）', () => {
  it('空数据 → 全 0', () => {
    const r = calcVirtualAssets({ totalAssets: 0, records: [], pools: [] });
    expect(r).toEqual({
      actualTotal: 0,
      prepaidUnconsumed: 0,
      unpaidConsumed: 0,
      earnedUnarrived: 0,
      depositRefundable: 0,
      depositPending: 0,
      virtualTotal: 0,
    });
  });

  it('手动总资产 3000 + 房租预付未消耗 500 + 工资已赚未到账 1500', () => {
    const rent = makePool({ name: '房租', amount: 1000, direction: 'expense' });
    const salary = makePool({ name: '工资', amount: 3000, direction: 'income' });

    const records: AccountRecord[] = [
      makeRecord({ amount: -1000, poolId: rent.id, poolStatus: 'claimed' }),
      ...Array.from({ length: 15 }, () =>
        makeRecord({ amount: -33.33, poolId: rent.id }),
      ),
      ...Array.from({ length: 15 }, () =>
        makeRecord({ amount: 100, type: 'income', poolId: salary.id }),
      ),
    ];

    const r = calcVirtualAssets({ totalAssets: 3000, records, pools: [rent, salary] });
    expect(r.actualTotal).toBe(3000);
    expect(r.prepaidUnconsumed).toBeCloseTo(1000 - 15 * 33.33, 2);
    expect(r.earnedUnarrived).toBe(1500);
    expect(r.virtualTotal).toBeCloseTo(3000 + (1000 - 15 * 33.33) + 1500, 2);
  });

  it('均摊支出逐日生成但无实际认领：只计入未支付，不增虚拟资产', () => {
    const rent = makePool({ amount: 1000, direction: 'expense' });
    const records: AccountRecord[] = Array.from({ length: 4 }, () =>
      makeRecord({ amount: -70, poolId: rent.id }),
    );

    const r = calcVirtualAssets({ totalAssets: 2000, records, pools: [rent] });
    expect(r.actualTotal).toBe(2000);
    expect(r.prepaidUnconsumed).toBe(0);
    expect(r.unpaidConsumed).toBe(280);
    expect(r.virtualTotal).toBe(2000);
  });

  it('均摊支出全额认领：预付未消耗为 0，virtualTotal 等于 totalAssets', () => {
    const rent = makePool({ amount: 1000, direction: 'expense' });
    const records: AccountRecord[] = [
      ...Array.from({ length: 4 }, () =>
        makeRecord({ amount: -70, poolId: rent.id }),
      ),
      makeRecord({ amount: -280, poolId: rent.id, poolStatus: 'claimed' }),
    ];

    const r = calcVirtualAssets({ totalAssets: 720, records, pools: [rent] });
    expect(r.actualTotal).toBe(720);
    expect(r.prepaidUnconsumed).toBe(0);
    expect(r.unpaidConsumed).toBe(0);
    expect(r.virtualTotal).toBe(720);
  });

  it('收入池部分到账：已赚 1500、到账 1000 → 未到账 500', () => {
    const salary = makePool({ amount: 3000, direction: 'income' });
    const records: AccountRecord[] = [
      ...Array.from({ length: 15 }, () =>
        makeRecord({ amount: 100, type: 'income', poolId: salary.id }),
      ),
      makeRecord({ amount: 1000, type: 'income', poolId: salary.id, poolStatus: 'claimed' }),
    ];
    const r = calcVirtualAssets({ totalAssets: 1000, records, pools: [salary] });
    expect(r.earnedUnarrived).toBe(500);
    expect(r.virtualTotal).toBe(1500);
  });

  it('押金先付：建池即声明已付 → 待退 = 押金金额', () => {
    const deposit = makePool({ type: 'deposit', amount: 1000 });
    const r = calcVirtualAssets({ totalAssets: 2000, records: [], pools: [deposit] });
    expect(r.depositRefundable).toBe(1000);
    expect(r.depositPending).toBe(0);
    expect(r.virtualTotal).toBe(3000);
  });

  it('先用后付部分支付：消耗 280、只认领 100 → 未支付 180', () => {
    const rent = makePool({ amount: 2100, direction: 'expense' });
    const records: AccountRecord[] = [
      ...Array.from({ length: 4 }, () =>
        makeRecord({ amount: -70, poolId: rent.id }),
      ),
      makeRecord({ amount: -100, poolId: rent.id, poolStatus: 'claimed' }),
    ];
    const r = calcVirtualAssets({ totalAssets: 3000, records, pools: [rent] });
    expect(r.unpaidConsumed).toBe(180);
    expect(r.prepaidUnconsumed).toBe(0);
  });

  it('收入池到账超过已赚 → 未到账不为负', () => {
    const salary = makePool({ amount: 3000, direction: 'income' });
    const records: AccountRecord[] = [
      makeRecord({ amount: 500, type: 'income', poolId: salary.id }),
      makeRecord({ amount: 2000, type: 'income', poolId: salary.id, poolStatus: 'claimed' }),
    ];
    const r = calcVirtualAssets({ totalAssets: 2000, records, pools: [salary] });
    expect(r.earnedUnarrived).toBe(0);
  });

  it('多池合计 + 押金先付存池计入绿色待退（v2.5 T-416）', () => {
    const rent1 = makePool({ amount: 600, direction: 'expense' });
    const rent2 = makePool({ amount: 300, direction: 'expense' });
    const deposit = makePool({ type: 'deposit', amount: 800 });
    const records: AccountRecord[] = [
      makeRecord({ amount: -600, poolId: rent1.id, poolStatus: 'claimed' }),
      makeRecord({ amount: -300, poolId: rent2.id }),
      makeRecord({ amount: -800, poolId: deposit.id, poolStatus: 'confirmed' }),
    ];
    const r = calcVirtualAssets({ totalAssets: 1000, records, pools: [rent1, rent2, deposit] });
    expect(r.prepaidUnconsumed).toBe(600);
    expect(r.unpaidConsumed).toBe(300);
    expect(r.earnedUnarrived).toBe(0);
    expect(r.depositRefundable).toBe(800);
    expect(r.virtualTotal).toBe(2400);
  });

  it('押金先付：存入 2000 取出 500 → 待退 1500', () => {
    const deposit = makePool({ type: 'deposit', amount: 2000, settleMode: 'prepay' });
    const records: AccountRecord[] = [
      makeRecord({ amount: -2000, poolId: deposit.id, poolStatus: 'confirmed' }),
      makeRecord({ amount: 500, type: 'income', poolId: deposit.id, poolStatus: 'confirmed' }),
    ];
    const r = calcVirtualAssets({ totalAssets: 3000, records, pools: [deposit] });
    expect(r.depositRefundable).toBe(1500);
    expect(r.depositPending).toBe(0);
    expect(r.virtualTotal).toBe(4500);
  });

  it('押金先付：建池即声明已付，无认领记录也显示待退', () => {
    const deposit = makePool({ type: 'deposit', amount: 2000, settleMode: 'prepay' });
    const r = calcVirtualAssets({ totalAssets: 3000, records: [], pools: [deposit] });
    expect(r.depositRefundable).toBe(2000);
    expect(r.depositPending).toBe(0);
    expect(r.virtualTotal).toBe(5000);
  });

  it('先用后付：押金 2000 未支付 → 待付 2000，虚拟总资产 -2000', () => {
    const deposit = makePool({ type: 'deposit', amount: 2000, settleMode: 'postpay' });
    const r = calcVirtualAssets({ totalAssets: 3000, records: [], pools: [deposit] });
    expect(r.depositPending).toBe(2000);
    expect(r.depositRefundable).toBe(0);
    expect(r.virtualTotal).toBe(1000);
  });

  it('先用后付部分支付：押金 2000 已存 800 → 待付 1200 + 待退 800', () => {
    const deposit = makePool({ type: 'deposit', amount: 2000, settleMode: 'postpay' });
    const records: AccountRecord[] = [
      makeRecord({ amount: -800, poolId: deposit.id, poolStatus: 'confirmed' }),
    ];
    const r = calcVirtualAssets({ totalAssets: 3000, records, pools: [deposit] });
    expect(r.depositPending).toBe(1200);
    expect(r.depositRefundable).toBe(800);
    expect(r.virtualTotal).toBe(2600);
  });
});
