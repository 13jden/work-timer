/**
 * TimerCard — 主计时卡(签名元素)
 * 显示倒计时 / 进度 / 状态
 */
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { HOLIDAYS } from '../../lib/constants';
import { dayState, progressPct } from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import styles from './TimerCard.module.css';

export function TimerCard() {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);

  const ds = dayState(now, config, overrides, HOLIDAYS);
  const pct = progressPct(now, config, overrides, HOLIDAYS);

  // ===== REST MODE: 匹配参考图 & index.html —— 显示 "REST" 衬线大字体 =====
  if (ds.mode === 'rest') {
    return (
      <div className={styles.card}>
        <div className={styles.status}>
          <span className={styles.dot} />
          <span>今日休息</span>
        </div>
        <div className={styles.display}>REST</div>
        <div className={styles.label}>享受休息日</div>
        <div className={styles.shift}>
          <div className={styles.shiftLeft}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M5 2v3l2 1" />
            </svg>
            <strong>SHIFT</strong>
          </div>
          <span className={styles.pct}>{pct.toFixed(0)}%</span>
        </div>
        <div className={styles.progress}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.range}>
          <span>{config.startTime}</span>
          <span>{config.endTime}</span>
        </div>
      </div>
    );
  }

  const isDone = ds.mode === 'done';
  const display = ds.display;

  return (
    <div className={styles.card}>
      <div className={styles.status}>
        <span className={styles.dot} />
        <span>{isDone ? ds.status : ds.status}</span>
      </div>
      <div className={styles.display}>{display}</div>
      <div className={styles.label}>{ds.label}</div>
      <div className={styles.shift}>
        <div className={styles.shiftLeft}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M5 2v3l2 1" />
          </svg>
          <strong>SHIFT</strong>
        </div>
        <span className={styles.pct}>{pct.toFixed(0)}%</span>
      </div>
      <div className={styles.progress}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.range}>
        <span>{config.startTime}</span>
        <span>{config.endTime}</span>
      </div>
    </div>
  );
}
