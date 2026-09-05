/**
 * @fileoverview Salary Timer — 虚拟资产分解纯函数（v2.4 · TASK-040 T-409）
 *
 * 虚拟资产 = 实际资产 + 预付未消耗 + 已赚未到账：
 * - 实际资产：Σ 账户余额
 * - 预付未消耗（支出池）：已认领（实际支付）− 已生成日均消耗，正值部分
 *   例：房租 1000 已付、消耗半个月 500 → 还剩 500 的服务价值未用完
 * - 已赚未到账（收入池）：已生成日均收入 − 已认领（实际到账），正值部分
 *   例：工资 3000 挣了半个月 1500、尚未发放 → 1500 虚拟在途
 * - 已消耗未支付（支出池，先用后付）：已生成消耗 − 已认领，正值部分
 *   例：房租 2100/月（日均 70），4 号已消耗 280、尚未付款 → 欠 280
 *   不并入虚拟总额，与未归入记录同框作为负向调整项展示
 *
 * 存池分解（v2.5 T-416）：
 * - 押金先付（prepay，默认）：池内余额实际已扣、概念仍存在 → 待退，绿色资产
 * - 先用后付（postpay）：未付部分 → 待付，红色调整项（与未分类同框）；已付部分同样计待退
 *
 * 未归入调整项：实际发生（手动记录 / 认领付款 / 存池存取）但未归入任何账户的
 * 记录，带符号合计。池逐日生成的虚拟记录不参与（已由池分解覆盖）。
 *
 * 纯函数、无副作用、无 DOM 依赖，单测覆盖（virtual.test.ts）。
 */
import type { Account, AccountRecord, PoolConfig } from '../types';

/** 虚拟资产分解结果（均四舍五入到分） */
export interface VirtualAssetsBreakdown {
  /** 实际资产：Σ 账户余额 */
  actualTotal: number;
  /** 未归入账户的实际记录净额（带符号：支出为负 / 收入为正） */
  pendingAdjust: number;
  /** 支出池预付未消耗合计（≥0）：先付后用，还剩的价值 */
  prepaidUnconsumed: number;
  /** 支出池已消耗未支付合计（≥0）：先用后付，欠的部分 */
  unpaidConsumed: number;
  /** 收入池已赚未到账合计（≥0） */
  earnedUnarrived: number;
  /** v2.5 T-416：存池押金待退合计（≥0）：实际已扣、概念仍存在，绿色资产 */
  depositRefundable: number;
  /** v2.5 T-416：存池先用后付未付合计（≥0）：红色待付，与未分类同框，不并入虚拟总额 */
  depositPending: number;
  /** 虚拟资产 = 实际 + 预付未消耗 + 已赚未到账 + 押金待退 */
  virtualTotal: number;
}

/**
 * 池逐日生成的虚拟记录（有 poolId、无 poolStatus）。
 * 收入池 → 虚拟到账；支出池 → 虚拟均摊。未实际影响账户余额。
 */
export function isPoolDailyRecord(record: AccountRecord): boolean {
  return !!record.poolId && !record.poolStatus;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 计算虚拟资产分解。
 * @param params.accounts 账户列表
 * @param params.records 全部记账记录
 * @param params.pools 池配置（仅均摊型参与虚拟分解）
 */
export function calcVirtualAssets(params: {
  accounts: Account[];
  records: AccountRecord[];
  pools: PoolConfig[];
}): VirtualAssetsBreakdown {
  const { accounts, records, pools } = params;

  const actualTotal = accounts.reduce((sum, a) => sum + a.balance, 0);

  // 未归入调整项：实际发生但账户缺失/失效的记录（排除池虚拟记录与存量虚拟）
  const accountIds = new Set(accounts.map((a) => a.id));
  let pendingAdjust = 0;
  for (const r of records) {
    if (isPoolDailyRecord(r) || r.poolStatus === 'virtual') continue;
    if (r.accountId && accountIds.has(r.accountId)) continue;
    pendingAdjust += r.amount;
  }

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
        // 先用后付：未付部分红色待付；已付部分实际已扣 → 绿色待退
        depositPending += Math.max(0, pool.amount - paidIn);
        depositRefundable += Math.max(0, paidIn - takenOut);
      } else {
        // 押金先付：建池即声明已付（不依赖认领记录），取出会减少待退
        depositRefundable += Math.max(0, pool.amount - takenOut);
      }
      continue;
    }
    if (pool.type !== 'equalize') continue;
    let generated = 0;
    let claimed = 0;
    let earnedTotal = 0; // v2.5 T-501：收入池「已赚」= 虚拟到账 record + 联动 / 认领 record
    // v2.5 TASK-046 T-505：noDailyVirtual 池(联动工资)跳过虚拟 record 计入,
    // 只追踪 confirmed in records(联动 / 手动认领)和 claimed records。
    // 避免联动 record 既在虚拟里又在 confirmed 里被双重计数。
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
        // v2.5 TASK-046 T-501：联动 / 手动认领的「已赚」真实 record
        earnedTotal += r.amount;
      }
    }
    if ((pool.direction ?? 'expense') === 'income') {
      // 收入池：虚拟分解 = 已赚合计 − 已认领到账
      earnedUnarrived += Math.max(0, earnedTotal - claimed);
    } else if (claimed >= generated) {
      // 先付后用：已付超过已消耗 → 剩余价值虚拟加回
      prepaidUnconsumed += claimed - generated;
    } else {
      // 先用后付：已消耗超过已付 → 欠的部分作为负向调整项
      unpaidConsumed += generated - claimed;
    }
  }

  return {
    actualTotal: round2(actualTotal),
    pendingAdjust: round2(pendingAdjust),
    prepaidUnconsumed: round2(prepaidUnconsumed),
    unpaidConsumed: round2(unpaidConsumed),
    earnedUnarrived: round2(earnedUnarrived),
    depositRefundable: round2(depositRefundable),
    depositPending: round2(depositPending),
    virtualTotal: round2(actualTotal + prepaidUnconsumed + earnedUnarrived + depositRefundable),
  };
}
