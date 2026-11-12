/**
 * @fileoverview StatsPage — 记账统计页三视图（v3.0 · TASK-055）
 *
 * v3.0 变更：
 * - 日视图：默认列表（现状不变）
 * - 月视图：默认列表（月/天分组），可选切换统计（柱图+分类排行）
 * - 年视图：默认列表（月分组折叠），可选切换统计（柱图+分类排行）
 *
 * 视图结构（v3.0）：
 * - 汇总卡片：日/月/年 segmented + 汇总双块 + 列表/统计 segmented
 * - 日：选中日记录列表（DndContext 拖拽归入账户）
 * - 月/列表：MonthGroupedList（天头吸顶）
 * - 年/列表：YearGroupedList（月头折叠）
 * - 月/统计：双柱图 + 分类排行（点柱下钻到日→切列表模式）
 * - 年/统计：双柱图 + 分类排行（点柱下钻到月→切列表模式）
 */
import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SegmentedControl } from '../../SegmentedControl';
import { useAccountStore } from '../../../store/accountStore';
import { useConfigStore } from '../../../store/configStore';
import type { Account, AccountRecord, RecordType } from '../../../lib/types';
import {
  filterByRange,
  aggregateByDay,
  aggregateByMonth,
  aggregateByCategory,
  sumRecords,
  shiftDay,
  shiftMonth,
  listableRecords,
} from '../../../lib/accounting/stats';
import { formatAmount, getTodayKey, getCurrentMonthKey, visibleRecords } from '../../../lib/accounting';
import { CategoryIcon } from '../../IconByKey';
import { StatsBarChart, type BarChartItem } from './StatsBarChart';
import { CategoryRankList } from './CategoryRankList';
import { MonthGroupedList, YearGroupedList } from './GroupedRecordList';
import { CategoryRecordsPage } from '../CategoryRecordsPage';
import { AddRecordModal } from '../AddRecordModal';
import { ImagePreview } from '../ImagePreview';
import { PageTopbar } from '../../PageTopbar';
import { RecordRow } from '../RecordRow';
import styles from './StatsPage.module.css';

type StatsView = 'day' | 'month' | 'year';
type ListOrChart = 'list' | 'chart';

