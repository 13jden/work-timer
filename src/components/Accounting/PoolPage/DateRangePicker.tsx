/**
 * @fileoverview DateRangePicker — 日历范围选择器（v2.3 · TASK-039）
 *
 * 建池弹窗内联日历，点选完整日期范围（YYYY-MM-DD，可跨月）。
 * 交互：第一次点选起点，第二次点选终点（早于起点则重新起点）。
 */
import { useState } from 'react';
import { getCurrentMonthKey } from '../../../lib/accounting';
import { daysInMonth } from '../../../lib/accounting/pool';
import styles from './PoolPage.module.css';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface DateRangePickerProps {
  /** 'YYYY-MM-DD' */
  start: string | null;
  end: string | null;
  onPick: (start: string | null, end: string | null) => void;
}

/** 日历范围选择器。 */
export function DateRangePicker({ start, end, onPick }: DateRangePickerProps) {
  const [viewMonth, setViewMonth] = useState(() =>
    start ? start.slice(0, 7) : getCurrentMonthKey(),
  );

  const handlePick = (dateKey: string) => {
    if (!start || (start && end)) {
      onPick(dateKey, null);
    } else if (dateKey < start) {
      onPick(dateKey, null);
    } else {
      onPick(start, dateKey);
    }
  };

  /** 判断某日期是否在已选范围内（用于高亮） */
  const inRange = (dateKey: string): boolean => {
    if (!start) return false;
    if (!end) return dateKey === start;
    return dateKey >= start && dateKey <= end;
  };

  const isEdge = (dateKey: string): boolean => dateKey === start || dateKey === end;

  // 月历格子（周一起点）
  const [y, m] = viewMonth.split('-').map(Number);
  const daysCount = daysInMonth(viewMonth);
  const leading = (new Date(y ?? 2026, (m ?? 1) - 1, 1).getDay() + 6) % 7;
  const cells: Array<string | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysCount }, (_, i) =>
      `${viewMonth}-${String(i + 1).padStart(2, '0')}`,
    ),
  ];

  return (
    <div className={styles.picker}>
      <div className={styles.pickerNav}>
        <button
          type="button"
          className={styles.pickerNavBtn}
          onClick={() => setViewMonth(shiftMonthLocal(viewMonth, -1))}
          aria-label="上个月"
        >
          ‹
        </button>
        <span className={styles.pickerTitle}>
          {y}年{m}月
        </span>
        <button
          type="button"
          className={styles.pickerNavBtn}
          onClick={() => setViewMonth(shiftMonthLocal(viewMonth, 1))}
          aria-label="下个月"
        >
          ›
        </button>
      </div>
      <div className={styles.pickerWeekdays}>
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className={styles.pickerGrid}>
        {cells.map((key, idx) => {
          if (!key) return <span key={`blank-${idx}`} />;
          const cls = [
            styles.pickerCell,
            inRange(key) ? styles.pickerCellRange : '',
            isEdge(key) ? styles.pickerCellEdge : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={key} type="button" className={cls} onClick={() => handlePick(key)}>
              {parseInt(key.slice(8), 10)}
            </button>
          );
        })}
      </div>
      <div className={styles.pickerHint}>
        {start && end
          ? `${start} ~ ${end}`
          : start
            ? `${start} ~ ？（点击结束日期）`
            : '点击选择开始日期'}
      </div>
    </div>
  );
}

function shiftMonthLocal(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
