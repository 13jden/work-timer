/**
 * @fileoverview StatsPage — 记账统计页三视图（v2.2 · TASK-038）
 *
 * 日 / 月 / 年三视图 + 支出 / 收入切换：
 * - 日：选中日记录列表（纯列表，无图表）
 * - 月：当月每日收/支双柱图 + 分类排行；点柱下钻到日
 * - 年：全年 12 月收/支双柱图 + 分类排行；点柱下钻到月
 * 汇总条显示本期总支出/收入与环比上期 ±%。
 */
import { useMemo, useState } from 'react';
import { SegmentedControl } from '../../SegmentedControl';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord, RecordType } from '../../../lib/types';
import {
  filterByRange,
  aggregateByDay,
  aggregateByMonth,
  aggregateByCategory,
  sumRecords,
  shiftDay,
  shiftMonth,
} from '../../../lib/accounting/stats';
import { formatAmount, getTodayKey, getCurrentMonthKey } from '../../../lib/accounting';
import { IconByKey } from '../../IconByKey';
import { StatsBarChart, type BarChartItem } from './StatsBarChart';
import { CategoryRankList } from './CategoryRankList';
import { CategoryRecordsPage } from '../CategoryRecordsPage';
import styles from './StatsPage.module.css';

type StatsView = 'day' | 'month' | 'year';

const VIEW_OPTIONS: Array<{ value: StatsView; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

const TYPE_OPTIONS: Array<{ value: RecordType; label: string }> = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
];