const VIEW_OPTIONS: Array<{ value: StatsView; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

const LIST_CHART_OPTIONS: Array<{ value: ListOrChart; label: string }> = [
  { value: 'list', label: '列表' },
  { value: 'chart', label: '统计' },
];

/** 统计页（记账主题 tab 1）。 */
export function StatsPage() {
  const records = useAccountStore((s) => s.records);
  const categories = useAccountStore((s) => s.categories);
  const accounts = useAccountStore((s) => s.accounts);
  const updateRecord = useAccountStore((s) => s.updateRecord);
  // v3.0 TASK-057：钱包模式开关。关闭时禁用 DndContext + AccountDock（拖拽归入账户）
  const walletEnabled = useConfigStore((s) => s.walletEnabled ?? false);

  /** v2.4：拖拽归入账户 — 当前拖动的记录 */
  const [dragRecord, setDragRecord] = useState<AccountRecord | null>(null);
  /** v2.4 T-410：点击记录打开编辑弹窗 */
  const [editingRecord, setEditingRecord] = useState<AccountRecord | null>(null);
  /** 拖拽一旦启动就抑制随后的 click（避免拖完误触编辑弹窗） */
  const suppressClickRef = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    suppressClickRef.current = true;
    const rec = records.find((r) => r.id === event.active.id);
    setDragRecord(rec ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragRecord(null);
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    const targetAccountId = event.over ? String(event.over.id) : null;
    if (!targetAccountId) return;
    const rec = records.find((r) => r.id === event.active.id);
    if (!rec || rec.accountId === targetAccountId) return;
    updateRecord(rec.id, { accountId: targetAccountId });
  };

  const handleOpenRecord = (record: AccountRecord) => {
    if (suppressClickRef.current) return;
    setEditingRecord(record);
  };

  // v3.0 TASK-055：默认「日」视图 + 列表模式（会话内状态，不持久化）
  const [view, setView] = useState<StatsView>('day');
  /** 列表 / 统计 切换（仅月/年视图生效；日视图只有列表） */
  const [listOrChart, setListOrChart] = useState<ListOrChart>('list');
  const [dayKey, setDayKey] = useState(getTodayKey());
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [year, setYear] = useState(new Date().getFullYear());
  /** v3.1：选中的分类 + 所属口径（支出/收入两套排行同时展示，点谁带谁） */
  const [rankSelection, setRankSelection] = useState<{ categoryId: string; type: RecordType } | null>(null);
  /** v3.0 TASK-056：点击缩略图触发的全屏预览 */
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  /** v2.3 T-307：虚拟/实际筛选开关 */
  const [includeVirtual] = useState(false);
  const statsOptions = useMemo(() => ({ includeVirtualPool: includeVirtual }), [includeVirtual]);
  const baseRecords = useMemo(
    () => (includeVirtual ? records : visibleRecords(records)),
    [records, includeVirtual],
  );

  // 视图切换时自动切到列表模式
  const handleViewChange = (v: StatsView) => {
    setView(v);
    // 月/年 切换时回到列表；日视图强制列表
    if (v !== 'day') setListOrChart('list');
  };

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
    () => filterByRange(baseRecords, ranges.start, ranges.end),
    [baseRecords, ranges],
  );
  const summary = useMemo(() => sumRecords(currentRecords, statsOptions), [currentRecords, statsOptions]);
  const prevSummary = useMemo(() => {
    const prevRecords = filterByRange(baseRecords, ranges.prevStart, ranges.prevEnd);
    return sumRecords(prevRecords, statsOptions);
  }, [baseRecords, ranges, statsOptions]);

  // ── 月视图：每日双柱数据 ────────────────────────────────
  const monthChartItems = useMemo<BarChartItem[]>(() => {
    if (view !== 'month') return [];
    const byDay = aggregateByDay(currentRecords, statsOptions);
    const [y, m] = monthKey.split('-').map(Number);
    const days = new Date(y ?? 2026, m ?? 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const key = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
      const slot = byDay.get(key);
      return { key, label: String(i + 1), income: slot?.income ?? 0, expense: slot?.expense ?? 0 };
    });
  }, [view, currentRecords, monthKey, statsOptions]);

  // ── 年视图：每月双柱数据 ────────────────────────────────
  const yearChartItems = useMemo<BarChartItem[]>(() => {
    if (view !== 'year') return [];
    const byMonth = aggregateByMonth(currentRecords, statsOptions);
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      const slot = byMonth.get(key);
      return { key, label: `${i + 1}月`, income: slot?.income ?? 0, expense: slot?.expense ?? 0 };
    });
  }, [view, currentRecords, year, statsOptions]);

  // ── 分类排行（月/年视图）：支出 / 收入 两套同时展示 ────
  const expenseRanks = useMemo(() => {
    if (view === 'day') return [];
    return aggregateByCategory(currentRecords, 'expense', statsOptions);
  }, [view, currentRecords, statsOptions]);
  const incomeRanks = useMemo(() => {
    if (view === 'day') return [];
    return aggregateByCategory(currentRecords, 'income', statsOptions);
  }, [view, currentRecords, statsOptions]);

  // ── 日视图：记录列表（listableRecords） ─────────────────
  const listBaseRecords = useMemo(
    () => (includeVirtual ? records : listableRecords(records)),
    [records, includeVirtual],
  );
  const dayRecords = useMemo(
    () =>
      [...filterByRange(listBaseRecords, ranges.start, ranges.end)].sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
    [listBaseRecords, ranges],
  );

  // ── 月/年列表用数据（listableRecords） ─────────────────
  const monthListRecords = useMemo(
    () => filterByRange(listBaseRecords, ranges.start, ranges.end),
    [listBaseRecords, ranges],
  );
  const yearListRecords = useMemo(
    () => filterByRange(listBaseRecords, ranges.start, ranges.end),
    [listBaseRecords, ranges],
  );

  // 统计模式点柱 → 切列表并下钻
  const handleBarClickMonth = (key: string) => {
    setDayKey(key);
    setView('day');
  };

  const handleBarClickYear = (key: string) => {
    setMonthKey(key);
    setView('month');
  };

  const todayKey = getTodayKey();
  const nowDate = new Date();

  // 列表/统计切换器仅月/年显示
  const showListChartToggle = view !== 'day';

  return (
    <div className={styles.page}>
      <PageTopbar
        eyebrow="stats"
        english="Where it all goes"
        right={`${nowDate.getMonth() + 1}/${nowDate.getDate()}`}
        title="日统计"
      />

      {/* v3.0 TASK-055：「账本头条」汇总卡片 — 顶部日/月/年满宽 segmented（页面级控件，不动共用组件） + 汇总带：期间标签 + 本期双块大数字 + 列表/统计切换 */}
      <div className={styles.viewSwitcher}>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={handleViewChange} />
      </div>

      <div className={styles.summaryCard}>
        {/* 头牌：期间标签 + 范围（mono 小字） */}
        <div className={styles.summaryHead}>
          <span className={styles.periodLabel}>{periodLabel(view, dayKey, monthKey, year)}</span>
          <span className={styles.periodRange}>{rangeLabel(view, ranges.start, ranges.end)}</span>
        </div>

        {/* 双块大数字（等宽数字体 + 支出/收入色，与 v3.1 手账页数字语言一致） */}
        <div className={styles.summaryNumbers}>
          <div className={styles.summaryBlock}>
            <span className={styles.summaryLabel}>支出</span>
            <span className={`${styles.summaryValue} ${styles.valueExpense}`}>
              <span className={styles.summarySign} aria-hidden="true">−</span>
              {formatAmount(summary.expense)}
            </span>
            <DeltaText current={summary.expense} prev={prevSummary.expense} badWhenUp />
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryBlock}>
            <span className={styles.summaryLabel}>收入</span>
            <span className={`${styles.summaryValue} ${styles.valueIncome}`}>
              <span className={styles.summarySign} aria-hidden="true">+</span>
              {formatAmount(summary.income)}
            </span>
            <DeltaText current={summary.income} prev={prevSummary.income} />
          </div>
        </div>

        {/* 列表/统计切换（仅月/年） */}
        {showListChartToggle && (
          <div className={styles.summaryToggle}>
            <ModeSwitch options={LIST_CHART_OPTIONS} value={listOrChart} onChange={setListOrChart} />
          </div>
        )}
      </div>

      {/* ── 日视图(始终列表) ─────────────────────────────────── */}
      {view === 'day' && walletEnabled && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragRecord(null)}
        >
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
                <DraggableRecordRow
                  key={record.id}
                  record={record}
                  isDragging={dragRecord?.id === record.id}
                  onOpen={() => handleOpenRecord(record)}
                  onPreviewImage={setPreviewImageId}
                />
              ))}
            </div>
          )}
          {dragRecord && <AccountDock accounts={accounts} currentAccountId={dragRecord.accountId} />}
          <DragOverlay dropAnimation={null}>
            {dragRecord ? <DragRecordCard record={dragRecord} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* v3.0 TASK-057：钱包关闭时的日视图(无拖拽归入) */}
      {view === 'day' && !walletEnabled && (
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
                <RecordRow
                  key={record.id}
                  record={record}
                  onOpen={() => handleOpenRecord(record)}
                  onPreviewImage={setPreviewImageId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 月视图：列表模式 ─────────────────────────────────── */}
      {view === 'month' && listOrChart === 'list' && (
        <>
          <PeriodNav
            title={formatMonthTitle(monthKey)}
            onPrev={() => setMonthKey(shiftMonth(monthKey, -1))}
            onNext={() => setMonthKey(shiftMonth(monthKey, 1))}
          />
          <MonthGroupedList
            records={monthListRecords}
            activeDayKey={dayKey.startsWith(monthKey) ? todayKey : undefined}
            onOpenRecord={handleOpenRecord}
            onPreviewImage={setPreviewImageId}
          />
        </>
      )}

      {/* ── 月视图：统计模式 ─────────────────────────────────── */}
      {view === 'month' && listOrChart === 'chart' && (
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
                handleBarClickMonth(key);
                setListOrChart('list');
              }}
            />
          </div>
          {/* v3.1：支出 / 收入 两套排行同时展示，不再切口径 */}
          <CategoryRankList
            ranks={expenseRanks}
            categories={categories}
            typeLabel="支出"
            onSelect={(categoryId) => setRankSelection({ categoryId, type: 'expense' })}
          />
          <CategoryRankList
            ranks={incomeRanks}
            categories={categories}
            typeLabel="收入"
            onSelect={(categoryId) => setRankSelection({ categoryId, type: 'income' })}
          />
        </>
      )}

      {/* ── 年视图：列表模式 ─────────────────────────────────── */}
      {view === 'year' && listOrChart === 'list' && (
        <>
          <PeriodNav
            title={`${year}年`}
            onPrev={() => setYear((v) => v - 1)}
            onNext={() => setYear((v) => v + 1)}
          />
          <YearGroupedList
            records={yearListRecords}
            activeMonthKey={monthKey}
            activeDayKey={dayKey}
            onOpenRecord={handleOpenRecord}
            onPreviewImage={setPreviewImageId}
            onNavigateMonth={(mk) => {
              setMonthKey(mk);
              setView('month');
            }}
          />
        </>
      )}

      {/* ── 年视图：统计模式 ─────────────────────────────────── */}
      {view === 'year' && listOrChart === 'chart' && (
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
                handleBarClickYear(key);
                setListOrChart('list');
              }}
            />
          </div>
          {/* v3.1：支出 / 收入 两套排行同时展示，不再切口径 */}
          <CategoryRankList
            ranks={expenseRanks}
            categories={categories}
            typeLabel="支出"
            onSelect={(categoryId) => setRankSelection({ categoryId, type: 'expense' })}
          />
          <CategoryRankList
            ranks={incomeRanks}
            categories={categories}
            typeLabel="收入"
            onSelect={(categoryId) => setRankSelection({ categoryId, type: 'income' })}
          />
        </>
      )}

      {rankSelection !== null && (
        <CategoryRecordsPage
          categoryId={rankSelection.categoryId}
          type={rankSelection.type}
          onBack={() => setRankSelection(null)}
        />
      )}

      <AddRecordModal
        open={editingRecord !== null}
        editingRecord={editingRecord}
        onClose={() => setEditingRecord(null)}
      />

      {/* v3.0 TASK-056：全屏图片预览 */}
      <ImagePreview imageId={previewImageId} onClose={() => setPreviewImageId(null)} />
    </div>
  );
}

