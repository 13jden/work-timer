/**
 * TimeTrackerWidget — 主页「时间记录」Widget
 *
 * v1.3.3 patch2 重设计
 *
 * 设计语言 — 「时间戳小票」(time-stamp receipt)
 *   - 米色 card 包住一块黑色「里程表」实时数字区
 *   - 大数字 = 仪式感的视觉锚点(signature element)
 *   - mode chip 像"标签贴"贴在右上
 *   - 进行中时:chip 脉动,数字闪淡光,底部状态行变化
 *
 * 信息架构(4 段,摸鱼时全显 / 加班时省略薪资行):
 *   1. eyebrow + mode chip
 *   2. 黑色里程表(实时大数字 + 副标"摸鱼中 / 未开始")
 *   3. 摸鱼薪资行(计算按时薪 × 时长,加班不显示)
 *   4. 主操作 + 次操作(无下拉符号)
 */
import { useEffect, useMemo, useState } from 'react';
import { useSlackingStore, todayKey } from '../../store/slackingStore';
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { HOLIDAYS } from '../../lib/constants';
import { effectiveHourlyRate, isWorkday, dayState, slackingEarn as slackingEarnFn } from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import type { TimeRecordLabel } from '../../lib/types';
import { ArrowRight } from '@phosphor-icons/react';
import styles from './TimeTrackerWidget.module.css';

interface Props {
  onOpenDetail?: () => void;
}

