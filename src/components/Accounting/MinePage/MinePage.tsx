/**
 * @fileoverview MinePage — MINE 页（v2.4 · TASK-040 T-402/T-405 + v3.0 · TASK-057 T-575）
 *
 * 记账主题第 4 个 tab，分区纵向排列：
 * 总资产卡 → 并排双入口卡（一程 / 定期账）。
 *
 * v3.0 TASK-057 改造（钱包模式开关）：
 * - TotalAssetsCard 双形态：关闭 = 「总支出」累计；开启 = v2.4 总资产（虚拟分解 + AccountRow）
 * - 总资产卡右上角 ⚙ 按钮 → WalletSwitchSheet 切换
 * - 开启钱包时，AccountRow 小卡点击 → AccountDetailPage（每账户详情）
 *
 * v3.1 TASK-064 改造（页面重排）：
 * - 结余目标从独立 GOAL 大卡改为页面底部的设置行（MonthlyGoalSetting）
 * - 隐藏计时模式从设置弹层下放到页面底部（HideTimerSetting）
 * - 底部两块合并成并排的两张竖版入口卡：JourneySection + RecurringEntryCard
 * - 定期账列表从 MINE 页内嵌分区改为独立全屏页（RecurringPage）
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { useConfigStore } from '../../../store/configStore';
import { formatAmount, calcVirtualAssets } from '../../../lib/accounting';
import { Gear, DotsThree } from '@phosphor-icons/react';
import { AccountRow } from './AccountRow';
import { AccountDetailPage } from './AccountDetailPage';
import { WalletSwitchSheet } from './WalletSwitchSheet';
import { MonthlyGoalSetting } from './MonthlyGoalSetting';
import { HideTimerSetting } from './HideTimerSetting';
// v3.2：「更多」入口 + 弹层（打赏作者 / 使用指南 / 检查更新）
import { MoreSheet } from './MoreSheet';
import { DonateSheet } from './DonateSheet';
import { FeedbackSheet } from './FeedbackSheet';
// v3.0 TASK-058：PoolSection → RecurringSection（去池化）
// v3.1 TASK-064：定期账 → 入口卡 + 独立全屏页
import { RecurringEntryCard } from '../PoolPage/RecurringEntryCard';
import { RecurringPage } from '../PoolPage/RecurringPage';
// v3.0 TASK-059：MINE 页「旅游记录」入口
import { JourneySection } from '../Journey/JourneySection';
import { JourneyListPage } from '../Journey/JourneyListPage';
import { JourneyDetailPage } from '../Journey/JourneyDetailPage';
import { PageTopbar } from '../../PageTopbar';
import styles from './MinePage.module.css';

export function MinePage() {
  const accountCount = useAccountStore((s) => s.accounts.length);
  const [pageMode, setPageMode] = useState<'mine' | 'list' | 'detail' | 'recurring'>('mine');
  const [detailJourneyId, setDetailJourneyId] = useState<string | null>(null);
  // v3.2：「更多」弹层 + 打赏弹层开关
  const [moreOpen, setMoreOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  // v3.2：意见反馈弹层开关
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
    // v3.1 TASK-064：定期账列表独立全屏
    if (pageMode === 'recurring') {
      return <RecurringPage onBack={() => setPageMode('mine')} />;
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
      {/* v2.5-patch4 N-481：取消「time → accounting 联动」展示入口。
          联动功能本身保留在 store（ensureSalaryPool / upsertSalaryLinkageForDate），
          默认开关=false，CalendarPage 不再写入联动 record。
          未来如需恢复，仅修改 config.salaryLinkageEnabled 即可。 */}
      {/* v3.1 TASK-064：页面底部两行设置（结余目标 / 隐藏计时模式） */}
      <div className={styles.settingsList}>
        <MonthlyGoalSetting />
        <HideTimerSetting />
      </div>
      {/* v3.2：「更多」入口 */}
      <button
        type="button"
        className={styles.donateEntry}
        onClick={() => setMoreOpen(true)}
      >
        <span className={styles.donateEntryText}>
          <span className={styles.donateEntryTitle}>更多</span>
        </span>
        <span className={styles.donateEntryRight}>
          <DotsThree size={18} weight="bold" />
        </span>
      </button>
      {/* v3.1 TASK-064：底部并排双入口卡（一程 / 定期账） */}
      <div className={styles.entryRow}>
        <JourneySection onOpen={() => setPageMode('list')} />
        <RecurringEntryCard onOpen={() => setPageMode('recurring')} />
      </div>
      {/* v3.2：「更多」弹层 + 打赏弹层 + 意见反馈弹层 */}
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenDonate={() => setDonateOpen(true)}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />
      <DonateSheet open={donateOpen} onClose={() => setDonateOpen(false)} />
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />


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

  // v3.0 TASK-061：关闭钱包时不展示「未分类」（未归入账户的待调整项）——
  // 没有钱包就没有账户归类概念，展示该金额对用户无意义。
  const showPendingAdjust = walletEnabled && pendingAdjust !== 0;
  const hasVirtual = prepaidUnconsumed > 0 || earnedUnarrived > 0 || depositRefundable > 0;
  const hasPending = showPendingAdjust || unpaidConsumed > 0 || depositPending > 0;
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
                {showPendingAdjust && (
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
