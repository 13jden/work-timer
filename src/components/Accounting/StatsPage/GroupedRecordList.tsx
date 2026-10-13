/**
 * @fileoverview GroupedRecordList — 月/年统计视图的分组记录列表（v3.0 TASK-055 T-552/T-553）
 *
 * 月视图：DayGroup[] → 天头吸顶 + 当日记录列表
 * 年视图：MonthGroup[] → 月头可折叠（默认展开最近 2 个月）+ 月内按天分组
 *
 * 列表行复用 RecordRow 共用组件，点击行为由调用方 onOpenRecord 控制。
 */
import { useState } from 'react';
import type { AccountRecord } from '../../../lib/types';
import { groupByDay, groupByMonth, type DayGroup, type MonthGroup } from '../../../lib/accounting/stats';
import { formatAmount } from '../../../lib/accounting';
import { RecordRow } from '../RecordRow';
import styles from './GroupedRecordList.module.css';

/** 月视图 Props */
export interface MonthListProps {
  /** 本月全部记录（已通过 listableRecords 过滤虚拟预扣） */
  records: AccountRecord[];
  /** 当前选中日 key（用于高亮） */
  activeDayKey?: string;
  /** 点击记录打开编辑 */
  onOpenRecord: (record: AccountRecord) => void;
}

/** 月视图：按天分组，天头吸顶 */
export function MonthGroupedList({ records, activeDayKey, onOpenRecord }: MonthListProps) {
  const dayGroups = groupByDay(records);
  if (dayGroups.length === 0) return <div className={styles.empty}>当月暂无记录</div>;

  return (
    <div className={styles.groupedList}>
      {dayGroups.map((day) => (
        <DaySection
          key={day.dateKey}
          day={day}
          isActive={day.dateKey === activeDayKey}
          onOpenRecord={onOpenRecord}
        />
      ))}
    </div>
  );
}

/** 年视图 Props */
export interface YearListProps {
  /** 本年全部记录 */
  records: AccountRecord[];
  /** 当前选中月 key */
  activeMonthKey?: string;
  /** 当前选中日 key（用于月内高亮） */
  activeDayKey?: string;
  /** 点击记录打开编辑 */
  onOpenRecord: (record: AccountRecord) => void;
  /** 跳转到指定月 */
  onNavigateMonth: (monthKey: string) => void;
}

/** 年视图：按月分组，月头可折叠（默认展开最近 2 个月） */
export function YearGroupedList({
  records,
  activeMonthKey,
  activeDayKey,
  onOpenRecord,
  onNavigateMonth,
}: YearListProps) {
  // 提取 monthKey 用于判断"最近 2 个月"
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const currentYearMonth = `${thisYear}-${String(thisMonth).padStart(2, '0')}`;
  const prevYearMonth = `${thisYear}-${String(Math.max(thisMonth - 1, 1)).padStart(2, '0')}`;

  const yearMonthGroups = groupByMonth(records);
  // 默认展开：当前月 + 上月（在同一年的前提下）
  const recentTwo = new Set([currentYearMonth, prevYearMonth]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const g of yearMonthGroups) {
      if (!recentTwo.has(g.monthKey)) init.add(g.monthKey);
    }
    return init;
  });

  if (yearMonthGroups.length === 0) return <div className={styles.empty}>本年暂无记录</div>;

  return (
    <div className={styles.groupedList}>
      {yearMonthGroups.map((month: MonthGroup) => {
        const isCollapsed = collapsed.has(month.monthKey);
        const monthNum = parseInt(month.monthKey.split('-')[1]!, 10);
        const year = month.monthKey.split('-')[0]!;
        const isCurrentMonth = month.monthKey === currentYearMonth;

        return (
          <div key={month.monthKey} className={styles.monthGroup}>
            {/* 月头 */}
            <button
              type="button"
              className={`${styles.monthHead} ${month.monthKey === activeMonthKey ? styles.monthHeadActive : ''}`}
              onClick={() => {
                // 任意月份均可折叠/展开
                if (isCollapsed) {
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    next.delete(month.monthKey);
                    return next;
                  });
                } else {
                  setCollapsed((prev) => new Set(prev).add(month.monthKey));
                }
              }}
              aria-expanded={!isCollapsed}
            >
              <span className={styles.monthTitle}>
                {year === String(thisYear) ? `${monthNum}月` : `${year}年${monthNum}月`}
                {isCurrentMonth && <span className={styles.currentBadge}>本月</span>}
              </span>
              <span className={styles.monthSummary}>
                {month.expense > 0 && (
                  <span className={styles.summaryExpense}>−¥{formatAmount(month.expense)}</span>
                )}
                {month.income > 0 && (
                  <span className={styles.summaryIncome}>+¥{formatAmount(month.income)}</span>
                )}
                <span className={`${styles.collapseIcon} ${isCollapsed ? styles.collapsed : ''}`}>
                  {isCollapsed ? '›' : '‹'}
                </span>
              </span>
            </button>

            {/* 月内按天分组 */}
            {!isCollapsed && (
              <div className={styles.days}>
                {month.days.map((day: DayGroup) => (
                  <DaySection
                    key={day.dateKey}
                    day={day}
                    isActive={day.dateKey === activeDayKey}
                    onOpenRecord={onOpenRecord}
                    onMonthDayClick={() => {
                      onNavigateMonth(month.monthKey);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 内部组件 ────────────────────────────────────────────────

interface DaySectionProps {
  day: DayGroup;
  isActive: boolean;
  onOpenRecord: (record: AccountRecord) => void;
  /** 月视图内：点击天头 → 跳转到日视图 */
  onMonthDayClick?: () => void;
}

function DaySection({ day, isActive, onOpenRecord, onMonthDayClick }: DaySectionProps) {
  const [y, m, d] = day.dateKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const week = weekdays[date.getDay()] ?? '';
  const monthDay = `${m}月${d}日`;

  return (
    <div className={styles.dayGroup}>
      {/* 天头：吸顶 */}
      <div className={`${styles.dayHead} ${isActive ? styles.dayHeadActive : ''}`}>
        <span
          className={styles.dayLabel}
          onClick={onMonthDayClick}
          role={onMonthDayClick ? 'button' : undefined}
          tabIndex={onMonthDayClick ? 0 : undefined}
        >
          {monthDay}
          <span className={styles.weekday}>· 周{week}</span>
        </span>
        <span className={styles.daySummary}>
          {day.expense > 0 && (
            <span className={styles.summaryExpense}>−¥{formatAmount(day.expense)}</span>
          )}
          {day.income > 0 && (
            <span className={styles.summaryIncome}>+¥{formatAmount(day.income)}</span>
          )}
        </span>
      </div>

      {/* 记录行 */}
      <div className={styles.dayRecords}>
        {day.records.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            onOpen={() => onOpenRecord(record)}
          />
        ))}
      </div>
    </div>
  );
}
