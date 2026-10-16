/**
 * @fileoverview AccountDetailPage — 每账户详情页(v3.0 TASK-057 T-576)
 *
 * 入口:开启钱包时,MinePage AccountRow 横向小卡点击 → 全屏页。
 *
 * 结构(对齐 CategoryRecordsPage 视觉):
 * - 顶部余额卡(墨黑大卡,跟 MinePage TotalAssetsCard 一致)
 * - 记录列表(按月分组,每行点击编辑)
 * - 底部「+ 记一笔」快捷按钮(打开 AddRecordModal,默认账户 = 该账户)
 *
 * 关闭钱包时此页不可访问(MinePage AccountRow 不渲染)。
 * 仅展示该账户关联的 records(accountId === accountId),
 * 排除池逐日虚拟记录(本就无 accountId 关联)。
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord } from '../../../lib/types';
import { formatAmount } from '../../../lib/accounting';
import { IconByKey } from '../../IconByKey';
import { AddRecordModal } from '../AddRecordModal';
import styles from './AccountDetailPage.module.css';

interface AccountDetailPageProps {
  /** 账户 ID */
  accountId: string;
  onBack: () => void;
}

export function AccountDetailPage({ accountId, onBack }: AccountDetailPageProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const records = useAccountStore((s) => s.records);
  const categories = useAccountStore((s) => s.categories);
  const account = accounts.find((a) => a.id === accountId);

  const [editing, setEditing] = useState<AccountRecord | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // 该账户关联的记录(排除池逐日虚拟)
  const accountRecords = useMemo(() => {
    return records
      .filter((r) => r.accountId === accountId && r.poolStatus !== 'virtual')
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.createdAt - a.createdAt);
  }, [records, accountId]);

  const totalCount = accountRecords.length;
  // 净流 = Σ amount(支出负 / 收入正),用于副标题
  const netFlow = accountRecords.reduce((sum, r) => sum + r.amount, 0);

  // 按月分组
  const monthGroups = useMemo(() => {
    const map = new Map<string, AccountRecord[]>();
    for (const r of accountRecords) {
      const key = r.dateKey.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [accountRecords]);

  if (!account) return null;

  return (
    <section className={styles.page} aria-label={`${account.name}账户详情`}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="返回">
          ‹
        </button>
        <span className={styles.title}>{account.name}</span>
      </div>

      <div className={styles.balanceCard}>
        <div className={styles.balanceLabel}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: account.color,
              display: 'inline-block',
            }}
            aria-hidden
          />
          <span>账户余额</span>
        </div>
        <div className={styles.balanceAmount}>¥{formatAmount(account.balance, true)}</div>
        <div className={styles.balanceMeta}>
          {totalCount} 笔 · 净流 {netFlow >= 0 ? '+' : '−'}¥{formatAmount(Math.abs(netFlow))}
        </div>
      </div>

      {monthGroups.length === 0 ? (
        <div className={styles.empty}>
          <span>暂无记录</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>点击下方「+ 记一笔」添加</span>
        </div>
      ) : (
        <div className={styles.list}>
          {monthGroups.map(([monthKey, items]) => {
            const monthTotal = items.reduce((sum, r) => sum + r.amount, 0);
            return (
              <div key={monthKey} className={styles.monthGroup}>
                <div className={styles.monthHead}>
                  <span>{formatMonthLabel(monthKey)}</span>
                  <span>
                    {monthTotal >= 0 ? '+' : '−'}¥{formatAmount(Math.abs(monthTotal))}
                  </span>
                </div>
                {items.map((record) => {
                  const cat = categories.find((c) => c.id === record.categoryId);
                  const icon = record.isUncategorized ? 'no' : (cat?.icon ?? '❓');
                  const color = record.isUncategorized
                    ? 'var(--muted)'
                    : (cat?.color ?? 'var(--muted)');
                  const name = record.isUncategorized
                    ? '未分类'
                    : (cat?.name ?? '未知分类');
                  const isExpense = record.type === 'expense';
                  return (
                    <button
                      key={record.id}
                      type="button"
                      className={styles.row}
                      onClick={() => setEditing(record)}
                    >
                      <span className={styles.rowIcon} style={{ background: color }}>
                        <IconByKey icon={icon} size={14} weight="regular" color="#fff" />
                      </span>
                      <span className={styles.rowInfo}>
                        <span className={styles.rowName}>
                          {record.note?.trim() || name}
                        </span>
                        <span className={styles.rowSub}>{formatDayLabel(record.dateKey)}</span>
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
            );
          })}
        </div>
      )}

      <div className={styles.addBtnWrap}>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setAddOpen(true)}
        >
          + 记一笔
        </button>
      </div>

      <AddRecordModal
        open={editing !== null || addOpen}
        editingRecord={editing}
        defaultDate={getTodayKey()}
        defaultAccountId={accountId}
        onClose={() => {
          setEditing(null);
          setAddOpen(false);
        }}
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

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
