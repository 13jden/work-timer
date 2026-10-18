/**
 * @fileoverview RecurringCard — 定期账卡片（TASK-058 T-582）
 *
 * 去术语化展示（替代 EqualizeCard + DepositCard）：
 * - 均摊：名称 + ¥X/天 + 本期进度「已结 ¥X / ¥Y」+ 状态徽标
 * - 押金：名称 + 「退租/到期时退回」+ 绿色待退或红色待付
 * - 工资联动池（noDailyVirtual）：salaryLinkageEnabled=ON 时隐藏编辑/删除按钮，仅允许到账
 *
 * 机制红线：不动 lib/accounting/pool.ts 任何生成 / 认领 / 回滚逻辑。
 */
import { useState, useRef, useCallback } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { PoolConfig, PoolCycle } from '../../../lib/types';
import { formatAmount } from '../../../lib/accounting';
import { equalizeProgress, eachMonthInRange, buildDateRangeKeys, getCycleDateKeys } from '../../../lib/accounting/pool';
import { useConfigStore } from '../../../store/configStore';
import { useCalendarStore } from '../../../store/calendarStore';
import { isWorkday, findCurrentSegment, getEffectiveSegments } from '../../../lib/compute';
import { formatDateKey } from '../../../lib/time';
import { HOLIDAYS } from '../../../lib/constants';
import { useNow } from '../../../hooks/useNow';
import { EditPoolModal } from './EditPoolModal';
import { PencilSimple } from '@phosphor-icons/react';
import styles from './PoolPage.module.css';

export interface RecurringCardProps {
  pool: PoolConfig;
  poolCycles: PoolCycle[];
  onDelete: (pool: PoolConfig) => void;
}

type CardStatus = 'generating' | 'confirmed' | 'overdue';

const STATUS_LABEL: Record<CardStatus, string> = {
  generating: '进行中',
  confirmed: '已结清',
  overdue: '已逾期',
};

const STATUS_CLASS: Record<CardStatus, string> = {
  generating: styles.statusGenerating ?? '',
  confirmed: styles.statusConfirmed ?? '',
  overdue: styles.statusOverdue ?? '',
};

function poolOverallStatus(poolCycles: PoolCycle[]): CardStatus {
  if (poolCycles.some((c) => c.status === 'overdue')) return 'overdue';
  if (poolCycles.length > 0 && poolCycles.every((c) => c.status === 'confirmed')) return 'confirmed';
  return 'generating';
}

/** 薪资池（noDailyVirtual=true）派生数据 */
function deriveSalaryPoolData(args: {
  pool: PoolConfig;
  records: import('../../../lib/types').AccountRecord[];
  todayKey: string;
  isTodayInProgress: boolean;
}): { totalDays: number; firstDateKey: string; todayAccumulated: number } {
  const { pool, records, todayKey, isTodayInProgress } = args;
  const allRecords = records.filter(
    (r) => r.poolId === pool.id && r.linkageSource === 'salary-time-mode' && r.amount > 0,
  );
  const completedRecords = isTodayInProgress
    ? allRecords.filter((r) => r.dateKey !== todayKey)
    : allRecords;
  const dateSet = new Set(completedRecords.map((r) => r.dateKey));
  const todayAccumulated = isTodayInProgress
    ? allRecords.filter((r) => r.dateKey === todayKey).reduce((sum, r) => sum + r.amount, 0)
    : 0;
  return {
    totalDays: dateSet.size,
    firstDateKey: Array.from(dateSet).sort()[0] ?? '',
    todayAccumulated,
  };
}

/**
 * 定期账卡片（统一展示均摊 + 押金）
 * - 均摊：日均 / 本期进度 / 一键到账/付款
 * - 押金：待退 / 待付 + 存款/取款
 */
