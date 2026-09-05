/**
 * @fileoverview PoolSection — 池管理区（v2.4 · TASK-040）
 *
 * MINE 页的池分区（原 v2.3 PoolPage，去掉页面外壳并入 MinePage）。
 * - 均摊型：周期进度条（已确认 / 总额）+ 状态徽标（进行中/已确认/已逾期）
 * - 存池型：池余额（Σ存入 − Σ取出）
 *
 * v2.5-patch4 N-483：每张池卡片加 ✎ 编辑按钮 → 打开 EditPoolModal。
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { PoolConfig, PoolCycle } from '../../../lib/types';
import { formatAmount } from '../../../lib/accounting';
import { equalizeProgress, depositBalance } from '../../../lib/accounting/pool';
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

/** 均摊型池卡片（v2.4 T-409：收入池显示到账进度 + 未到账标记） */
function EqualizeCard({ pool, poolCycles, onDelete, onEdit }: CardProps) {
  const records = useAccountStore((s) => s.records);
  const progress = equalizeProgress(poolCycles);
  const paidTotal = poolCycles.reduce((sum, c) => sum + c.paidAmount, 0);
  const grandTotal = poolCycles.reduce((sum, c) => sum + c.totalAmount, 0);
  const status = poolOverallStatus(poolCycles);
  const dailyAvg = poolCycles[0]?.dailyVirtual ?? 0;
  const isIncome = pool.direction === 'income';

  // v2.5 TASK-046 T-501-PATCH：income equalize 池复用 calcVirtualAssets
  // 拆分出的 earnedUnarrived —— 与总资产卡同口径,避免「池卡片 vs 总资产卡」对不上。
  // —— 大数字 displayTotal = records 中 confirmed in 之和(已赚累计),
  // displayPaid = claimed 部分(已到账),二者差额 remaining 即「未到账」,
  // 该值与总资产 chip「已赚未到账」完全一致。
  const confirmedIncomeSum = isIncome
    ? records.reduce(
        (sum, r) =>
          r.poolId === pool.id && r.poolStatus === 'confirmed' && r.amount > 0
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

  const displayTotal = isIncome ? confirmedIncomeSum : grandTotal;
  const displayPaid = isIncome ? claimedIncomeSum : paidTotal;
  // v2.5 TASK-046 T-505：noDailyVirtual 池(联动工资)没有日均概念,
  // 不显示日均数字；普通 income equalize 池仍按总额/天数推导。
  const displayDailyAvg = isIncome
    ? pool.noDailyVirtual
      ? 0
      : grandTotal > 0 && poolCycles[0]?.dayCount
        ? grandTotal / poolCycles[0].dayCount
        : 0
    : dailyAvg;
  const remaining = Math.max(0, displayTotal - displayPaid);

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
        <span className={styles.cardAmt}>¥{formatAmount(displayTotal, true)}</span>
        <span className={styles.cardAmtLabel}>
          {isIncome ? '已赚累计' : '/ 周期 · 日均'} ¥{formatAmount(displayDailyAvg)}
        </span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className={styles.cardMeta}>
        <span>
          {isIncome ? '已赚' : '已认领'} ¥{formatAmount(displayPaid)} / ¥{formatAmount(displayTotal)}
        </span>
        <span className={styles.cardMetaRight}>
          {isIncome && remaining > 0 && (
            <em className={styles.unreceivedTag}>¥{formatAmount(remaining)} 未到账</em>
          )}
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}

/** 存池型池卡片 */
function DepositCard({ pool, poolCycles, onDelete, onEdit }: CardProps) {
  const allTx = poolCycles.flatMap((c) => c.transactions);
  const balance = depositBalance(allTx);
  const inCount = allTx.filter((t) => t.direction === 'in' && t.status === 'confirmed').length;
  const outCount = allTx.filter((t) => t.direction === 'out' && t.status === 'confirmed').length;

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
        <span className={styles.cardAmt}>¥{formatAmount(balance, true)}</span>
        <span className={styles.cardAmtLabel}>池内余额</span>
      </div>
      <div className={styles.cardMeta}>
        <span>存入 {inCount} 笔 · 取出 {outCount} 笔</span>
        <span>押金 ¥{formatAmount(pool.amount)}</span>
      </div>
    </div>
  );
}

// ── 状态辅助 ──────────────────────────────────────────────

type PoolStatus = 'generating' | 'confirmed' | 'overdue';

const STATUS_LABEL: Record<PoolStatus, string> = {
  generating: '进行中',
  confirmed: '已确认',
  overdue: '已逾期',
};

const STATUS_CLASS: Record<PoolStatus, string> = {
  generating: styles.statusGenerating ?? '',
  confirmed: styles.statusConfirmed ?? '',
  overdue: styles.statusOverdue ?? '',
};

/** 池整体状态：有逾期 → 逾期；全确认 → 已确认；否则进行中 */
function poolOverallStatus(poolCycles: PoolCycle[]): PoolStatus {
  if (poolCycles.some((c) => c.status === 'overdue')) return 'overdue';
  if (poolCycles.length > 0 && poolCycles.every((c) => c.status === 'confirmed')) return 'confirmed';
  return 'generating';
}
