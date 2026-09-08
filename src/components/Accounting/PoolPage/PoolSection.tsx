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
import type { PoolConfig, PoolCycle } from '../../../lib/types';
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
 */
function EqualizeCard({ pool, poolCycles, onDelete, onEdit }: CardProps) {
  const records = useAccountStore((s) => s.records);
  const accounts = useAccountStore((s) => s.accounts);
  const partialClaimToPool = useAccountStore((s) => s.partialClaimToPool);
  const progress = equalizeProgress(poolCycles);
  const paidTotal = poolCycles.reduce((sum, c) => sum + c.paidAmount, 0);
  const grandTotal = poolCycles.reduce((sum, c) => sum + c.totalAmount, 0);
  const status = poolOverallStatus(poolCycles);
  const isIncome = pool.direction === 'income';

  // ── 薪资池特化(virtual 任务延续) ─────────────────────────
  // 识别条件:noDailyVirtual=true && direction=income —— 这是 ensureSalaryPool()
  // 创建的「工资池」,amount=0、无 dayRange/dateRange,cycle.dayCount 默认走整月 31 天,
  // 与「真实存在多少联动 record」严重不符。
  // —— 从 records(联动 record 的真实来源)直接派生天数与首日:
  //   totalDays    = distinct dateKey 数    (取消某天 / 跨日新增 day 都自动同步)
  //   firstDateKey = 最早的联动 record 日期(用于 elapsed)
  //   elapsed      = 该池实际有 record 的天数(= totalDays)，
  //                   让 poolDaily × elapsed = grandTotal,使「已赚 ¥X」语义与「总额」一致
  // grandTotal 继续走 cycle.totalAmount,因为 upsertSalaryLinkageForDate 已经把
  // cycle.totalAmount 与 records 增量保持同步(原子写入),口径= sum of records。
  // 其他 equalize 池(支出均摊、公积金等用户自己填了 dateRange 的)完全保持旧逻辑。
  const isSalaryPool = pool.noDailyVirtual === true && pool.direction === 'income';

  // 「今日还在增长」检测 —— 薪资池专属:工作时间内,今日联动 record 还在累加,
  // 不能纳入 totalDays/grandTotal 的均值(会被偏小值稀释)。
  // —— 仅在薪资池分支下计算;非薪资池路径完全不动。
  // 时间订阅(useNow)与配置订阅只为该判断服务,薪资池卡片每秒重算,
  // 其他池卡片虽也订阅但计算很轻(只多走一个 isSalaryPool === false 短路)。
  const now = useNow(1000);
  const config = useConfigStore();
  const dayOverrides = useCalendarStore((s) => s.dayOverrides);
  const monthlyRestModes = useCalendarStore((s) => s.monthlyRestModes);
  // 真实当月月度休息模式覆盖 —— 与 useSalaryLinkageSync 同口径
  const y = now.getFullYear();
  const m = now.getMonth();
  const currentMonthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
  const effectiveRestMode = monthlyRestModes[currentMonthKey] ?? config.restMode;
  const effectiveConfig = { ...config, restMode: effectiveRestMode };
  // 「今日」的 dateKey —— 必须用 formatDateKey(now) 本地时区,与联动 record 一致;
  // 卡片下方「elapsed」用的 todayKey 是另一份(UTC 旧实现,本次不动)。
  const todayKeyLocal = formatDateKey(now);
  const isTodayInProgress = isSalaryPool
    ? isWorkday(now, effectiveConfig, dayOverrides, HOLIDAYS) &&
      findCurrentSegment(
        getEffectiveSegments(effectiveConfig, dayOverrides[todayKeyLocal] ?? null, now),
        now,
      ) !== null
    : false;

  const salaryPoolRecords = isSalaryPool
    ? records.filter(
        (r) => r.poolId === pool.id && r.linkageSource === 'salary-time-mode' && r.amount > 0,
      )
    : [];
  // 今日还在增长 → 排除今日 record(否则日均被稀释);其他日期照常计入
  const completedSalaryPoolRecords = isTodayInProgress
    ? salaryPoolRecords.filter((r) => r.dateKey !== todayKeyLocal)
    : salaryPoolRecords;
  const salaryPoolDateSet = isSalaryPool ? new Set(completedSalaryPoolRecords.map((r) => r.dateKey)) : null;
  const salaryPoolFirstDateKey = isSalaryPool
    ? (Array.from(salaryPoolDateSet ?? []).sort()[0] ?? '')
    : '';
  // v2.5-patch15 T-531：薪资池「日均」口径修正
  // —— 不算今天(分子分母同步扣除今日部分)。
  //   分母:totalDays = 完整工作日数(已排除今日进行中)
  //   分子:(grandTotal - todayAccumulated) = 完整工作日累计
  //   效果:poolDaily 精准反映「完整一天赚多少」,不再被今日的部分薪资稀释
  //   显示「已赚 ¥X」继续走 grandTotal(仍含今日部分),与原 consumedByTime 语义一致
  const todayAccumulated = isSalaryPool && isTodayInProgress
    ? salaryPoolRecords
        .filter((r) => r.dateKey === todayKeyLocal)
        .reduce((sum, r) => sum + r.amount, 0)
    : 0;

  // ── 按自然天数计算已过/未消耗 ─────────────────────────
  // v2.5-patch13：支出/收入池统一按自然天数算，不按周期已付款
  // totalDays = 池总天数（从 dateRange 或 各周期 dateKeys 推导）
  // poolDaily = 总额 / 总天数（统一日均）
  // elapsed = 从池开始日期到今天的天数（不跨过总天数）
  // consumed = poolDaily × elapsed（已按时间流逝消耗/赚取的部分）
  // remaining = grandTotal − consumed
  const totalDays = (() => {
    if (isSalaryPool) return salaryPoolDateSet?.size ?? 0;
    if (pool.cycleMode === 'daily' && pool.dateRange) {
      const months = eachMonthInRange(pool.dateRange);
      return months.reduce(
        (sum, mk) => sum + buildDateRangeKeys(pool.dateRange!, mk).length,
        0,
      );
    }
    // 月模式：用 getCycleDateKeys 重建各周期的实际天数（考虑 dayRange 跨月）
    return poolCycles.reduce((sum, c) => {
      const keys = getCycleDateKeys(pool, c.monthKey);
      return sum + keys.length;
    }, 0);
  })();
  // firstDateKey = 池内第一天的 dateKey（用于计算 elapsed）
  const firstDateKey = (() => {
    if (isSalaryPool) return salaryPoolFirstDateKey;
    if (pool.cycleMode === 'daily' && pool.dateRange) return pool.dateRange.start;
    // 月模式：从第一个周期的实际 dateKeys 取第一天（正确处理 dayRange 跨月情况）
    const firstKeys = poolCycles[0] ? getCycleDateKeys(pool, poolCycles[0].monthKey) : [];
    return firstKeys[0] ?? '';
  })();
  const todayKey = new Date().toISOString().slice(0, 10);
  const elapsed = (() => {
    if (isSalaryPool) {
      // 薪资池：「已过天数」= 有 record 的天数(= totalDays),保证
      // poolDaily × elapsed = grandTotal,「已赚 ¥X」直接等于总额,直观。
      return totalDays;
    }
    if (!firstDateKey || firstDateKey > todayKey) return 0;
    const start = new Date(firstDateKey);
    const end = new Date(todayKey);
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  })();


  // v2.5 TASK-046 T-501：income equalize 池复用 calcVirtualAssets
  // 拆分出的 earnedUnarrived —— 与总资产卡同口径,避免「池卡片 vs 总资产卡」对不上。
  // —— 大数字 displayTotal = records 中 confirmed in 之和(已赚累计),
  // displayPaid = claimed 部分(已到账),二者差额 remaining 即「未到账」,
  // 该值与总资产 chip「已赚未到账」完全一致。
  //
  // v2.5-patch7 T-513：收入池大数字要包含「按日生成的虚拟到账记录」(!poolStatus)
  // —— 用户在 7.1-9.30 期间设的 6480 公积金池,会逐日生成 +70.43 收入 record;
  // 之前只统计 confirmed 联动 record 的话,日均场景永远显示 0;
  // 修复后：累计 = 每日均摊 + 联动/手动 confirmed,扣掉已 claim 的到账 = 未到账。
  // claimed 仍只在 displayPaid 计入(已到账口径,不再计入已赚累计,避免重复)。
  const isIncomeEqualize = isIncome && pool.type === 'equalize';
  const incomeEarnedSum = isIncomeEqualize
    ? records.reduce(
        (sum, r) =>
          r.poolId === pool.id && r.amount > 0 && r.poolStatus !== 'claimed'
            ? sum + r.amount
            : sum,
        0,
      )
    : grandTotal;
  const displayTotal = isIncomeEqualize ? incomeEarnedSum : grandTotal;
  const poolDaily = totalDays > 0
      ? (isSalaryPool
          ? Math.round(((incomeEarnedSum - todayAccumulated) / totalDays) * 100) / 100
          : Math.round((grandTotal / totalDays) * 100) / 100)
      : 0;
  const grandTotal1= isSalaryPool ? incomeEarnedSum : grandTotal;
  const elapsedClamped = Math.min(Math.max(0, elapsed), totalDays);
  const consumedByTime = isSalaryPool? incomeEarnedSum:Math.round(poolDaily * elapsedClamped * 100) / 100;
  const remainingByTime = Math.round((grandTotal - consumedByTime) * 100) / 100;
  const claimedIncomeSum = isIncomeEqualize
    ? records.reduce(
        (sum, r) =>
          r.poolId === pool.id && r.poolStatus === 'claimed' && r.amount > 0
            ? sum + r.amount
            : sum,
        0,
      )
    : paidTotal;

  const displayPaid = isIncomeEqualize ? claimedIncomeSum : paidTotal;
  // v2.5 TASK-046 T-504：剩余到账金额（用于「完成剩余到账」按钮）
  const remaining = Math.max(0, displayTotal - displayPaid);
  // v2.5 TASK-046 T-504：是否已 100% 完成（用于提示「该池已经完成确认」）
  const isFullyPaid = displayTotal > 0 && remaining < 1e-9;

  // v2.5 TASK-046 T-504：「一键到账」快速认领表单
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
        <span className={styles.cardAmt}>¥{formatAmount(grandTotal1, true)}</span>
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
