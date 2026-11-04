/**
 * @fileoverview JourneyListPage — 一程列表（v3.1 TASK-063 重设计）
 *
 * 设计语言：护照页 / 旅行手账。
 * - 头部：小圆钮返回 + 居中「ONE WAY / 一程」+ 墨色圆钮新建
 * - 统计行：细线夹住「N 程 · N 笔 · 合计 ¥X」
 * - 封面卡：16:9 封面压衬线标题 + 圆形邮戳（起始日期 / 支出·收入）+ 底部三项统计
 * - 无封面：墨底 + 纸纹 + 标题首字做印刷封面，不用渐变占位色
 * - 尾部：「开始新的一程」虚线按钮 + mono 页脚
 *
 * 数据口径：金额取一程内 Σ|amount|，类型由收入/支出合计决定（与详情页一致）。
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals } from '../../../lib/accounting/journey';
import { formatAmount } from '../../../lib/accounting';
import { useImage } from '../../../hooks/useImage';
import { JourneyDetailPage } from './JourneyDetailPage';
import { JourneyEditModal } from './JourneyEditModal';
import { Plus, ArrowLeft, CaretRight, AirplaneTilt } from '@phosphor-icons/react';
import styles from './JourneyListPage.module.css';

interface JourneyListPageProps {
  onBack: () => void;
  /** v3.0 TASK-059：选中一程时让父级接管跳转（避免内嵌 MinePage） */
  onPick?: (id: string) => void;
}

/** 一程的展示口径（列表卡与头部统计共用） */
interface JourneyCardStats {
  count: number;
  type: 'income' | 'expense';
  total: number;
  days: number;
  perDay: number;
  firstKey: string;
  lastKey: string;
}

/** 由聚合结果推导展示口径：类型按合计大小决定，天数按首尾 dateKey 差值 +1。 */
function toCardStats(summary: {
  count: number;
  expenseTotal: number;
  incomeTotal: number;
  firstKey: string;
  lastKey: string;
}): JourneyCardStats {
  const type: 'income' | 'expense' =
    summary.incomeTotal > summary.expenseTotal ? 'income' : 'expense';
  const total = type === 'income' ? summary.incomeTotal : summary.expenseTotal;
  const days =
    summary.firstKey && summary.lastKey
      ? Math.max(
          1,
          Math.round(
            (new Date(summary.lastKey).getTime() - new Date(summary.firstKey).getTime()) /
              86_400_000,
          ) + 1,
        )
      : 0;
  return {
    count: summary.count,
    type,
    total,
    days,
    perDay: days > 0 ? total / days : 0,
    firstKey: summary.firstKey,
    lastKey: summary.lastKey,
  };
}

/** 「2026-10-06」→「10-06」 */
function shortKey(dateKey: string): string {
  return dateKey.slice(5);
}

/** 「2026-10-06」→「10/06」 */
function stampKey(dateKey: string): string {
  return dateKey.slice(5).replace('-', '/');
}

