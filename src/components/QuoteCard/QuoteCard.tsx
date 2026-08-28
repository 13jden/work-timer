import { QUOTES } from '../../lib/constants';
import styles from './QuoteCard.module.css';

interface QuoteCardProps {
  /** 决定显示哪一条;不传则用一天里的固定一条(基于 day-of-year) */
  index?: number;
}

export function QuoteCard({ index }: QuoteCardProps) {
  const i = index ?? Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const quote = QUOTES[i % QUOTES.length] ?? QUOTES[0]!;
  return (
    <div className={styles.card}>
      <span className={styles.mark}>&ldquo;</span>
      <span className={styles.body}>{quote}</span>
    </div>
  );
}