/**
 * @fileoverview RecurringSection — 定期账管理区（TASK-058 T-583）
 *
 * MINE 页的定期账分区（替代 PoolSection）。
 * - 展示所有定期账（均摊 + 押金）
 * - 过滤工资联动池（noDailyVirtual=true），内部记录仍正常写入
 * - 使用 RecurringCard + RecurringCreateModal
 *
 * 旧组件 PoolSection 在验收后删除（不并存）。
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { PoolConfig } from '../../../lib/types';
import { RecurringCard } from './RecurringCard';
import { RecurringCreateModal } from './RecurringCreateModal';
import styles from './PoolPage.module.css';

/** 定期账管理区（MINE 页分区）。 */
export function RecurringSection() {
  const pools = useAccountStore((s) => s.pools);
  const cycles = useAccountStore((s) => s.cycles);
  const deletePool = useAccountStore((s) => s.deletePool);
  const [addOpen, setAddOpen] = useState(false);

  // v3.0 TASK-058 T-585：原本过滤工资联动池（noDailyVirtual=true），
  // 让池列表干净；但工资池也该在定期账区展示（改名字不影响可见性）。
  // 如需隐藏某个池，用 isArchived 标记，不在 RecurringSection 层过滤。
  const visiblePools = pools;

  const handleDelete = (pool: PoolConfig) => {
    if (!window.confirm(`删除「${pool.name}」？已生成的均摊记录会保留。`)) return;
    deletePool(pool.id);
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>定期账单</div>
          <div className={styles.sub}>均摊 · 押金 · 工资联动</div>
        </div>
        <button type="button" className={styles.addBtn} onClick={() => setAddOpen(true)}>
          + 新建定期账
        </button>
      </div>

      {visiblePools.length === 0 ? (
        <div className={styles.emptySmall}>
          还没有定期账，把房租、押金交给它管理
        </div>
      ) : (
        visiblePools.map((pool) => {
          const poolCycles = cycles.filter((c) => c.poolId === pool.id);
          return (
            <RecurringCard
              key={pool.id}
              pool={pool}
              poolCycles={poolCycles}
              onDelete={handleDelete}
            />
          );
        })
      )}

      <RecurringCreateModal open={addOpen} onClose={() => setAddOpen(false)} />
    </section>
  );
}
