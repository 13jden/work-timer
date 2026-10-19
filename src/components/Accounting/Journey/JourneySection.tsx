/**
 * @fileoverview JourneySection — MINE 页「我一程」入口区（v3.0 TASK-059 T-596 重设计）
 *
 * 设计语言：登机牌 / 护照页风格 —— 一张横向卡，左侧是邮戳 + 标题，
 * 右侧是「查看全部」。点击整张卡打开 JourneyListPage。
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals } from '../../../lib/accounting/journey';
import { JourneyListPage } from './JourneyListPage';
import { ArrowUpRight, AirplaneTilt } from '@phosphor-icons/react';
import styles from './JourneySection.module.css';

export function JourneySection() {
  const journeys = useAccountStore((s) => s.journeys);
  const records = useAccountStore((s) => s.records);
  const [listOpen, setListOpen] = useState(false);

  const summaries = useMemo(() => journeyTotals(journeys, records), [journeys, records]);

  // 最近 1 程的最近日期 + 笔数
  const recent = useMemo(() => {
    return [...journeys]
      .sort((a, b) => {
        const sA = summaries.get(a.id);
        const sB = summaries.get(b.id);
        const keyA = sA?.lastKey ?? String(a.updatedAt);
        const keyB = sB?.lastKey ?? String(b.updatedAt);
        return keyB.localeCompare(keyA);
      })
      .slice(0, 1)[0];
  }, [journeys, summaries]);

  if (listOpen) {
    return <JourneyListPage onBack={() => setListOpen(false)} />;
  }

  const totalCount = journeys.length;
  const recentSummary = recent ? summaries.get(recent.id) : undefined;
  const recentDate = recentSummary?.lastKey ?? '';

  return (
    <section
      className={styles.card}
      onClick={() => setListOpen(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setListOpen(true)}
      aria-label="打开一程列表"
    >
      {/* 左上：邮戳 */}
      <div className={styles.stamp}>
        <div className={styles.stampCircle}>
          <AirplaneTilt size={16} weight="fill" />
        </div>
        <span className={styles.stampText}>JOURNEY</span>
      </div>

      {/* 主区 */}
      <div className={styles.body}>
        <div className={styles.eyebrow}>
          <span>我的一程</span>
          {totalCount > 0 && <span className={styles.eyebrowDot} />}
          {totalCount > 0 && <span>{totalCount} 段</span>}
        </div>
        <div className={styles.title}>
          {totalCount === 0 ? '把一次旅行、一次兼职记成一程' : recent?.title ?? '一程'}
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
          onClick={(e) => { e.stopPropagation(); setListOpen(true); }}
          aria-label="查看全部一程"
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
