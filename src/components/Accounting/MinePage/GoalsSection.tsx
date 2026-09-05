/**
 * GoalsSection — 结余目标（v2.5-patch5 N-485 redesign）
 *
 * 视觉设计：
 * - 黑底英雄卡（与上方 TotalAssetsCard 同源 → 视觉延续）
 * - 巨型数字（display font, 44px, tabular-nums）作为视觉重心
 * - 11px mono uppercase eyebrow + 副标，键盘节奏感
 * - 右上角 ✎ 极简图标做编辑入口（无文字"编辑"按钮，节省视觉重量）
 * - 底部 1px accent 极细线，提示「目标」性质
 * - 数字与下方水平线呼应：目标是个锚点
 *
 * 数据流：
 * - 数据源 useMonthlyGoalStore.monthlyGoal
 * - 点卡片或 ✎ → 弹小窗编辑，保存即同步给首页大卡
 * - 未设置(null) → 卡片显示默认 12000 与「点击设置」提示
 */
import { useState } from 'react';
import { PencilSimple } from '@phosphor-icons/react';
import { useMonthlyGoalStore } from '../../../store/monthlyGoalStore';
import { formatAmount } from '../../../lib/accounting';
import styles from './MinePage.module.css';

const DEFAULT_GOAL = 12000;

export function GoalsSection() {
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
    <section className={styles.section}>
      <button type="button" className={styles.goalHeroCard} onClick={openEdit}>
        <div className={styles.goalHeroEyebrowRow}>
          <span className={styles.goalHeroEyebrow}>GOAL · 月度</span>
          <span className={styles.goalHeroEdit} aria-label="编辑结余目标" title="编辑">
            <PencilSimple size={14} weight="regular" />
          </span>
        </div>

        <div className={styles.goalHeroLabel}>结余目标</div>

        <div className={styles.goalHeroAmt}>¥{formatAmount(effectiveGoal, true)}</div>

        <div className={styles.goalHeroFooter}>
          <span className={styles.goalHeroHint}>
            {isUnset ? '点击设置 · 默认 ¥12,000' : '点击调整目标'}
          </span>
          <span className={styles.goalHeroSlash} aria-hidden />
        </div>
      </button>

      {editing && (
        <div className={styles.goalEditOverlay} onClick={() => setEditing(false)}>
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
    </section>
  );
}
