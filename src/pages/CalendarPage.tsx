/**
 * CalendarPage — 月度工作日网格
 *
 * v1.3.4-patch4 桌面端改造：
 * - `isDesktopInline` prop：桌面端 DaySheet 不在页面内渲染，**而是由 DesktopRightPanel 接管**
 *   - 这里只负责日历网格 + Summary + 导航 + 选中日期触发
 *   - 选中日期通过 `onPickDate(date)` 回调上抛给 App.tsx
 * - 桌面端布局：日历网格占左 2/3，右侧 DaySheet 由 DesktopRightPanel 渲染
 * - 移动端：日 Sheet 仍走弹窗（保留原行为）
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useMonthlyStore } from '../store/monthlyStore';
import { HOLIDAYS } from '../lib/constants';
import { dailySalary, daysInMonthCalc, isWorkday, monthEarnedSoFar, dayUnits, todayEarned, batchGenerateEarned, effectiveDailyRate } from '../lib/compute';
import { formatDateKey } from '../lib/time';
import { DaySheet } from '../components/DaySheet';
import { GenerateSheet } from '../components/GenerateSheet';

import { CaretLeft, CaretRight, Crosshair } from '@phosphor-icons/react';
import styles from './CalendarPage.module.css';

interface CalendarPageProps {
  /** 桌面端内联模式：日历在主区,右侧 DaySheet 由 DesktopRightPanel 接管 */
  isDesktopInline?: boolean;
  /** 桌面端：选中日期时回调（App 层会用此渲染 DesktopRightPanel） */
  onPickDate?: (date: Date) => void;
  /** 桌面端：当前已选中的日期（用于网格高亮） */
  selectedDate?: Date | null;
}

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

