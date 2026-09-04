/**
 * @fileoverview CategoryRecordsPage — 分类记录页（v2.2 · TASK-038）
 *
 * 展示某分类的全部记录（按时间倒序、按月分组），顶部大图标 + 累计金额，
 * 支持月份筛选。入口：统计页分类排行 / CategoryDetailPanel「查看全部记录」。
 * 未分类虚拟分类（UNCATEGORIZED_ID）展示 isUncategorized 的记录。
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord, RecordType } from '../../../lib/types';
import { UNCATEGORIZED_ID } from '../../../lib/accounting/stats';
import { formatAmount } from '../../../lib/accounting';
import { IconByKey } from '../../IconByKey';
import { AddRecordModal } from '../AddRecordModal';
import styles from './CategoryRecordsPage.module.css';

interface CategoryRecordsPageProps {
  /** 分类 ID，或 UNCATEGORIZED_ID（未分类虚拟分类） */
  categoryId: string;
  /** 记录类型（排行所选的支出/收入方向） */
  type: RecordType;
  onBack: () => void;
}

/** 分类记录页：全屏 overlay，内含月份筛选与记录编辑。 */
export function CategoryRecordsPage({ categoryId, type, onBack }: CategoryRecordsPageProps) {
  const records = useAccountStore((s) => s.records);
  const categories = useAccountStore((s) => s.categories);
  const accounts = useAccountStore((s) => s.accounts);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [editing, setEditing] = useState<AccountRecord | null>(null);

  const isUncat = categoryId === UNCATEGORIZED_ID;
  const category = categories.find((c) => c.id === categoryId);
  const name = isUncat ? '未分类' : (category?.name ?? '未知分类');
  const icon = isUncat ? 'package' : (category?.icon ?? '❓');
  const color = isUncat ? 'var(--muted)' : (category?.color ?? 'var(--muted)');

  const allRecords = useMemo(() => {
    return records
      .filter((r) => r.type === type && r.poolStatus !== 'virtual')
      .filter((r) =>
        isUncat ? r.isUncategorized === true : r.categoryId === categoryId && !r.isUncategorized,
      );
  }, [records, categoryId, type, isUncat]);

  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(allRecords.map((r) => r.dateKey.slice(0, 7))));
    return keys.sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  const visible = useMemo(() => {
    const list =
      monthFilter === 'all'
        ? allRecords
        : allRecords.filter((r) => r.dateKey.startsWith(monthFilter));
    return [...list].sort(
      (a, b) => b.dateKey.localeCompare(a.dateKey) || b.createdAt - a.createdAt,
    );
  }, [allRecords, monthFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, AccountRecord[]>();
    for (const r of visible) {
      const key = r.dateKey.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  const total = visible.reduce((sum, r) => sum + Math.abs(r.amount), 0);

  return (
    <section className={styles.page} aria-label={`${name}全部记录`}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="返回">
          ‹
        </button>
        <span className={styles.title}>{name}</span>
      </div>

      <div className={styles.summary}>
        <div className={styles.bigIcon} style={{ background: color }}>
          <IconByKey icon={icon} size={26} color="#fff" />
        </div>
        <div className={styles.amount}>¥{formatAmount(total)}</div>
        <div className={styles.meta}>
          {monthFilter === 'all' ? '累计' : formatMonthLabel(monthFilter)} · {visible.length} 笔
        </div>
      </div>

      <div className={styles.filterRow}>
        <button
          type="button"
          className={`${styles.filterChip} ${monthFilter === 'all' ? styles.filterChipActive : ''}`}
          onClick={() => setMonthFilter('all')}
        >
          全部
        </button>
        {monthOptions.map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.filterChip} ${monthFilter === key ? styles.filterChipActive : ''}`}
            onClick={() => setMonthFilter(key)}
          >
            {formatMonthLabel(key)}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className={styles.empty}>还没有{name}记录</div>
      ) : (
        <div className={styles.list}>
          {groups.map(([monthKey, items]) => {
            const monthTotal = items.reduce((sum, r) => sum + Math.abs(r.amount), 0);
            return (
              <div key={monthKey} className={styles.monthGroup}>
                <div className={styles.monthHead}>
                  <span>{formatMonthLabel(monthKey)}</span>
                  <span>¥{formatAmount(monthTotal)}</span>
                </div>
                {items.map((record) => {
                  const account = accounts.find((a) => a.id === record.accountId);
                  return (
                    <button
                      key={record.id}
                      type="button"
                      className={styles.row}
                      onClick={() => setEditing(record)}
                    >
                      <span className={styles.rowInfo}>
                        <span className={styles.rowName}>{record.note?.trim() || name}</span>
                        <span className={styles.rowSub}>
                          {formatDayLabel(record.dateKey)} · {account?.name ?? '未知账户'}
                        </span>
                      </span>
                      <span
                        className={`${styles.rowAmt} ${
                          type === 'expense' ? styles.amtExpense : styles.amtIncome
                        }`}
                      >
                        {type === 'expense' ? '-' : '+'}¥{formatAmount(Math.abs(record.amount))}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <AddRecordModal
        open={editing !== null}
        editingRecord={editing}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

function formatMonthLabel(monthKey: string): string {
  const [year, month = '1'] = monthKey.split('-');
  return `${year}年${parseInt(month, 10)}月`;
}

function formatDayLabel(dateKey: string): string {
  const parts = dateKey.split('-');
  return `${parseInt(parts[1] ?? '1', 10)}月${parseInt(parts[2] ?? '1', 10)}日`;
}
