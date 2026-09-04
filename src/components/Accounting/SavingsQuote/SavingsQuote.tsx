/**
 * SavingsQuote — 存钱主题引言
 *
 * 替代 QuoteCard 在骨架中的位置（同 .quoteWrap 容器）。
 * 随机显示一条存钱主题文案，与 QuoteCard 视觉/尺寸一致。
 */
import { useMemo } from 'react';
import styles from './SavingsQuote.module.css';

const SAVINGS_QUOTES = [
  '先付给未来的自己。',
  '存下的每一块，都是未来的底气。',
  '今天的克制，是明天的选择权。',
  '余额，是成年人最踏实的安全感。',
  '攒钱不是抠门，是把自由存进银行。',
  '钱花在刀刃上，也存进日子里。',
  '慢慢攒，也是一种富足。',
  '会赚是本事，会存是智慧。',
];

interface SavingsQuoteProps {
  /** 决定显示哪一条；不传则随机 */
  index?: number;
}

export function SavingsQuote({ index }: SavingsQuoteProps) {
  const i = useMemo(
    () => index ?? Math.floor(Math.random() * SAVINGS_QUOTES.length),
    [index],
  );
  const quote = SAVINGS_QUOTES[i % SAVINGS_QUOTES.length]!;
  return (
    <div className={styles.card}>
      <span className={styles.mark}>&ldquo;</span>
      <span className={styles.body}>{quote}</span>
    </div>
  );
}