export function RecurringCard({ pool, poolCycles, onDelete }: RecurringCardProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const records = useAccountStore((s) => s.records);
  const partialClaimToPool = useAccountStore((s) => s.partialClaimToPool);
  const depositToPool = useAccountStore((s) => s.depositToPool);
  const withdrawFromPool = useAccountStore((s) => s.withdrawFromPool);
  const config = useConfigStore();
  const salaryLinkageEnabled = useConfigStore((s) => s.salaryLinkageEnabled ?? false);
  const dayOverrides = useCalendarStore((s) => s.dayOverrides);
  const monthlyRestModes = useCalendarStore((s) => s.monthlyRestModes);
  const now = useNow(1000);

  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const isEqualize = pool.type === 'equalize';
  const isIncome = pool.direction === 'income';
  const isSalaryPool = pool.noDailyVirtual === true && pool.direction === 'income';
  // 工资联动池在联动开启时禁止编辑/删除，只能到账
  const canEdit = !isSalaryPool || !salaryLinkageEnabled;
  const isSalaryPool = pool.noDailyVirtual === true && pool.direction === 'income';
  const progress = equalizeProgress(poolCycles);
  const status = poolOverallStatus(poolCycles);
  const paidTotal = poolCycles.reduce((sum, c) => sum + c.paidAmount, 0);
  const grandTotal = poolCycles.reduce((sum, c) => sum + c.totalAmount, 0);

  // 今日 dateKey
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const effectiveRestMode = monthlyRestModes[currentMonthKey] ?? config.restMode;
  const effectiveConfig = { ...config, restMode: effectiveRestMode };
  const todayKeyLocal = formatDateKey(now);
  const isTodayInProgress = isSalaryPool
    ? isWorkday(now, effectiveConfig, dayOverrides, HOLIDAYS) &&
      findCurrentSegment(
        getEffectiveSegments(effectiveConfig, dayOverrides[todayKeyLocal] ?? null, now),
        now,
      ) !== null
    : false;

  const salaryPoolData = isSalaryPool
    ? deriveSalaryPoolData({ pool, records, todayKey: todayKeyLocal, isTodayInProgress })
    : null;

  const incomeEarnedSum = isIncome
    ? records.reduce(
        (sum, r) =>
          r.poolId === pool.id && r.amount > 0 && r.poolStatus !== 'claimed'
            ? sum + r.amount
            : sum,
        0,
      )
    : grandTotal;
  const claimedIncomeSum = isIncome
    ? records.reduce(
        (sum, r) =>
          r.poolId === pool.id && r.poolStatus === 'claimed' && r.amount > 0
            ? sum + r.amount
            : sum,
        0,
      )
    : paidTotal;

  const totalDays = isSalaryPool
    ? salaryPoolData!.totalDays
    : (() => {
        if (pool.cycleMode === 'daily' && pool.dateRange) {
          return eachMonthInRange(pool.dateRange).reduce(
            (sum, mk) => sum + buildDateRangeKeys(pool.dateRange!, mk).length,
            0,
          );
        }
        return poolCycles.reduce((sum, c) => sum + getCycleDateKeys(pool, c.monthKey).length, 0);
      })();

  const firstDateKey = isSalaryPool
    ? salaryPoolData!.firstDateKey
    : (() => {
        if (pool.cycleMode === 'daily' && pool.dateRange) return pool.dateRange.start;
        const firstKeys = poolCycles[0] ? getCycleDateKeys(pool, poolCycles[0].monthKey) : [];
        return firstKeys[0] ?? '';
      })();

  const todayKey = new Date().toISOString().slice(0, 10);
  const elapsed = isSalaryPool
    ? totalDays
    : (() => {
        if (!firstDateKey || firstDateKey > todayKey) return 0;
        const start = new Date(firstDateKey);
        const end = new Date(todayKey);
        return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      })();
  const elapsedClamped = Math.min(Math.max(0, elapsed), totalDays);

  const displayGrand = isSalaryPool ? incomeEarnedSum : grandTotal;
  const displayTotal = isIncome ? incomeEarnedSum : grandTotal;
  const displayPaid = isIncome ? claimedIncomeSum : paidTotal;

  const poolDaily =
    totalDays > 0
      ? Math.round(((displayGrand - (isSalaryPool ? salaryPoolData!.todayAccumulated : 0)) / totalDays) * 100) / 100
      : 0;
  const consumedByTime = isSalaryPool
    ? incomeEarnedSum
    : Math.round(poolDaily * elapsedClamped * 100) / 100;
  const remainingByTime = Math.round((grandTotal - consumedByTime) * 100) / 100;
  const remaining = Math.max(0, displayTotal - displayPaid);
  const isFullyPaid = displayTotal > 0 && remaining < 1e-9;

  // 均摊卡片 badge 文案
  const typeBadge = isEqualize
    ? isIncome ? '均摊·收入' : '均摊·支出'
    : (pool.settleMode ?? 'prepay') === 'postpay' ? '押金·未付' : '押金·已付';

  // 押金卡片数据
  const allTx = poolCycles.flatMap((c) => c.transactions);
  const takenOut = allTx
    .filter((t) => t.direction === 'out' && t.status === 'confirmed')
    .reduce((sum, t) => sum + t.amount, 0);
  const paidIn = allTx
    .filter((t) => t.direction === 'in' && t.status === 'confirmed')
    .reduce((sum, t) => sum + t.amount, 0);
  const isPostpay = (pool.settleMode ?? 'prepay') === 'postpay';
  const depositDisplay = isPostpay
    ? Math.max(0, Math.round((paidIn - takenOut) * 100) / 100)
    : Math.max(0, Math.round((pool.amount - takenOut) * 100) / 100);
  const depositPending = isPostpay ? Math.max(0, Math.round((pool.amount - paidIn) * 100) / 100) : 0;
  const withdrawableAmount = depositDisplay;

  // 一键到账/付款表单
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimAmountStr, setClaimAmountStr] = useState('');
  const [claimAccountId, setClaimAccountId] = useState('');
  const claimInputRef = useRef<HTMLInputElement>(null);

  // 押金存款/取款表单
  const [txOpen, setTxOpen] = useState(false);
  const [txMode, setTxMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [txAmountStr, setTxAmountStr] = useState('');
  const [txAccountId, setTxAccountId] = useState('');
  const txInputRef = useRef<HTMLInputElement>(null);

  const openClaim = useCallback(() => {
    setClaimOpen(true);
    setClaimAmountStr('');
    setClaimAccountId(pool.targetAccountId ?? accounts[0]?.id ?? '');
    setTimeout(() => claimInputRef.current?.focus(), 100);
  }, [pool.targetAccountId, accounts]);

  const submitClaim = useCallback(() => {
    const amt = parseFloat(claimAmountStr);
    if (!isFinite(amt) || amt <= 0) { claimInputRef.current?.focus(); return; }
    const claimedAmt = partialClaimToPool(pool.id, amt, { accountId: claimAccountId, note: pool.name });
    setClaimOpen(false);
    setClaimAmountStr('');
    if (claimedAmt > 0 && Math.abs(claimedAmt - remaining) < 0.01) {
      window.alert(`「${pool.name}」已 100% 完成，将自动删除（记录保留）。`);
    }
  }, [claimAmountStr, claimAccountId, partialClaimToPool, pool.id, pool.name, remaining]);

  const submitClaimAll = useCallback(() => {
    if (remaining <= 0) return;
    const accountId = pool.targetAccountId ?? accounts[0]?.id ?? '';
    const claimedAmt = partialClaimToPool(pool.id, remaining, { accountId, note: pool.name });
    setClaimOpen(false);
    setClaimAmountStr('');
    if (claimedAmt > 0) {
      window.alert(`「${pool.name}」已 100% 完成，将自动删除（记录保留）。`);
    }
  }, [partialClaimToPool, pool.id, pool.name, remaining, pool.targetAccountId, accounts]);

  const openDeposit = useCallback(() => {
    setTxMode('deposit');
    setTxOpen(true);
    setTxAmountStr('');
    setTxAccountId(pool.targetAccountId ?? accounts[0]?.id ?? '');
    setTimeout(() => txInputRef.current?.focus(), 100);
  }, [pool.targetAccountId, accounts]);

  const openWithdraw = useCallback(() => {
    setTxMode('withdraw');
    setTxOpen(true);
    setTxAmountStr(withdrawableAmount > 0 ? String(withdrawableAmount) : '');
    setTxAccountId(pool.targetAccountId ?? accounts[0]?.id ?? '');
    setTimeout(() => txInputRef.current?.focus(), 100);
  }, [pool.targetAccountId, accounts, withdrawableAmount]);

  const submitTx = useCallback(() => {
    const amt = parseFloat(txAmountStr);
    if (!isFinite(amt) || amt <= 0) { txInputRef.current?.focus(); return; }
    if (txMode === 'deposit') {
      depositToPool(pool.id, amt, { accountId: txAccountId });
    } else {
      withdrawFromPool(pool.id, amt, { accountId: txAccountId });
    }
    setTxOpen(false);
    setTxAmountStr('');
  }, [txAmountStr, txAccountId, txMode, depositToPool, withdrawFromPool, pool.id]);

  const actionLabel = isIncome ? '到账' : '付款';
  const hintLabel = isIncome ? '剩余未到账' : '剩余未付款';

  if (isEqualize) {
    // ── 均摊卡片 ────────────────────────────────────────────────
    return (
      <>
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardName}>{pool.name}</span>
            <span className={`${styles.badge} ${isIncome ? styles.badgeIncome ?? '' : styles.badgeEqualize}`}>
              {typeBadge}
            </span>
            <span className={`${styles.badge} ${STATUS_CLASS[status] ?? ''}`}>
              {STATUS_LABEL[status]}
            </span>
            {canEdit && (
              <>
                <button type="button" className={styles.editBtn} onClick={() => setEditingPoolId(pool.id)} aria-label="编辑" title="编辑">
                  <PencilSimple size={14} weight="regular" />
                </button>
                <button type="button" className={styles.delBtn} onClick={() => onDelete(pool)} aria-label="删除">
                  ✕
                </button>
              </>
            )}
          </div>

          <div className={styles.cardAmtRow}>
            <span className={styles.cardAmt}>¥{formatAmount(displayGrand, true)}</span>
            <span className={styles.cardAmtLabel}>
              {isIncome
                ? `日均 ¥${formatAmount(poolDaily)} · 已赚 ¥${formatAmount(consumedByTime)}`
                : `日均 ¥${formatAmount(poolDaily)} · 已消耗 ¥${formatAmount(consumedByTime)} · 未消耗 ¥${formatAmount(Math.max(0, remainingByTime))}`}
            </span>
          </div>

          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>

          <div className={styles.cardMeta}>
            <span>
              {isIncome ? '已到账' : '已付款'} ¥{formatAmount(displayPaid)} / ¥{formatAmount(displayTotal)}
            </span>
            <span className={styles.cardMetaRight}>
              {Math.round(progress * 100)}%
              {!claimOpen && !isFullyPaid && (
                <button type="button" className={styles.quickClaimBtn} onClick={openClaim}>
                  {actionLabel}
                </button>
              )}
            </span>
          </div>

          {claimOpen && (
            <div className={styles.quickClaimForm}>
              {!isFullyPaid && remaining > 0 && (
                <div className={styles.quickClaimHint}>{hintLabel} ¥{formatAmount(remaining)}</div>
              )}
              <div className={styles.quickClaimRow}>
                <div className={styles.quickClaimField}>
                  <span className={styles.quickClaimCurrency}>¥</span>
                  <input
                    ref={claimInputRef}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className={styles.quickClaimInput}
                    value={claimAmountStr}
                    onChange={(e) => setClaimAmountStr(e.target.value)}
                    placeholder={isIncome ? '到账金额' : '付款金额'}
                    aria-label={isIncome ? '到账金额' : '付款金额'}
                    onKeyDown={(e) => e.key === 'Enter' && submitClaim()}
                  />
                </div>
                <select
                  className={styles.quickClaimAccount}
                  value={claimAccountId}
                  onChange={(e) => setClaimAccountId(e.target.value)}
                  aria-label="归入账户"
                >
                  {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
                <button type="button" className={styles.quickClaimSubmit} onClick={submitClaim}>确认</button>
                <button type="button" className={styles.quickClaimCancel} onClick={() => setClaimOpen(false)}>取消</button>
              </div>
              {!isFullyPaid && remaining > 0 && (
                <button type="button" className={styles.quickClaimAll} onClick={submitClaimAll}>
                  完成剩余{actionLabel} ¥{formatAmount(remaining)}
                </button>
              )}
            </div>
          )}
        </div>

        <EditPoolModal
          open={editingPoolId != null}
          poolId={editingPoolId}
          onClose={() => setEditingPoolId(null)}
        />
      </>
    );
  }

  // ── 押金卡片 ─────────────────────────────────────────────────
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span className={styles.cardName}>{pool.name}</span>
          <span className={`${styles.badge} ${isPostpay ? styles.badgePostpay ?? '' : styles.badgeDeposit}`}>
            {typeBadge}
          </span>
          {canEdit && (
            <>
              <button type="button" className={styles.editBtn} onClick={() => setEditingPoolId(pool.id)} aria-label="编辑" title="编辑">
                <PencilSimple size={14} weight="regular" />
              </button>
              <button type="button" className={styles.delBtn} onClick={() => onDelete(pool)} aria-label="删除">
                ✕
              </button>
            </>
          )}
        </div>

        <div className={styles.cardAmtRow}>
          <span className={styles.cardAmt}>¥{formatAmount(depositDisplay, true)}</span>
          <span className={styles.cardAmtLabel}>
            {isPostpay ? '池内已存入' : '池内余额'}
            {isPostpay && depositPending > 0 && (
              <em className={styles.unreceivedTag}> -¥{formatAmount(depositPending)} 待付</em>
            )}
          </span>
        </div>

        <div className={styles.cardMeta}>
          <span>存入 {allTx.filter((t) => t.direction === 'in' && t.status === 'confirmed').length} 笔 · 取出 {allTx.filter((t) => t.direction === 'out' && t.status === 'confirmed').length} 笔</span>
          <span>押金 ¥{formatAmount(pool.amount)}</span>
        </div>

        {/* 操作按钮行 */}
        <div className={styles.depositActions}>
          {isPostpay && depositPending > 0 && !txOpen && (
            <button type="button" className={styles.depositPayBtn} onClick={openDeposit}>
              付款 ¥{formatAmount(depositPending)}
            </button>
          )}
          {!isPostpay && withdrawableAmount > 0 && !txOpen && (
            <button type="button" className={styles.depositPayBtn} onClick={openWithdraw}>
              到账 ¥{formatAmount(withdrawableAmount)}
            </button>
          )}
          {isPostpay && withdrawableAmount > 0 && !txOpen && (
            <button type="button" className={styles.depositWithdrawBtn} onClick={openWithdraw}>取出</button>
          )}
        </div>

        {txOpen && (
          <div className={styles.quickClaimForm}>
            <div className={styles.quickClaimHint}>
              {txMode === 'deposit' ? '押金存入' : '押金取出'}（{isPostpay ? '先用后付' : '押金'}）
            </div>
            <div className={styles.quickClaimRow}>
              <div className={styles.quickClaimField}>
                <span className={styles.quickClaimCurrency}>¥</span>
                <input
                  ref={txInputRef}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={styles.quickClaimInput}
                  value={txAmountStr}
                  onChange={(e) => setTxAmountStr(e.target.value)}
                  placeholder={txMode === 'deposit' ? '存入金额' : '取出金额'}
                  aria-label={txMode === 'deposit' ? '存入金额' : '取出金额'}
                  onKeyDown={(e) => e.key === 'Enter' && submitTx()}
                />
              </div>
              <select
                className={styles.quickClaimAccount}
                value={txAccountId}
                onChange={(e) => setTxAccountId(e.target.value)}
                aria-label="关联账户"
              >
                {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
              <button type="button" className={styles.quickClaimSubmit} onClick={submitTx}>确认</button>
              <button type="button" className={styles.quickClaimCancel} onClick={() => setTxOpen(false)}>取消</button>
            </div>
            {txMode === 'deposit' && depositPending > 0 && (
              <button
                type="button"
                className={styles.quickClaimAll}
                onClick={() => { setTxAmountStr(String(depositPending)); txInputRef.current?.focus(); }}
              >
                全额付款 ¥{formatAmount(depositPending)}
              </button>
            )}
            {txMode === 'withdraw' && withdrawableAmount > 0 && (
              <button
                type="button"
                className={styles.quickClaimAll}
                onClick={() => { setTxAmountStr(String(withdrawableAmount)); txInputRef.current?.focus(); }}
              >
                全额取出 ¥{formatAmount(withdrawableAmount)}
              </button>
            )}
          </div>
        )}
      </div>

      <EditPoolModal
        open={editingPoolId != null}
        poolId={editingPoolId}
        onClose={() => setEditingPoolId(null)}
      />
    </>
  );
}
