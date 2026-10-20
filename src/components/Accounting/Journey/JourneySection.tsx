/**
 * @fileoverview JourneySection — MINE 页「旅游记录」入口卡（v3.0 TASK-059 T-596）
 *
 * 裸入口卡，点击或点击「查看全部」都会触发 onOpen 回调，由 MinePage
 * 切到独立全屏的 JourneyListPage。
 *
 * 设计：登机牌 / 护照页风 —— 撕角切口 + 邮戳圆 + 倾斜条纹底纹。
 */
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals } from '../../../lib/accounting/journey';
import { ArrowUpRight, AirplaneTilt } from '@phosphor-icons/react';
import styles from './JourneySection.module.css';

interface JourneySectionProps {
  onOpen: () => void;
}

export function JourneySection({ onOpen }: JourneySectionProps) {
  const journeys = useAccountStore((s) => s.journeys);
  const records = useAccountStore((s) => s.records);

  const summaries = useMemo(() => journeyTotals(journeys, records), [journeys, records]);

  const recent = useMemo(
    () =>
      [...journeys]
        .sort((a, b) => {
          const sA = summaries.get(a.id);
          const sB = summaries.get(b.id);
          const keyA = sA?.lastKey ?? String(a.updatedAt);
          const keyB = sB?.lastKey ?? String(b.updatedAt);
          return keyB.localeCompare(keyA);
        })[0],
    [journeys, summaries],
  );

  const totalCount = journeys.length;
  const recentSummary = recent ? summaries.get(recent.id) : undefined;
  const recentDate = recentSummary?.lastKey ?? '';

  return (
    <section
      className={styles.card}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      aria-label="打开旅游记录"
    >
      {/* 左上：邮戳 */}
      <div className={styles.stamp}>
        <div className={styles.stampCircle}>
          <AirplaneTilt size={16} weight="fill" />
        </div>
        <span className={styles.stampText}>TRIP</span>
      </div>

      {/* 主区 */}
      <div className={styles.body}>
        <div className={styles.eyebrow}>
          <span>旅游记录</span>
          {totalCount > 0 && <span className={styles.eyebrowDot} />}
          {totalCount > 0 && <span>{totalCount} 段</span>}
        </div>
        <div className={styles.title}>
          {totalCount === 0 ? '把一次旅行记成一段记录' : recent?.title ?? '旅游记录'}
        </div>
        {totalCount > 0 && recentSummary && recentSummary.count > 0 && (
          <div className={styles.meta}>
            {recentSummary.count} 笔{recentDate && ` · 截至 ${recentDate.slice(5)}`}
          </div>
        )}
      </div>

      {/* 右上：开口按钮 */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.viewBtn}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          aria-label="查看全部旅游记录"
          title="查看全部"
        >
          <ArrowUpRight size={16} weight="bold" />
        </button>
      </div>

      {/* 撕角装饰（登机牌风） */}
      <div className={styles.perforation} aria-hidden />
    </section>
  );
}