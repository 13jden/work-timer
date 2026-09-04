/**
 * @fileoverview MinePage — MINE 页（v2.4 · TASK-040 T-402/T-405）
 *
 * 记账主题第 4 个 tab，分区纵向排列：
 * 总资产卡（含横向账户卡）→ 存钱目标 → 池管理。
 */
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount, calcVirtualAssets } from '../../../lib/accounting';
import { AccountRow } from './AccountRow';
import { GoalsSection } from './GoalsSection';
import { PoolSection } from '../PoolPage/PoolSection';
import styles from './MinePage.module.css';

export function MinePage() {
  return (
    <div className={styles.page}>
      <TotalAssetsCard />
      <GoalsSection />
      <PoolSection />
    </div>
  );
}

/**
 * 总资产卡（T-402 / T-409）：虚拟总额 + 分解行 + 横向账户卡片行。
 * 分解行：实际（含未归入调整项）· 预付未消耗（淡红）· 已赚未到账（淡绿）。
 */
function TotalAssetsCard() {
  const accounts = useAccountStore((s) => s.accounts);
  const records = useAccountStore((s) => s.records);
  const pools = useAccountStore((s) => s.pools);

  const {
    actualTotal,
    pendingAdjust,
    prepaidUnconsumed,
    unpaidConsumed,
    earnedUnarrived,
    virtualTotal,
  } = useMemo(() => calcVirtualAssets({ accounts, records, pools }), [accounts, records, pools]);

  const hasVirtual = prepaidUnconsumed > 0 || earnedUnarrived > 0;
  const hasPending = pendingAdjust !== 0 || unpaidConsumed > 0;
  const hasBreakdown = hasVirtual || hasPending;

  return (
    <div className={styles.totalCard}>
      <div className={styles.totalLabel}>
        总资产
        {hasVirtual && <span className={styles.totalVirtualTag}>虚拟</span>}
      </div>
      <div className={styles.totalAmount}>¥{formatAmount(virtualTotal)}</div>
      {hasBreakdown && (
        <div className={styles.virtualRow}>
          <span className={styles.virtualActual}>实际 ¥{formatAmount(actualTotal)}</span>
          {hasPending && (
            <span className={styles.pendingBox}>
              {pendingAdjust !== 0 && (
                <span className={pendingAdjust < 0 ? styles.pendingNeg : styles.pendingPos}>
                  {pendingAdjust < 0 ? '-' : '+'}¥{formatAmount(Math.abs(pendingAdjust))} 未分类
                </span>
              )}
              {unpaidConsumed > 0 && (
                <span className={styles.pendingNeg}>-¥{formatAmount(unpaidConsumed)} 未支付</span>
              )}
            </span>
          )}
          {prepaidUnconsumed > 0 && (
            <span className={styles.chipPrepaid}>+¥{formatAmount(prepaidUnconsumed)} 预付未消耗</span>
          )}
          {earnedUnarrived > 0 && (
            <span className={styles.chipEarned}>+¥{formatAmount(earnedUnarrived)} 已赚未到账</span>
          )}
        </div>
      )}
      <AccountRow />
    </div>
  );
}
