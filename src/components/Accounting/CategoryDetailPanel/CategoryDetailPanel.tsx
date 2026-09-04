import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount, sumExpense, visibleRecords } from '../../../lib/accounting';
import type { AccountRecord } from '../../../lib/types';
import { X } from '@phosphor-icons/react';
import { IconByKey } from '../../IconByKey';
import styles from './CategoryDetailPanel.module.css';

const RECORD_DRAG_MIME = 'application/x-accounting-category-record-id';

interface CategoryDetailPanelProps {
  categoryId: string | null;
  monthKey: string;
  onClose: () => void;
  onPickRecord?: (recordId: string) => void;
  onEditCategory?: (categoryId: string) => void;
  onDeleteCategory?: (categoryId: string) => void;
  /** v2.2 TASK-038：查看全部记录入口（分类记录页） */
  onShowAllRecords?: (categoryId: string) => void;
}

/** 分类详情页：查看分类统计，编辑记录，拖动记录调整日期。 */
export function CategoryDetailPanel({
  categoryId,
  monthKey,
  onClose,
  onPickRecord,
  onEditCategory,
  onDeleteCategory,
  onShowAllRecords,
}: CategoryDetailPanelProps) {
  const records = useAccountStore((s) => s.records);
  const categories = useAccountStore((s) => s.categories);
  const folders = useAccountStore((s) => s.folders);
  const accounts = useAccountStore((s) => s.accounts);
  const updateRecord = useAccountStore((s) => s.updateRecord);
  const [dragRecordId, setDragRecordId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const category = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const folder = useMemo(
    () => folders.find((item) => item.categoryId === categoryId) ?? null,
    [folders, categoryId],
  );

  const monthRecords = useMemo(() => {
    if (!categoryId) return [];
    // v2.3：虚拟池预扣不计入分类月度统计
    return visibleRecords(records)
      .filter((record) => record.categoryId === categoryId && record.dateKey.startsWith(monthKey))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.createdAt - a.createdAt);
  }, [records, categoryId, monthKey]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, AccountRecord[]>();
    monthRecords.forEach((record) => {
      const dayRecords = map.get(record.dateKey) ?? [];
      dayRecords.push(record);
      map.set(record.dateKey, dayRecords);
    });
    return Array.from(map, ([dateKey, items]) => ({
      dateKey,
      items,
      total: sumExpense(items),
    }));
  }, [monthRecords]);

  const stats = useMemo(() => {
    const total = sumExpense(monthRecords);
    const largest = [...monthRecords].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
    const uniqueDays = new Set(monthRecords.map((record) => record.dateKey)).size;
    const allExpenses = visibleRecords(records).filter(
      (record) => record.type === 'expense' && record.dateKey.startsWith(monthKey),
    );
    const allExpenseTotal = sumExpense(allExpenses);
    return {
      total,
      count: monthRecords.length,
      maxSingle: largest ? Math.abs(largest.amount) : 0,
      maxSingleNote: largest?.note ?? '',
      dailyAvg: uniqueDays ? total / uniqueDays : 0,
      percent: allExpenseTotal ? Math.round((total / allExpenseTotal) * 100) : 0,
    };
  }, [monthRecords, records, monthKey]);

  if (!categoryId || !category || !folder) return null;

  const hasAnyRecord = records.some((record) => record.categoryId === category.id);

  const handleRecordDragStart = (event: React.DragEvent, recordId: string) => {
    event.dataTransfer.setData(RECORD_DRAG_MIME, recordId);
    event.dataTransfer.effectAllowed = 'move';
    setDragRecordId(recordId);
  };

  const handleDayDrop = (event: React.DragEvent, targetDateKey: string) => {
    event.preventDefault();
    const recordId = event.dataTransfer.getData(RECORD_DRAG_MIME);
    const record = records.find((item) => item.id === recordId);
    if (record && record.categoryId === category.id && record.dateKey !== targetDateKey) {
      updateRecord(record.id, { dateKey: targetDateKey });
    }
    setDragRecordId(null);
    setDragOverDateKey(null);
  };

  return (
    <section className={styles.page} aria-label={`${category.name}分类详情`}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onClose} aria-label="返回">‹</button>
        <span className={styles.title}>{category.name}</span>
        {onDeleteCategory && !hasAnyRecord ? (
          <button className={styles.moreBtn} onClick={() => setConfirmOpen(true)} aria-label="删除分类">
            <X size={16} weight="regular" />
          </button>
        ) : (
          <button className={styles.moreBtn} onClick={() => onEditCategory?.(category.id)} aria-label="更多">⋯</button>
        )}
      </div>

      {/* v2.1 TASK-037:删除分类确认弹窗(替代 window.confirm) */}
      {confirmOpen && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmOpen(false)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>删除这个分类？</div>
            <div className={styles.confirmText}>「{category.name}」将被删除，删除后不可恢复。</div>
            <div className={styles.confirmBtns}>
              <button type="button" className={styles.confirmCancel} onClick={() => setConfirmOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className={styles.confirmDanger}
                onClick={() => {
                  setConfirmOpen(false);
                  onDeleteCategory?.(category.id);
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.summary}>
        <div className={styles.bigIcon} style={{ background: folder.color }}>
          <IconByKey icon={folder.icon} size={26} color="#fff" />
        </div>
        <div className={styles.amount}>¥{formatAmount(stats.total)}</div>
        <div className={styles.meta}>本月 {stats.count} 笔 · 日均 ¥{formatAmount(stats.dailyAvg)}</div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statBlock}>
          <div className={`${styles.statVal} ${styles.statAccent}`}>¥{formatAmount(stats.maxSingle)}</div>
          <div className={styles.statLbl}>单笔最多{stats.maxSingleNote ? ` · ${stats.maxSingleNote}` : ''}</div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statBlock}>
          <div className={styles.statVal}>¥{formatAmount(stats.dailyAvg)}</div>
          <div className={styles.statLbl}>日均</div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statBlock}>
          <div className={styles.statVal}>{stats.percent}%</div>
          <div className={styles.statLbl}>占总支出</div>
        </div>
      </div>

      {onShowAllRecords && (
        <button
          type="button"
          className={styles.viewAllBtn}
          onClick={() => onShowAllRecords(category.id)}
        >
          查看全部记录
        </button>
      )}

      {groupedByDay.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📒</span>
          <span className={styles.emptyText}>本月还没有 {category.name} 记录</span>
        </div>
      ) : (
        <div className={styles.list}>
          {groupedByDay.map((day) => (
            <div
              key={day.dateKey}
              className={`${styles.dayRow} ${dragOverDateKey === day.dateKey ? styles.dayRowOver : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverDateKey(day.dateKey);
              }}
              onDragLeave={(event) => {
                const next = event.relatedTarget as Node | null;
                if (!next || !event.currentTarget.contains(next)) setDragOverDateKey(null);
              }}
              onDrop={(event) => handleDayDrop(event, day.dateKey)}
            >
              <div className={styles.dayHead}>
                <span className={styles.dayDate}>{formatDayLabel(day.dateKey)}</span>
                <span className={styles.dayTotal}>-¥{formatAmount(day.total)}</span>
              </div>
              <div className={styles.dayCards}>
                {day.items.map((record) => {
                  const account = accounts.find((item) => item.id === record.accountId);
                  return (
                    <button
                      key={record.id}
                      className={`${styles.card} ${dragRecordId === record.id ? styles.cardDragging : ''}`}
                      onClick={() => onPickRecord?.(record.id)}
                      draggable
                      onDragStart={(event) => handleRecordDragStart(event, record.id)}
                      onDragEnd={() => {
                        setDragRecordId(null);
                        setDragOverDateKey(null);
                      }}
                    >
                      <div className={styles.cardIcon} style={{ background: folder.color }}>
                        <IconByKey icon={folder.icon} size={15} color="#fff" />
                      </div>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardName}>{record.note?.trim() || category.name}</div>
                        <div className={styles.cardSub}>{formatTime(record.createdAt)} · {account?.name ?? '未知账户'}</div>
                      </div>
                      <div className={styles.cardAmt}>-¥{formatAmount(Math.abs(record.amount))}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDayLabel(dateKey: string): string {
  const [year, month = 1, day = 1] = dateKey.split('-').map(Number);
  const date = new Date(year ?? new Date().getFullYear(), month - 1, day);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${month} 月 ${day} 日 · 周${weekdays[date.getDay()]}`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
