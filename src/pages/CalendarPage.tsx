/**
 * CalendarPage — 月度工作日网格
 */
import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useMonthlyStore } from '../store/monthlyStore';
import { HOLIDAYS } from '../lib/constants';
import { dailySalary, daysInMonthCalc, isWorkday, monthEarnedSoFar, dayUnits } from '../lib/compute';
import { formatDateKey } from '../lib/time';
import { useNow } from '../hooks/useNow';
import { StatusBar } from '../components/StatusBar';
import { DaySheet } from '../components/DaySheet';
import { GenerateSheet } from '../components/GenerateSheet';
import { EarnSheet } from '../components/EarnSheet';
import styles from './CalendarPage.module.css';

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function CalendarPage() {
  const now = useNow(60_000);
  const config = useConfigStore();
  const year = useCalendarStore((s) => s.year);
  const month = useCalendarStore((s) => s.month);
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const nextMonth = useCalendarStore((s) => s.nextMonth);
  const prevMonth = useCalendarStore((s) => s.prevMonth);
  const goToToday = useCalendarStore((s) => s.goToToday);
  const setDayOverride = useCalendarStore((s) => s.setDayOverride);
  const clearOverride = useCalendarStore((s) => s.clearOverride);
  const snapshots = useMonthlyStore((s) => s.snapshots);
  const createSnapshot = useMonthlyStore((s) => s.createSnapshot);

  // 当前月的快照
  const currentKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const hasSnapshot = currentKey in snapshots;
  const snapshot = hasSnapshot ? snapshots[currentKey] : null;

  // 日均(若已生成快照则用快照的,否则用实时计算的)
  const effectiveSalary = snapshot?.salary ?? config.monthlySalary;

  const daily = useMemo(
    () => {
      if (snapshot) return snapshot.dailyRate;
      return dailySalary(year, month, config, overrides, HOLIDAYS);
    },
    [year, month, config, overrides, snapshot],
  );

  // 当月已赚:用 effectiveSalary 计算(快照已锁定的月薪)
  const monthEarned = useMemo(
    () => {
      const effectiveConfig = { ...config, monthlySalary: effectiveSalary };
      return monthEarnedSoFar(year, month, now, effectiveConfig, overrides, HOLIDAYS);
    },
    [year, month, now, config, overrides, effectiveSalary],
  );

  // 工作日数
  const workdaysCount = useMemo(() => {
    let count = 0;
    const days = daysInMonthCalc(year, month);
    for (let d = 1; d <= days; d++) {
      if (isWorkday(new Date(year, month, d), config, overrides, HOLIDAYS)) count++;
    }
    return count;
  }, [year, month, config, overrides]);

  // 网格
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = daysInMonthCalc(year, month);

  // DaySheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);

  // GenerateSheet
  const [genOpen, setGenOpen] = useState(false);

  // EarnSheet
  const [earnOpen, setEarnOpen] = useState(false);

  function openDay(d: number) {
    const date = new Date(year, month, d);
    setPickedDate(date);
    setSheetOpen(true);
  }

  const pickedKey = pickedDate ? formatDateKey(pickedDate) : '';
  const pickedEntry = pickedKey ? (overrides[pickedKey] ?? null) : null;
  const isPickedWork = pickedDate
    ? isWorkday(pickedDate, config, overrides, HOLIDAYS)
    : false;

  function handleGenerate(salary: number) {
    createSnapshot(year, month, salary, config, overrides, HOLIDAYS);
  }

  function handleEarnEdit(salary: number) {
    createSnapshot(year, month, salary, config, overrides, HOLIDAYS);
  }

  return (
    <>
      <StatusBar />

      {/* Header:月份 + 右上角 dot */}
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <div className={styles.month}>{MONTH_NAMES[month]}</div>
          <div className={styles.year}>{year}</div>
        </div>
        <button
          type="button"
          className={`${styles.dotBtn} ${hasSnapshot ? styles.dotGenerated : styles.dotEmpty}`}
          onClick={() => setGenOpen(true)}
          title={hasSnapshot ? '已生成薪资' : '点击生成薪资'}
          aria-label="生成月度薪资"
        />
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={`${styles.summaryCard} ${styles.green}`}>
          <div className={styles.summaryNum}>{workdaysCount}</div>
          <div className={styles.summaryLbl}>工作日</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.white}`}>
          <div className={styles.summaryNum}>¥{Math.round(daily).toLocaleString('en-US')}</div>
          <div className={styles.summaryLbl}>日均</div>
        </div>
        <button
          type="button"
          className={`${styles.summaryCard} ${styles.white} ${styles.earnCard}`}
          onClick={() => snapshot ? setEarnOpen(true) : setGenOpen(true)}
          title={snapshot ? '点击调整月薪' : '点击生成薪资'}
        >
          <div className={styles.summaryNum}>
            ¥{Math.round(monthEarned).toLocaleString('en-US')}
          </div>
          <div className={styles.summaryLbl}>已赚</div>
        </button>
      </div>

      {/* 导航 */}
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

      {/* 网格 */}
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
            const units = dayUnits(date, config, overrides, HOLIDAYS);
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

            // 过去已过工作日:显示 dayEarn(¥daily × units)
            let earnText = '';
            if (isWork) {
              if (isToday) {
                earnText = '';
              } else if (isPast && units > 0) {
                const dayEarn = daily * units;
                earnText = `¥${dayEarn.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

      {/* DaySheet:工作日类型切换 */}
      <DaySheet
        open={sheetOpen}
        date={pickedDate}
        isWork={isPickedWork}
        dailyEarning={daily}
        currentEntry={pickedEntry}
        onClose={() => setSheetOpen(false)}
        onSave={(key, entry) => setDayOverride(key, entry)}
        onReset={(key) => clearOverride(key)}
      />

      {/* GenerateSheet:生成月度薪资 */}
      <GenerateSheet
        open={genOpen}
        year={year}
        month={month}
        config={config}
        defaultSalary={snapshot?.salary ?? config.monthlySalary}
        overrides={overrides}
        holidays={HOLIDAYS}
        onClose={() => setGenOpen(false)}
        onConfirm={handleGenerate}
      />

      {/* EarnSheet:点击已赚修改月薪 */}
      <EarnSheet
        open={earnOpen}
        year={year}
        month={month}
        currentSalary={snapshot?.salary ?? config.monthlySalary}
        onClose={() => setEarnOpen(false)}
        onConfirm={handleEarnEdit}
      />
    </>
  );
}