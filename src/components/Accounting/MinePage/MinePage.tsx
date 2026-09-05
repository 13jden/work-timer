/**
 * @fileoverview MinePage — MINE 页（v2.4 · TASK-040 T-402/T-405）
 *
 * 记账主题第 4 个 tab，分区纵向排列：
 * 总资产卡（含横向账户卡）→ 存钱目标 → 池管理。
 *
 * v2.5-patch4：
 * - N-481：移除 LinkageSection 整块（time → accounting 联动展示取消）。
 * - N-484：TotalAssetsCard 右上角增加「重置资产」图标，二次确认后调 accountStore.resetAssets。
 */
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount, calcVirtualAssets } from '../../../lib/accounting';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { AccountRow } from './AccountRow';
import { GoalsSection } from './GoalsSection';
import { PoolSection } from '../PoolPage/PoolSection';
import { PageTopbar } from '../../PageTopbar';
import styles from './MinePage.module.css';

export function MinePage() {
  const accountCount = useAccountStore((s) => s.accounts.length);
  return (
    <div className={styles.page}>
      {/* v2.5 T-415：与计时侧设置页位置对应的标题栏 */}
      <PageTopbar
        eyebrow="mine"
        english="What you own"
        right={`${accountCount} 账户`}
        title="资产设置"
      />
      <TotalAssetsCard />
      <GoalsSection />
      {/* v2.5-patch4 N-481：取消「time → accounting 联动」展示入口。
          联动功能本身保留在 store（ensureSalaryPool / upsertSalaryLinkageForDate），
          默认开关=false，CalendarPage 不再写入联动 record。
          未来如需恢复，仅修改 config.salaryLinkageEnabled 即可。 */}
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
  const resetAssets = useAccountStore((s) => s.resetAssets);

  const {
    actualTotal,
    pendingAdjust,
    prepaidUnconsumed,
    unpaidConsumed,
    earnedUnarrived,
    depositRefundable,
    depositPending,
    virtualTotal,
  } = useMemo(() => calcVirtualAssets({ accounts, records, pools }), [accounts, records, pools]);

  const hasVirtual = prepaidUnconsumed > 0 || earnedUnarrived > 0 || depositRefundable > 0;
  const hasPending = pendingAdjust !== 0 || unpaidConsumed > 0 || depositPending > 0;
  const hasBreakdown = hasVirtual || hasPending;

  // v2.5-patch4 N-484：二次确认后调 resetAssets（仅余额归零，记录保留）。
  const handleResetAssets = () => {
    const confirmed = window.confirm(
      '重置资产？\n\n所有账户余额将归零（记账记录、池、目标全部保留）。',
    );
    if (!confirmed) return;
    resetAssets();
  };

  return (
    <div className={styles.totalCard}>
      <div className={styles.totalLabel}>
        <span>总资产</span>
        {hasVirtual && <span className={styles.totalVirtualTag}>虚拟</span>}
        {/* v2.5-patch4 N-484：资产清零入口 —— 右上角小图标 */}
        <button
          type="button"
          className={styles.totalResetBtn}
          onClick={handleResetAssets}
          title="重置资产（账户余额归零，记录保留）"
          aria-label="重置资产"
        >
          <ArrowCounterClockwise size={14} weight="regular" />
        </button>
      </div>
      <div className={styles.totalAmount}>¥{formatAmount(virtualTotal, true)}</div>
      {hasBreakdown && (
        <div className={styles.virtualRow}>
          <span className={styles.virtualActual}>实际 ¥{formatAmount(actualTotal, true)}</span>
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
              {/* v2.5 T-416：存池先用后付 → 红色待付，与未分类同框 */}
              {depositPending > 0 && (
                <span className={styles.pendingNeg}>-¥{formatAmount(depositPending)} 待付</span>
              )}
            </span>
          )}
          {prepaidUnconsumed > 0 && (
            <span className={styles.chipPrepaid}>+¥{formatAmount(prepaidUnconsumed)} 预付未消耗</span>
          )}
          {earnedUnarrived > 0 && (
            <span className={styles.chipEarned}>+¥{formatAmount(earnedUnarrived)} 已赚未到账</span>
          )}
          {/* v2.5 T-416：押金先付 → 实际已扣、概念仍存在，绿色待退 */}
          {depositRefundable > 0 && (
            <span className={styles.chipEarned}>+¥{formatAmount(depositRefundable)} 待退</span>
          )}
        </div>
      )}
      <AccountRow />
    </div>
  );
}
