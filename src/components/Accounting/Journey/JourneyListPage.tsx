/**
 * @fileoverview JourneyListPage — 一程瀑布流列表页（v3.0 TASK-059 T-593）
 *
 * 入口：MINE 页「我一程」区 → 全屏页。
 * 布局：CSS column-count: 2 瀑布流；卡片 = 封面 + 标题 + 金额 + N 笔。
 * 排序：lastKey 降序（新的在上）。
 * 空态：插画 + 引导文案。
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals } from '../../../lib/accounting/journey';
import { formatAmount } from '../../../lib/accounting';
import { JourneyDetailPage } from './JourneyDetailPage';
import { JourneyEditModal } from './JourneyEditModal';
import { Plus } from '@phosphor-icons/react';
import styles from './JourneyListPage.module.css';

interface JourneyListPageProps {
  onBack: () => void;
}

export function JourneyListPage({ onBack }: JourneyListPageProps) {
  const journeys = useAccountStore((s) => s.journeys);
  const records = useAccountStore((s) => s.records);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const summaries = useMemo(() => journeyTotals(journeys, records), [journeys, records]);

  // 按 lastKey 降序排列（新的在上）
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

  if (detailId) {
    return (
      <JourneyDetailPage
        journeyId={detailId}
        onBack={() => setDetailId(null)}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="返回">
          ←
        </button>
        <span className={styles.title}>我一程</span>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setCreateOpen(true)}
          aria-label="新建一程"
          title="新建一程"
        >
          <Plus size={18} weight="bold" />
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>✈</div>
          <div className={styles.emptyTitle}>还没有一程</div>
          <div className={styles.emptyHint}>
            把一次旅行、一次兼职<br />记成一程
          </div>
          <button type="button" className={styles.emptyAddBtn} onClick={() => setCreateOpen(true)}>
            创建第一个一程
          </button>
        </div>
      ) : (
        <div className={styles.masonry}>
          {sorted.map((journey) => {
            const summary = summaries.get(journey.id);
            return (
              <div
                key={journey.id}
                className={styles.card}
                onClick={() => setDetailId(journey.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setDetailId(journey.id)}
              >
                {journey.coverImageId ? (
                  <JourneyCoverImage imageId={journey.coverImageId} />
                ) : (
                  <div className={`${styles.coverPlaceholder} ${journey.type === 'income' ? styles.income : styles.expense}`}>
                    <span className={styles.coverAmount}>¥{formatAmount(summary?.total ?? 0, true)}</span>
                  </div>
                )}
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{journey.title}</div>
                  <div className={styles.cardMeta}>
                    {summary && summary.count > 0 ? (
                      <>{summary.count} 笔{summary.lastKey ? ` · ${summary.lastKey.slice(5)}` : ''}</>
                    ) : (
                      <span className={styles.cardEmpty}>暂无记录</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <JourneyEditModal
        open={createOpen || editId != null}
        journeyId={editId}
        onClose={() => { setCreateOpen(false); setEditId(null); }}
        onCreated={(id) => {
          setCreateOpen(false);
          setEditId(null);
          setDetailId(id);
        }}
      />
    </div>
  );
}

/** 封面图占位组件（读取 IndexedDB imageBlob） */
function JourneyCoverImage({ imageId }: { imageId: string }) {
  // 封面图从 IndexedDB 读取，Lazy load
  return (
    <div className={styles.coverImgWrap}>
      <img
        src={`__image__:${imageId}`}
        alt="封面"
        className={styles.coverImg}
        loading="lazy"
      />
    </div>
  );
}