export function JourneyListPage({ onBack, onPick }: JourneyListPageProps) {
  const journeys = useAccountStore((s) => s.journeys);
  const records = useAccountStore((s) => s.records);
  const [internalDetailId, setInternalDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const handlePick = (id: string) => {
    if (onPick) {
      onPick(id);
    } else {
      setInternalDetailId(id);
    }
  };

  const detailId = onPick ? null : internalDetailId;

  const summaries = useMemo(() => journeyTotals(journeys, records), [journeys, records]);

  // 按 lastKey 降序排列
  const sorted = useMemo(
    () =>
      [...journeys].sort((a, b) => {
        const sA = summaries.get(a.id);
        const sB = summaries.get(b.id);
        const keyA = sA?.lastKey ?? String(a.updatedAt);
        const keyB = sB?.lastKey ?? String(b.updatedAt);
        return keyB.localeCompare(keyA);
      }),
    [journeys, summaries],
  );

  // 头部统计：程数 / 总笔数 / 合计金额
  const overall = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const journey of journeys) {
      const summary = summaries.get(journey.id);
      if (!summary) continue;
      count += summary.count;
      total += summary.total;
    }
    return { journeys: journeys.length, count, total };
  }, [journeys, summaries]);

  if (detailId) {
    return (
      <JourneyDetailPage
        journeyId={detailId}
        onBack={() => setInternalDetailId(null)}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.circleBtn} onClick={onBack} aria-label="返回">
          <ArrowLeft size={17} weight="bold" />
        </button>
        <div className={styles.headerCenter}>
          <div className={styles.overline}>ONE WAY</div>
          <h1 className={styles.headerTitle}>一程</h1>
        </div>
        <button
          type="button"
          className={`${styles.circleBtn} ${styles.addBtn}`}
          onClick={() => setCreateOpen(true)}
          aria-label="开始新的一程"
        >
          <Plus size={17} weight="bold" />
        </button>
      </header>

      <div className={styles.sumline}>
        <span>{overall.journeys} 程</span>
        <i aria-hidden />
        <span>{overall.count} 笔</span>
        <i aria-hidden />
        <b>合计 ¥{formatAmount(overall.total)}</b>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyStamp} aria-hidden>
            <span className={styles.emptyStampDate}>00/00</span>
            <span className={styles.emptyStampLine} />
            <AirplaneTilt size={16} weight="bold" />
          </div>
          <div className={styles.emptyTitle}>还没有启程</div>
          <div className={styles.emptyHint}>把一次远行，走成一程</div>
          <button type="button" className={styles.emptyAddBtn} onClick={() => setCreateOpen(true)}>
            开始新的一程
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {sorted.map((journey) => {
            const summary = summaries.get(journey.id);
            if (!summary) return null;
            const stats = toCardStats(summary);
            return (
              <div
                key={journey.id}
                className={styles.card}
                onClick={() => handlePick(journey.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePick(journey.id);
                  }
                }}
                aria-label={`打开一程 ${journey.title}`}
              >
                <div className={styles.photo}>
                  {journey.coverImageId ? (
                    <JourneyCoverImage imageId={journey.coverImageId} title={journey.title} />
                  ) : (
                    <div className={styles.photoFallback} aria-hidden>
                      <span className={styles.photoFallbackGlyph}>
                        {journey.title.slice(0, 1)}
                      </span>
                      <span className={styles.photoFallbackHint}>没有封面的旅程</span>
                    </div>
                  )}
                  <div className={styles.photoScrim} aria-hidden />
                  <div className={styles.onPhoto}>
                    <div className={styles.photoText}>
                      <div className={styles.photoTitle}>{journey.title}</div>
                      {stats.firstKey && (
                        <div className={styles.photoDates}>
                          {shortKey(stats.firstKey)} → {shortKey(stats.lastKey)}
                          {stats.days > 0 && ` · ${stats.days} 天`}
                        </div>
                      )}
                    </div>
                    {stats.firstKey && (
                      <span className={styles.stamp} aria-hidden>
                        <span className={styles.stampDate}>{stampKey(stats.firstKey)}</span>
                        <span className={styles.stampLine} />
                        <span className={styles.stampType}>
                          {stats.type === 'income' ? '收入' : '支出'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <span className={styles.stat}>
                    <span className={`${styles.statNum} ${stats.count === 0 ? styles.statZero : ''}`}>
                      {stats.count}
                    </span>
                    <span className={styles.statUnit}>笔</span>
                  </span>
                  <span className={styles.statSep} aria-hidden />
                  <span className={styles.stat}>
                    <span
                      className={`${styles.statNum} ${
                        stats.total === 0
                          ? styles.statZero
                          : stats.type === 'income'
                            ? styles.statIncome
                            : styles.statExpense
                      }`}
                    >
                      {stats.type === 'income' ? '+' : '-'}¥{formatAmount(stats.total)}
                    </span>
                    <span className={styles.statUnit}>{stats.type === 'income' ? '收入' : '支出'}</span>
                  </span>
                  <span className={styles.statSep} aria-hidden />
                  {stats.count === 0 ? (
                    <span className={styles.statEmptyHint}>还没有记录 · 进去记一笔</span>
                  ) : (
                    <span className={styles.stat}>
                      <span className={styles.statNum}>¥{formatAmount(stats.perDay)}</span>
                      <span className={styles.statUnit}>日均</span>
                    </span>
                  )}
                  <CaretRight size={15} weight="bold" className={styles.chev} aria-hidden />
                </div>
              </div>
            );
          })}

          <button type="button" className={styles.newBtn} onClick={() => setCreateOpen(true)}>
            <Plus size={15} weight="bold" />
            开始新的一程
          </button>
          <div className={styles.footNote}>走过的路，都算数</div>
        </div>
      )}

      <JourneyEditModal
        open={createOpen || editId != null}
        journeyId={editId}
        onClose={() => { setCreateOpen(false); setEditId(null); }}
        onCreated={(id) => {
          setCreateOpen(false);
          setEditId(null);
          // 直接打开详情页：若有 onPick 则交由父级导航，否则自管内部状态
          handlePick(id);
        }}
      />
    </div>
  );
}

/** 封面图（加载中保留纸色占位，避免高度跳动） */
function JourneyCoverImage({ imageId, title }: { imageId: string; title: string }) {
  const { url, status } = useImage(imageId);
  if (status === 'ok' && url) {
    return <img src={url} alt={`${title} 封面`} className={styles.photoImg} loading="lazy" />;
  }
  return (
    <div className={styles.photoFallback} aria-hidden>
      <span className={styles.photoFallbackGlyph}>{title.slice(0, 1)}</span>
      <span className={styles.photoFallbackHint}>
        {status === 'missing' ? '封面已删除' : '封面加载中'}
      </span>
    </div>
  );
}
