/**
 * MonthIncomeProgress — 桌面端侧边栏左下角月度收入进度
 *
 * v1.3.4-patch1 新增:
 *   - 展开态:显示「本月已赚 / 月度目标」+ 主题色进度条 + 百分比
 *   - 收起态:只显示小圆环,中心百分比
 *   - 未设置目标:显示「设置月度目标」chip + 点击打开 SettingsDrawer
 *
 * 计算:
 *   - 已赚 = monthEarnedSoFar(year, month, now, config, overrides, holidays)
 *   - 进度 = min(已赚 / 目标, 1)
 *   - 1 分钟刷新一次(useNow 60_000)
 *
 * 主题色:进度条用 `var(--accent)`,数字用 `var(--ink)`,未达 100% 时高亮显示
 */
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useMonthlyGoalStore } from '../../store/monthlyGoalStore';
import { HOLIDAYS } from '../../lib/constants';
import { monthEarnedSoFar } from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import { Target } from '@phosphor-icons/react';
import styles from './MonthIncomeProgress.module.css';

interface Props {
  /** Sidebar 收起态? */
  collapsed?: boolean;
  /** 点击"设置目标"时调用(由 App.tsx 打开 SettingsDrawer) */
  onOpenSettings?: () => void;
}

function fmtCNY(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function MonthIncomeProgress({ collapsed = false, onOpenSettings }: Props) {
  const now = useNow(60_000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const goal = useMonthlyGoalStore((s) => s.monthlyGoal);

  const year = now.getFullYear();
  const month = now.getMonth();
  const earned = monthEarnedSoFar(year, month, now, config, overrides, HOLIDAYS);

  // ── 收起态:小圆环(无目标时也显示空圆环 + 提示) ──
  if (collapsed) {
    if (goal === null) {
      return (
        <button
          type="button"
          className={styles.ringEmptyBtn}
          onClick={onOpenSettings}
          aria-label="设置月度目标"
          title="设置月度目标"
        >
          <Target size={14} weight="bold" />
        </button>
      );
    }
    const pct = goal > 0 ? Math.min(earned / goal, 1) : 0;
    return (
      <div
        className={styles.progressRingSmall}
        title={`¥${fmtCNY(earned)} / ¥${fmtCNY(goal)}`}
      >
        <svg viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="14" className={styles.ringBg} />
          <circle
            cx="18"
            cy="18"
            r="14"
            className={styles.ringFg}
            strokeDasharray={`${pct * 87.96} 87.96`}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className={styles.ringNum}>{Math.round(pct * 100)}</span>
      </div>
    );
  }

  // ── 展开态 ──
  if (goal === null) {
    return (
      <button
        type="button"
        className={styles.setupCard}
        onClick={onOpenSettings}
        aria-label="设置月度目标"
      >
        <div className={styles.setupIcon}>
          <Target size={12} weight="bold" />
        </div>
        <div className={styles.setupText}>
          <div className={styles.setupEyebrow}>MONTHLY GOAL</div>
          <div className={styles.setupLabel}>设置月度目标</div>
        </div>
      </button>
    );
  }

  const pct = goal > 0 ? Math.min(earned / goal, 1) : 0;
  const pctNum = Math.round(pct * 100);
  const completed = pct >= 1;

  return (
    <div className={styles.block}>
      <div className={styles.eyebrow}>
        本月 · {month + 1}月
        {completed && <span className={styles.doneBadge}>完成 ✓</span>}
      </div>
      <div className={styles.amountRow}>
        <div className={styles.amountMain}>
          <span className={styles.amountCurrency}>¥</span>
          <span className={styles.amountNum}>{fmtCNY(earned)}</span>
        </div>
        <div className={styles.amountGoal}>
          / ¥{fmtCNY(goal)}
        </div>
      </div>
      <div className={styles.bar}>
        <div
          className={`${styles.barFill} ${completed ? styles.barFillDone : ''}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className={styles.hint}>
        {completed
          ? '🎉 恭喜达标!'
          : `已完成 ${pctNum}%`}
      </div>
    </div>
  );
}
