/** @fileoverview UncategorizedArea — horizontally scrollable unclassified record cards.
 * v2.5-patch8：默认不启用拖动手势（点击即编辑），
 * 需在父级开启「拖动归类」模式后才能长按拖动 → 减少误触 + 允许触屏正常上下滑。
 */
import { useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord } from '../../../lib/types';
import { formatAmount, visibleRecords } from '../../../lib/accounting';
import styles from './UncategorizedArea.module.css';

export const RECORD_DRAG_PREFIX = 'record:';

interface UncategorizedAreaProps {
  onPickRecord?: (recordId: string) => void;
  onManageAll?: () => void;
  /** v2.5-patch8：父级启用「拖动归类」模式后才允许长按拖动卡片 */
  dragMode?: boolean;
}

/** Renders unclassified records as dnd-kit draggable cards. */
export function UncategorizedArea({ onPickRecord, onManageAll, dragMode = false }: UncategorizedAreaProps) {
  const records = useAccountStore((state) => state.records);
  const unclassifiedRecords = useMemo(
    // v2.3：虚拟池预扣不进未分类区
    () => visibleRecords(records)
      .filter((record) => record.isUncategorized || !record.categoryId)
      .sort((left, right) => right.createdAt - left.createdAt),
    [records],
  );

  if (unclassifiedRecords.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <span className={styles.title}>未分类</span>
        <span className={styles.count}>{unclassifiedRecords.length}</span>
        {onManageAll && <button className={styles.manageBtn} onClick={onManageAll}>管理</button>}
      </div>
      <div className={styles.list}>
        {unclassifiedRecords.map((record) => (
          <UncategorizedCard
            key={record.id}
            record={record}
            onPick={onPickRecord}
            dragMode={dragMode}
          />
        ))}
      </div>
      <p className={styles.hint}>
        {dragMode
          ? '长按卡片拖到下方分类即可归类（再次点击「完成归类」退出）'
          : '点击卡片编辑 · 长按前先点上方「归类」启用拖动'}
      </p>
    </div>
  );
}

interface UncategorizedCardProps {
  record: AccountRecord;
  onPick?: (recordId: string) => void;
  /** v2.5-patch8：仅在父级启用时挂拖动手势 */
  dragMode: boolean;
}

function UncategorizedCard({ record, onPick, dragMode }: UncategorizedCardProps) {
  // v2.5-patch8：未启用 dragMode 时仍挂 useDraggable（保持 ID 一致），
  // 但用 disabled 让 dnd-kit 不接管手势监听 → 允许父级滚动 + 直接点击编辑
  const draggable = useDraggable({
    id: `${RECORD_DRAG_PREFIX}${record.id}`,
    data: { type: 'record', recordId: record.id },
    disabled: !dragMode,
  });
  const { attributes, listeners, setNodeRef, isDragging } = draggable;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
      onClick={() => onPick?.(record.id)}
      aria-label={`未分类记录 ${record.note ?? ''} ${formatAmount(Math.abs(record.amount))}`}
      {...(dragMode ? attributes : {})}
      {...(dragMode ? listeners : {})}
    >
      <span className={styles.cardName}>{record.note || '未命名记录'}</span>
      <span className={`${styles.cardAmount} ${record.type === 'income' ? styles.income : styles.expense}`}>
        {record.type === 'income' ? '+' : '-'}¥{formatAmount(Math.abs(record.amount))}
      </span>
      <span className={styles.cardTime}>{formatTime(record.dateKey)}</span>
    </button>
  );
}

function formatTime(dateKey: string): string {
  const now = new Date();
  const [year = now.getFullYear(), month = 1, day = 1] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const difference = now.getTime() - date.getTime();
  const dayMilliseconds = 86_400_000;
  if (difference < dayMilliseconds) return '今天';
  if (difference < dayMilliseconds * 2) return '昨天';
  if (difference < dayMilliseconds * 7) return `${Math.floor(difference / dayMilliseconds)}天前`;
  return `${month}/${day}`;
}
