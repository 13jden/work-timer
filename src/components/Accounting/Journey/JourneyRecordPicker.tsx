/**
 * @fileoverview JourneyRecordPicker — 关联其他记录到一程（v3.0 TASK-059 T-595）
 *
 * 列出当前类型（支出/收入）、未挂任何一程的记录，用户多选 → 关联到当前 journey。
 * 可点击单条记录移除关联（移出本程）。
 */
import { useState, useEffect, useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount } from '../../../lib/accounting';
import { X, Check, LinkBreak } from '@phosphor-icons/react';
import styles from './JourneyRecordPicker.module.css';

interface JourneyRecordPickerProps {
  open: boolean;
  journeyId: string;
  /** 当前一程的类型，只列同类型记录 */
  type: 'expense' | 'income';
  onClose: () => void;
}

export function JourneyRecordPicker({ open, journeyId, type, onClose }: JourneyRecordPickerProps) {
  const records = useAccountStore((s) => s.records);
  const updateRecord = useAccountStore((s) => s.updateRecord);
  const journey = useAccountStore((s) => s.journeys.find((j) => j.id === journeyId));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'unattached' | 'attached'>('unattached');
  const categories = useAccountStore((s) => s.categories);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setTab('unattached');
    }
  }, [open]);

  // 候选记录：当前类型 + 未挂任何 journey
  const candidates = useMemo(
    () =>
      records
        .filter((r) => r.type === type && !r.journeyId)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [records, type],
  );

  // 本程已关联
  const attached = useMemo(
    () =>
      records
        .filter((r) => r.journeyId === journeyId)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [records, journeyId],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    for (const id of selected) {
      updateRecord(id, { journeyId });
    }
    onClose();
  };

  const handleUnlink = (recordId: string) => {
    updateRecord(recordId, { journeyId: undefined });
  };

  if (!open || !journey) return null;

  const list = tab === 'unattached' ? candidates : attached;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>
        <div className={styles.header}>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
          <div className={styles.headerTitle}>关联记录到「{journey.title}」</div>
          <div className={styles.headerSpacer} />
        </div>

        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'unattached' ? styles.tabActive : ''}`}
            onClick={() => setTab('unattached')}
          >
            待关联
            <span className={styles.tabCount}>{candidates.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'attached' ? styles.tabActive : ''}`}
            onClick={() => setTab('attached')}
          >
            已关联
            <span className={styles.tabCount}>{attached.length}</span>
          </button>
        </div>

        {list.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📋</span>
            <span className={styles.emptyText}>
              {tab === 'unattached' ? '暂无可关联的同类型记录' : '本程还没有关联记录'}
            </span>
          </div>
        ) : (
          <div className={styles.list}>
            {list.map((r) => {
              const cat = categories.find((c) => c.id === r.categoryId);
              const isSelected = selected.has(r.id);
              return (
                <div
                  key={r.id}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                  onClick={() => tab === 'unattached' && toggle(r.id)}
                  role={tab === 'unattached' ? 'button' : undefined}
                >
                  <div className={styles.rowLeft}>
                    {tab === 'unattached' && (
                      <span className={`${styles.checkbox} ${isSelected ? styles.checkboxOn : ''}`}>
                        {isSelected && <Check size={12} weight="bold" />}
                      </span>
                    )}
                    <div className={styles.rowInfo}>
                      <div className={styles.rowTopLine}>
                        <span className={styles.rowDate}>{r.dateKey.slice(5)}</span>
                        {cat && (
                          <span className={styles.rowCat} style={{ color: cat.color }}>
                            {cat.icon} {cat.name}
                          </span>
                        )}
                      </div>
                      {r.note && <div className={styles.rowNote}>{r.note}</div>}
                    </div>
                  </div>
                  <div className={styles.rowRight}>
                    <span className={r.type === 'income' ? styles.incomeAmt : styles.expenseAmt}>
                      {r.type === 'income' ? '+' : '-'}¥{formatAmount(Math.abs(r.amount))}
                    </span>
                    {tab === 'attached' && (
                      <button
                        type="button"
                        className={styles.unlinkBtn}
                        onClick={(e) => { e.stopPropagation(); handleUnlink(r.id); }}
                        title="移出本程"
                      >
                        <LinkBreak size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'unattached' && candidates.length > 0 && (
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>取消</button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              关联 {selected.size > 0 ? `${selected.size} 条` : '记录'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
