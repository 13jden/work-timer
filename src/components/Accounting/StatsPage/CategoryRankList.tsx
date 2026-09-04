/**
 * @fileoverview CategoryRankList — 统计页分类排行条形列表（v2.2 · TASK-038）
 *
 * 按所选类型聚合本期各分类总额降序展示；
 * 条形宽度相对最大分类占比；点击某分类进入分类记录页。
 */
import type { Category } from '../../../lib/types';
import { UNCATEGORIZED_ID, type CategoryAggregate } from '../../../lib/accounting/stats';
import { formatAmount } from '../../../lib/accounting';
import { IconByKey } from '../../IconByKey';
import styles from './StatsPage.module.css';

interface CategoryRankListProps {
  ranks: CategoryAggregate[];
  categories: Category[];
  typeLabel: string;
  onSelect: (categoryId: string) => void;
}

/** 分类排行；空数据显示占位文案。 */
export function CategoryRankList({ ranks, categories, typeLabel, onSelect }: CategoryRankListProps) {
  if (ranks.length === 0) {
    return (
      <div className={styles.rankCard}>
        <div className={styles.rankTitle}>{typeLabel}排行</div>
        <div className={styles.chartEmpty}>本期暂无{typeLabel}记录</div>
      </div>
    );
  }

  const maxTotal = ranks[0]?.total ?? 0;

  return (
    <div className={styles.rankCard}>
      <div className={styles.rankTitle}>{typeLabel}排行</div>
      {ranks.map((rank) => {
        const category = categories.find((c) => c.id === rank.categoryId);
        const isUncat = rank.categoryId === UNCATEGORIZED_ID;
        const name = isUncat ? '未分类' : (category?.name ?? '未知分类');
        const icon = isUncat ? 'package' : (category?.icon ?? '❓');
        const color = isUncat ? 'var(--muted)' : (category?.color ?? 'var(--muted)');
        const barWidth = maxTotal > 0 ? Math.max((rank.total / maxTotal) * 100, 2) : 0;
        return (
          <button
            key={rank.categoryId}
            type="button"
            className={styles.rankRow}
            onClick={() => onSelect(rank.categoryId)}
          >
            <span className={styles.rankIcon} style={{ background: color }}>
              <IconByKey icon={icon} size={16} color="#fff" />
            </span>
            <span className={styles.rankMain}>
              <span className={styles.rankNameLine}>
                <span className={styles.rankName}>{name}</span>
                <span className={styles.rankAmt}>¥{formatAmount(rank.total)}</span>
              </span>
              <span className={styles.rankBarTrack}>
                <span
                  className={styles.rankBarFill}
                  style={{ width: `${barWidth}%`, background: color }}
                />
              </span>
            </span>
            <span className={styles.rankPct}>{Math.round(rank.percent)}%</span>
          </button>
        );
      })}
    </div>
  );
}
