/**
 * AccountRow — 总资产卡内横向账户卡片行（v2.4 · TASK-040 T-401/T-402 + v3.0 · TASK-057 T-576）
 *
 * 横向排列多张账户小卡（可滚动），末尾「+」卡新增；
 * 点小卡进编辑弹窗（MINE 页 v2.4 行为）；v3.0 起也支持点击进入每账户详情页（onPickAccount）。
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount } from '../../../lib/accounting';
import type { Account } from '../../../lib/types';
import { AddAccountModal } from './AddAccountModal';
import styles from './MinePage.module.css';

interface AccountRowProps {
  /** v3.0 TASK-057：点击账户小卡进入 AccountDetailPage。不传则走 v2.4 编辑弹窗流程 */
  onPickAccount?: (accountId: string) => void;
}

export function AccountRow({ onPickAccount }: AccountRowProps = {}) {
  const accounts = useAccountStore((s) => s.accounts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const handlePick = (acc: Account) => {
    if (onPickAccount) {
      onPickAccount(acc.id);
    } else {
      setEditing(acc);
      setModalOpen(true);
    }
  };

  return (
    <div className={styles.accountRow}>
      {[...accounts]
        .sort((a, b) => a.order - b.order)
        .map((acc) => (
          <button
            key={acc.id}
            type="button"
            className={styles.accountMini}
            onClick={() => handlePick(acc)}
          >
            <span className={styles.accountMiniTop}>
              <span className={styles.accountDot} style={{ background: acc.color }} />
              <span className={styles.accountName}>{acc.name}</span>
            </span>
            <span className={styles.accountBalance}>¥{formatAmount(acc.balance, true)}</span>
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
