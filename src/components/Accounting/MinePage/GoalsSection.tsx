/**
 * GoalsSection — 月度目标区（v2.5-patch2 T-507）
 *
 * 单值目标（结余目标），与 AccountingTopCard 显示的「本月结余目标」共享同一个值。
 * 数据源：useMonthlyGoalStore.monthlyGoal（与 time 模式月度收入目标同 store，
 * 但语义在 accounting 侧展示为「结余目标」）。
 *
 * - 点卡片或 ✎ 按钮 → 输入金额，保存即同步给首页大卡
 * - 未设置(null) → 卡片显示「点击设置结余目标」
 * - 不再有多目标 / 进度 / 截止日期概念
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { useMonthlyGoalStore } from '../../../store/monthlyGoalStore';
import { formatAmount } from '../../../lib/accounting';
import styles from './MinePage.module.css';

const DEFAULT_GOAL = 12000;

export function GoalsSection() {
  const records = useAccountStore((s) => s.records);
  const monthlyGoal = useMonthlyGoalStore((s) => s.monthlyGoal);
  const setMonthlyGoal = useMonthlyGoalStore((s) => s.setGoal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const effectiveGoal = monthlyGoal ?? DEFAULT_GOAL;

  // 当前结余 = 本月收入 - 本月支出（仅 expense/income 主线，不含虚拟池预扣）
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthRecords = records.filter((r) => r.dateKey.startsWith(monthKey));
  const balance = monthRecords.reduce((sum, r) => sum + r.amount, 0);
  const pct = Math.max(0, Math.min(100, (balance / effectiveGoal) * 100));

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
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>月度目标</div>
        <button type="button" className={styles.addBtn} onClick={openEdit}>
          {monthlyGoal != null ? '编辑' : '设置'}
        </button>
      </div>

      <button type="button" className={styles.goalCard} onClick={openEdit}>
        <div className={styles.goalTop}>
          <span className={styles.goalName}>本月结余目标</span>
          {monthlyGoal == null && (
            <span className={`${styles.badge} ${styles.badgeOverdue}`}>未设置</span>
          )}
        </div>

        <div className={styles.goalAmtRow}>
          <span className={styles.goalAmt}>¥{formatAmount(effectiveGoal, true)}</span>
          <span className={styles.goalAmtLabel}>
            当前 ¥{formatAmount(balance, true)} · {Math.floor(pct)}%
          </span>
        </div>

        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>

        <div className={styles.goalMeta}>
          <span>{monthlyGoal == null ? '点击设置 · 默认 ¥12,000' : '点击调整'}</span>
          <span>与首页结余同步</span>
        </div>
      </button>

      {editing && (
        <div className={styles.goalEditOverlay} onClick={() => setEditing(false)}>
          <div className={styles.goalEditModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.goalEditTitle}>本月结余目标</div>
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
    </section>
  );
}
