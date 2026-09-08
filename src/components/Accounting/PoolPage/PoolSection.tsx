/**
 * @fileoverview PoolSection — 池管理区（v2.4 · TASK-040）
 *
 * MINE 页的池分区（原 v2.3 PoolPage，去掉页面外壳并入 MinePage）。
 * - 均摊型：周期进度条（已确认 / 总额）+ 状态徽标（进行中/已确认）
 * - 存池型：池余额（Σ存入 − Σ取出）
 *
 * v2.5-patch4 N-483：每张池卡片加 ✎ 编辑按钮 → 打开 EditPoolModal。
 * v2.5 TASK-046 T-504：收入池卡片加「一键到账」按钮 → 快速认领到账金额。
 */
import { useState, useRef, useCallback } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { useConfigStore } from '../../../store/configStore';
import { useCalendarStore } from '../../../store/calendarStore';
import type { PoolConfig, PoolCycle, AccountRecord } from '../../../lib/types';
import { formatAmount } from '../../../lib/accounting';
import { equalizeProgress, eachMonthInRange, buildDateRangeKeys, getCycleDateKeys } from '../../../lib/accounting/pool';
import { isWorkday, findCurrentSegment, getEffectiveSegments } from '../../../lib/compute';
import { formatDateKey } from '../../../lib/time';
import { HOLIDAYS } from '../../../lib/constants';
import { useNow } from '../../../hooks/useNow';
import { AddPoolModal } from './AddPoolModal';
import { EditPoolModal } from './EditPoolModal';
import { PencilSimple } from '@phosphor-icons/react';
import styles from './PoolPage.module.css';

/** 池管理区（MINE 页分区）。 */
export function PoolSection() {
  const pools = useAccountStore((s) => s.pools);
  const cycles = useAccountStore((s) => s.cycles);
  const deletePool = useAccountStore((s) => s.deletePool);
  const [addOpen, setAddOpen] = useState(false);
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);

  const handleDelete = (pool: PoolConfig) => {
    if (!window.confirm(`删除池「${pool.name}」？关联周期与认领关系将一并移除。`)) return;
    deletePool(pool.id);
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>我的池</div>
          <div className={styles.sub}>周期性支出均摊 · 押金存池</div>
        </div>
        <button type="button" className={styles.addBtn} onClick={() => setAddOpen(true)}>
          + 新建池
        </button>
      </div>

      {pools.length === 0 ? (
        <div className={styles.emptySmall}>
          还没有池，把房租、会员费、押金交给池管理
        </div>
      ) : (
        pools.map((pool) => {
          const poolCycles = cycles.filter((c) => c.poolId === pool.id);
          return pool.type === 'equalize' ? (
            <EqualizeCard
              key={pool.id}
              pool={pool}
              poolCycles={poolCycles}
              onDelete={() => handleDelete(pool)}
              onEdit={() => setEditingPoolId(pool.id)}
            />
          ) : (
            <DepositCard
              key={pool.id}
              pool={pool}
              poolCycles={poolCycles}
              onDelete={() => handleDelete(pool)}
              onEdit={() => setEditingPoolId(pool.id)}
            />
          );
        })
      )}

      <AddPoolModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditPoolModal
        open={editingPoolId != null}
        poolId={editingPoolId}
        onClose={() => setEditingPoolId(null)}
      />
    </section>
  );
}

interface CardProps {
  pool: PoolConfig;
  poolCycles: PoolCycle[];
  onDelete: () => void;
  onEdit: () => void;
}

/** 均摊型池卡片（v2.4 T-409：收入池显示到账进度 + 未到账标记）
 * v2.5 TASK-046 T-504：收入池卡片加「一键到账」入口
 * v2.5-patch8：支出池卡片加「付款」入口 → 走 partialClaimToPool 认领到当前周期
 *
 * 计算流程（自上而下 7 段）：
 *   1. Store 订阅 + 池身份(isIncome / isSalaryPool)
 *   2. 基础聚合(grandTotal / paidTotal / status / progress)
 *   3. 有效当月配置 + 「今日还在增长」检测
 *   4. 薪资池派生(totalDays / firstDateKey / todayAccumulated)
 *   5. 收入 record 聚合(incomeEarnedSum / claimedIncomeSum)
 *   6. totalDays / firstDateKey / elapsed(按池类型分支)
 *   7. 显示口径(displayGrand / displayTotal / displayPaid) +
 *      日均/已赚/未消耗(poolDaily / consumedByTime / remainingByTime) +
 *      「一键到账」按钮态(remaining / isFullyPaid)
 */
