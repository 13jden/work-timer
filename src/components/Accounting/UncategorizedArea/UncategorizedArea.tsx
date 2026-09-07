/** @fileoverview UncategorizedArea — horizontally scrollable unclassified record cards.
 * v2.5-patch10：未分类记录始终可拖动归类（无需点击「归类」启用模式）。
 * - useDraggable 始终启用（移除 disabled: !dragMode）
 * - 与 SortableFolder 的 useDroppable 配合，直接拖到下方分类文件夹即可归类
 * - 点击卡片仍可进入编辑（onClick 在 drag 未触发时正常触发）
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
  /** v2.5-patch10：保留参数以兼容旧 API，但实际不再用于控制可拖动状态 */
  dragMode?: boolean;
}

/** Renders unclassified records as dnd-kit draggable cards. */
export function UncategorizedArea({ onPickRecord, onManageAll, dragMode: _dragMode = false }: UncategorizedAreaProps) {
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
          />
        ))}
      </div>
      <p className={styles.hint}>
        点击卡片编辑 · 直接拖动卡片到下方分类文件夹即可归类
      </p>
    </div>
  );
}

interface UncategorizedCardProps {
  record: AccountRecord;
  onPick?: (recordId: string) => void;
}

/**
 * v2.5-patch10：未分类记录始终可拖动（移除 dragMode 判断）。
 * - useDraggable 始终挂载，distance activation 让 click 编辑与 drag 归类互不冲突：
 *   · 无移动 → onClick 触发 → 编辑记录
 *   · 移动 N 像素 → drag 触发 → 拖到分类文件夹归类
 */
function UncategorizedCard({ record, onPick }: UncategorizedCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${RECORD_DRAG_PREFIX}${record.id}`,
    data: { type: 'record', recordId: record.id },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
      onClick={() => onPick?.(record.id)}
      aria-label={`未分类记录 ${record.note ?? ''} ${formatAmount(Math.abs(record.amount))}`}
      {...attributes}
      {...listeners}
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
