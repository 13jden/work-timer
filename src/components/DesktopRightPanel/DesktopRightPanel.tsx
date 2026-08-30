/**
 * DesktopRightPanel — 桌面端三栏布局的右栏（v1.3.4）
 *
 * 根据当前页面（today / calendar）渲染对应的上下文面板：
 *
 * today    → 迷你月历 + 今日详情 + 换算 Top 5
 * calendar → 日历页点选日期的 DaySheet（inline，无 modal 外壳）
 *
 * 点击迷你月历的日期 → onNavigateToCalendar(key: string)
 */
import { MiniCalendar } from '../MiniCalendar';
import { ConvertPanel } from '../ConvertPanel';
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { HOLIDAYS } from '../../lib/constants';
import { dailySalary, effectiveHourlyRate, todayEarned, isWorkday, getDayOverride } from '../../lib/compute';
import { formatDateKey } from '../../lib/time';
import { useNow } from '../../hooks/useNow';
import { CaretRight } from '@phosphor-icons/react';
import type { DesktopTabId } from '../DesktopSidebar';
import styles from './DesktopRightPanel.module.css';

interface TodayDetailProps {
  onEditDay: () => void;
}

function TodayDetail({ onEditDay }: TodayDetailProps) {
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const now = useNow(60_000);

  const dateKey = formatDateKey(now);
  const entry = getDayOverride(overrides, dateKey);
  const dayType = entry?.type ?? 'work';
  const multiplier = entry?.multiplier ?? 1;

  const year = now.getFullYear();
  const month = now.getMonth();
  const daily = dailySalary(year, month, config, overrides, HOLIDAYS);
  const hourly = effectiveHourlyRate(now, config, overrides, HOLIDAYS);
  const earned = todayEarned(now, config, overrides, HOLIDAYS);
  const isWork = isWorkday(now, config, overrides, HOLIDAYS);

  const typeLabel: Record<string, string> = {
    work: '工作日', paid_overtime: '加班', freelance: '自由/兼职', leave: '请假', rest: '休息日',
  };

  const timeText = config.salaryMode === 'monthly'
    ? `${config.startTime}–${config.endTime}`
    : '见工时模板';

  return (
    <div className={styles.todayDetail}>
      <div className={styles.todayDetailHeader}>
        <span className={styles.todayDetailTitle}>今日详情</span>
        <button type="button" className={styles.editBtn} onClick={onEditDay}>
          <CaretRight size={12} weight="bold" />
          编辑
        </button>
      </div>

      <div className={styles.todayDetailRows}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>类型</span>
          <span className={styles.detailValue}>{typeLabel[dayType] ?? dayType}{multiplier > 1 ? ` ×${multiplier}` : ''}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>工时</span>
          <span className={styles.detailValue}>{timeText}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>日薪</span>
          <span className={styles.detailValue}>¥{daily.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>时薪</span>
          <span className={styles.detailValue}>¥{hourly.toFixed(2)}/h</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>今日已赚</span>
          <span className={`${styles.detailValue} ${styles.detailEarn}`}>
            {isWork ? `¥${earned.toFixed(2)}` : '休息日'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────

interface DesktopRightPanelProps {
  page: DesktopTabId;
  onNavigateToCalendar?: (dateKey: string) => void;
}

export function DesktopRightPanel({ page, onNavigateToCalendar }: DesktopRightPanelProps) {
  // 今日页：日历选中日期时跳到日历 tab
  function handlePickDate(key: string) {
    onNavigateToCalendar?.(key);
  }

  if (page === 'today') {
    return (
      <aside className={styles.panel}>
        <MiniCalendar onPickDate={handlePickDate} />

        <TodayDetail onEditDay={() => onNavigateToCalendar?.('')} />

        <div className={styles.section}>
          <div className={styles.sectionTitle}>等价换算</div>
          <ConvertPanel mode="compact" showAllLink onShowAll={() => {}} />
        </div>
      </aside>
    );
  }

  // calendar tab: right panel is reserved for DaySheet inline editing
  // handled by CalendarPage itself, so right panel shows a placeholder
  return (
    <aside className={styles.panel}>
      <div className={styles.calHint}>
        <span>← 点击日历日期</span>
        <span>在右侧编辑设置</span>
      </div>
    </aside>
  );
}
