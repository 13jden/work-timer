/**
 * @fileoverview JourneySection — MINE 页「我一程」入口区（v3.0 TASK-059 T-596）
 *
 * 最近 2 程预览卡 + 「查看全部」按钮。
 * 点击「查看全部」→ JourneyListPage（全屏）。
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals } from '../../../lib/accounting/journey';
import { formatAmount } from '../../../lib/accounting';
import { JourneyListPage } from './JourneyListPage';
import { Plus } from '@phosphor-icons/react';
import styles from './JourneySection.module.css';

export function JourneySection() {
  const journeys = useAccountStore((s) => s.journeys);
  const records = useAccountStore((s) => s.records);
  const [listOpen, setListOpen] = useState(false);

  const summaries = useMemo(() => journeyTotals(journeys, records), [journeys, records]);

  // 最近 2 程：按 lastKey 降序取前 2
  const recent = useMemo(() => {
    return [...journeys]
      .sort((a, b) => {
        const sA = summaries.get(a.id);
        const sB = summaries.get(b.id);
        const keyA = sA?.lastKey ?? String(a.updatedAt);
        const keyB = sB?.lastKey ?? String(b.updatedAt);
        return keyB.localeCompare(keyA);
      })
      .slice(0, 2);
  }, [journeys, summaries]);

  if (listOpen) {
    return <JourneyListPage onBack={() => setListOpen(false)} />;
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>我一程</div>
          <div className={styles.sub}>记录每一次旅行、兼职</div>
        </div>
        <button type="button" className={styles.viewAllBtn} onClick={() => setListOpen(true)}>
          查看全部
        </button>
      </div>

      {journeys.length === 0 ? (
        <div className={styles.emptyHint}>
          <span>✈</span> 把一次旅行、一次兼职记成一程
        </div>
      ) : (
        <div className={styles.previewRow}>
          {recent.map((journey) => {
            const summary = summaries.get(journey.id);
            return (
              <div key={journey.id} className={styles.previewCard}>
                <div className={`${styles.previewCover} ${journey.type === 'income' ? styles.incomeBg : styles.expenseBg}`}>
                  {journey.coverImageId ? (
                    <img src={`__image__:${journey.coverImageId}`} alt="封面" className={styles.previewImg} />
                  ) : (
                    <span className={styles.previewAmount}>
                      {journey.type === 'income' ? '+' : '-' }¥{formatAmount(summary?.total ?? 0)}
                    </span>
                  )}
                </div>
                <div className={styles.previewBody}>
                  <div className={styles.previewTitle}>{journey.title}</div>
                  <div className={styles.previewMeta}>
                    {summary ? `${summary.count} 笔` : '暂无记录'}
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className={styles.addCard}
            onClick={() => setListOpen(true)}
            aria-label="新建一程"
            title="新建一程"
          >
            <Plus size={24} />
          </button>
        </div>
      )}
    </section>
  );
}
