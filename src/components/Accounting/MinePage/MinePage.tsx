/**
 * @fileoverview MinePage — MINE 页（v2.4 · TASK-040 T-402/T-405 + v3.0 · TASK-057 T-575）
 *
 * 记账主题第 4 个 tab，分区纵向排列：
 * 总资产卡 → 存钱目标 → 池管理。
 *
 * v3.0 TASK-057 改造（钱包模式开关）：
 * - TotalAssetsCard 双形态：关闭 = 「总支出」累计；开启 = v2.4 总资产（虚拟分解 + AccountRow）
 * - 总资产卡右上角 ⚙ 按钮 → WalletSwitchSheet 切换
 * - 开启钱包时，AccountRow 小卡点击 → AccountDetailPage（每账户详情）
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { useConfigStore } from '../../../store/configStore';
import { formatAmount, calcVirtualAssets } from '../../../lib/accounting';
import { Gear } from '@phosphor-icons/react';
import { AccountRow } from './AccountRow';
import { AccountDetailPage } from './AccountDetailPage';
import { WalletSwitchSheet } from './WalletSwitchSheet';
import { GoalsSection } from './GoalsSection';
// v3.0 TASK-058：PoolSection → RecurringSection（去池化）
import { RecurringSection } from '../PoolPage/RecurringSection';
// v3.0 TASK-059：MINE 页「旅游记录」入口
import { JourneySection } from '../Journey/JourneySection';
import { JourneyListPage } from '../Journey/JourneyListPage';
import { JourneyDetailPage } from '../Journey/JourneyDetailPage';
import { PageTopbar } from '../../PageTopbar';
import styles from './MinePage.module.css';

export function MinePage() {
  const accountCount = useAccountStore((s) => s.accounts.length);
  const [pageMode, setPageMode] = useState<'mine' | 'list' | 'detail'>('mine');
  const [detailJourneyId, setDetailJourneyId] = useState<string | null>(null);

  // v3.0 TASK-059：旅游记录页面独立全屏（不再内嵌于 MINE）
  if (pageMode !== 'mine') {
    if (pageMode === 'list') {
      return (
        <JourneyListPage
          onBack={() => setPageMode('mine')}
          onPick={(id) => {
            setDetailJourneyId(id);
            setPageMode('detail');
          }}
        />
      );
    }
    if (detailJourneyId) {
      return (
        <JourneyDetailPage
          journeyId={detailJourneyId}
          onBack={() => setPageMode('list')}
        />
      );
    }
    setPageMode('list');
    return null;
  }

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
      {/* v3.0 TASK-059：MINE 页「旅游记录」入口（位于定期账单之上） */}
      <JourneySection onOpen={() => setPageMode('list')} />
      <RecurringSection />
    </div>
  );
}

/**
 * 总资产卡（T-402 / T-409）。
 *
 * v3.0 TASK-057 改造（钱包模式开关）：
 * - 展示层永远「总资产」（虚拟分解 chip 照常显示，关闭钱包时不过钱包筛选）
 * - 开启钱包时：显示 AccountRow，点击账户小卡 → AccountDetailPage
 * - 总资产卡右上角 ⚙ 按钮 → WalletSwitchSheet
 */
function TotalAssetsCard() {
  const accounts = useAccountStore((s) => s.accounts);
  const records = useAccountStore((s) => s.records);
  const pools = useAccountStore((s) => s.pools);
  const walletEnabled = useConfigStore((s) => s.walletEnabled ?? false);

  // ⚙ 按钮 → WalletSwitchSheet
  const [sheetOpen, setSheetOpen] = useState(false);
  // 开启钱包时：点击账户小卡 → AccountDetailPage
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);

  // 虚拟分解：关闭钱包时同样计算（展示层不过钱包筛选）
  const breakdown = useMemo(
    () => calcVirtualAssets({ accounts, records, pools }),
    [accounts, records, pools],
  );
  const {
    actualTotal,
    pendingAdjust,
    prepaidUnconsumed,
    unpaidConsumed,
    earnedUnarrived,
    depositRefundable,
    depositPending,
    virtualTotal,
  } = breakdown;

  const hasVirtual = prepaidUnconsumed > 0 || earnedUnarrived > 0 || depositRefundable > 0;
  const hasPending = pendingAdjust !== 0 || unpaidConsumed > 0 || depositPending > 0;
  const hasBreakdown = hasVirtual || hasPending;

  return (
    <>
      <div className={styles.totalCard}>
        <div className={styles.totalLabel}>
          <span>总资产</span>
          {hasVirtual && <span className={styles.totalVirtualTag}>虚拟</span>}
          {/* v3.0 TASK-057：⚙ 按钮 → WalletSwitchSheet */}
          <button
            type="button"
            className={styles.totalResetBtn}
            onClick={() => setSheetOpen(true)}
            title="钱包设置"
            aria-label="钱包设置"
          >
            <Gear size={14} weight="regular" />
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
            {depositRefundable > 0 && (
              <span className={styles.chipEarned}>+¥{formatAmount(depositRefundable)} 待退</span>
            )}
          </div>
        )}
        {/* 开启钱包时：AccountRow 小卡点击 → AccountDetailPage */}
        {walletEnabled && (
          <AccountRow onPickAccount={(id) => setDetailAccountId(id)} />
        )}
      </div>

      <WalletSwitchSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      {detailAccountId && (
        <AccountDetailPage
          accountId={detailAccountId}
          onBack={() => setDetailAccountId(null)}
        />
      )}
    </>
  );
}
