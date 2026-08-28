/**
 * CalendarPage — 月度工作日网格
 */
import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { HOLIDAYS } from '../lib/constants';
import { dailySalary, daysInMonthCalc, isWorkday, monthEarnedSoFar } from '../lib/compute';
import { formatDateKey } from '../lib/time';
import { useNow } from '../hooks/useNow';
import { StatusBar } from '../components/StatusBar';
import { DaySheet } from '../components/DaySheet';
import styles from './CalendarPage.module.css';

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function CalendarPage() {
  const now = useNow(60_000); // 月度网格不需要秒级更新,1 分钟一次够
  const config = useConfigStore();
  const year = useCalendarStore((s) => s.year);
  const month = useCalendarStore((s) => s.month);
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const nextMonth = useCalendarStore((s) => s.nextMonth);
  const prevMonth = useCalendarStore((s) => s.prevMonth);
  const goToToday = useCalendarStore((s) => s.goToToday);
  const toggleDay = useCalendarStore((s) => s.toggleDay);
  const clearOverride = useCalendarStore((s) => s.clearOverride);

  const daily = useMemo(
    () => dailySalary(year, month, config, overrides, HOLIDAYS),
    [year, month, config, overrides],
  );

  const workdaysCount = useMemo(() => {
    let count = 0;
    const days = daysInMonthCalc(year, month);
    for (let d = 1; d <= days; d++) {
      if (isWorkday(new Date(year, month, d), config, overrides, HOLIDAYS)) count++;
    }
    return count;
  }, [year, month, config, overrides]);

  const monthEarned = useMemo(
    () => monthEarnedSoFar(year, month, now, config, overrides, HOLIDAYS),
    [year, month, now, config, overrides],
  );

  // 网格
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = daysInMonthCalc(year, month);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);

  function openDay(d: number) {
    const date = new Date(year, month, d);
    setPickedDate(date);
    setSheetOpen(true);
  }

  const isPickedWorkday = pickedDate
    ? isWorkday(pickedDate, config, overrides, HOLIDAYS)
    : false;
  const pickedKey = pickedDate ? formatDateKey(pickedDate) : '';
  const pickedHasOverride = pickedKey in overrides;

  return (
    <>
      <StatusBar />

      <div className={styles.head}>
        <div className={styles.month}>{MONTH_NAMES[month]}</div>
        <div className={styles.year}>{year}</div>
      </div>

      <div className={styles.summary}>
        <div className={`${styles.summaryCard} ${styles.green}`}>
          <div className={styles.summaryNum}>{workdaysCount}</div>
          <div className={styles.summaryLbl}>工作日</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.white}`}>
          <div className={styles.summaryNum}>¥{Math.round(daily).toLocaleString('en-US')}</div>
          <div className={styles.summaryLbl}>日均</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.white}`}>
          <div className={styles.summaryNum}>¥{Math.round(monthEarned).toLocaleString('en-US')}</div>
          <div className={styles.summaryLbl}>已赚</div>
        </div>
      </div>

      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="上个月">
          ‹
        </button>
        <button type="button" className={styles.navTitle} onClick={goToToday}>
          今天
        </button>
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="下个月">
          ›
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.weekdays}>
          {WEEKDAYS.map((d) => (
            <span key={d} className={styles.weekdayCell}>{d}</span>
          ))}
        </div>
        <div className={styles.days}>
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className={`${styles.day} ${styles.dayEmpty}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const date = new Date(year, month, d);
            const isWork = isWorkday(date, config, overrides, HOLIDAYS);
            const isToday =
              d === now.getDate() &&
              month === now.getMonth() &&
              year === now.getFullYear();
            const isPast =
              year < now.getFullYear() ||
              (year === now.getFullYear() && month < now.getMonth()) ||
              (year === now.getFullYear() && month === now.getMonth() && d < now.getDate());
            const key = formatDateKey(date);
            const hasOv = key in overrides;

            const classes = [
              styles.day,
              !isWork ? styles.dayWeekend : '',
              isToday ? styles.dayToday : '',
              hasOv ? styles.dayOverride : '',
            ].filter(Boolean).join(' ');

            let earnText = '';
            if (isWork) {
              if (isToday && isWork) {
                earnText = ''; // today 显示今天赚的(简化:省略)
              } else if (isPast) {
                earnText = `¥${Math.round(daily).toLocaleString('en-US')}`;
              }
            }

            return (
              <button
                key={d}
                type="button"
                className={classes}
                onClick={() => openDay(d)}
              >
                <span className={styles.dayNum}>{d}</span>
                {earnText && <span className={styles.earn}>{earnText}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <DaySheet
        open={sheetOpen}
        date={pickedDate}
        isWork={isPickedWorkday}
        dailyEarning={daily}
        hasOverride={pickedHasOverride}
        onClose={() => setSheetOpen(false)}
        onToggle={() => {
          if (pickedDate) {
            const make = isPickedWorkday ? 'rest' : 'work';
            toggleDay(formatDateKey(pickedDate), make);
          }
        }}
        onReset={() => {
          if (pickedDate) clearOverride(formatDateKey(pickedDate));
        }}
      />
    </>
  );
}