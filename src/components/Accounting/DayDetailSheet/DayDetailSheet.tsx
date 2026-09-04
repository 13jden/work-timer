/**
 * @fileoverview DayDetailSheet — 记账日历日详情弹窗（v2.2 · TASK-038）
 *
 * 底部半屏 sheet（结构对齐 AddRecordModal）：
 * - 头部：日期 + 当日总支出/收入
 * - 记录列表：分类图标 + 名称 + 备注 + 金额；点击经 RecordActionSheet 编辑/删除
 * - 底部「+ 记一笔」→ 打开 AddRecordModal 并预填该日期
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord } from '../../../lib/types';
import { sumRecords } from '../../../lib/accounting/stats';
import { formatAmount } from '../../../lib/accounting';
import { IconByKey } from '../../IconByKey';
import { AddRecordModal } from '../AddRecordModal';
import { RecordActionSheet } from '../RecordActionSheet';
import styles from './DayDetailSheet.module.css';

interface DayDetailSheetProps {
  /** 选中日期（YYYY-MM-DD）；null 时关闭 */
  dateKey: string | null;
  onClose: () => void;
}

/** 日历日详情弹窗。 */
export function DayDetailSheet({ dateKey, onClose }: DayDetailSheetProps) {
  const records = useAccountStore((s) => s.records);
  const categories = useAccountStore((s) => s.categories);
  const [actionRecord, setActionRecord] = useState<AccountRecord | null>(null);
  const [editing, setEditing] = useState<AccountRecord | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  if (!dateKey) return null;

  const dayRecords = records
    .filter((r) => r.dateKey === dateKey && r.poolStatus !== 'virtual')
    .sort((a, b) => b.createdAt - a.createdAt);
  const summary = sumRecords(dayRecords);

  const closeEditor = () => {
    setEditing(null);
    setAddOpen(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.head}>
          <span className={styles.title}>{formatDayTitle(dateKey)}</span>
          <span className={styles.headStats}>
            支出 ¥{formatAmount(summary.expense)} · 收入 ¥{formatAmount(summary.income)}
          </span>
        </div>

        {dayRecords.length === 0 ? (
          <div className={styles.empty}>这一天还没有记录</div>
        ) : (
          <div className={styles.list}>
            {dayRecords.map((record) => {
              const category = categories.find((c) => c.id === record.categoryId);
              const name = record.isUncategorized ? '未分类' : (category?.name ?? '未知分类');
              const icon = record.isUncategorized ? 'package' : (category?.icon ?? '❓');
              const color = record.isUncategorized
                ? 'var(--muted)'
                : (category?.color ?? 'var(--muted)');
              const isExpense = record.type === 'expense';
              return (
                <button
                  key={record.id}
                  type="button"
                  className={styles.row}
                  onClick={() => setActionRecord(record)}
                >
                  <span className={styles.rowIcon} style={{ background: color }}>
                    <IconByKey icon={icon} size={16} color="#fff" />
                  </span>
                  <span className={styles.rowInfo}>
                    <span className={styles.rowName}>{name}</span>
                    {record.note?.trim() ? (
                      <span className={styles.rowSub}>{record.note}</span>
                    ) : null}
                  </span>
                  <span
                    className={`${styles.rowAmt} ${
                      isExpense ? styles.amtExpense : styles.amtIncome
                    }`}
                  >
                    {isExpense ? '-' : '+'}¥{formatAmount(Math.abs(record.amount))}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button type="button" className={styles.addBtn} onClick={() => setAddOpen(true)}>
          + 记一笔
        </button>
      </div>

      <RecordActionSheet
        open={actionRecord !== null}
        record={actionRecord}
        onClose={() => setActionRecord(null)}
        onEdit={(recordId) => {
          const target = useAccountStore.getState().records.find((r) => r.id === recordId);
          if (target) setEditing(target);
        }}
      />

      <AddRecordModal
        open={editing !== null || addOpen}
        editingRecord={editing}
        defaultDate={dateKey}
        onClose={closeEditor}
      />
    </div>
  );
}

function formatDayTitle(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${m}月${d}日 · 周${weekdays[date.getDay()]}`;
}
