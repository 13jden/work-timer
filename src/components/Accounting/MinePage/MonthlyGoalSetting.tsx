/**
 * @fileoverview MonthlyGoalSetting — 月度结余目标设置项（v3.1 TASK-064）
 *
 * 原 `GoalsSection`（MINE 页上的 GOAL 大卡）下线，改为设置弹层里的一行：
 * 展示当前目标金额 + 「调整」按钮 → 打开编辑弹窗（保存 / 清除 / 取消）。
 *
 * 数据源不变：useMonthlyGoalStore.monthlyGoal（null = 未设置 → 默认 ¥12,000）。
 */
import { useState } from 'react';
import { useMonthlyGoalStore } from '../../../store/monthlyGoalStore';
import { formatAmount } from '../../../lib/accounting';
import styles from './MinePage.module.css';

const DEFAULT_GOAL = 12000;

export function MonthlyGoalSetting() {
  const monthlyGoal = useMonthlyGoalStore((s) => s.monthlyGoal);
  const setMonthlyGoal = useMonthlyGoalStore((s) => s.setGoal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const effectiveGoal = monthlyGoal ?? DEFAULT_GOAL;
  const isUnset = monthlyGoal == null;

  const openEdit = () => {
    setDraft(monthlyGoal != null ? String(monthlyGoal) : String(DEFAULT_GOAL));
    setEditing(true);
  };

  const handleSave = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 0) {
      setEditing(false);
      return;
    }
    setMonthlyGoal(n);
    setEditing(false);
  };

  const handleClear = () => {
    setMonthlyGoal(null);
    setEditing(false);
  };

  return (
    <>
      <div className={styles.goalSetting}>
        <div className={styles.goalSettingLabel}>
          <div className={styles.goalSettingTitle}>月度结余目标</div>
          <div className={styles.goalSettingHint}>
            {isUnset ? '未设置 · 默认 ¥12,000' : '首页大卡按此目标计算进度'}
          </div>
        </div>
        <div className={styles.goalSettingRight}>
          <span className={styles.goalSettingValue}>¥{formatAmount(effectiveGoal, true)}</span>
          <button type="button" className={styles.goalSettingEdit} onClick={openEdit}>
            调整
          </button>
        </div>
      </div>

      {editing && (
        <div
          className={styles.goalEditOverlay}
          onClick={(e) => {
            // 阻止冒泡到设置弹层（否则会连带关闭设置）
            e.stopPropagation();
            setEditing(false);
          }}
        >
          <div className={styles.goalEditModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.goalEditTitle}>结余目标</div>
            <div className={styles.goalEditAmt}>
              <span className={styles.goalEditCurrency}>¥</span>
              <input
                type="number"
                inputMode="decimal"
                step="100"
                min="0"
                className={styles.goalEditInput}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>
            <div className={styles.goalEditActions}>
              <button type="button" className={styles.goalEditClear} onClick={handleClear}>
                清除
              </button>
              <button type="button" className={styles.goalEditCancel} onClick={() => setEditing(false)}>
                取消
              </button>
              <button type="button" className={styles.goalEditSave} onClick={handleSave}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
