import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useSlackingStore } from '../store/slackingStore';
import { HOLIDAYS } from '../lib/constants';
import { computeRangeStats } from '../lib/compute';
import { TimeTrackerDetailPage } from './TimeTrackerDetailPage';
import styles from './FishPage.module.css';

type RangeMode = 'day' | 'week' | 'month';

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function rangeFor(mode: Exclude<RangeMode, 'day'>, offset: number, now: Date) {
  if (mode === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6) };
  }
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 0) };
}

function fmtMinutes(value: number) {
  const rounded = Math.round(value);
  return `${Math.floor(rounded / 60)}h${String(rounded % 60).padStart(2, '0')}m`;
}

function fmtRange(mode: Exclude<RangeMode, 'day'>, offset: number, now: Date) {
  const { start, end } = rangeFor(mode, offset, now);
  if (mode === 'month') return `${start.getFullYear()}年${start.getMonth() + 1}月`;
  return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
}

export function FishPage() {
  const [mode, setMode] = useState<RangeMode>('day');
  const [offset, setOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const sessions = useSlackingStore((s) => s.sessions);
  const now = new Date();

  const stats = useMemo(() => {
    if (mode === 'day') return null;
    const range = rangeFor(mode, offset, now);
    return computeRangeStats(range.start, range.end, config, overrides, HOLIDAYS, sessions);
  }, [mode, offset, config, overrides, sessions]);

  if (mode === 'day') {
    return (
      <div className={styles.page}>
        <div className={styles.head}>
          <div className={styles.headEyebrowRow}>
            <span className={styles.headEyebrow}>TIME RECORDS</span>
          </div>
          <h1 className={styles.headTitle}>时间记录</h1>
        </div>
        <TimeTrackerDetailPage onModeChange={(newMode) => { setMode(newMode); setOffset(0); }} />
      </div>
    );
  }

  // 过滤：排除未来日期和未生成记录的日期（用于统计计算）
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const todayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');

  const filteredPerDay = (stats?.perDay ?? []).filter(day => {
    if (day.date > todayEnd) return false;
    if (day.dateKey === todayKey) return true;
    if (overrides[day.dateKey]?.earnedGenerated) return true;
    if (sessions[day.dateKey]?.length) return true;
    if (day.isRest && overrides[day.dateKey] != null) return true;
    return false;
  });

  // 图表用：显示截止到今天的所有日期（柱子为0也显示，X轴标签完整）
  const chartPerDay = (stats?.perDay ?? []).filter(day => day.date <= todayEnd);

  const fTotalNet = filteredPerDay.reduce((sum, d) => sum + d.netMinutes, 0);
  const fTotalSlack = filteredPerDay.reduce((sum, d) => sum + d.slackMinutes, 0);
  const fTotalComp = filteredPerDay.reduce((sum, d) => sum + d.compMinutes, 0);
  const fTotalEarned = filteredPerDay.reduce((sum, d) => sum + (d.earned ?? 0), 0);
  const fWorkDays = filteredPerDay.filter(d => !d.isRest).length;

  const todayIndex = chartPerDay.findIndex(d => d.dateKey === todayKey);
  const fallbackIndex = chartPerDay.findIndex(d => !d.isRest);
  const actualSelectedIndex = selectedDayIndex !== null
    ? selectedDayIndex
    : (todayIndex >= 0 ? todayIndex : fallbackIndex >= 0 ? fallbackIndex : 0);
  const selectedDay = chartPerDay[actualSelectedIndex];

  const max = 540;

  const workDays = fWorkDays || 1;

  const totalNet = fTotalNet;
  const effectiveMin = totalNet - fTotalComp;
  const effPct = totalNet > 0 ? (effectiveMin / totalNet) * 100 : 0;
  const slackPct = totalNet > 0 ? (fTotalSlack / totalNet) * 100 : 0;
  const compPct = totalNet > 0 ? (fTotalComp / totalNet) * 100 : 0;

  const baseHourly = config.monthlySalary / 22 / 8;
  const fishSalary = (fTotalSlack / 60) * baseHourly;

  const totalEarned = fTotalEarned;
  
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.headEyebrowRow}>
          <span className={styles.headEyebrow}>TIME RECORDS</span>
        </div>
        <h1 className={styles.headTitle}>时间记录</h1>
      </div>

      {/* 日/周/月切换器 */}
      <div className={styles.tabs}>
        <button onClick={() => { setMode('day'); setOffset(0); }}>日</button>
        <button className={mode === 'week' ? styles.tabActive : ''} onClick={() => { setMode('week'); setOffset(0); setSelectedDayIndex(null); }}>周</button>
        <button className={mode === 'month' ? styles.tabActive : ''} onClick={() => { setMode('month'); setOffset(0); setSelectedDayIndex(null); }}>月</button>
      </div>

      {/* 日期范围导航 */}
      <div className={styles.rangeNav}>
        <button onClick={() => { setOffset((v) => v - 1); setSelectedDayIndex(null); }}>‹</button>
        <span>{fmtRange(mode, offset, now)}</span>
        <button onClick={() => { setOffset((v) => v + 1); setSelectedDayIndex(null); }}>›</button>
      </div>

      {/* 顶部大数字：选中日的日期 + 净工时（周/月视图均显示选中日） */}
      {selectedDay ? (
        <>
          <div className={styles.sDay}>
            {selectedDay.date.getMonth() + 1}月{selectedDay.date.getDate()}日 · 周{WEEKDAY_NAMES[selectedDay.date.getDay()]}
          </div>
          <div className={styles.sBig}>
            {fmtMinutes(selectedDay.netMinutes)}
            <small>净工时</small>
          </div>
        </>
      ) : (
        <>
          <div className={styles.sDay}>
            工作日 {workDays} 天
          </div>
          <div className={styles.sBig}>
            {fmtMinutes(fTotalNet)}
            <small>累计净工时</small>
          </div>
        </>
      )}

      {/* 柱状图 */}
      <div className={styles.chartWrap}>
        <div className={styles.chart}>
          {/* 网格线 + Y轴标签 */}
          <div className={styles.gridLine} style={{ top: '0%' }}><span>9h</span></div>
          <div className={styles.gridLine} style={{ top: '33.3%' }}><span>6h</span></div>
          <div className={styles.gridLine} style={{ top: '66.6%' }}><span>3h</span></div>
          <div className={styles.gridLine} style={{ top: '100%' }}><span>0</span></div>

          {/* 柱子 */}
          <div className={`${styles.bars} ${mode === 'month' ? styles.barsMonth : styles.barsWeek}`}>
            {chartPerDay.map((day, index) => {
              const hasRecord = day.dateKey === todayKey
                || !!overrides[day.dateKey]?.earnedGenerated
                || !!sessions[day.dateKey]?.length;
              const heightPct = day.isRest
                ? 0
                : hasRecord
                  ? Math.min(100, (day.netMinutes / max) * 100)
                  : 0;
              const isSelected = index === actualSelectedIndex;

              return (
                <div
                  key={day.dateKey}
                  className={styles.barSlot}
                  onClick={() => !day.isRest && setSelectedDayIndex(index)}
                  style={{ cursor: day.isRest ? 'default' : 'pointer' }}
                  title={`${day.dateKey} · ${fmtMinutes(day.netMinutes)}`}
                >
                  {day.isRest ? (
                    <div className={styles.restDot} />
                  ) : (
                    <div
                      className={`${styles.bar} ${isSelected ? styles.barSelected : ''}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X轴标签 */}
        <div className={`${styles.xLabels} ${mode === 'month' ? styles.xLabelsMonth : styles.xLabelsWeek}`}>
          {chartPerDay.map((day, index) => {
            const showLabel = mode === 'week' || (mode === 'month' && index % 5 === 0);
            const isSelected = index === actualSelectedIndex;

            return (
              <div
                key={day.dateKey}
                className={`${styles.xLabel} ${isSelected ? styles.xLabelSel : ''}`}
                onClick={() => !day.isRest && setSelectedDayIndex(index)}
                style={{ cursor: day.isRest ? 'default' : 'pointer' }}
              >
                {showLabel && (
                  mode === 'week' ? (
                    <>
                      <b>{day.date.getMonth() + 1}/{day.date.getDate()}</b>
                      <span>{day.isRest ? <span className={styles.restTag}>休</span> : `周${WEEKDAY_NAMES[day.date.getDay()]}`}</span>
                    </>
                  ) : (
                    <b>{day.date.getDate()}</b>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 双栏：累计净工时 / 日均净工时 */}
      <div className={styles.duo}>
        <div className={styles.duoItem}>
          <div className={styles.duoLabel}>累计净工时</div>
          <div className={styles.duoValue}>{fmtMinutes(fTotalNet)}</div>
          <div className={styles.duoSub}>工作日 {workDays} 天</div>
        </div>
        <div className={styles.duoDivider}></div>
        <div className={styles.duoItem}>
          <div className={styles.duoLabel}>日均净工时</div>
          <div className={styles.duoValue}>{fmtMinutes(fTotalNet / workDays)}</div>
          <div className={styles.duoSub}>非工作日不参与平均</div>
        </div>
      </div>

      {/* 深色卡：净时薪 + 累计已赚 */}
      <div className={styles.darkCard}>
        <div className={styles.darkItem}>
          <div className={styles.darkLabel}>净时薪</div>
          <div className={styles.darkValue}>¥{(fTotalNet > 0 ? fTotalEarned / (fTotalNet / 60) : 0).toFixed(1)}/h</div>
        </div>
        <div className={styles.darkItem}>
          <div className={styles.darkLabel}>累计已赚</div>
          <div className={styles.darkValue}>¥{Math.round(totalEarned).toLocaleString()}</div>
        </div>
      </div>

      {/* 时长去向 */}
      <h3 className={styles.sectionTitle}>时长去向</h3>
      <div className={styles.composition}>
        <div className={styles.compBar}>
          <div className={styles.compSegEff} style={{ width: `${effPct}%` }}></div>
          <div className={styles.compSegFish} style={{ width: `${slackPct}%` }}></div>
          <div className={styles.compSegOt} style={{ width: `${compPct}%` }}></div>
        </div>
        <div className={styles.compCols}>
          <div className={styles.compCol}>
            <div className={styles.compIco}>💼</div>
            <div className={styles.compPct}>{effPct.toFixed(0)}%</div>
            <div className={styles.compLab}>有效工时</div>
          </div>
          <div className={styles.compCol}>
            <div className={styles.compIco}>🐟</div>
            <div className={styles.compPct}>{slackPct.toFixed(0)}%</div>
            <div className={styles.compLab}>摸鱼</div>
          </div>
          <div className={styles.compCol}>
            <div className={styles.compIco}>⏰</div>
            <div className={styles.compPct}>{compPct.toFixed(0)}%</div>
            <div className={styles.compLab}>加班</div>
          </div>
        </div>
      </div>

      {/* 摸鱼总薪资 */}
      <div className={styles.fishSalary}>
        <div>
          <div className={styles.fishLabel}>摸鱼总薪资</div>
          <div className={styles.fishSub}>按 ¥{baseHourly.toFixed(2)}/h × {fmtMinutes(fTotalSlack)}</div>
        </div>
        <div className={styles.fishValue}>¥{fishSalary.toFixed(2)}</div>
      </div>

      <div className={styles.footnote}>
        * 日均、净时薪均按工作日计算，非工作日不参与平均<br />
        当前基础时薪 ¥{baseHourly.toFixed(2)}/h
      </div>
    </div>
  );
}
