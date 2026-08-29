/**
 * SlackingWidget — 主页摸鱼 Widget(v1.3 新增)
 *
 * Today 页 QuoteCard 下方的紧凑型摸鱼卡片。
 *
 * 状态:
 *   - 未开始:显示"开始摸鱼 ▾"按钮
 *   - 进行中:显示实时时长 + "结束摸鱼"按钮
 *   - 休息日:disabled + "休息日无需摸鱼 😎"
 */
import { useEffect, useState } from 'react';
import { useSlackingStore, todayKey } from '../../store/slackingStore';
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { HOLIDAYS } from '../../lib/constants';
import { isWorkday } from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import { SLACKING_LABEL_ICON, SLACKING_LABEL_TEXT } from '../../lib/constants';
import type { SlackingLabel } from '../../lib/types';
import styles from './SlackingWidget.module.css';

interface Props {
  /** 进入详情页回调 */
  onOpenDetail?: () => void;
}

function fmtMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const LABEL_OPTIONS: Array<{ value: SlackingLabel; label: string; icon: string }> = [
  { value: 'toilet', label: SLACKING_LABEL_TEXT.toilet, icon: SLACKING_LABEL_ICON.toilet },
  { value: 'slack', label: SLACKING_LABEL_TEXT.slack, icon: SLACKING_LABEL_ICON.slack },
  { value: 'meal', label: SLACKING_LABEL_TEXT.meal, icon: SLACKING_LABEL_ICON.meal },
  { value: 'other', label: SLACKING_LABEL_TEXT.other, icon: SLACKING_LABEL_ICON.other },
];

export function SlackingWidget({ onOpenDetail }: Props) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);

  const dateKey = todayKey(now);
  const isWork = isWorkday(now, config, overrides, HOLIDAYS);

  const startSession = useSlackingStore((s) => s.startSession);
  const stopCurrentSession = useSlackingStore((s) => s.stopCurrentSession);
  const currentSession = useSlackingStore((s) => s.getCurrentSession());
  const todayMinutes = useSlackingStore((s) => s.getTodaySlackingMinutes(dateKey));

  const [openMenu, setOpenMenu] = useState(false);
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!currentSession) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [currentSession]);

  // 休息日 disabled
  if (!isWork) {
    return (
      <div className={`${styles.widget} ${styles.disabled}`}>
        <div className={styles.header}>
          <span className={styles.title}>
            {SLACKING_LABEL_ICON.slack} 摸鱼时间
          </span>
        </div>
        <div className={styles.restStatus}>休息日无需摸鱼 😎</div>
      </div>
    );
  }

  const isRunning = !!currentSession && currentSession.endTs === null;
  const elapsedSec = isRunning && currentSession
    ? Math.max(0, Math.floor((now.getTime() - currentSession.startTs) / 1000))
    : 0;

  const todaySec = todayMinutes * 60;

  const handleStart = (label: SlackingLabel) => {
    startSession(dateKey, label);
    setOpenMenu(false);
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>
          {SLACKING_LABEL_ICON.slack} 摸鱼时间
        </span>
        <span className={styles.total}>
          {isRunning ? fmtMMSS(elapsedSec) : fmtMMSS(todaySec)}
        </span>
      </div>

      <div className={styles.status}>
        {isRunning && currentSession ? (
          <>
            <span className={styles.pulse} />
            <span className={styles.statusText}>
              进行中 · {SLACKING_LABEL_ICON[currentSession.label]}{' '}
              {currentSession.label === 'other' && currentSession.customLabel
                ? currentSession.customLabel
                : SLACKING_LABEL_TEXT[currentSession.label]}{' '}
              · {fmtMMSS(elapsedSec)}
            </span>
          </>
        ) : (
          <span className={styles.statusText}>未开始</span>
        )}
      </div>

      <div className={styles.buttons}>
        {isRunning ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => stopCurrentSession()}
          >
            结束摸鱼 ▾
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setOpenMenu((v) => !v)}
          >
            开始摸鱼 ▾
          </button>
        )}
        {onOpenDetail && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onOpenDetail}
          >
            详情 →
          </button>
        )}
      </div>

      {openMenu && (
        <div className={styles.menu}>
          {LABEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={styles.menuItem}
              onClick={() => handleStart(opt.value)}
            >
              <span className={styles.menuIcon}>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}