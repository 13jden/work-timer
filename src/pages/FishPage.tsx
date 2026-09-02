import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useSlackingStore } from '../store/slackingStore';
import { HOLIDAYS } from '../lib/constants';
import { computeRangeStats } from '../lib/compute';
import { TimeTrackerDetailPage } from './TimeTrackerDetailPage';
import styles from './FishPage.module.css';

type RangeMode = 'day' | 'week' | 'month';

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
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
}

export function FishPage() {
  const [mode, setMode] = useState<RangeMode>('day');
  const [offset, setOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
        <TimeTrackerDetailPage />
      </div>
    );
  }

  const max = Math.max(...(stats?.perDay.map((d) => d.netMinutes) ?? [1]), 1);
  const selected = stats?.perDay.find((d) => d.dateKey === selectedKey) ?? null;
  const chartWidth = Math.max((stats?.perDay.length ?? 0) * 28, 196);
  return (
    <div className={styles.page}>
      <div className={styles.head}><span>FISH · {mode === 'week' ? 'WEEK' : 'MONTH'}</span><strong>时间统计</strong></div>
      <div className={styles.switcher}>{(['day', 'week', 'month'] as RangeMode[]).map((item) => <button key={item} className={item === mode ? styles.active : ''} onClick={() => { setMode(item); setOffset(0); }}>{item === 'day' ? '日' : item === 'week' ? '周' : '月'}</button>)}</div>
      <div className={styles.rangeNav}><button onClick={() => setOffset((v) => v - 1)}>‹</button><span>{fmtRange(mode, offset, now)}</span><button onClick={() => setOffset((v) => v + 1)}>›</button></div>
      <div className={styles.cards}>
        <div><small>净工时</small><b>{fmtMinutes(stats?.totalNetMinutes ?? 0)}</b></div>
        <div><small>平均净时薪</small><b>¥{(stats?.avgNetHourly ?? 0).toFixed(2)}</b></div>
        <div><small>摸鱼</small><b>{fmtMinutes(stats?.totalSlackMinutes ?? 0)}</b></div>
        <div><small>加班补偿</small><b>{fmtMinutes(stats?.totalCompMinutes ?? 0)}</b></div>
      </div>
      <div className={styles.chart}>
        <svg viewBox={`0 0 ${chartWidth} 180`} role="img" aria-label="每日净工时柱状图">
          {stats?.perDay.map((day, index) => {
            const x = index * 28 + 6;
            const height = Math.max(day.isRest ? 3 : 5, (day.netMinutes / max) * 126);
            const isToday = day.dateKey === [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
            const className = [styles.svgBar, day.isRest ? styles.svgRest : '', day.compMinutes > 0 ? styles.svgOvertime : '', selectedKey === day.dateKey ? styles.svgSelected : ''].filter(Boolean).join(' ');
            return (
              <g key={day.dateKey} className={styles.svgItem} onClick={() => setSelectedKey(day.dateKey)}>
                <title>{`${day.dateKey} · ${fmtMinutes(day.netMinutes)}`}</title>
                {isToday && <line className={styles.todayLine} x1={x + 8} x2={x + 8} y1="12" y2="156" />}
                <rect className={className} x={x} y={156 - height} width="16" height={height} rx="3" />
                <text x={x + 8} y="174" textAnchor="middle">{day.date.getDate()}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className={styles.records}>
        <h3>{selected ? `${selected.date.getMonth() + 1}月${selected.date.getDate()}日 · 当日明细` : '记录汇总'}</h3>
        {(selected ? [selected] : (stats?.perDay ?? []).filter((d) => d.slackMinutes || d.compMinutes)).map((day) => <div className={styles.record} key={day.dateKey}><span>{day.date.getMonth() + 1}/{day.date.getDate()}</span><span>摸鱼 {fmtMinutes(day.slackMinutes)}</span><span>加班 +{fmtMinutes(day.compMinutes)}</span></div>)}
        {selected && <button className={styles.clear} onClick={() => setSelectedKey(null)}>查看全部</button>}
      </div>
    </div>
  );
}
