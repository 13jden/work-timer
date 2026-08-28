/**
 * CalendarPage — 月度工作日网格
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useMonthlyStore } from '../store/monthlyStore';
import { HOLIDAYS } from '../lib/constants';
import { dailySalary, daysInMonthCalc, isWorkday, monthEarnedSoFar, dayUnits, todayEarned } from '../lib/compute';
import { formatDateKey } from '../lib/time';
import { StatusBar } from '../components/StatusBar';
import { DaySheet } from '../components/DaySheet';
import { GenerateSheet } from '../components/GenerateSheet';
import styles from './CalendarPage.module.css';

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function CalendarPage() {
  // 页面可见时刷新 now(秒级)
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function tick() {
      setNow(new Date());
    }
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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

  // 是否当前月
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();

  // 是否未来月(未来月不允许补生成)
  const isFutureMonth =
    year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth());

  // 快照日均
  const daily = useMemo(
    () => {
      if (snapshot) return snapshot.dailyRate;
      return dailySalary(year, month, config, overrides, HOLIDAYS);
    },
    [year, month, config, overrides, snapshot],
  );

  // 快照月薪
  const effectiveSalary = snapshot?.salary ?? config.monthlySalary;

  // 当月已赚(用快照月薪,若快照存在;无快照则固定显示 ¥0)
  const monthEarned = hasSnapshot
    ? (() => {
        const effectiveConfig = { ...config, monthlySalary: effectiveSalary };
        return monthEarnedSoFar(year, month, now, effectiveConfig, overrides, HOLIDAYS);
      })()
    : 0;

  // 当日已赚(仅当前月 + 有快照时显示)
  const todayEarn = useMemo(() => {
    if (!isCurrentMonth || !hasSnapshot) return 0;
    const effectiveConfig = { ...config, monthlySalary: effectiveSalary };
    return todayEarned(now, effectiveConfig, overrides, HOLIDAYS);
  }, [isCurrentMonth, hasSnapshot, now, config, overrides, effectiveSalary]);

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

  /**
   * GenerateSheet 确认:统一创建 / 覆盖快照。
   * 当前月时同步更新 config.monthlySalary,让设置页和其它计算页立刻生效。
   */
  function handleGenerate(salary: number) {
    createSnapshot(year, month, salary, config, overrides, HOLIDAYS);
    if (isCurrentMonth) {
      useConfigStore.setState({ monthlySalary: salary });
    }
  }

  const monthLabel = `${MONTH_NAMES[month]}`;
  const yearLabel = `${year}`;

  return (
    <>
      <StatusBar />

      {/* Header:月份居中可点击 → 弹出 GenerateSheet(未来月不可点) */}
      <button
        type="button"
        className={styles.head}
        onClick={() => !isFutureMonth && setGenOpen(true)}
        disabled={isFutureMonth}
        title={isFutureMonth ? '未来月份,无法生成' : '点击设置月度薪资'}
        aria-label="设置当月薪资"
      >
        <div className={styles.headInner}>
          <div className={styles.month}>{monthLabel}</div>
          <div className={styles.year}>{yearLabel}</div>
        </div>
      </button>

      {/* Summary:始终三卡;已赚无快照时显示 ¥0 + 右上角小圆点 */}
      <div className={styles.summary}>
        <div className={`${styles.summaryCard} ${styles.green}`}>
          <div className={styles.summaryNum}>{workdaysCount}</div>
          <div className={styles.summaryLbl}>工作日</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.white}`}>
          <div className={styles.summaryNum}>
            ¥{Math.round(daily).toLocaleString('en-US')}
          </div>
          <div className={styles.summaryLbl}>日均</div>
        </div>
        <button
          type="button"
          className={`${styles.summaryCard} ${styles.white} ${styles.summaryEarn}`}
          onClick={() => setGenOpen(true)}
          title={hasSnapshot ? '调整月薪' : '生成当月薪资'}
        >
          <div className={styles.summaryNum}>
            ¥{Math.round(monthEarned).toLocaleString('en-US')}
          </div>
          <div className={styles.summaryLbl}>已赚</div>
          {!hasSnapshot && !isFutureMonth && (
            <span className={styles.earnDot} aria-label="可点击生成薪资" />
          )}
        </button>
      </div>

      {/* 月份导航:‹  [now]  › (now 仅非当月显示,颜色用主题 accent) */}
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="上个月">
          ‹
        </button>
        {!isCurrentMonth && (
          <button type="button" className={styles.navTitle} onClick={goToToday}>
            now
          </button>
        )}
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

            // 显示 ¥ 金额规则:
            // - 已生成快照:过去工作日显示「已结算金额」(daily × units)
            // - 今天 + 当前月 + 已生成快照:实时累积「今日已赚」(每秒刷新)
            // - 今天 + 当前月 + 无快照:不显示(用户没确认数据,不该瞎猜)
            let earnText = '';
            if (hasSnapshot && isWork) {
              if (isToday) {
                earnText = `¥${todayEarn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

      {/* GenerateSheet:点击月份 / 已赚 → 设置 / 调整月薪 */}
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
    </>
  );
}
