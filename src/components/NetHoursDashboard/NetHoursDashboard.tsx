/**
 * NetHoursDashboard — 净工时 4 卡 dashboard（v1.3.4-patch4）
 *
 * 从 TimeTrackerDetailPage 抽出,2×2 网格:
 * - 总工时(灰)
 * - 午休扣除(绿)
 * - 摸鱼扣除(绿)
 * - 加班(红,可点击展开 popup)
 *
 * 数据全部走 `computeNetHours`,与详情页同源。
 */
import { useMemo, useState } from 'react';
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useSlackingStore, todayKey } from '../../store/slackingStore';
import { HOLIDAYS } from '../../lib/constants';
import {
  computeNetHours,
  effectiveHourlyRate,
  overtimeSessionSplit,
  todayEarned,
} from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import { ChartLineUp, Moon } from '@phosphor-icons/react';
import sharedStyles from '../DesktopRightPanel/DesktopRightPanel.module.css';
import sheetStyles from '../../pages/SlackingDetailPage.module.css';

function fmtHoursMin(min: number): string {
  const totalMin = Math.round(min);
  const h = Math.floor(totalMin / 60);
  const m = totalMin - h * 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}m`;
}

interface Props {
  /** 紧凑模式(默认 false):右栏内嵌版本,缩小字号 */
  compact?: boolean;
}

export function NetHoursDashboard({ compact = false }: Props) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const sessions = useSlackingStore((s) => s.sessions);

  const dateKey = todayKey(now);
  const todaySessions = sessions[dateKey] ?? [];

  const net = useMemo(
    () => computeNetHours({
      date: now,
      config,
      overrides,
      holidays: HOLIDAYS,
      slackingSessions: todaySessions,
    }),
    [now, config, overrides, todaySessions],
  );

  const earned = useMemo(
    () => todayEarned(now, config, overrides, HOLIDAYS),
    [now, config, overrides],
  );
  const hourly = useMemo(
    () => effectiveHourlyRate(now, config, overrides, HOLIDAYS),
    [now, config, overrides],
  );
  const netHourly = net.netMinutes > 0 ? earned / (net.netMinutes / 60) : 0;

  const [showCompPopup, setShowCompPopup] = useState(false);
  const entry = overrides[dateKey] ?? null;
  const overtimeMul = entry?.multiplier ?? 1;
  const otSplit = useMemo(
    () => overtimeSessionSplit(todaySessions, now.getTime()),
    [todaySessions, now],
  );
  const userOvertimeDayMin = Math.round(otSplit.dayMin);
  const userOvertimeNightMin = Math.round(otSplit.nightMin);

  // 选 compact 模式(右栏用)用 .dashboardMini,默认模式用 .dashboard
  const rootClass = compact ? sharedStyles.dashboardMini : sheetStyles.dashboard;
  const cardClass = compact ? sharedStyles.dashCard : sheetStyles.card;
  const labelClass = compact ? sharedStyles.dashLabel : sheetStyles.cardLabel;
  const valueClass = compact ? sharedStyles.dashValue : sheetStyles.cardValue;
  const positiveClass = compact ? sharedStyles.dashValuePositive : sheetStyles.positive;
  const negativeClass = compact ? sharedStyles.dashValueNegative : sheetStyles.negative;

  return (
    <div className={rootClass}>
      <div className={cardClass}>
        <div className={labelClass}>总工时</div>
        <div className={valueClass}>{fmtHoursMin(net.grossElapsed)}</div>
      </div>
      <div className={`${cardClass} ${net.lunchElapsed > 0 ? positiveClass : ''}`}>
        <div className={labelClass}>午休扣除</div>
        <div className={valueClass}>
          {net.lunchElapsed > 0 ? `−${fmtHoursMin(net.lunchElapsed)}` : '0h'}
        </div>
      </div>
      <div className={`${cardClass} ${net.slackingElapsed > 0 ? positiveClass : ''}`}>
        <div className={labelClass}>摸鱼扣除</div>
        <div className={valueClass}>
          {net.slackingElapsed > 0 ? `−${fmtHoursMin(net.slackingElapsed)}` : '0h'}
        </div>
      </div>
      <div
        className={`${cardClass} ${sheetStyles.clickable ?? ''} ${net.overtimeElapsed > 0 ? negativeClass : ''}`}
        onClick={() => setShowCompPopup((v) => !v)}
        style={{ position: 'relative', cursor: net.overtimeElapsed > 0 ? 'pointer' : 'default' }}
      >
        <div className={labelClass}>加班</div>
        <div className={valueClass}>+{fmtHoursMin(net.overtimeElapsed)}</div>
        {showCompPopup && net.overtimeElapsed > 0 && (userOvertimeDayMin + userOvertimeNightMin > 0) && (
          <div className={sheetStyles.popup}>
            {userOvertimeDayMin > 0 && (
              <div className={sheetStyles.popupRow}>
                <ChartLineUp size={14} weight="bold" />
                <span>加班(日){fmtHoursMin(userOvertimeDayMin)} × {overtimeMul}</span>
              </div>
            )}
            {userOvertimeNightMin > 0 && (
              <div className={sheetStyles.popupRow}>
                <Moon size={14} weight="regular" />
                <span>加班(夜){fmtHoursMin(userOvertimeNightMin)} × {overtimeMul} × 1.5</span>
              </div>
            )}
            {userOvertimeDayMin > 0 && userOvertimeNightMin > 0 && (
              <div className={`${sheetStyles.popupRow} ${sheetStyles.popupRowTotal}`}>
                <span>= {fmtHoursMin(userOvertimeDayMin)} + {fmtHoursMin(userOvertimeNightMin)} × 1.5</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 净工时 / 净时薪 横条 ── */}
      {!compact && (
        <div className={sheetStyles.summary} style={{ gridColumn: '1 / -1' }}>
          <div className={sheetStyles.sumItem}>
            <div className={sheetStyles.sumLabel}>净工时</div>
            <div className={sheetStyles.sumValue}>{fmtHoursMin(net.netMinutes)}</div>
          </div>
          <div className={sheetStyles.sumItem}>
            <div className={sheetStyles.sumLabel}>净时薪</div>
            <div className={sheetStyles.sumValue}>¥{netHourly.toFixed(2)}/h</div>
          </div>
          <div className={sheetStyles.sumItem}>
            <div className={sheetStyles.sumLabel}>基础时薪</div>
            <div className={sheetStyles.sumValue}>¥{hourly.toFixed(2)}/h</div>
          </div>
        </div>
      )}
    </div>
  );
}