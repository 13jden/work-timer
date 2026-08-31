/**
 * MiniCalendar — 桌面端右栏用迷你月历（v1.3.4）
 *
 * 行为：
 * - 展示当月日历网格 7×N
 * - 当天高亮
 * - 工作日 / 周末 / 休息日 类型差异
 * - 点击日期 → onPickDate(dateStr)
 *
 * 不做月份切换（仅当月），保持右栏轻量。
 */
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { HOLIDAYS } from '../../lib/constants';
import { isWorkday } from '../../lib/compute';
import { formatDateKey } from '../../lib/time';
import styles from './MiniCalendar.module.css';

interface MiniCalendarProps {
  /** 点击某天时回调（YYYY-MM-DD） */
  onPickDate?: (key: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = [
  '一月','二月','三月','四月','五月','六月',
  '七月','八月','九月','十月','十一月','十二月',
];

export function MiniCalendar({ onPickDate }: MiniCalendarProps) {
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayKey = formatDateKey(today);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>{MONTH_NAMES[month]} · {year}</span>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.weekdayCell}>{d}</span>
        ))}
      </div>

      <div className={styles.days}>
        {Array.from({ length: firstDow }).map((_, i) => (
          <span key={`empty-${i}`} className={styles.dayEmpty} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const key = formatDateKey(date);
          const isToday = key === todayKey;
          const isWork = isWorkday(date, config, overrides, HOLIDAYS);
          const hasOv = key in overrides;

          const classes = [
            styles.day,
            !isWork ? styles.dayRest : '',
            isToday ? styles.dayToday : '',
            hasOv ? styles.dayOverride : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={day}
              type="button"
              className={classes}
              onClick={() => onPickDate?.(key)}
              title={`${key} · ${isWork ? '工作日' : '休息日'}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