function EqualizeCard({ pool, poolCycles, onDelete, onEdit }: CardProps) {
  // ── 1. Store 订阅 ──
  const records = useAccountStore((s) => s.records);
  const accounts = useAccountStore((s) => s.accounts);
  const partialClaimToPool = useAccountStore((s) => s.partialClaimToPool);
  const config = useConfigStore();
  const dayOverrides = useCalendarStore((s) => s.dayOverrides);
  const monthlyRestModes = useCalendarStore((s) => s.monthlyRestModes);
  // 时间订阅 —— 薪资池专属 1s tick,非薪资池路径走短路、重算成本可忽略
  const now = useNow(1000);

  // ── 2. 池身份 ──
  // 薪资池(联动工资池)识别:noDailyVirtual=true && direction=income,
  // 由 ensureSalaryPool() 创建,amount=0、无 dayRange/dateRange,
  // totalDays / firstDateKey 全部从 records 派生(取消某天 / 跨日新增 day 自动同步)。
  const isIncome = pool.direction === 'income';
  const isIncomeEqualize = isIncome && pool.type === 'equalize';
  const isSalaryPool = pool.noDailyVirtual === true && pool.direction === 'income';

  // ── 3. 基础聚合 ──
  const progress = equalizeProgress(poolCycles);
  const status = poolOverallStatus(poolCycles);
  const paidTotal = poolCycles.reduce((sum, c) => sum + c.paidAmount, 0);
  const grandTotal = poolCycles.reduce((sum, c) => sum + c.totalAmount, 0);

  // ── 4. 有效当月配置 + 「今日」dateKey ──
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const effectiveRestMode = monthlyRestModes[currentMonthKey] ?? config.restMode;
  const effectiveConfig = { ...config, restMode: effectiveRestMode };
  // 「今日」dateKey —— 必须本地时区,与联动 record 一致;
  // 卡片下方「elapsed」用的 todayKey 是另一份(UTC 旧实现,本次不动)。
  const todayKeyLocal = formatDateKey(now);

  // ── 5. 「今日还在增长」检测(薪资池专属) ──
  // 工作时间内、今日联动 record 还在累加,不能纳入 totalDays / poolDaily 均值(会被偏小值稀释)
  const isTodayInProgress = isSalaryPool
    ? isWorkday(now, effectiveConfig, dayOverrides, HOLIDAYS) &&
      findCurrentSegment(
        getEffectiveSegments(effectiveConfig, dayOverrides[todayKeyLocal] ?? null, now),
        now,
      ) !== null
    : false;

  // ── 6. 薪资池派生(仅 isSalaryPool 时有值) ──
  // salaryTotalDays:完整工作日数(今日进行中时不含今日)
  // salaryFirstDateKey:最早联动 record 日期
  // todayAccumulated:今日累计薪资(用于 poolDaily 扣除)
  const salaryPoolData = isSalaryPool
    ? deriveSalaryPoolData({
        pool,
        records,
        todayKey: todayKeyLocal,
        isTodayInProgress,
      })
    : null;

  // ── 7. 收入 record 聚合 ──
  // incomeEarnedSum:所有非 claimed 收入 record 之和(每日均摊虚拟 + 联动/手动 confirmed)
  // claimedIncomeSum:所有 claimed 收入 record 之和(已到账)
  // —— 与总资产 chip「已赚未到账」完全一致;v2.5-patch7 T-513 修复日均场景永远显示 0 的 bug
  const incomeEarnedSum = isIncomeEqualize
    ? records.reduce(
        (sum, r) =>
          r.poolId === pool.id && r.amount > 0 && r.poolStatus !== 'claimed'
            ? sum + r.amount
            : sum,
        0,
      )
    : grandTotal;
  const claimedIncomeSum = isIncomeEqualize
    ? records.reduce(
        (sum, r) =>
          r.poolId === pool.id && r.poolStatus === 'claimed' && r.amount > 0
            ? sum + r.amount
            : sum,
        0,
      )
    : paidTotal;

  // ── 8. 总天数 / 起始日 / 已过天数(按池类型分支) ──
  const totalDays = isSalaryPool
    ? salaryPoolData!.totalDays
    : (() => {
        // 非薪资池:按 dateRange 或 各周期 dateKeys 推导
        if (pool.cycleMode === 'daily' && pool.dateRange) {
          return eachMonthInRange(pool.dateRange).reduce(
            (sum, mk) => sum + buildDateRangeKeys(pool.dateRange!, mk).length,
            0,
          );
        }
        // 月模式:用 getCycleDateKeys 重建各周期的实际天数(考虑 dayRange 跨月)
        return poolCycles.reduce(
          (sum, c) => sum + getCycleDateKeys(pool, c.monthKey).length,
          0,
        );
      })();

  const firstDateKey = isSalaryPool
    ? salaryPoolData!.firstDateKey
    : (() => {
        // 非薪资池:从 dateRange.start 或 第一个周期取第一天
        if (pool.cycleMode === 'daily' && pool.dateRange) return pool.dateRange.start;
        const firstKeys = poolCycles[0] ? getCycleDateKeys(pool, poolCycles[0].monthKey) : [];
        return firstKeys[0] ?? '';
      })();

  const todayKey = new Date().toISOString().slice(0, 10);
  const elapsed = isSalaryPool
    ? totalDays // 薪资池:已过天数 = 有 record 的天数,保证 poolDaily × elapsed = 已赚总额
    : (() => {
        if (!firstDateKey || firstDateKey > todayKey) return 0;
        const start = new Date(firstDateKey);
        const end = new Date(todayKey);
        return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      })();
  const elapsedClamped = Math.min(Math.max(0, elapsed), totalDays);

  // ── 9. 显示口径 ──
  // displayGrand:卡片大数字(池内总额 / 已赚总额)
  //   - 薪资池 → incomeEarnedSum(含今日累计,让大数字 = 已赚总额,语义统一)
  //   - 其他池 → grandTotal(原口径)
  // displayTotal:「已赚/已付款 ¥X / ¥Y」分母
  //   - 收入池 → incomeEarnedSum;  支出池 → grandTotal
  // displayPaid:已到账/已付款金额
  //   - 收入池 → claimedIncomeSum;  支出池 → paidTotal
  const displayGrand = isSalaryPool ? incomeEarnedSum : grandTotal;
  const displayTotal = isIncomeEqualize ? incomeEarnedSum : grandTotal;
  const displayPaid = isIncomeEqualize ? claimedIncomeSum : paidTotal;

  // ── 10. 日均 / 已赚 / 未消耗 ──
  // poolDaily:每完整一天赚/花多少(薪资池扣除今日部分)
  //   - 薪资池 → (incomeEarnedSum - todayAccumulated) / totalDays
  //           = (displayGrand - todayAccumulated) / totalDays(下面用 displayGrand 简写)
  //   - 其他池 → grandTotal / totalDays = displayGrand / totalDays
  // consumedByTime(已赚/已消耗):
  //   - 薪资池 → incomeEarnedSum(含今日累计,大数字 = 已赚,语义一致)
  //   - 其他池 → poolDaily × elapsedClamped(按时长累计)
  // remainingByTime(仅支出池有意义):grandTotal - consumedByTime
  // —— 注意 remainingByTime 用 grandTotal 而非 displayGrand,因为支出池口径下二者一致,
  //   且 grandTotal 是更直接的「池合同总额」语义。
  const poolDaily = totalDays > 0
    ? Math.round(
        ((displayGrand - (isSalaryPool ? salaryPoolData!.todayAccumulated : 0)) / totalDays) * 100,
      ) / 100
    : 0;
  const consumedByTime = isSalaryPool
    ? incomeEarnedSum
    : Math.round(poolDaily * elapsedClamped * 100) / 100;
  const remainingByTime = Math.round((grandTotal - consumedByTime) * 100) / 100;

  // ── 11. 「一键到账」按钮态 ──
  const remaining = Math.max(0, displayTotal - displayPaid);
  const isFullyPaid = displayTotal > 0 && remaining < 1e-9;

  // ── 12. 「一键到账」表单状态 + handlers ──
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimAmountStr, setClaimAmountStr] = useState('');
  const [claimAccountId, setClaimAccountId] = useState('');
  const claimInputRef = useRef<HTMLInputElement>(null);

  const openClaim = useCallback(() => {
    setClaimOpen(true);
    setClaimAmountStr('');
    setClaimAccountId(pool.targetAccountId ?? accounts[0]?.id ?? '');
    setTimeout(() => claimInputRef.current?.focus(), 100);
  }, [pool.targetAccountId, accounts]);

  const submitClaim = useCallback(() => {
    const amt = parseFloat(claimAmountStr);
    if (!isFinite(amt) || amt <= 0) {
      claimInputRef.current?.focus();
      return;
    }
    // v2.5 TASK-046 T-504：限制到账金额不超过剩余（避免超额）
    const claimedAmt = partialClaimToPool(pool.id, amt, {
      accountId: claimAccountId,
      note: pool.name,
    });
    setClaimOpen(false);
    setClaimAmountStr('');
    // v2.5 TASK-046 T-504：到账后如果整池已 100%，提示用户即将自动删除
    if (claimedAmt > 0 && Math.abs(claimedAmt - remaining) < 0.01) {
      window.alert(`「${pool.name}」已 100% 完成确认，将自动删除池配置（记录保留）。`);
    }
  }, [claimAmountStr, claimAccountId, partialClaimToPool, pool.id, pool.name, remaining]);

  // v2.5 TASK-046 T-504：「完成剩余到账」一键认领全部剩余金额
  const submitClaimAll = useCallback(() => {
    if (remaining <= 0) return;
    const accountId = pool.targetAccountId ?? accounts[0]?.id ?? '';
    const claimedAmt = partialClaimToPool(pool.id, remaining, {
      accountId,
      note: pool.name,
    });
    setClaimOpen(false);
    setClaimAmountStr('');
    if (claimedAmt > 0) {
      window.alert(`「${pool.name}」已 100% 完成确认，将自动删除池配置（记录保留）。`);
    }
  }, [partialClaimToPool, pool.id, pool.name, remaining, pool.targetAccountId, accounts]);

  // v2.5-patch8：付款/到账按钮文案与方向
  // income 池：到账 → 创建 income record
  // expense 池：付款 → 创建 expense record
  const actionLabel = isIncome ? '到账' : '付款';
  const fieldLabel = isIncome ? '到账金额' : '付款金额';
  const hintLabel = isIncome ? '剩余未到账' : '剩余未付款';
  const actionTitle = isIncome ? '一键到账' : '一键付款';

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.cardName}>{pool.name}</span>
        <span className={`${styles.badge} ${styles.badgeEqualize}`}>
          {isIncome ? '均摊·收入' : '均摊'}
        </span>
        <span className={`${styles.badge} ${STATUS_CLASS[status] ?? ''}`}>{STATUS_LABEL[status]}</span>
        {/* v2.5-patch4 N-483：编辑入口 */}
        <button type="button" className={styles.editBtn} onClick={onEdit} aria-label="编辑池" title="编辑">
          <PencilSimple size={14} weight="regular" />
        </button>
        <button type="button" className={styles.delBtn} onClick={onDelete} aria-label="删除池">
          ✕
        </button>
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
          {/* v2.5 TASK-046 T-504：移除「多少未到账」红色标记，避免视觉臃肿 */}
          {Math.round(progress * 100)}%
          {/* v2.5 TASK-046 T-504：收入池「一键到账」入口
             v2.5-patch8：支出池「一键付款」入口 */}
          {!claimOpen && !isFullyPaid && (
            <button
              type="button"
              className={styles.quickClaimBtn}
              onClick={openClaim}
              title={actionTitle}
            >
              {actionLabel}
            </button>
          )}
        </span>
      </div>

      {/* v2.5 TASK-046 T-504：收入池「一键到账」内嵌表单 */}
      {claimOpen && (
        <div className={styles.quickClaimForm}>
          {/* v2.5 TASK-046 T-504：剩余到账提示（只在还有剩余时显示） */}
          {!isFullyPaid && remaining > 0 && (
            <div className={styles.quickClaimHint}>
              {hintLabel} ¥{formatAmount(remaining)}
            </div>
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
                placeholder={fieldLabel}
                aria-label={fieldLabel}
                onKeyDown={(e) => e.key === 'Enter' && submitClaim()}
              />
            </div>
            <select
              className={styles.quickClaimAccount}
              value={claimAccountId}
              onChange={(e) => setClaimAccountId(e.target.value)}
              aria-label="归入账户"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            <button type="button" className={styles.quickClaimSubmit} onClick={submitClaim}>
              确认
            </button>
            <button type="button" className={styles.quickClaimCancel} onClick={() => setClaimOpen(false)}>
              取消
            </button>
          </div>
          {/* v2.5 TASK-046 T-504：完成剩余到账（一键认领全部剩余金额） */}
          {!isFullyPaid && remaining > 0 && (
            <button type="button" className={styles.quickClaimAll} onClick={submitClaimAll}>
              {isIncome ? '完成剩余到账' : '完成剩余付款'} ¥{formatAmount(remaining)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** 存池型池卡片
 * v2.5 TASK-046 T-504：添加存款/取款按钮
 * - postpay 存池：显示「付款」按钮（确认押金已付）/「取出」按钮
 * - prepay 存池：显示「取出」按钮（押金退款）
 */
function DepositCard({ pool, poolCycles, onDelete, onEdit }: CardProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const depositToPool = useAccountStore((s) => s.depositToPool);
  const withdrawFromPool = useAccountStore((s) => s.withdrawFromPool);

  const allTx = poolCycles.flatMap((c) => c.transactions);
  const inCount = allTx.filter((t) => t.direction === 'in' && t.status === 'confirmed').length;
  const outCount = allTx.filter((t) => t.direction === 'out' && t.status === 'confirmed').length;

  // v2.5-patch7 T-512：存池大数字的语义从「交易余额 in-out」改为「当前池内可支配价值」
  // - prepay：建池即声明已付押金,默认全额在池,取出才减少 → display = max(0, pool.amount - takenOut)
  // - postpay：押金未付,池内只算已存入部分 → display = max(0, paidIn - takenOut)
  const takenOut = allTx
    .filter((t) => t.direction === 'out' && t.status === 'confirmed')
    .reduce((sum, t) => sum + t.amount, 0);
  const paidIn = allTx
    .filter((t) => t.direction === 'in' && t.status === 'confirmed')
    .reduce((sum, t) => sum + t.amount, 0);
  const isPostpay = (pool.settleMode ?? 'prepay') === 'postpay';
  const displayValue = isPostpay
    ? Math.max(0, Math.round((paidIn - takenOut) * 100) / 100)
    : Math.max(0, Math.round((pool.amount - takenOut) * 100) / 100);
  // postpay 「待付」= 押金总额 - 已存入
  const depositPending = isPostpay ? Math.max(0, Math.round((pool.amount - paidIn) * 100) / 100) : 0;
  // 可取出金额 = 池内可用余额
  const withdrawableAmount = displayValue;

  // v2.5 TASK-046 T-504：存款/取款表单状态
  const [txOpen, setTxOpen] = useState(false);
  const [txMode, setTxMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [txAmountStr, setTxAmountStr] = useState('');
  const [txAccountId, setTxAccountId] = useState('');
  const txInputRef = useRef<HTMLInputElement>(null);

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
    if (!isFinite(amt) || amt <= 0) {
      txInputRef.current?.focus();
      return;
    }
    if (txMode === 'deposit') {
      depositToPool(pool.id, amt, { accountId: txAccountId });
    } else {
      withdrawFromPool(pool.id, amt, { accountId: txAccountId });
    }
    setTxOpen(false);
    setTxAmountStr('');
  }, [txAmountStr, txAccountId, txMode, depositToPool, withdrawFromPool, pool.id]);

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.cardName}>{pool.name}</span>
        <span className={`${styles.badge} ${styles.badgeDeposit}`}>
          存池{(pool.settleMode ?? 'prepay') === 'postpay' ? ' · 先用后付' : ''}
        </span>
        {/* v2.5-patch4 N-483：编辑入口 */}
        <button type="button" className={styles.editBtn} onClick={onEdit} aria-label="编辑池" title="编辑">
          <PencilSimple size={14} weight="regular" />
        </button>
        <button type="button" className={styles.delBtn} onClick={onDelete} aria-label="删除池">
          ✕
        </button>
      </div>
      <div className={styles.cardAmtRow}>
        <span className={styles.cardAmt}>¥{formatAmount(displayValue, true)}</span>
        <span className={styles.cardAmtLabel}>
          {isPostpay ? '池内已存入' : '池内余额'}
        </span>
      </div>
      <div className={styles.cardMeta}>
        <span>存入 {inCount} 笔 · 取出 {outCount} 笔</span>
        <span>
          押金 ¥{formatAmount(pool.amount)}
          {isPostpay && depositPending > 0 && (
            <em className={styles.unreceivedTag}>
              {' '}-¥{formatAmount(depositPending)} 待付
            </em>
          )}
        </span>
      </div>

      {/* v2.5 TASK-046 T-504：存池操作按钮行 */}
      <div className={styles.depositActions}>
        {isPostpay && depositPending > 0 && !txOpen && (
          <button type="button" className={styles.depositPayBtn} onClick={openDeposit}>
            付款 ¥{formatAmount(depositPending)}
          </button>
        )}
        {/* v2.5-patch8：prepay 押金「到账」按钮 — 押金退还到账户
            用户原意"押金也是，加一个到账" — 即押金取出/退还的入口 */}
        {!isPostpay && withdrawableAmount > 0 && !txOpen && (
          <button type="button" className={styles.depositPayBtn} onClick={openWithdraw}>
            到账 ¥{formatAmount(withdrawableAmount)}
          </button>
        )}
        {isPostpay && withdrawableAmount > 0 && !txOpen && (
          <button type="button" className={styles.depositWithdrawBtn} onClick={openWithdraw}>
            取出
          </button>
        )}
      </div>

      {/* v2.5 TASK-046 T-504：存款/取款表单 */}
      {txOpen && (
        <div className={styles.quickClaimForm}>
          <div className={styles.quickClaimHint}>
            {txMode === 'deposit' ? '押金存入' : '押金取出'}（{isPostpay ? '先用后付' : '押金' }）
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
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            <button type="button" className={styles.quickClaimSubmit} onClick={submitTx}>
              确认
            </button>
            <button type="button" className={styles.quickClaimCancel} onClick={() => setTxOpen(false)}>
              取消
            </button>
          </div>
          {/* 快捷全额按钮 */}
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
  );
}

// ── 薪资池派生 ──────────────────────────────────────────────

/** 薪资池(联动工资池)从 records 派生的展示数据 —— 专门提取以保持主函数清晰 */
function deriveSalaryPoolData(args: {
  pool: PoolConfig;
  records: AccountRecord[];
  todayKey: string;
  isTodayInProgress: boolean;
}): { totalDays: number; firstDateKey: string; todayAccumulated: number } {
  const { pool, records, todayKey, isTodayInProgress } = args;
  // 所有联动 record(由 upsertSalaryLinkageForDate 写入)
  const allRecords = records.filter(
    (r) => r.poolId === pool.id && r.linkageSource === 'salary-time-mode' && r.amount > 0,
  );
  // 今日进行中 → 排除今日 record(否则日均被稀释)
  const completedRecords = isTodayInProgress
    ? allRecords.filter((r) => r.dateKey !== todayKey)
    : allRecords;
  const dateSet = new Set(completedRecords.map((r) => r.dateKey));
  // 今日累计薪资(用于 poolDaily 分子扣除)
  const todayAccumulated = isTodayInProgress
    ? allRecords
        .filter((r) => r.dateKey === todayKey)
        .reduce((sum, r) => sum + r.amount, 0)
    : 0;
  return {
    totalDays: dateSet.size,
    firstDateKey: Array.from(dateSet).sort()[0] ?? '',
    todayAccumulated,
  };
}

// ── 状态辅助 ──────────────────────────────────────────────

type PoolStatus = 'generating' | 'confirmed';

/** 进行中：只要还有未完成的周期；已确认：全部周期均已认领满额 */
const STATUS_LABEL: Record<PoolStatus, string> = {
  generating: '进行中',
  confirmed: '已确认',
};

const STATUS_CLASS: Record<PoolStatus, string> = {
  generating: styles.statusGenerating ?? '',
  confirmed: styles.statusConfirmed ?? '',
};

/** 池整体状态：有全确认 → 已确认；否则进行中 */
function poolOverallStatus(poolCycles: PoolCycle[]): PoolStatus {
  if (poolCycles.length > 0 && poolCycles.every((c) => c.status === 'confirmed')) return 'confirmed';
  return 'generating';
}
