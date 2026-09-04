/**
 * @fileoverview StatsBarChart — 统计页收/支双柱柱状图（v2.2 · TASK-038）
 *
 * 纯 div + CSS 实现，不引图表库；高度按系列最大值归一化。
 * 月视图 31 柱过密时由外层容器横向滚动（柱最小宽度保证可读）。
 */
import styles from './StatsPage.module.css';

/** 单根双柱的数据 */
export interface BarChartItem {
  /** dateKey（月视图）或 monthKey（年视图） */
  key: string;
  /** 轴标签，如 '1'、'12月' */
  label: string;
  income: number;
  expense: number;
}

interface StatsBarChartProps {
  items: BarChartItem[];
  /** 高亮的柱（今天 / 当前月） */
  activeKey?: string;
  onBarClick?: (key: string) => void;
}

/** 收/支双柱柱状图；无数据时渲染空态占位。 */
export function StatsBarChart({ items, activeKey, onBarClick }: StatsBarChartProps) {
  const max = items.reduce((m, i) => Math.max(m, i.income, i.expense), 0);

  if (max === 0) {
    return <div className={styles.chartEmpty}>本期暂无收支记录</div>;
  }

  return (
    <div className={styles.chartScroll}>
      <div className={styles.chart}>
        {items.map((item) => {
          const expenseH = Math.round((item.expense / max) * 100);
          const incomeH = Math.round((item.income / max) * 100);
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.chartCol} ${isActive ? styles.chartColActive : ''}`}
              onClick={() => onBarClick?.(item.key)}
              aria-label={`${item.label} 支出${item.expense} 收入${item.income}`}
            >
              <span className={styles.barsWrap}>
                <span
                  className={`${styles.bar} ${styles.barExpense}`}
                  style={{ height: `${expenseH}%` }}
                />
                <span
                  className={`${styles.bar} ${styles.barIncome}`}
                  style={{ height: `${incomeH}%` }}
                />
              </span>
              <span className={styles.chartLabel}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
