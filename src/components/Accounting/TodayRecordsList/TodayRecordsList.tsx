/**
 * TodayRecordsList — 今日记录列表
 *
 * 展示今日所有记账记录，按时间倒序。
 * 每行显示：
 * - 分类图标 + 名称
 * - 备注
 * - 金额（绿=收入，红=支出）
 *
 * 点击记录 → 打开编辑弹窗
 * 长按记录 → 显示操作菜单
 */
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord } from '../../../lib/types';
import { formatAmount, sumExpense, sumIncome } from '../../../lib/accounting';
import styles from './TodayRecordsList.module.css';

interface TodayRecordsListProps {
  /** 显示的日期（YYYY-MM-DD），默认今天 */
  dateKey?: string;
  /** 点击记录 → 编辑 */
  onPickRecord?: (recordId: string) => void;
  /** 长按记录 */
  onLongPressRecord?: (recordId: string) => void;
  /** 显示今日合计（默认 true） */
  showSummary?: boolean;
}

export function TodayRecordsList({
  dateKey,
  onPickRecord,
  onLongPressRecord,
  showSummary = true,
}: TodayRecordsListProps) {
  const records = useAccountStore((s) => s.records);
  const categories = useAccountStore((s) => s.categories);

  const today = useMemo(() => dateKey ?? getTodayKey(), [dateKey]);

  const todayRecords = useMemo(
    () => records
      .filter((r) => r.dateKey === today)
      .sort((a, b) => b.createdAt - a.createdAt),
    [records, today],
  );

  const income = useMemo(() => sumIncome(todayRecords), [todayRecords]);
  const expense = useMemo(() => sumExpense(todayRecords), [todayRecords]);

  if (todayRecords.length === 0) {
    return (
      <div className={styles.section}>
        {showSummary && (
          <div className={styles.head}>
            <span className={styles.title}>今日记录</span>
          </div>
        )}
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📒</span>
          <span className={styles.emptyText}>还没有记录</span>
          <span className={styles.emptyHint}>点击上方快速记一笔</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <span className={styles.title}>今日记录</span>
        <span className={styles.summary}>
          <span className={styles.summaryIncome}>+¥{formatAmount(income)}</span>
          <span className={styles.expense}>-¥{formatAmount(expense)}</span>
        </span>
      </div>

      <div className={styles.list}>
        {todayRecords.map((record) => {
          const cat = categories.find((c) => c.id === record.categoryId);
          return (
            <RecordRow
              key={record.id}
              record={record}
              categoryIcon={cat?.icon ?? '❓'}
              categoryName={cat?.name ?? '未知'}
              onPick={onPickRecord}
              onLongPress={onLongPressRecord}
            />
          );
        })}
      </div>
    </div>
  );
}

interface RecordRowProps {
  record: AccountRecord;
  categoryIcon: string;
  categoryName: string;
  onPick?: (id: string) => void;
  onLongPress?: (id: string) => void;
}

function RecordRow({ record, categoryIcon, categoryName, onPick, onLongPress }: RecordRowProps) {
  const handleTouchStart = () => {
    const id = setTimeout(() => onLongPress?.(record.id), 500);
    (window as { __longPressTimer?: ReturnType<typeof setTimeout> }).__longPressTimer = id;
  };
  const handleTouchEnd = () => {
    const id = (window as { __longPressTimer?: ReturnType<typeof setTimeout> }).__longPressTimer;
    if (id) clearTimeout(id);
  };

  return (
    <button
      className={styles.row}
      onClick={() => onPick?.(record.id)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <span className={styles.icon}>{categoryIcon}</span>
      <div className={styles.info}>
        <span className={styles.name}>
          {record.note?.trim() || categoryName}
          {record.isUncategorized && (
            <span className={styles.unassignTag}>未分类</span>
          )}
          {record.poolStatus === 'virtual' && (
            <span className={styles.virtualTag}>虚拟</span>
          )}
        </span>
        <span className={styles.sub}>
          {categoryName} · {formatTime(record.createdAt)}
        </span>
      </div>
      <span className={`${styles.amount} ${record.type === 'income' ? styles.income : styles.expense}`}>
        {record.type === 'income' ? '+' : '-'}¥{formatAmount(Math.abs(record.amount))}
      </span>
    </button>
  );
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
