/**
 * TimerCard — 主计时卡(签名元素)
 * v1.3 扩展:加班胶囊(paid_overtime 时显示 ⚡×N)
 * v1.3.1:加班胶囊用 lucide Zap 图标
 */
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { HOLIDAYS } from '../../lib/constants';
import { dayState, progressPct, getDayOverride } from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import { formatDateKey } from '../../lib/time';
import { Clock, Lightning } from '@phosphor-icons/react';
import styles from './TimerCard.module.css';

export function TimerCard() {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);

  const ds = dayState(now, config, overrides, HOLIDAYS);
  const pct = progressPct(now, config, overrides, HOLIDAYS);

  // v1.3 加班胶囊:paid_overtime 日
  const dateKey = formatDateKey(now);
  const entry = getDayOverride(overrides, dateKey);
  const isOvertime = entry?.type === 'paid_overtime';
  const mult = entry?.multiplier ?? 1;

  // ===== REST MODE: 匹配参考图 & index.html —— 显示 "REST" 衬线大字体 =====
  if (ds.mode === 'rest') {
    return (
      <div className={styles.card}>
        <div className={styles.status}>
          <span className={styles.dot} />
          <span>今日休息</span>
          {isOvertime && (
            <span className={styles.overtimeBadge}>
              <Lightning size={11} weight="duotone" />
              ×{mult}
            </span>
          )}
        </div>
        <div className={styles.display}>REST</div>
        <div className={styles.label}>享受休息日</div>
        <div className={styles.shift}>
          <div className={styles.shiftLeft}>
            <Clock size={11} weight="duotone" />
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
        {isOvertime && (
          <span className={styles.overtimeBadge}>
            <Lightning size={11} weight="duotone" />
            ×{mult}
          </span>
        )}
      </div>
      <div className={styles.display}>{display}</div>
      <div className={styles.label}>{ds.label}</div>
      <div className={styles.shift}>
        <div className={styles.shiftLeft}>
          <Clock size={11} weight="duotone" />
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
