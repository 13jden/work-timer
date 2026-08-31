/**
 * SegmentsEditor — 通用多段工时编辑器(v1.3 新增)
 *
 * 复用场景:
 *   - SettingsPage 全局多段工时配置
 *   - DaySheet 单日自定义工时
 *
 * 设计:
 *   - 段列表:每段两个 time input + 移除按钮
 *   - end < start 自动显示"✨ 次日"徽章
 *   - 段数上限 10
 *   - 底部合计小时
 */
import { useMemo } from 'react';
import type { WorkSegment } from '../../lib/types';
import { toMinutes } from '../../lib/time';
import { SEGMENTS_MAX } from '../../lib/constants';
import { Plus, X, Confetti } from '@phosphor-icons/react';
import styles from './SegmentsEditor.module.css';

interface Props {
  segments: WorkSegment[];
  onChange: (segs: WorkSegment[]) => void;
  maxSegments?: number;
  showTotal?: boolean;
  readOnly?: boolean;
}

function isCrossDay(seg: WorkSegment): boolean {
  return toMinutes(seg.end) <= toMinutes(seg.start) && seg.end !== seg.start;
}

function formatTotal(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

export function SegmentsEditor({
  segments,
  onChange,
  maxSegments = SEGMENTS_MAX,
  showTotal = true,
  readOnly = false,
}: Props) {
  const totalMin = useMemo(() => {
    let total = 0;
    for (const seg of segments) {
      const start = toMinutes(seg.start);
      let end = toMinutes(seg.end);
      if (end <= start) end += 24 * 60; // 跨天
      total += end - start;
    }
    return total;
  }, [segments]);

  const update = (idx: number, patch: Partial<WorkSegment>) => {
    const next = segments.slice();
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = segments.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const add = () => {
    if (segments.length >= maxSegments) return;
    const next = segments.slice();
    next.push({ start: '09:00', end: '18:00' });
    onChange(next);
  };

  return (
    <div className={styles.editor}>
      <div className={styles.list}>
        {segments.map((seg, idx) => {
          const cross = isCrossDay(seg);
          return (
            <div key={idx} className={styles.row}>
              <span className={styles.num}>{idx + 1}</span>
              <input
                type="time"
                className={styles.time}
                value={seg.start}
                onChange={(e) => update(idx, { start: e.target.value })}
                disabled={readOnly}
              />
              <span className={styles.dash}>–</span>
              <input
                type="time"
                className={styles.time}
                value={seg.end}
                onChange={(e) => update(idx, { end: e.target.value })}
                disabled={readOnly}
              />
              {cross && (
                <span className={styles.crossBadge}>
                  <Confetti size={9} weight="duotone" />
                  次日
                </span>
              )}
              {!readOnly && (
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => remove(idx)}
                  aria-label="移除"
                >
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <button
          type="button"
          className={styles.add}
          onClick={add}
          disabled={segments.length >= maxSegments}
        >
          <Plus size={12} weight="bold" />
          添加一段工时
        </button>
      )}
      {showTotal && segments.length > 0 && (
        <div className={styles.total}>
          合计 {formatTotal(totalMin)} / 天
        </div>
      )}
    </div>
  );
}