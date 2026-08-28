import { useNowTime } from '../../hooks/useNowTime';
import styles from './StatusBar.module.css';

/**
 * StatusBar — 顶栏(时间 + 信号 + 电池图标)
 * 完全静态,只显示时间(分钟级更新)。
 */
export function StatusBar() {
  const time = useNowTime();
  return (
    <div className={styles.statusBar}>
      <span>{time}</span>
      <span className={styles.right}>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden="true">
          <path d="M1 7h2v3H1zM5 5h2v5H5zM9 3h2v7H9zM13 1h2v9h-2z" />
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
          <rect x="0.5" y="0.5" width="20" height="10" rx="2" />
          <rect x="2" y="2" width="17" height="7" rx="1" fill="currentColor" stroke="none" />
          <path d="M22 3.5v4" />
        </svg>
      </span>
    </div>
  );
}