export function CalendarPage({
  isDesktopInline = false,
  onPickDate,
  selectedDate = null,
}: CalendarPageProps) {
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
  const createSnapshot = useMonthlyStore((s) => s.createSnapshot);

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

  // 当前月的快照
  const currentKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const hasSnapshot = currentKey in snapshots;
  const snapshot = hasSnapshot ? snapshots[currentKey] : null;

  // effectiveConfig:若该月有月度休息模式覆盖,则覆盖 config.restMode
  const effectiveRestMode = monthlyRestModes[currentKey] ?? config.restMode;
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
  const [selectMode, setSelectMode] = useState<'generate' | 'cancel' | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);


  function openDay(d: number) {
    const date = new Date(year, month, d);
    const key = formatDateKey(date);
    const todayKey = formatDateKey(now);
    const past = key < todayKey;
    if (selectMode) {
      const eligible = selectMode === 'generate'
        ? past && isWorkday(date, effectiveConfig, overrides, HOLIDAYS)
        : past && Boolean(overrides[key]?.earnedGenerated);
      if (eligible) {
        setSelectedDays((days) => days.includes(key) ? days.filter((item) => item !== key) : [...days, key]);
      }
      return;
    }
    setPickedDate(date);
    if (isDesktopInline && onPickDate) {
      // 桌面端:把选中日期抛给 App 层,DesktopRightPanel 接管渲染
      onPickDate(date);
    } else {
      // 移动端:打开 DaySheet 弹窗
      setSheetOpen(true);
    }
  }

  function startSelection(mode: 'generate' | 'cancel') {
    setSelectMode(mode);
    setSelectedDays([]);
  }

  function selectAllEligible() {
    const todayKey = formatDateKey(now);
    const eligible = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
      .filter((date) => {
        const key = formatDateKey(date);
        return key < todayKey && (selectMode === 'generate'
          ? isWorkday(date, effectiveConfig, overrides, HOLIDAYS)
          : Boolean(overrides[key]?.earnedGenerated));
      })
      .map(formatDateKey);
    setSelectedDays(eligible);
  }

  function confirmBatch() {
    if (!selectMode || selectedDays.length === 0) return;
    const dates = selectedDays.map((key) => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y ?? year, (m ?? month + 1) - 1, d ?? 1);
    });
    const next = batchGenerateEarned(dates, effectiveConfig, overrides, HOLIDAYS, selectMode === 'cancel');
    const keys = new Set([...Object.keys(overrides), ...Object.keys(next)]);
    keys.forEach((key) => setDayOverride(key, next[key] ?? null));
    setSelectMode(null);
    setSelectedDays([]);
  }

  const selectedTotal = selectedDays.reduce((sum, key) => {
    const existing = overrides[key]?.earnedAmount;
    if (selectMode === 'cancel') return sum + (existing ?? 0);
    const [y, m, d] = key.split('-').map(Number);
    return sum + effectiveDailyRate(new Date(y ?? year, (m ?? month + 1) - 1, d ?? 1), effectiveConfig, overrides, HOLIDAYS);
  }, 0);

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
   * 已赚卡片点击:进入/退出批量生成模式
   */
  function handleEarnedClick() {
    if (selectMode) {
      // 已在多选模式 → 退出
      setSelectMode(null);
      setSelectedDays([]);
    } else {
      // 进入生成模式
      startSelection('generate');
    }
  }


  const monthLabel = `${MONTH_NAMES[month]}`;
  const yearLabel = `${year}`;

  // ── DaySheet 渲染策略 ──────────────────────────────────────
  // v1.3.4-patch4:
  //   desktop inline → DaySheet 由 DesktopRightPanel 渲染(本组件不渲染 sheet),
  //                  仅通过 onPickDate 上抛选中日期
  //   mobile         → DaySheet 走弹窗遮罩(原行为)
  // 当前选中日期 key(用于网格高亮,即便 DaySheet 在 DesktopRightPanel 渲染)
  const selectedKey = selectedDate ? formatDateKey(selectedDate) : null;

  // v1.3.5:从 customRestSchedule 取每个日期的模板色(用于格子左上角色点)
  function templateColorForDate(key: string): string | null {
    const ids = config.customRestSchedule?.workDays[key];
    if (!ids || ids.length === 0) return null;
    // 取第一个模板的颜色
    const firstId = ids[0];
    if (!firstId || firstId === 'inherit') return null;
    const tpl = (config.workTemplates ?? []).find((t) => t.id === firstId);
    return tpl?.color ?? null;
  }

  return (
    <div className={`${styles.pageWrap} ${isDesktopInline ? styles.pageInline : ''}`}>

      {/* ── 左/主列:Summary + 导航 + 网格(移除 Header,标题移到右侧) ── */}
      <div className={styles.mainCol}>

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
            title="工作日"
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
            onClick={handleEarnedClick}
            title={selectMode ? '退出多选模式' : '批量生成已赚'}
          >
            <div className={styles.summaryNum}>
              ¥{Math.round(monthEarned).toLocaleString('en-US')}
            </div>
            <div className={styles.summaryLbl}>已赚</div>
            {!hasSnapshot && !isFutureMonth && !selectMode && (
              <span className={styles.earnDot} aria-label="可点击生成薪资" />
            )}
          </button>
        </div>

        {selectMode && (
          <div className={styles.earnedActions}>
            <div className={styles.selectionModeTabs}>
              <button type="button" className={selectMode === 'generate' ? styles.selectionActive : ''} onClick={() => startSelection('generate')}>生成</button>
              <button type="button" className={selectMode === 'cancel' ? styles.selectionActive : ''} onClick={() => startSelection('cancel')}>取消</button>
            </div>
            <div className={styles.selectionTools}>
              <button type="button" onClick={selectAllEligible}>全选可用</button>
              <button type="button" onClick={() => setSelectedDays([])}>清空</button>
            </div>
            <div className={styles.selectionHint}>已选 {selectedDays.length} 天 · ¥{selectedTotal.toFixed(2)}</div>
          </div>
        )}

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
              const tplColor = templateColorForDate(key);
              const isPicked = selectedKey === key;
              const isBatchSelected = selectedDays.includes(key);

              const classes = [
                styles.day,
                !isWork ? styles.dayWeekend : '',
                isToday ? styles.dayToday : '',
                hasOv ? styles.dayOverride : '',
                isPicked ? styles.daySelected : '',
                isBatchSelected ? styles.dayBatchSelected : '',
              ].filter(Boolean).join(' ');

              let earnText = '';
              if (isWork) {
                if (isToday) {
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
                  aria-pressed={isBatchSelected}
                >
                  <span className={styles.dayNum}>{d}</span>
                  {tplColor && (
                    <span className={styles.dayTemplateDot} style={{ backgroundColor: tplColor }} />
                  )}
                  {earnText && <span className={styles.earn}>{earnText}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── v1.3.4-patch4:桌面端右栏 DaySheet 由 DesktopRightPanel 渲染 ──
          本组件不再输出右侧 inlineSheet,选中日期通过 onPickDate 抛到 App 层 */}

      {/* ── 移动端弹窗 DaySheet（仅非 inline 模式渲染遮罩） ── */}
      {!isDesktopInline && (
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
      )}

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
      {selectMode && selectedDays.length > 0 && (
        <div className={styles.selectionFooter}>
          <span>{selectMode === 'generate' ? '生成' : '取消'} {selectedDays.length} 天 · ¥{selectedTotal.toFixed(2)}</span>
          <button type="button" onClick={confirmBatch}>{selectMode === 'generate' ? '确认生成' : '确认取消'}</button>
        </div>
      )}
    </div>
  );
}