/** 统计页（记账主题 tab 1）。 */
export function StatsPage() {
  const records = useAccountStore((s) => s.records);
  const categories = useAccountStore((s) => s.categories);

  const [view, setView] = useState<StatsView>('month');
  const [type, setType] = useState<RecordType>('expense');
  const [dayKey, setDayKey] = useState(getTodayKey());
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [year, setYear] = useState(new Date().getFullYear());
  const [rankCategoryId, setRankCategoryId] = useState<string | null>(null);

  // ── 本期 / 上期范围 ─────────────────────────────────────
  const ranges = useMemo(() => {
    if (view === 'day') {
      return { start: dayKey, end: dayKey, prevStart: shiftDay(dayKey, -1), prevEnd: shiftDay(dayKey, -1) };
    }
    if (view === 'month') {
      const prev = shiftMonth(monthKey, -1);
      return { start: `${monthKey}-01`, end: `${monthKey}-31`, prevStart: `${prev}-01`, prevEnd: `${prev}-31` };
    }
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      prevStart: `${year - 1}-01-01`,
      prevEnd: `${year - 1}-12-31`,
    };
  }, [view, dayKey, monthKey, year]);

  const currentRecords = useMemo(
    () => filterByRange(records, ranges.start, ranges.end),
    [records, ranges],
  );
  const summary = useMemo(() => sumRecords(currentRecords), [currentRecords]);
  const prevSummary = useMemo(() => {
    const prevRecords = filterByRange(records, ranges.prevStart, ranges.prevEnd);
    return sumRecords(prevRecords);
  }, [records, ranges]);

  // ── 月视图：每日双柱数据 ────────────────────────────────
  const monthChartItems = useMemo<BarChartItem[]>(() => {
    if (view !== 'month') return [];
    const byDay = aggregateByDay(currentRecords);
    const [y, m] = monthKey.split('-').map(Number);
    const days = new Date(y ?? 2026, m ?? 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const key = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
      const slot = byDay.get(key);
      return { key, label: String(i + 1), income: slot?.income ?? 0, expense: slot?.expense ?? 0 };
    });
  }, [view, currentRecords, monthKey]);

  // ── 年视图：每月双柱数据 ────────────────────────────────
  const yearChartItems = useMemo<BarChartItem[]>(() => {
    if (view !== 'year') return [];
    const byMonth = aggregateByMonth(currentRecords);
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      const slot = byMonth.get(key);
      return { key, label: `${i + 1}月`, income: slot?.income ?? 0, expense: slot?.expense ?? 0 };
    });
  }, [view, currentRecords, year]);

  // ── 分类排行（月/年视图） ───────────────────────────────
  const ranks = useMemo(() => {
    if (view === 'day') return [];
    return aggregateByCategory(currentRecords, type);
  }, [view, currentRecords, type]);

  // ── 日视图：记录列表 ────────────────────────────────────
  const dayRecords = useMemo(
    () => [...currentRecords].sort((a, b) => b.createdAt - a.createdAt),
    [currentRecords],
  );

  const todayKey = getTodayKey();
  const typeLabel = type === 'expense' ? '支出' : '收入';

  return (
    <div className={styles.page}>
      <div className={styles.controls}>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
        <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryLabel}>本期支出</span>
          <span className={styles.summaryValue}>¥{formatAmount(summary.expense)}</span>
          <DeltaText current={summary.expense} prev={prevSummary.expense} badWhenUp />
        </div>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryLabel}>本期收入</span>
          <span className={styles.summaryValue}>¥{formatAmount(summary.income)}</span>
          <DeltaText current={summary.income} prev={prevSummary.income} />
        </div>
      </div>

      {view === 'day' && (
        <>
          <PeriodNav
            title={formatDayTitle(dayKey)}
            onPrev={() => setDayKey(shiftDay(dayKey, -1))}
            onNext={() => setDayKey(shiftDay(dayKey, 1))}
          />
          {dayRecords.length === 0 ? (
            <div className={styles.empty}>当日暂无记录</div>
          ) : (
            <div className={styles.dayList}>
              {dayRecords.map((record) => (
                <DayRecordRow key={record.id} record={record} />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'month' && (
        <>
          <PeriodNav
            title={formatMonthTitle(monthKey)}
            onPrev={() => setMonthKey(shiftMonth(monthKey, -1))}
            onNext={() => setMonthKey(shiftMonth(monthKey, 1))}
          />
          <div className={styles.chartCard}>
            <ChartLegend />
            <StatsBarChart
              items={monthChartItems}
              activeKey={dayKey.startsWith(monthKey) ? todayKey : undefined}
              onBarClick={(key) => {
                setDayKey(key);
                setView('day');
              }}
            />
          </div>
          <CategoryRankList
            ranks={ranks}
            categories={categories}
            typeLabel={typeLabel}
            onSelect={setRankCategoryId}
          />
        </>
      )}

      {view === 'year' && (
        <>
          <PeriodNav
            title={`${year}年`}
            onPrev={() => setYear((v) => v - 1)}
            onNext={() => setYear((v) => v + 1)}
          />
          <div className={styles.chartCard}>
            <ChartLegend />
            <StatsBarChart
              items={yearChartItems}
              onBarClick={(key) => {
                setMonthKey(key);
                setView('month');
              }}
            />
          </div>
          <CategoryRankList
            ranks={ranks}
            categories={categories}
            typeLabel={typeLabel}
            onSelect={setRankCategoryId}
          />
        </>
      )}

      {rankCategoryId !== null && (
        <CategoryRecordsPage
          categoryId={rankCategoryId}
          type={type}
          onBack={() => setRankCategoryId(null)}
        />
      )}
    </div>
  );
}

// ── 子组件 ────────────────────────────────────────────────

interface PeriodNavProps {
  title: string;
  onPrev: () => void;
  onNext: () => void;
}

/** ‹ 期 › 切换器（尺寸复用日视图日期切换样式） */
function PeriodNav({ title, onPrev, onNext }: PeriodNavProps) {
  return (
    <div className={styles.periodNav}>
      <button type="button" className={styles.periodBtn} onClick={onPrev} aria-label="上一期">
        ‹
      </button>
      <span className={styles.periodTitle}>{title}</span>
      <button type="button" className={styles.periodBtn} onClick={onNext} aria-label="下一期">
        ›
      </button>
    </div>
  );
}

function ChartLegend() {
  return (
    <div className={styles.chartLegend}>
      <span>
        <span className={`${styles.legendDot} ${styles.legendExpense}`} />
        支出
      </span>
      <span>
        <span className={`${styles.legendDot} ${styles.legendIncome}`} />
        收入
      </span>
    </div>
  );
}

interface DeltaTextProps {
  current: number;
  prev: number;
  /** 数值上升是否为坏事（支出上升=坏，收入上升=好） */
  badWhenUp?: boolean;
}

/** 环比上期 ±%；上期为 0 时显示「上期无」 */
function DeltaText({ current, prev, badWhenUp }: DeltaTextProps) {
  if (prev <= 0) {
    return <span className={styles.summaryDelta}>{current > 0 ? '上期无记录' : '较上期 —'}</span>;
  }
  const pct = Math.round(((current - prev) / prev) * 100);
  const up = pct > 0;
  const bad = badWhenUp ? up : !up;
  const cls = pct === 0 ? styles.summaryDelta : `${styles.summaryDelta} ${bad ? styles.deltaBad : styles.deltaGood}`;
  return (
    <span className={cls}>
      较上期 {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  );
}

/** 日视图记录行：分类图标 + 分类名 + 备注 + 金额 */
function DayRecordRow({ record }: { record: AccountRecord }) {
  const categories = useAccountStore((s) => s.categories);
  const category = categories.find((c) => c.id === record.categoryId);
  const name = record.isUncategorized ? '未分类' : (category?.name ?? '未知分类');
  const icon = record.isUncategorized ? 'package' : (category?.icon ?? '❓');
  const color = record.isUncategorized ? 'var(--muted)' : (category?.color ?? 'var(--muted)');
  const isExpense = record.type === 'expense';
  return (
    <div className={styles.dayRow}>
      <span className={styles.dayRowIcon} style={{ background: color }}>
        <IconByKey icon={icon} size={16} color="#fff" />
      </span>
      <span className={styles.dayRowInfo}>
        <span className={styles.dayRowName}>{name}</span>
        {record.note?.trim() ? <span className={styles.dayRowSub}>{record.note}</span> : null}
      </span>
      <span className={`${styles.dayRowAmt} ${isExpense ? styles.amtExpense : styles.amtIncome}`}>
        {isExpense ? '-' : '+'}¥{formatAmount(Math.abs(record.amount))}
      </span>
    </div>
  );
}

// ── 日期工具 ──────────────────────────────────────────────

function formatDayTitle(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const week = weekdays[date.getDay()] ?? '';
  return `${m}月${d}日 · 周${week}`;
}

function formatMonthTitle(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${y}年${parseInt(m ?? '1', 10)}月`;
}
