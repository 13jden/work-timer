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
import { DaySheet } from '../components/DaySheet';
import { GenerateSheet } from '../components/GenerateSheet';
import { RestModeSheet } from '../components/RestModeSheet';
import { CaretLeft, CaretRight, Crosshair } from '@phosphor-icons/react';
import styles from './CalendarPage.module.css';

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 智能格式化金额：
 * - <= 9999.99: 显示两位小数 (如 1000.00)
 * - > 9999.99: 显示整数 (如 10000)
 */
function formatEarnText(value: number): string {
  if (value > 9999.99) {
    return `¥${Math.round(value).toLocaleString('en-US')}`;
  }
  return `¥${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const monthlyRestModes = useCalendarStore((s) => s.monthlyRestModes);
  const setMonthlyRestMode = useCalendarStore((s) => s.setMonthlyRestMode);
  const setConfig = useConfigStore((s) => s.setConfig);
  const createSnapshot = useMonthlyStore((s) => s.createSnapshot);

  // 当前月的快照
  const currentKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const hasSnapshot = currentKey in snapshots;
  const snapshot = hasSnapshot ? snapshots[currentKey] : null;

  // effectiveConfig:若该月有月度休息模式覆盖,则覆盖 config.restMode
  const effectiveRestMode: 0 | 1 | 2 = monthlyRestModes[currentKey] ?? config.restMode;
  const effectiveConfig = { ...config, restMode: effectiveRestMode };

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
      return dailySalary(year, month, effectiveConfig, overrides, HOLIDAYS);
    },
    [year, month, effectiveConfig, overrides, snapshot],
  );

  // 快照月薪
  const effectiveSalary = snapshot?.salary ?? config.monthlySalary;

  // 当月已赚(用快照月薪,若快照存在;无快照则固定显示 0)
  const monthEarned = hasSnapshot
    ? (() => {
        const cfg = { ...effectiveConfig, monthlySalary: effectiveSalary };
        return monthEarnedSoFar(year, month, now, cfg, overrides, HOLIDAYS);
      })()
    : 0;

  // 当日已赚(当前月时实时计算)
  const todayEarn = useMemo(() => {
    if (!isCurrentMonth) return 0;
    const cfg = { ...effectiveConfig, monthlySalary: effectiveSalary };
    return todayEarned(now, cfg, overrides, HOLIDAYS);
  }, [isCurrentMonth, now, effectiveConfig, effectiveSalary, overrides]);

  // 工作日数
  const workdaysCount = useMemo(() => {
    let count = 0;
    const days = daysInMonthCalc(year, month);
    for (let d = 1; d <= days; d++) {
      if (isWorkday(new Date(year, month, d), effectiveConfig, overrides, HOLIDAYS)) count++;
    }
    return count;
  }, [year, month, effectiveConfig, overrides]);

  // 网格
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = daysInMonthCalc(year, month);

  // DaySheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);

  // GenerateSheet
  const [genOpen, setGenOpen] = useState(false);

  // RestModeSheet
  const [restOpen, setRestOpen] = useState(false);

  function openDay(d: number) {
    const date = new Date(year, month, d);
    setPickedDate(date);
    setSheetOpen(true);
  }

  const pickedKey = pickedDate ? formatDateKey(pickedDate) : '';
  const pickedEntry = pickedKey ? (overrides[pickedKey] ?? null) : null;
  const isPickedWork = pickedDate
    ? isWorkday(pickedDate, effectiveConfig, overrides, HOLIDAYS)
    : false;

  /**
   * GenerateSheet 确认:统一创建 / 覆盖快照。
   * 当前月时同步更新 config.monthlySalary,让设置页和其它计算页立刻生效。
   */
  function handleGenerate(salary: number) {
    createSnapshot(year, month, salary, effectiveConfig, overrides, HOLIDAYS);
    if (isCurrentMonth) {
      useConfigStore.setState({ monthlySalary: salary });
    }
  }

  /**
   * RestModeSheet 确认:切换月度休息模式
   * - 当前月 → 全局 config.restMode 同步 + 清除月度覆盖
   * - 历史月 → 仅写 monthlyRestModes 覆盖
   * - null → 清除月度覆盖
   */
  function handleRestConfirm(mode: 0 | 1 | 2 | null) {
    if (mode === null) {
      // 清除月度覆盖,恢复全局
      setMonthlyRestMode(currentKey, null);
    } else if (isCurrentMonth) {
      // 当前月 → 修改全局配置
      setConfig({ restMode: mode });
      setMonthlyRestMode(currentKey, null);
    } else {
      // 历史月 → 仅覆盖该月
      setMonthlyRestMode(currentKey, mode);
    }
  }

  const monthLabel = `${MONTH_NAMES[month]}`;
  const yearLabel = `${year}`;

  return (
    <>

      {/* Header:两行结构 — eyebrow + 月份标题(可点击) */}
      <div className={styles.head}>
        <div className={styles.headEyebrowRow}>
          <span className={styles.headEyebrow}>calendar</span>
          <span className={styles.headEnglish}>Monthly overview</span>
          <span className={styles.headRight}>{yearLabel}</span>
        </div>
        <button
          type="button"
          className={styles.headTitle}
          onClick={() => !isFutureMonth && setGenOpen(true)}
          disabled={isFutureMonth}
          title={isFutureMonth ? '未来月份,无法生成' : '点击设置月度薪资'}
          aria-label="设置当月薪资"
        >
          {monthLabel}
        </button>
      </div>

      {/* Summary:始终三卡;已赚无快照时显示 0 + 右上角小圆点 */}
      <div className={styles.summary}>
        <button
          type="button"
          className={`${styles.summaryCard} ${styles.green} ${styles.summaryRest}`}
          onClick={() => setRestOpen(true)}
          title="调整休息模式"
        >
          <div className={styles.summaryNum}>{workdaysCount}</div>
          <div className={styles.summaryLbl}>工作日</div>
        </button>
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
          <CaretLeft size={16} weight="bold" />
        </button>
        {!isCurrentMonth && (
          <button type="button" className={styles.navTitle} onClick={goToToday}>
            <Crosshair size={12} weight="regular" style={{ marginRight: 4, verticalAlign: '-1px' }} />
            now
          </button>
        )}
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="下个月">
          <CaretRight size={16} weight="bold" />
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
            const isWork = isWorkday(date, effectiveConfig, overrides, HOLIDAYS);
            const units = dayUnits(date, effectiveConfig, overrides, HOLIDAYS);
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

            // 显示 金额规则:
            // - 已生成快照:过去工作日显示「已结算金额」(daily * units)
            // - 今天 + 当前月:始终显示实时累积「今日已赚」(用户已配置好数据,实时有效)
            // - 今天 + 当前月 + 无快照:不显示秒数(已满足,见 StatCard)
            let earnText = '';
            if (isWork) {
              if (isToday) {
                // today 无条件显示(实时数据,即使还没生成快照)
                earnText = formatEarnText(todayEarn);
              } else if (hasSnapshot && isPast && units > 0) {
                const dayEarn = daily * units;
                earnText = formatEarnText(dayEarn);
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
        salaryMode={config.salaryMode}
        segmentTemplates={config.segmentTemplates}
        onClose={() => setSheetOpen(false)}
        onSave={(key, entry) => setDayOverride(key, entry)}
        onReset={(key) => clearOverride(key)}
      />

      {/* RestModeSheet:点击工作日 → 切换休息模式 */}
      <RestModeSheet
        open={restOpen}
        year={year}
        month={month}
        currentMode={effectiveRestMode}
        isCurrentMonth={isCurrentMonth}
        onClose={() => setRestOpen(false)}
        onConfirm={handleRestConfirm}
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