/**
 * @fileoverview Salary Timer — 虚拟资产分解纯函数（v3.0 TASK-057 T-575）
 *
 * v3.0 改造：取消多账户体系，actualTotal 不再来自账户余额求和，
 * 改读用户手动维护的 `assets.totalAssets`。pendingAdjust（未归入调整项）
 * 概念整体移除 —— 记账记录不再与资产对账。
 *
 * 虚拟资产 = 手动总资产 + 池分解项：
 *  - 实际：assets.totalAssets（用户手动维护）
 *  - 预付未消耗（支出池）：已认领 − 已生成日均消耗，正值部分
 *  - 已消耗未支付（支出池，先用后付）：已生成 − 已认领，正值部分 → 作为负向调整
 *  - 已赚未到账（收入池）：已生成 − 已认领到账，正值部分
 *  - 存池押金待退（先付）：实际已扣但概念仍存在 → 绿色资产
 *  - 存池先用后付未付：未付部分 → 红色调整（与未支付同框）
 *
 * 纯函数、无副作用、无 DOM 依赖，单测覆盖（virtual.test.ts）。
 */
import type { AccountRecord, PoolConfig } from '../types';

/** 虚拟资产分解结果（均四舍五入到分） */
export interface VirtualAssetsBreakdown {
  /** 实际资产：用户手动维护的 totalAssets（v3.0 起不再来自账户余额） */
  actualTotal: number;
  /** 支出池预付未消耗合计（≥0）：先付后用，还剩的价值 */
  prepaidUnconsumed: number;
  /** 支出池已消耗未支付合计（≥0）：先用后付，欠的部分 */
  unpaidConsumed: number;
  /** 收入池已赚未到账合计（≥0） */
  earnedUnarrived: number;
  /** 存池押金待退合计（≥0）：实际已扣、概念仍存在，绿色资产 */
  depositRefundable: number;
  /** 存池先用后付未付合计（≥0）：红色待付，不并入虚拟总额 */
  depositPending: number;
  /** 虚拟资产 = 实际 + 预付未消耗 + 已赚未到账 + 押金待退 - 押金待付 */
  virtualTotal: number;
}

/**
 * 池逐日生成的虚拟记录（有 poolId、无 poolStatus）。
 * 收入池 → 虚拟到账；支出池 → 虚拟均摊。未实际影响任何余额。
 */
export function isPoolDailyRecord(record: AccountRecord): boolean {
  return !!record.poolId && !record.poolStatus;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 计算虚拟资产分解。
 * @param params.totalAssets 用户手动维护的总资产（v3.0 起为唯一「实际资产」口径）
 * @param params.records 全部记账记录
 * @param params.pools 池配置（仅均摊型参与虚拟分解）
 */
export function calcVirtualAssets(params: {
  totalAssets: number;
  records: AccountRecord[];
  pools: PoolConfig[];
}): VirtualAssetsBreakdown {
  const { totalAssets, records, pools } = params;

  const actualTotal = round2(totalAssets);

  // 池虚拟分解：逐池统计已生成 / 已认领
  let prepaidUnconsumed = 0;
  let unpaidConsumed = 0;
  let earnedUnarrived = 0;
  let depositRefundable = 0;
  let depositPending = 0;
  for (const pool of pools) {
    if (pool.type === 'deposit') {
      // v2.5 T-416：存池分解。confirmed 支出记录=存入，收入记录=取出
      let paidIn = 0;
      let takenOut = 0;
      for (const r of records) {
        if (r.poolId !== pool.id || r.poolStatus !== 'confirmed') continue;
        if (r.amount < 0) paidIn += -r.amount;
        else takenOut += r.amount;
      }
      if ((pool.settleMode ?? 'prepay') === 'postpay') {
        depositPending += Math.max(0, pool.amount - paidIn);
        depositRefundable += Math.max(0, paidIn - takenOut);
      } else {
        depositRefundable += Math.max(0, pool.amount - takenOut);
      }
      continue;
    }
    if (pool.type !== 'equalize') continue;
    let generated = 0;
    let claimed = 0;
    let earnedTotal = 0;
    const skipVirtual = !!pool.noDailyVirtual;
    for (const r of records) {
      if (r.poolId !== pool.id) continue;
      if (isPoolDailyRecord(r)) {
        const abs = Math.abs(r.amount);
        generated += abs;
        if ((pool.direction ?? 'expense') === 'income' && !skipVirtual) {
          earnedTotal += abs;
        }
      } else if (r.poolStatus === 'claimed') {
        claimed += Math.abs(r.amount);
      } else if (
        r.poolStatus === 'confirmed' &&
        (pool.direction ?? 'expense') === 'income' &&
        r.amount > 0
      ) {
        earnedTotal += r.amount;
      }
    }
    if ((pool.direction ?? 'expense') === 'income') {
      earnedUnarrived += Math.max(0, earnedTotal - claimed);
    } else if (claimed >= generated) {
      prepaidUnconsumed += claimed - generated;
    } else {
      unpaidConsumed += generated - claimed;
    }
  }

  return {
    actualTotal,
    prepaidUnconsumed: round2(prepaidUnconsumed),
    unpaidConsumed: round2(unpaidConsumed),
    earnedUnarrived: round2(earnedUnarrived),
    depositRefundable: round2(depositRefundable),
    depositPending: round2(depositPending),
    virtualTotal: round2(
      actualTotal + prepaidUnconsumed + earnedUnarrived + depositRefundable - depositPending,
    ),
  };
}
