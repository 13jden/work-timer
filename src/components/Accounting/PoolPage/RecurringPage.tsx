/**
 * @fileoverview RecurringPage — 定期账全屏列表页（v3.1 TASK-064）
 *
 * MINE 页「定期账」入口卡点击后的落地页（与一程列表页同构）：
 * - 头部：小圆钮返回 + 居中「RECUR / 定期账」+ 墨色圆钮新建
 * - 列表：复用 RecurringCard（均摊 / 押金统一卡）
 * - 空态：引导新建
 *
 * 取代原 RecurringSection（MINE 页内嵌分区）。
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { PoolConfig } from '../../../lib/types';
import { ArrowLeft, Plus, ArrowsClockwise } from '@phosphor-icons/react';
import { RecurringCard } from './RecurringCard';
import { RecurringCreateModal } from './RecurringCreateModal';
import styles from './RecurringPage.module.css';

interface RecurringPageProps {
  onBack: () => void;
}

export function RecurringPage({ onBack }: RecurringPageProps) {
  const pools = useAccountStore((s) => s.pools);
  const cycles = useAccountStore((s) => s.cycles);
  const deletePool = useAccountStore((s) => s.deletePool);
  const [addOpen, setAddOpen] = useState(false);

  const handleDelete = (pool: PoolConfig) => {
    if (!window.confirm(`删除「${pool.name}」？已生成的均摊记录会保留。`)) return;
    deletePool(pool.id);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.circleBtn} onClick={onBack} aria-label="返回">
          <ArrowLeft size={17} weight="bold" />
        </button>
        <div className={styles.headerCenter}>
          <div className={styles.overline}>RECUR</div>
          <h1 className={styles.headerTitle}>定期账</h1>
        </div>
        <button
          type="button"
          className={`${styles.circleBtn} ${styles.addBtn}`}
          onClick={() => setAddOpen(true)}
          aria-label="新建定期账"
        >
          <Plus size={17} weight="bold" />
        </button>
      </header>

      {pools.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden>
            <ArrowsClockwise size={18} weight="bold" />
          </div>
          <div className={styles.emptyTitle}>还没有定期账</div>
          <div className={styles.emptyHint}>把房租、押金交给它管理</div>
          <button type="button" className={styles.emptyAddBtn} onClick={() => setAddOpen(true)}>
            <Plus size={14} weight="bold" />
            新建定期账
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {pools.map((pool) => (
            <RecurringCard
              key={pool.id}
              pool={pool}
              poolCycles={cycles.filter((c) => c.poolId === pool.id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <RecurringCreateModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