// ── 子组件 ────────────────────────────────────────────────

interface ModeSwitchProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

/**
 * 统计页汇总带内的模式切换（本地实现，不改共用 SegmentedControl 的样式）。
 * 墨底胶囊 + mono 小字，跟汇总带的细线语言一致。
 */
function ModeSwitch<T extends string>({ options, value, onChange }: ModeSwitchProps<T>) {
  return (
    <div className={styles.modeSwitch} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`${styles.modeItem} ${value === option.value ? styles.modeItemActive : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface PeriodNavProps {
  title: string;
  onPrev: () => void;
  onNext: () => void;
}

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
  badWhenUp?: boolean;
}

function DeltaText({ current, prev, badWhenUp }: DeltaTextProps) {
  if (prev <= 0) {
    return <span className={styles.summaryDelta}>{current > 0 ? '上期无记录' : '较上期 —'}</span>;
  }
  const pct = Math.round(((current - prev) / prev) * 100);
  const up = pct > 0;
  const down = pct < 0;
  const bad = badWhenUp ? up : down;
  const cls = pct === 0 ? styles.summaryDelta : `${styles.summaryDelta} ${bad ? styles.deltaBad : styles.deltaGood}`;
  const arrow = up ? '▲' : down ? '▼' : '—';
  return (
    <span className={cls}>
      <span className={styles.deltaArrow} aria-hidden="true">{arrow}</span>
      <span className={styles.deltaPct}>{Math.abs(pct)}%</span>
      <span className={styles.deltaNote}>较上期</span>
    </span>
  );
}

interface DraggableRecordRowProps {
  record: AccountRecord;
  isDragging: boolean;
  onOpen: () => void;
  /** v3.0 TASK-056：点击缩略图预览 */
  onPreviewImage?: (imageId: string) => void;
}

/** 日视图记录行（整行可拖拽归入账户，点击编辑），复用 RecordRow 共用组件 */
function DraggableRecordRow({ record, isDragging, onOpen, onPreviewImage }: DraggableRecordRowProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: record.id });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.dayRowDraggable} ${isDragging ? styles.dayRowDragging : ''}`}
      {...listeners}
      {...attributes}
    >
      <RecordRow record={record} onOpen={onOpen} onPreviewImage={onPreviewImage} />
    </div>
  );
}

