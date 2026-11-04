/**
 * @fileoverview RecurringEntryCard — MINE 页「定期账」入口卡（v3.1 TASK-064）
 *
 * 与「一程」卡并排的竖版入口卡：
 * - 整卡点击 → onOpen（MinePage 切到定期账全屏列表页）
 * - 卡内「+ 新建」按钮 → 直接打开 RecurringCreateModal（不触发导航）
 *
 * 数据：定期账个数 + 类型标签（均摊 / 押金）。
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { ArrowsClockwise, Plus } from '@phosphor-icons/react';
import { EntryCard } from '../EntryCard/EntryCard';
import { RecurringCreateModal } from './RecurringCreateModal';
import styles from './RecurringEntryCard.module.css';

interface RecurringEntryCardProps {
  onOpen: () => void;
}

export function RecurringEntryCard({ onOpen }: RecurringEntryCardProps) {
  const pools = useAccountStore((s) => s.pools);
  const [createOpen, setCreateOpen] = useState(false);

  const count = pools.length;
  const meta =
    count === 0
      ? '还没有定期账'
      : [
          pools.some((p) => p.type === 'equalize') ? '均摊' : null,
          pools.some((p) => p.type === 'deposit') ? '押金' : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <>
      <EntryCard
        overline="RECUR"
        icon={<ArrowsClockwise size={15} weight="bold" />}
        value={String(count)}
        unit="个"
        meta={meta}
        foot={
          <button
            type="button"
            className={styles.newBtn}
            onClick={(e) => {
              e.stopPropagation();
              setCreateOpen(true);
            }}
            aria-label="新建定期账"
          >
            <Plus size={12} weight="bold" />
            新建
          </button>
        }
        onOpen={onOpen}
        ariaLabel="打开定期账"
      />

      <RecurringCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
