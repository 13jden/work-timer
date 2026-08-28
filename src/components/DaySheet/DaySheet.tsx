/**
 * DaySheet — 日历日详情 + 切换 work / rest
 */
import styles from './DaySheet.module.css';

interface DaySheetProps {
  open: boolean;
  date: Date | null;
  isWork: boolean;
  dailyEarning: number;
  hasOverride: boolean;
  onClose: () => void;
  onToggle: () => void;
  onReset: () => void;
}

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export function DaySheet({
  open,
  date,
  isWork,
  dailyEarning,
  hasOverride,
  onClose,
  onToggle,
  onReset,
}: DaySheetProps) {
  if (!date) return null;

  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const dow = DAY_NAMES[date.getDay()]!;
  const dateLabel = `${mm}月${dd}日 · 周${dow}`;

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
      />
      <div className={styles.sheet} style={{ display: open ? 'block' : 'none' }}>
        <div className={styles.handle} />
        <h3 className={styles.date}>{dateLabel}</h3>
        <div className={styles.type}>{isWork ? '工作日' : '休息日'}</div>

        <div className={styles.figure}>
          <div className={styles.earn}>{isWork ? `¥${dailyEarning.toFixed(2)}` : '¥0.00'}</div>
          <div className={styles.earnLabel}>{isWork ? '今天值这么多' : '休息不工作'}</div>
        </div>

        <div className={styles.actions}>
          {hasOverride && (
            <button type="button" className={styles.reset} onClick={onReset}>
              重置
            </button>
          )}
          <button type="button" className={styles.toggle} onClick={onToggle}>
            {isWork ? '切换为休息日' : '切换为工作日'}
          </button>
        </div>
      </div>
    </>
  );
}