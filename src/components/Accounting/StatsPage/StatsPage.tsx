/**
 * @fileoverview StatsPage — 记账统计页三视图（v2.2 · TASK-038）
 *
 * 日 / 月 / 年三视图 + 支出 / 收入切换：
 * - 日：选中日记录列表（纯列表，无图表）
 * - 月：当月每日收/支双柱图 + 分类排行；点柱下钻到日
 * - 年：全年 12 月收/支双柱图 + 分类排行；点柱下钻到月
 * 汇总条显示本期总支出/收入与环比上期 ±%。
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
import { IconByKey } from '../../IconByKey';
import { StatsBarChart, type BarChartItem } from './StatsBarChart';
import { CategoryRankList } from './CategoryRankList';
import { CategoryRecordsPage } from '../CategoryRecordsPage';
import { AddRecordModal } from '../AddRecordModal';
import { PageTopbar } from '../../PageTopbar';
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
  const accounts = useAccountStore((s) => s.accounts);
  const updateRecord = useAccountStore((s) => s.updateRecord);

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
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
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

  // v2.5 T-411：默认打开「日」视图（与计时侧 fish 对应「日统计」）
  const [view, setView] = useState<StatsView>('day');
  const [type, setType] = useState<RecordType>('expense');
  const [dayKey, setDayKey] = useState(getTodayKey());
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [year, setYear] = useState(new Date().getFullYear());
  const [rankCategoryId, setRankCategoryId] = useState<string | null>(null);
  /** v2.3 T-307：虚拟/实际筛选开关 */
  const [includeVirtual, setIncludeVirtual] = useState(false);
  const statsOptions = useMemo(() => ({ includeVirtualPool: includeVirtual }), [includeVirtual]);
  const baseRecords = useMemo(
    () => (includeVirtual ? records : visibleRecords(records)),
    [records, includeVirtual],
  );

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

  // ── 分类排行（月/年视图） ───────────────────────────────
  const ranks = useMemo(() => {
    if (view === 'day') return [];
    return aggregateByCategory(currentRecords, type, statsOptions);
  }, [view, currentRecords, type, statsOptions]);

  // ── 日视图：记录列表 ────────────────────────────────────
  // v2.4 T-410：列表用 listableRecords —— 认领付款记录保留展示（标「已关联池」），
  // 仅排除存量虚拟预扣；汇总/图表仍走 baseRecords（visibleRecords）避免重复计算
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

  const todayKey = getTodayKey();
  const typeLabel = type === 'expense' ? '支出' : '收入';
  const nowDate = new Date();

  return (
    <div className={styles.page}>
      {/* v2.5 T-415：与计时侧 FISH 页位置对应的标题栏 */}
      <PageTopbar
        eyebrow="stats"
        english="Where it all goes"
        right={`${nowDate.getMonth() + 1}/${nowDate.getDate()}`}
        title="日统计"
      />
      <div className={styles.controls}>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
        <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />
        <label className={styles.virtualToggle}>
          <input
            type="checkbox"
            checked={includeVirtual}
            onChange={(e) => setIncludeVirtual(e.target.checked)}
          />
          <span>含虚拟池预扣</span>
        </label>
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
                <DayRecordRow
                  key={record.id}
                  record={record}
                  isDragging={dragRecord?.id === record.id}
                  onOpen={() => handleOpenRecord(record)}
                />
              ))}
            </div>
          )}
          {dragRecord && (
            <AccountDock accounts={accounts} currentAccountId={dragRecord.accountId} />
          )}
          <DragOverlay dropAnimation={null}>
            {dragRecord ? <DragRecordCard record={dragRecord} /> : null}
          </DragOverlay>
        </DndContext>
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

      {/* v2.4 T-410：点开记录查看详情、修改金额与分类 */}
      <AddRecordModal
        open={editingRecord !== null}
        editingRecord={editingRecord}
        onClose={() => setEditingRecord(null)}
      />
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

interface DayRecordRowProps {
  record: AccountRecord;
  isDragging: boolean;
  /** v2.4 T-410：点击打开详情编辑 */
  onOpen: () => void;
}

