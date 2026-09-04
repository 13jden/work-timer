/**
 * @fileoverview AccountingCalendar — 记账月历（v2.2 · TASK-038）
 *
 * 月历格子总览每日净额（收-支），今天高亮描边，月份左右切换；
 * 点击某天弹出 DayDetailSheet 日详情。
 * 新建组件，不复用/不改动计时主题的 CalendarPage。
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import {
  filterByRange,
  aggregateByDay,
  sumRecords,
  shiftMonth,
} from '../../../lib/accounting/stats';
import { formatAmount, getCurrentMonthKey, getTodayKey } from '../../../lib/accounting';
import { DayDetailSheet } from '../DayDetailSheet';
import styles from './AccountingCalendar.module.css';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/** 记账日历页（记账主题 tab 2）。 */
export function AccountingCalendar() {
  const records = useAccountStore((s) => s.records);
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monthRecords = useMemo(
    () => filterByRange(records, `${monthKey}-01`, `${monthKey}-31`),
    [records, monthKey],
  );
  const byDay = useMemo(() => aggregateByDay(monthRecords), [monthRecords]);
  const summary = useMemo(() => sumRecords(monthRecords), [monthRecords]);

  const cells = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    const year = y ?? 2026;
    const month = m ?? 1;
    const daysCount = new Date(year, month, 0).getDate();
    // 周一为一周起点：周日(0) → 6，周一(1) → 0
    const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const list: Array<{ dateKey: string; day: number } | null> = Array.from(
      { length: leading },
      () => null,
    );
    for (let d = 1; d <= daysCount; d += 1) {
      list.push({ dateKey: `${monthKey}-${String(d).padStart(2, '0')}`, day: d });
    }
    return list;
  }, [monthKey]);

  const todayKey = getTodayKey();
  const [titleYear, titleMonth] = monthKey.split('-');

  return (
    <div className={styles.page}>
      <div className={styles.monthNav}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
          aria-label="上个月"
        >
          ‹
        </button>
        <span className={styles.monthTitle}>
          {titleYear}年{parseInt(titleMonth ?? '1', 10)}月
        </span>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
          aria-label="下个月"
        >
          ›
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.weekdays}>
          {WEEKDAYS.map((w) => (
            <span key={w} className={styles.weekday}>
              {w}
            </span>
          ))}
        </div>
        <div className={styles.cells}>
          {cells.map((cell, idx) => {
            if (!cell) return <span key={`blank-${idx}`} />;
            const slot = byDay.get(cell.dateKey);
            const hasRecords = slot !== undefined;
            const net = (slot?.income ?? 0) - (slot?.expense ?? 0);
            const cls = [
              styles.cell,
              hasRecords ? styles.cellFilled : '',
              cell.dateKey === todayKey ? styles.cellToday : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={cell.dateKey}
                type="button"
                className={cls}
                onClick={() => setSelectedDay(cell.dateKey)}
              >
                <span className={styles.cellDay}>{cell.day}</span>
                {hasRecords && net !== 0 && (
                  <span
                    className={`${styles.cellAmt} ${
                      net < 0 ? styles.amtExpense : styles.amtIncome
                    }`}
                  >
                    {net < 0 ? '-' : '+'}
                    {formatAmount(Math.abs(net))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerTitle}>本月小结</span>
        <span className={styles.footerStats}>
          <span className={styles.footerExpense}>支出 ¥{formatAmount(summary.expense)}</span>
          <span className={styles.footerIncome}>收入 ¥{formatAmount(summary.income)}</span>
        </span>
      </div>

      <DayDetailSheet dateKey={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  );
}
