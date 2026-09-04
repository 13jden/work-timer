/**
 * AddAccountModal — 账户新增 / 编辑弹窗（v2.4 · TASK-040 T-401）
 *
 * 字段：名称 / 类型（支付宝/微信/银行卡/现金）/ 余额。
 * 颜色随类型自动取 ACCOUNT_TYPE_COLORS。
 */
import { useEffect, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { ACCOUNT_TYPE_COLORS } from '../../../lib/constants';
import type { Account, AccountType } from '../../../lib/types';
import styles from './MinePage.module.css';

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信' },
  { value: 'card', label: '银行卡' },
  { value: 'cash', label: '现金' },
];

/** v2.4：自定义卡片小点颜色 */
const COLOR_OPTIONS = [
  '#1677FF',
  '#07C160',
  '#2D2D2D',
  '#8B8F84',
  '#C04A3A',
  '#FBBF24',
  '#8B5CF6',
  '#EC4899',
];

interface AddAccountModalProps {
  open: boolean;
  editing?: Account | null;
  onClose: () => void;
}

export function AddAccountModal({ open, editing, onClose }: AddAccountModalProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const records = useAccountStore((s) => s.records);
  const addAccount = useAccountStore((s) => s.addAccount);
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const deleteAccount = useAccountStore((s) => s.deleteAccount);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('alipay');
  const [color, setColor] = useState<string>(ACCOUNT_TYPE_COLORS.alipay);
  const [balanceStr, setBalanceStr] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setColor(editing.color);
      setBalanceStr(String(editing.balance));
    } else {
      setName('');
      setType('alipay');
      setColor(ACCOUNT_TYPE_COLORS.alipay);
      setBalanceStr('');
    }
    setError(null);
  }, [open, editing]);

  const handlePickType = (t: AccountType) => {
    setType(t);
    setColor(ACCOUNT_TYPE_COLORS[t]);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('请输入账户名称');
      return;
    }
    const balance = balanceStr.trim() === '' ? 0 : parseFloat(balanceStr);
    if (!isFinite(balance)) {
      setError('请输入有效余额');
      return;
    }
    if (editing) {
      updateAccount(editing.id, {
        name: name.trim(),
        type,
        balance,
        color,
      });
    } else {
      addAccount({
        name: name.trim(),
        type,
        balance,
        color,
        order: accounts.length,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editing) return;
    const count = records.filter((r) => r.accountId === editing.id).length;
    const msg =
      count > 0
        ? `删除账户「${editing.name}」？其下 ${count} 条记录将一并删除，相关目标进度同步回退。`
        : `删除账户「${editing.name}」？`;
    if (!window.confirm(msg)) return;
    deleteAccount(editing.id);
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>{editing ? '编辑账户' : '添加账户'}</div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>名称</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：工资卡"
            maxLength={20}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>类型</label>
          <div className={styles.typeRow}>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.typeOpt} ${type === opt.value ? styles.typeOptActive : ''}`}
                onClick={() => handlePickType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>卡片小点颜色</label>
          <div className={styles.colorRow}>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`颜色 ${c}`}
                className={`${styles.colorDot} ${color === c ? styles.colorDotActive : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>余额（元）</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            className={styles.fieldInput}
            value={balanceStr}
            onChange={(e) => setBalanceStr(e.target.value)}
            placeholder="0.00"
          />
          <div className={styles.hint}>
            {editing ? '修改余额将直接覆盖当前余额；记账仍会自动增减' : '初始余额，之后记账会自动增减'}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
          {editing ? '保存' : '添加'}
        </button>

        {editing && (
          <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
            删除账户
          </button>
        )}
      </div>
    </div>
  );
}
