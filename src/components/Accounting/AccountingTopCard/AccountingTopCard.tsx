/**
 * AccountingTopCard — 会计模式深色大卡
 *
 * 替代 TimerCard 在骨架中的位置。结构/尺寸/视觉与 TimerCard 完全一致：
 * - 顶部 status 行（带绿点）
 * - 中部大数字（本月结余）
 * - 底部 shift 进度条 + 目标百分比 — 与 TimerCard 的 SHIFT 进度条同位置
 * - 底部 range 两角（本月收入 / 本月支出）
 *
 * v2.1 重构：
 * - 结余目标行从「顶部位置」移到「本月结余下方」(与 TimerCard 的 SHIFT 一致)
 * - 原位替换 TimerCard（同一 .timerWrap 容器，骨架尺寸不变）
 *
 * v2.5-patch2 T-507：结余目标值从 useMonthlyGoalStore 读取(原 props 默认 12000,
 * 完全独立)。未设置(null)时退化为 12000 默认值，保持原有视觉。
 */
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount, sumExpense, sumIncome, getCurrentMonthKey, visibleRecords } from '../../../lib/accounting';
import { useMonthlyGoalStore } from '../../../store/monthlyGoalStore';
import { Target } from '@phosphor-icons/react';
import styles from './AccountingTopCard.module.css';

export function AccountingTopCard() {
  const records = useAccountStore((s) => s.records);
  const monthlyGoal = useMonthlyGoalStore((s) => s.monthlyGoal);
  const effectiveGoal = monthlyGoal ?? 12000;

  const monthKey = getCurrentMonthKey();
  const monthRecords = useMemo(
    // v2.3：虚拟池预扣不计入默认结余（统计页可开关）
    () => visibleRecords(records).filter((r) => r.dateKey.startsWith(monthKey)),
    [records, monthKey],
  );

  const income = useMemo(() => sumIncome(monthRecords), [monthRecords]);
  const expense = useMemo(() => sumExpense(monthRecords), [monthRecords]);
  const balance = income - expense;
  const pct = Math.max(0, Math.min(100, (balance / effectiveGoal) * 100));

  return (
    <div className={styles.card}>
      <div className={styles.status}>
        <span className={styles.dot} />
        <span>记账中 · {monthKey.split('-')[1]} 月</span>
      </div>

      {/* 大数字 — 本月结余 */}
      <div className={styles.display}>
        ¥{formatAmount(balance, true)}
      </div>
      <div className={styles.label}>本月结余 · 含虚拟池</div>

      {/* 目标进度行 — 移到「本月结余」下方,与 TimerCard 的 SHIFT 进度条位置一致 */}
      <div className={styles.shift}>
        <div className={styles.shiftLeft}>
          <Target size={11} weight="duotone" />
          <strong>本月结余目标 ¥{effectiveGoal.toLocaleString()}</strong>
        </div>
        <span className={styles.pct}>{Math.floor(pct)}%</span>
      </div>
      <div className={styles.progress}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>

      {/* 底部两角 — 本月收入 / 本月支出 */}
      <div className={styles.range}>
        <span>本月收入 ¥{formatAmount(income)}</span>
        <span>本月支出 ¥{formatAmount(expense)}</span>
      </div>
    </div>
  );
}