/**
 * StatCard — 数据卡(收入 / 等价物)
 */
import styles from './StatCard.module.css';

interface StatCardProps {
  index: string;
  value: string;
  variant?: 'income' | 'equivalent';
  flavor?: boolean;
  sub?: string;
  extra?: React.ReactNode;
  onClick?: () => void;
}

export function StatCard({
  index,
  value,
  variant = 'equivalent',
  flavor = false,
  sub,
  extra,
  onClick,
}: StatCardProps) {
  const variantClass = variant === 'income' ? styles.income : styles.equivalent;
  return (
    <div
      className={`${styles.card} ${variantClass}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={styles.index}>{index}</div>
      <div className={`${styles.value} ${flavor ? styles.flavor : ''}`}>{value}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
      {extra && <div className={styles.extra}>{extra}</div>}
    </div>
  );
}