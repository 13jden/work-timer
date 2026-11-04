/**
 * @fileoverview JourneySelector — 单选一程的底部 sheet（v3.0 TASK-059 T-598 · v3.1 TASK-063 文案）
 *
 * 用于 AddRecordModal 内「一程」chip 的选择器。
 * 只列出当前类型的 journey，无则显示空态。
 */
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { X, Check, AirplaneTilt } from '@phosphor-icons/react';
import styles from './JourneySelector.module.css';

interface JourneySelectorProps {
  open: boolean;
  type: 'expense' | 'income';
  selectedId?: string;
  onPick: (id: string | undefined) => void;
  onClose: () => void;
}

export function JourneySelector({ open, type, selectedId, onPick, onClose }: JourneySelectorProps) {
  const journeys = useAccountStore((s) => s.journeys);

  const list = useMemo(
    () => journeys.filter((j) => j.type === type).sort((a, b) => b.updatedAt - a.updatedAt),
    [journeys, type],
  );

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={(e) => {
      // v3.0 TASK-059 fix: stopPropagation 防止冒泡到 AddRecordModal overlay
      e.stopPropagation();
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={styles.sheet}>
        <div className={styles.header}>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
          <div className={styles.headerTitle}>选择一程</div>
          <div className={styles.headerSpacer} />
        </div>

        {list.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <AirplaneTilt size={36} weight="duotone" />
            </div>
            <div className={styles.emptyText}>还没有一程</div>
            <div className={styles.emptyHint}>去「我的 → 一程」开始第一程</div>
          </div>
        ) : (
          <div className={styles.list}>
            {list.map((j) => (
              <button
                key={j.id}
                type="button"
                className={`${styles.row} ${selectedId === j.id ? styles.rowActive : ''}`}
                onClick={(e) => {
                  // v3.0 TASK-059 fix: 阻止冒泡到外层 AddRecordModal 的 overlay，
                  // 否则会顺带把整个记一笔弹窗也关掉（导致「选完直接退回主页」）。
                  e.stopPropagation();
                  onPick(j.id);
                  onClose();
                }}
              >
                <div className={styles.rowLeft}>
                  <span className={`${styles.glyph} ${type === 'income' ? styles.glyphIncome : styles.glyphExpense}`}>
                    {type === 'income' ? '✧' : '✈'}
                  </span>
                  <div className={styles.rowInfo}>
                    <div className={styles.rowTitle}>{j.title}</div>
                    <div className={styles.rowMeta}>
                      {j.note ? `${j.note.slice(0, 18)}` : type === 'income' ? '收入' : '支出'}
                    </div>
                  </div>
                </div>
                {selectedId === j.id && (
                  <span className={styles.checkBadge}>
                    <Check size={14} weight="bold" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}