/** v2.4：拖拽时的浮动记录卡（DragOverlay 内容） */
function DragRecordCard({ record }: { record: AccountRecord }) {
  const categories = useAccountStore((s) => s.categories);
  const category = categories.find((c) => c.id === record.categoryId);
  const name = record.isUncategorized ? '未分类' : (category?.name ?? '未知分类');
  const icon = record.isUncategorized ? 'no' : (category?.icon ?? '❓');
  const color = record.isUncategorized ? 'var(--muted)' : (category?.color ?? 'var(--muted)');
  // v3.2 TASK-070：自定义分类图片
  const iconImageId = record.isUncategorized ? null : (category?.iconImageId ?? null);
  const isExpense = record.type === 'expense';
  return (
    <div className={styles.dragCard}>
      <span className={styles.dragCardIcon} style={{ background: color }}>
        <CategoryIcon icon={icon} imageId={iconImageId} size={16} weight="regular" color="#fff" />
      </span>
      <span className={styles.dragCardName}>{name}</span>
      <span className={`${styles.dragCardAmt} ${isExpense ? styles.amtExpense : styles.amtIncome}`}>
        {isExpense ? '-' : '+'}¥{formatAmount(Math.abs(record.amount))}
      </span>
    </div>
  );
}

interface AccountDockProps {
  accounts: Account[];
  currentAccountId: string;
}

