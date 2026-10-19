/**
 * @fileoverview JourneyListPage — 一程瀑布流列表页（v3.0 TASK-059 T-593 重设计）
 *
 * 设计：Polaroid 卡片，每张微旋转（±1.5°），封面有圆形日期邮戳。
 * 新建一程 → 直接进详情页。
 */
import { useMemo, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals } from '../../../lib/accounting/journey';
import { formatAmount } from '../../../lib/accounting';
import { JourneyDetailPage } from './JourneyDetailPage';
import { JourneyEditModal } from './JourneyEditModal';
import { Plus, ArrowLeft, Stamp } from '@phosphor-icons/react';
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
          <ArrowLeft size={18} weight="bold" />
        </button>
        <div className={styles.headerCenter}>
          <div className={styles.headerEyebrow}>PASSPORT</div>
          <div className={styles.headerTitle}>我的一程</div>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setCreateOpen(true)}
          aria-label="新建一程"
        >
          <Plus size={18} weight="bold" />
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyStamp}>
            <Stamp size={56} weight="duotone" />
          </div>
          <div className={styles.emptyTitle}>还没有一程</div>
          <div className={styles.emptyHint}>
            把一次旅行、一次兼职<br />串成一个有故事的小册
          </div>
          <button type="button" className={styles.emptyAddBtn} onClick={() => setCreateOpen(true)}>
            开始第一程 →
          </button>
        </div>
      ) : (
        <div className={styles.masonry}>
          {sorted.map((journey, i) => {
            const summary = summaries.get(journey.id);
            // 交替倾斜方向（左 -1.5° / 右 +1.5°），每 2 张循环
            const tilt = i % 2 === 0 ? -1.5 : 1.5;
            return (
              <div
                key={journey.id}
                className={styles.card}
                style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
                onClick={() => setDetailId(journey.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setDetailId(journey.id)}
              >
                <div className={styles.cardInner}>
                  {journey.coverImageId ? (
                    <JourneyCoverImage imageId={journey.coverImageId} />
                  ) : (
                    <div className={`${styles.cover} ${journey.type === 'income' ? styles.coverIncome : styles.coverExpense}`}>
                      <span className={styles.coverGlyph}>
                        {journey.type === 'income' ? '✧' : '✈'}
                      </span>
                    </div>
                  )}
                  {/* 邮戳角标 */}
                  {summary && (summary.firstKey || summary.lastKey) && (
                    <div className={styles.stampBadge}>
                      <div className={styles.stampCircle}>
                        <span className={styles.stampDate}>
                          {(summary.firstKey || summary.lastKey || '').slice(2, 7).replace('-', '/')}
                        </span>
                        <span className={styles.stampDivider} />
                        <span className={styles.stampType}>
                          {journey.type === 'income' ? '收入' : '支出'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{journey.title}</div>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardAmount}>
                      {journey.type === 'income' ? '+' : '-'}¥{formatAmount(summary?.total ?? 0, true)}
                    </span>
                    <span className={styles.cardDivider} aria-hidden>·</span>
                    <span>{summary?.count ?? 0} 笔</span>
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
          // 直接打开详情页
          setDetailId(id);
        }}
      />
    </div>
  );
}

/** 封面图占位组件 */
function JourneyCoverImage({ imageId }: { imageId: string }) {
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
