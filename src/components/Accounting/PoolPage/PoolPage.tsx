/**
 * @fileoverview PoolPage — 池管理页（v2.3 · TASK-039）
 *
 * 记账主题 MINE tab（T-301）：池卡片列表 + 建池弹窗。
 * - 均摊型：周期进度条（已确认 / 总额）+ 状态徽标（进行中/已确认/已逾期）
 * - 存池型：池余额（Σ存入 − Σ取出）
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { PoolConfig, PoolCycle } from '../../../lib/types';
import { formatAmount } from '../../../lib/accounting';
import { equalizeProgress, depositBalance } from '../../../lib/accounting/pool';
import { AddPoolModal } from './AddPoolModal';
import styles from './PoolPage.module.css';

/** 池管理页（记账主题 tab 3）。 */
export function PoolPage() {
  const pools = useAccountStore((s) => s.pools);
  const cycles = useAccountStore((s) => s.cycles);
  const deletePool = useAccountStore((s) => s.deletePool);
  const [addOpen, setAddOpen] = useState(false);

  const handleDelete = (pool: PoolConfig) => {
    if (!window.confirm(`删除池「${pool.name}」？关联周期与认领关系将一并移除。`)) return;
    deletePool(pool.id);
  };

  return (
    <div className={styles.page}>
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
        <div className={styles.empty}>
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
            />
          ) : (
            <DepositCard
              key={pool.id}
              pool={pool}
              poolCycles={poolCycles}
              onDelete={() => handleDelete(pool)}
            />
          );
        })
      )}

      <AddPoolModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

interface CardProps {
  pool: PoolConfig;
  poolCycles: PoolCycle[];
  onDelete: () => void;
}

/** 均摊型池卡片 */
function EqualizeCard({ pool, poolCycles, onDelete }: CardProps) {
  const progress = equalizeProgress(poolCycles);
  const paidTotal = poolCycles.reduce((sum, c) => sum + c.paidAmount, 0);
  const grandTotal = poolCycles.reduce((sum, c) => sum + c.totalAmount, 0);
  const status = poolOverallStatus(poolCycles);
  const dailyAvg = poolCycles[0]?.dailyVirtual ?? 0;

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.cardName}>{pool.name}</span>
        <span className={`${styles.badge} ${styles.badgeEqualize}`}>均摊</span>
        <span className={`${styles.badge} ${STATUS_CLASS[status] ?? ''}`}>{STATUS_LABEL[status]}</span>
        <button type="button" className={styles.delBtn} onClick={onDelete} aria-label="删除池">
          ✕
        </button>
      </div>
      <div className={styles.cardAmtRow}>
        <span className={styles.cardAmt}>¥{formatAmount(pool.amount)}</span>
        <span className={styles.cardAmtLabel}>/ 周期 · 日均 ¥{formatAmount(dailyAvg)}</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className={styles.cardMeta}>
        <span>
          已认领 ¥{formatAmount(paidTotal)} / ¥{formatAmount(grandTotal)}
        </span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
}

/** 存池型池卡片 */
function DepositCard({ pool, poolCycles, onDelete }: CardProps) {
  const allTx = poolCycles.flatMap((c) => c.transactions);
  const balance = depositBalance(allTx);
  const inCount = allTx.filter((t) => t.direction === 'in' && t.status === 'confirmed').length;
  const outCount = allTx.filter((t) => t.direction === 'out' && t.status === 'confirmed').length;

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.cardName}>{pool.name}</span>
        <span className={`${styles.badge} ${styles.badgeDeposit}`}>存池</span>
        <button type="button" className={styles.delBtn} onClick={onDelete} aria-label="删除池">
          ✕
        </button>
      </div>
      <div className={styles.cardAmtRow}>
        <span className={styles.cardAmt}>¥{formatAmount(balance)}</span>
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