/** v2.4：拖拽时底部显示的账户 dock，松手即归入对应账户 */
function AccountDock({ accounts, currentAccountId }: AccountDockProps) {
  return (
    <div className={styles.dockWrap}>
      <div className={styles.dockHint}>松开手指，归入对应账户</div>
      {accounts.length === 0 ? (
        <div className={styles.dockEmpty}>暂无账户，请先在 MINE 页添加</div>
      ) : (
        <div className={styles.dockCards}>
          {accounts.map((account) => (
            <DockCard
              key={account.id}
              account={account}
              isCurrent={account.id === currentAccountId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DockCard({ account, isCurrent }: { account: Account; isCurrent: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: account.id });
  const cls = [
    styles.dockCard,
    isCurrent ? styles.dockCardCurrent : '',
    isOver ? styles.dockCardOver : '',
  ].filter(Boolean).join(' ');
  return (
    <div ref={setNodeRef} className={cls}>
      {isCurrent && <span className={styles.dockCurrentTag}>当前</span>}
      <span className={styles.dockDot} style={{ background: account.color }} />
      <span className={styles.dockName}>{account.name}</span>
      <span className={styles.dockBalance}>¥{formatAmount(account.balance, true)}</span>
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

/** 期号主标签（日/月/年 + 期间标识） */
function periodLabel(view: StatsView, dayKey: string, monthKey: string, year: number): string {
  if (view === 'day') return dayKey.replace(/-/g, ' · ');
  if (view === 'month') return monthKey.replace(/-/g, ' · ');
  return `${year} · ANNUAL`;
}

/** 期号次标签（区间） */
function rangeLabel(view: StatsView, start: string, end: string): string {
  if (view === 'day') return 'ONE DAY';
  if (view === 'month') {
    const [, sm] = start.split('-');
    const [, em] = end.split('-');
    return sm === em ? `${sm}月 整月` : `${sm}月 — ${em}月`;
  }
  return 'JAN — DEC';
}
