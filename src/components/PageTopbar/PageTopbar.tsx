/**
 * PageTopbar — 页面标题栏（v2.5 T-415）
 *
 * 复刻计时主题 TodayPage topbar 的视觉规格（eyebrow + 英文短语 + 右侧信息 + 居中大标题），
 * 供记账主题 CAL / STATS / MINE 页共用，保持两侧页面头部位置一致。
 */
import styles from './PageTopbar.module.css';

interface PageTopbarProps {
  /** 小写英文眉标（如 cal / stats / mine） */
  eyebrow: string;
  /** 英文短语 */
  english: string;
  /** 右侧信息（日期 / 月份等） */
  right?: string;
  /** 居中大标题 */
  title: string;
}

export function PageTopbar({ eyebrow, english, right, title }: PageTopbarProps) {
  return (
    <div className={styles.topbar}>
      <div className={styles.eyebrowRow}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <span className={styles.english}>{english}</span>
        <span className={styles.right}>{right ?? ''}</span>
      </div>
      <div className={styles.center}>{title}</div>
    </div>
  );
}