/** 日视图记录行：分类图标 + 分类名 + 备注 + 账户标签 + 金额（v2.4：整行可拖拽归入账户，点击编辑） */
function DayRecordRow({ record, isDragging, onOpen }: DayRecordRowProps) {
  const categories = useAccountStore((s) => s.categories);
  const accounts = useAccountStore((s) => s.accounts);
  const { attributes, listeners, setNodeRef } = useDraggable({ id: record.id });
  const category = categories.find((c) => c.id === record.categoryId);
  const account = accounts.find((a) => a.id === record.accountId);
  const name = record.isUncategorized ? '未分类' : (category?.name ?? '未知分类');
  const icon = record.isUncategorized ? 'package' : (category?.icon ?? '❓');
  const color = record.isUncategorized ? 'var(--muted)' : (category?.color ?? 'var(--muted)');
  const isExpense = record.type === 'expense';
  // v2.4 T-409：池逐日生成的均摊记录（收入=虚拟到账 / 支出=虚拟均摊）
  const isPoolDaily = !!record.poolId && !record.poolStatus;
  // v2.4 T-410：均摊记录已关联实际入账/支出（虚拟变实际）
  const isSettled = isPoolDaily && !!record.poolSettledAt;
  // v2.4 T-410：认领付款记录（真实流水，已关联池，不参与统计）
  const isClaimed = record.poolStatus === 'claimed';
  const cls = [
    styles.dayRow,
    styles.dayRowDraggable,
    isDragging ? styles.dayRowDragging : '',
  ].filter(Boolean).join(' ');
  // 副标题优先级：已关联结算信息 > 备注
  const sub = isSettled
    ? `已关联 · ${formatSettledDate(record.poolSettledAt!)} · ¥${formatAmount(record.poolSettledAmount ?? Math.abs(record.amount))}`
    : record.note?.trim() || null;
  return (
    <div ref={setNodeRef} className={cls} onClick={onOpen} {...listeners} {...attributes}>
      <span className={styles.dayRowIcon} style={{ background: color }}>
        <IconByKey icon={icon} size={16} weight="regular" color="#fff" />
      </span>
      <span className={styles.dayRowInfo}>
        <span className={styles.dayRowName}>
          {name}
          {isClaimed && <span className={styles.linkedTag}>已关联池 · 不计统计</span>}
          {isSettled && <span className={styles.linkedTag}>已关联池</span>}
          {isPoolDaily && !isSettled && (
            <span
              className={record.poolDirection === 'in' ? styles.virtualTagIn : styles.virtualTagOut}
            >
              {record.poolDirection === 'in' ? '虚拟到账' : '虚拟均摊'}
            </span>
          )}
        </span>
        {sub ? <span className={styles.dayRowSub}>{sub}</span> : null}
      </span>
      {account ? (
        <span className={styles.dayRowAcct}>
          <span className={styles.dayRowAcctDot} style={{ background: account.color }} />
          {account.name}
        </span>
      ) : (
        <span className={`${styles.dayRowAcct} ${styles.dayRowAcctNone}`}>未归入</span>
      )}
      <span className={`${styles.dayRowAmt} ${isExpense ? styles.amtExpense : styles.amtIncome}`}>
        {isExpense ? '-' : '+'}¥{formatAmount(Math.abs(record.amount))}
      </span>
    </div>
  );
}

/** 结算时间戳 → "M月D日"（同年省略年份） */
function formatSettledDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}年${md}`;
}

/** v2.4：拖拽时的浮动记录卡（DragOverlay 内容） */
function DragRecordCard({ record }: { record: AccountRecord }) {
  const categories = useAccountStore((s) => s.categories);
  const category = categories.find((c) => c.id === record.categoryId);
  const name = record.isUncategorized ? '未分类' : (category?.name ?? '未知分类');
  const icon = record.isUncategorized ? 'package' : (category?.icon ?? '❓');
  const color = record.isUncategorized ? 'var(--muted)' : (category?.color ?? 'var(--muted)');
  const isExpense = record.type === 'expense';
  return (
    <div className={styles.dragCard}>
      <span className={styles.dayRowIcon} style={{ background: color }}>
        <IconByKey icon={icon} size={16} weight="regular" color="#fff" />
      </span>
      <span className={styles.dayRowName}>{name}</span>
      <span className={`${styles.dayRowAmt} ${isExpense ? styles.amtExpense : styles.amtIncome}`}>
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
