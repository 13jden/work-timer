/**
 * AddGoalModal — 存钱目标新增 / 编辑弹窗（v2.4 · TASK-040 T-404）
 *
 * 字段：名称 / 目标金额 / 已存入（仅新建可设初始值）/ 截止日期（选填）。
 * 进度由记账时关联目标自动累计，编辑时不可手改进度。
 */
import { useEffect, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { SavingsGoal } from '../../../lib/types';
import styles from './MinePage.module.css';

interface AddGoalModalProps {
  open: boolean;
  editing?: SavingsGoal | null;
  onClose: () => void;
}

export function AddGoalModal({ open, editing, onClose }: AddGoalModalProps) {
  const addSavingsGoal = useAccountStore((s) => s.addSavingsGoal);
  const updateSavingsGoal = useAccountStore((s) => s.updateSavingsGoal);

  const [name, setName] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [currentStr, setCurrentStr] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setTargetStr(String(editing.targetAmount));
      setCurrentStr(String(editing.currentAmount));
      setDeadline(editing.deadline ?? '');
    } else {
      setName('');
      setTargetStr('');
      setCurrentStr('');
      setDeadline('');
    }
    setError(null);
  }, [open, editing]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('请输入目标名称');
      return;
    }
    const target = parseFloat(targetStr);
    if (!isFinite(target) || target <= 0) {
      setError('请输入有效目标金额');
      return;
    }
    if (editing) {
      updateSavingsGoal(editing.id, {
        name: name.trim(),
        targetAmount: target,
        deadline: deadline || undefined,
      });
    } else {
      const current = currentStr.trim() === '' ? 0 : parseFloat(currentStr);
      if (!isFinite(current) || current < 0) {
        setError('已存入金额无效');
        return;
      }
      addSavingsGoal({
        name: name.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: deadline || undefined,
      });
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>{editing ? '编辑目标' : '新建存钱目标'}</div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>名称</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：买相机"
            maxLength={20}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>目标金额（元）</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className={styles.fieldInput}
            value={targetStr}
            onChange={(e) => setTargetStr(e.target.value)}
            placeholder="5000"
          />
        </div>

        {!editing && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>已存入（元 · 选填）</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={styles.fieldInput}
              value={currentStr}
              onChange={(e) => setCurrentStr(e.target.value)}
              placeholder="0"
            />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.fieldLabel}>截止日期（选填）</label>
          <input
            type="date"
            className={styles.fieldInput}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <div className={styles.hint}>
            {editing
              ? '进度由记账时关联本目标自动累计'
              : '之后记账时关联本目标，金额会自动累计进进度'}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
          {editing ? '保存' : '创建'}
        </button>
      </div>
    </div>
  );
}
