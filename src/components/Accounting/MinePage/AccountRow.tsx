/**
 * AccountRow — 总资产卡内横向账户卡片行（v2.4 · TASK-040 T-401/T-402）
 *
 * 横向排列多张账户小卡（可滚动），末尾「+」卡新增；
 * 点小卡进编辑弹窗，删除入口在弹窗内。
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount } from '../../../lib/accounting';
import type { Account } from '../../../lib/types';
import { AddAccountModal } from './AddAccountModal';
import styles from './MinePage.module.css';

export function AccountRow() {
  const accounts = useAccountStore((s) => s.accounts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  return (
    <div className={styles.accountRow}>
      {[...accounts]
        .sort((a, b) => a.order - b.order)
        .map((acc) => (
          <button
            key={acc.id}
            type="button"
            className={styles.accountMini}
            onClick={() => {
              setEditing(acc);
              setModalOpen(true);
            }}
          >
            <span className={styles.accountMiniTop}>
              <span className={styles.accountDot} style={{ background: acc.color }} />
              <span className={styles.accountName}>{acc.name}</span>
            </span>
            <span className={styles.accountBalance}>¥{formatAmount(acc.balance)}</span>
          </button>
        ))}

      <button
        type="button"
        className={styles.addMini}
        aria-label="添加账户"
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      >
        +
      </button>

      <AddAccountModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
    </div>
  );
}