function fmtMMSS(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtCNY(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '¥0.00';
  return `¥${value.toFixed(2)}`;
}

const LABEL_TEXT: Record<TimeRecordLabel, string> = {
  slack: '摸鱼',
  overtime: '加班',
  other: '其他',
};

function fmtMM(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export function TimeTrackerWidget({ onOpenDetail }: Props) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);

  const dateKey = todayKey(now);
  const isWork = isWorkday(now, config, overrides, HOLIDAYS);

  const startSession = useSlackingStore((s) => s.startSession);
  const stopCurrentSession = useSlackingStore((s) => s.stopCurrentSession);
  // v1.3.3 patch3 fix:不再用 selector 调用方法(getCurrentSession 闭包不会自动响应 store 变化)
  // 改为直接订阅原始 state,在组件内派生 currentSession
  const sessions = useSlackingStore((s) => s.sessions);
  const currentSessionId = useSlackingStore((s) => s.currentSessionId);
  const currentSession = useMemo(() => {
    if (!currentSessionId) return null;
    for (const list of Object.values(sessions)) {
      if (!list) continue;
      const found = list.find((s) => s.id === currentSessionId);
      if (found) return found;
    }
    return null;
  }, [sessions, currentSessionId]);

  const hourly = effectiveHourlyRate(now, config, overrides, HOLIDAYS);

  // v1.3.3 patch5:空闲态(未开始)显示模式
  //   - 工时段内 → 摸鱼(默认)
  //   - 已过下班 / 未到上班 / 夜班 → 加班(下一步点击会进入加班 session)
  // 让 chip 文字与 handleStart 的 autoLabel 保持一致,避免「收工仍显示摸鱼」的违和感
  const state = dayState(now, config, overrides, HOLIDAYS);
  const idleLabel: TimeRecordLabel =
    state.mode === 'active' ? 'slack' : 'overtime';

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!currentSession) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [currentSession]);

  // 休息日 disabled — 仅 eyebrow + 文字 + 详情箭头,隐藏中间黑框(odometer 区域)
  if (!isWork) {
    return (
      <div className={`${styles.widget} ${styles.disabled}`}>
        <div className={styles.receipt}>
          {/* Row 1 · eyebrow + 详情箭头(保留) */}
          <div className={styles.eyebrowRow}>
            <span className={styles.eyebrow}>TIME RECORDS</span>
            {onOpenDetail && (
              <button
                type="button"
                className={styles.detailArrowTop}
                onClick={onOpenDetail}
                aria-label="查看详情"
              >
                <ArrowRight size={12} weight="bold" />
              </button>
            )}
          </div>
          {/* Row 2 · 文字提示(无黑框) */}
          <div className={styles.restNote}>休息日无需摸鱼</div>
        </div>
      </div>
    );
  }

  const isRunning = !!currentSession && currentSession.endTs === null;
  const elapsedSec = isRunning && currentSession
    ? Math.max(0, Math.floor((now.getTime() - currentSession.startTs) / 1000))
    : 0;

  // v1.3.3 patch5:模式优先级
  //   - 进行中 → 取 session.label
  //   - 空闲态 → 按 dayState 派生(idleLabel):工时内=摸鱼,其他=加班
  const mode: TimeRecordLabel = currentSession?.label ?? idleLabel;
  // 摸鱼薪资(仅 slack 计入,slackingEarn 内部已过滤)
  // v1.3.3 patch5+:加班 session 不显示薪资行,所以 showEarn 仅用于摸鱼场景
  const showEarn = currentSession && mode === 'slack'
    ? slackingEarnFn([currentSession], hourly, now.getTime())
    : 0;

  const handleStart = () => {
    // v1.3.3 patch3:根据"当前是否在工时段内"自动选 label
    //  - 在工时段内(state.mode === 'active'): 摸鱼
    //  - 已过下班 / 未到上班 / 夜班时刻:加班(自愿)
    // v1.3.3 patch5:与 idleLabel 保持一致逻辑(避免 chip 文字与点击行为不一致)
    const autoLabel: TimeRecordLabel = idleLabel;
    startSession(dateKey, autoLabel);
  };

  const handleStop = () => {
    stopCurrentSession();
  };

  return (
    <div className={`${styles.widget} ${isRunning ? styles.running : ''}`}>
      <div className={styles.receipt}>
        {/* Row 1 · eyebrow + date + 详情箭头 */}
        <div className={styles.eyebrowRow}>
          <span className={styles.eyebrow}>
            {isRunning ? 'RECORDING' : 'TIME RECORDS'}
            <span className={styles.eyebrowDate}>· {fmtMM(now)}</span>
          </span>
          {onOpenDetail && (
            <button
              type="button"
              className={styles.detailArrowTop}
              onClick={onOpenDetail}
              aria-label="查看详情"
            >
              <ArrowRight size={12} weight="bold" />
            </button>
          )}
        </div>

        {/* Row 2 · 里程表(缩小:chip + 数字 + 单按钮 同行) */}
        <div className={styles.odoFrame}>
          <div className={styles.odoRow}>
            <div className={styles.odoRowCenter}>
              <span className={`${styles.odoRowChip} ${isRunning ? styles.odoRowChipActive : ''}`}>
                <span className={styles.odoRowChipDot} aria-hidden />
                {LABEL_TEXT[mode]}
              </span>
              <div className={styles.odoNumber}>
                <span className={styles.odoMin}>{fmtMMSS(elapsedSec).slice(0, 2)}</span>
                <span className={styles.odoColon}>:</span>
                <span className={styles.odoSec}>{fmtMMSS(elapsedSec).slice(3, 5)}</span>
              </div>
            </div>
            {isRunning ? (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnStop}`}
                onClick={handleStop}
              >
                <span className={styles.actionBtnDot} aria-hidden />
                结束
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnStart}`}
                onClick={handleStart}
              >
                开始
              </button>
            )}
          </div>
        </div>

        {/* Row 3 · 时间薪资 — v1.3.3 patch5:加班不显示(加班没有薪资,只摸鱼计入) */}
        {mode !== 'overtime' && (
          <div className={styles.earnRow}>
            <span className={styles.earnLabel}>
              摸鱼薪资
              <span className={styles.earnRate}>@ ¥{hourly.toFixed(2)}/h</span>
            </span>
            <span className={`${styles.earnValue} ${isRunning && showEarn > 0 ? styles.earnLive : ''}`}>
              {(isRunning && showEarn > 0) ? `+${fmtCNY(showEarn)}` : fmtCNY(showEarn)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}