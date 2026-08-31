/**
 * SegmentPicker — 多段工时模板多选组件(v1.3.1 新增)
 *
 * 在 DaySheet 中使用:
 *   - 列出 config.segmentTemplates(每个 chip)
 *   - 多选 → 合并勾选的 segments → 写入 DayOverrideEntry.segments
 *
 * 设计:
 *   - 每个 chip 显示 label + 时长摘要(如 "早班 · 6h")
 *   - 选中态:accent 边框 + 加号变减号
 *   - 跨天段自动显示 "✨ 次日" 徽章
 */
import { useMemo } from 'react';
import type { SegmentTemplate, WorkSegment } from '../../lib/types';
import { toMinutes } from '../../lib/time';
import { Confetti } from '@phosphor-icons/react';
import styles from './SegmentPicker.module.css';

interface Props {
  templates: SegmentTemplate[];
  /** 当前已选的 template id 集合 */
  selectedIds: Set<string>;
  /** 选择变化回调 */
  onChange: (next: Set<string>) => void;
  /** 自定义空态文案 */
  emptyText?: string;
}

function totalMin(segs: WorkSegment[]): number {
  let total = 0;
  for (const s of segs) {
    const start = toMinutes(s.start);
    let end = toMinutes(s.end);
    if (end <= start) end += 24 * 60;
    total += end - start;
  }
  return total;
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

function isCrossDay(seg: WorkSegment): boolean {
  return toMinutes(seg.end) <= toMinutes(seg.start) && seg.end !== seg.start;
}

export function SegmentPicker({ templates, selectedIds, onChange, emptyText }: Props) {
  const sortedTemplates = useMemo(() => {
    // 选中的排前面,未选后排;同组内按 label
    return templates.slice().sort((a, b) => {
      const aSel = selectedIds.has(a.id);
      const bSel = selectedIds.has(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [templates, selectedIds]);

  if (templates.length === 0) {
    return (
      <div className={styles.empty}>
        {emptyText ?? '还没有工时模板,到「设置」页配置'}
      </div>
    );
  }

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className={styles.picker}>
      {sortedTemplates.map((tpl) => {
        const selected = selectedIds.has(tpl.id);
        const cross = tpl.segments.some(isCrossDay);
        const dur = fmtDuration(totalMin(tpl.segments));
        return (
          <button
            key={tpl.id}
            type="button"
            className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
            onClick={() => toggle(tpl.id)}
            aria-pressed={selected}
          >
            <span className={styles.checkbox}>
              {selected ? '−' : '+'}
            </span>
            <span className={styles.label}>{tpl.label}</span>
            <span className={styles.duration}>{dur}</span>
            {cross && (
              <span className={styles.crossBadge}>
                <Confetti size={10} weight="duotone" />
                次日
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}