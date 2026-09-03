/**
 * AddRecordModal — 完整添加 / 编辑记录弹窗
 *
 * 底部半屏模态框，支持：
 * - 金额输入（大字号）
 * - 类型切换（支出 / 收入）
 * - 分类选择（chip 列表）
 * - 备注输入
 * - 日期选择
 * - 账户选择
 *
 * 模式：
 * - add：添加新记录
 * - edit：编辑现有记录
 */
import { useEffect, useState, useRef, useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord, RecordType } from '../../../lib/types';
import { IconByKey } from '../../IconByKey';
import styles from './AddRecordModal.module.css';

interface AddRecordModalProps {
  open: boolean;
  /** 编辑模式：传入要编辑的记录 */
  editingRecord?: AccountRecord | null;
  /** 默认日期（YYYY-MM-DD） */
  defaultDate?: string;
  /** 默认类型 */
  defaultType?: RecordType;
  onClose: () => void;
  /** 保存成功 */
  onSaved?: (recordId: string) => void;
}

export function AddRecordModal({
  open,
  editingRecord,
  defaultDate,
  defaultType,
  onClose,
  onSaved,
}: AddRecordModalProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const categories = useAccountStore((s) => s.categories);
  const addRecord = useAccountStore((s) => s.addRecord);
  const updateRecord = useAccountStore((s) => s.updateRecord);
  const deleteRecord = useAccountStore((s) => s.deleteRecord);

  // 表单状态
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<RecordType>(defaultType ?? 'expense');
  const [categoryId, setCategoryId] = useState<string>('');
  const [note, setNote] = useState('');
  const [dateKey, setDateKey] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // 初始化表单
  useEffect(() => {
    if (!open) return;
    if (editingRecord) {
      setAmountStr(String(Math.abs(editingRecord.amount)));
      setType(editingRecord.type);
      setCategoryId(editingRecord.categoryId);
      setNote(editingRecord.note ?? '');
      setDateKey(editingRecord.dateKey);
      setAccountId(editingRecord.accountId);
    } else {
      setAmountStr('');
      setType(defaultType ?? 'expense');
      setCategoryId('');
      setNote('');
      setDateKey(defaultDate ?? getTodayKey());
      setAccountId(accounts[0]?.id ?? '');
    }
    setError(null);
    const id = setTimeout(() => amountRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, [open, editingRecord, defaultDate, defaultType, accounts]);

  // 过滤当前类型下的分类
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  // 类型切换时重置分类选择
  useEffect(() => {
    if (!categoryId || !filteredCategories.find((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ?? '');
    }
  }, [type, filteredCategories, categoryId]);

  const handleSave = () => {
    const amount = parseFloat(amountStr);
    if (!isFinite(amount) || amount <= 0) {
      setError('请输入有效金额');
      return;
    }
    if (!categoryId) {
      setError('请选择分类');
      return;
    }
    if (!accountId) {
      setError('请选择账户');
      return;
    }

    // 支出存负数，收入存正数
    const signedAmount = type === 'expense' ? -amount : amount;

    if (editingRecord) {
      updateRecord(editingRecord.id, {
        amount: signedAmount,
        type,
        categoryId,
        note: note.trim() || undefined,
        dateKey,
        accountId,
      });
      onSaved?.(editingRecord.id);
    } else {
      const record = addRecord({
        dateKey,
        amount: signedAmount,
        type,
        categoryId,
        note: note.trim() || undefined,
        accountId,
      });
      onSaved?.(record.id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingRecord) return;
    if (!window.confirm('确定删除这条记录？')) return;
    deleteRecord(editingRecord.id);
    onSaved?.(editingRecord.id);
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
          <div className={styles.title}>
            {editingRecord ? '编辑记录' : '记一笔'}
          </div>
          <div className={styles.placeholder} />
        </div>

        {/* Type Toggle */}
        <div className={styles.typeToggle}>
          <button
            className={`${styles.typeBtn} ${type === 'expense' ? styles.typeBtnActive : ''}`}
            onClick={() => setType('expense')}
          >
            支出
          </button>
          <button
            className={`${styles.typeBtn} ${type === 'income' ? styles.typeBtnActive : ''}`}
            onClick={() => setType('income')}
          >
            收入
          </button>
        </div>

        {/* Amount */}
        <div className={styles.amountWrap}>
          <span className={styles.currency}>¥</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className={styles.amountInput}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {/* Category */}
        <div className={styles.catGrid}>
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              className={`${styles.catChip} ${categoryId === cat.id ? styles.catChipActive : ''}`}
              onClick={() => setCategoryId(cat.id)}
              style={{ backgroundColor: categoryId === cat.id ? cat.color : undefined }}
            >
              <span className={styles.catIcon}>
                <IconByKey icon={cat.icon} size={16} color={categoryId === cat.id ? '#fff' : cat.color} />
              </span>
              <span className={styles.catName}>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>备注</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="选填"
              maxLength={50}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>日期</label>
              <input
                type="date"
                className={styles.fieldInput}
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>账户</label>
              <select
                className={styles.fieldInput}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* Actions */}
        <div className={styles.actions}>
          {editingRecord && (
            <button
              className={styles.deleteBtn}
              onClick={handleDelete}
              aria-label="删除记录"
            >
              删除
            </button>
          )}
          <button
            className={styles.submitBtn}
            onClick={handleSave}
          >
            {editingRecord ? '保存' : '记一笔'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
