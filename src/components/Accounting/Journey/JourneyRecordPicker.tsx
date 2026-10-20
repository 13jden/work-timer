/**
 * @fileoverview JourneyRecordPicker — 关联 / 取消关联记录到旅游记录（v3.0 TASK-059 T-597 重设计）
 *
 * 列出全部同类型记录（按时间倒序），分三组：
 * - 已关联到这里
 * - 已关联到其他旅游记录
 * - 未挂记录
 *
 * 多选：勾选 → 保存时把 journeyId 写入（覆盖其他关联）。
 * 已勾选的「已关联到这里」可点击取消勾选 → 保存时会把这些移出。
 */
import { useState, useEffect, useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount } from '../../../lib/accounting';
import { X, Check } from '@phosphor-icons/react';
import styles from './JourneyRecordPicker.module.css';

interface JourneyRecordPickerProps {
  open: boolean;
  journeyId: string;
  type: 'expense' | 'income';
  onClose: () => void;
}

export function JourneyRecordPicker({ open, journeyId, type, onClose }: JourneyRecordPickerProps) {
  const records = useAccountStore((s) => s.records);
  const journeys = useAccountStore((s) => s.journeys);
  const updateRecord = useAccountStore((s) => s.updateRecord);
  const journey = journeys.find((j) => j.id === journeyId);

  // v3.0 TASK-059 fix: confirm 期间忽略 overlay click，防止 store 更新触发 re-render
  // 时 click 打到背后的 AddRecordModal overlay 导致其关闭
  const [confirming, setConfirming] = useState(false);

  // 选中记录：origin === 'this' 默认勾选（保持关联）；'other' / 'none' 默认不勾选
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      const init = new Set<string>();
      records
        .filter((r) => r.type === type && r.journeyId === journeyId)
        .forEach((r) => init.add(r.id));
      setSelected(init);
    }
  }, [open, records, type, journeyId]);

  // 按时间倒序的全部同类型记录
  const sortedAll = useMemo(
    () => records.filter((r) => r.type === type).sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [records, type],
  );

  const grouped = useMemo(() => {
    const thisJourney: typeof sortedAll = [];
    const otherJourney: Array<{ record: typeof sortedAll[0]; otherTitle: string }> = [];
    const unattached: typeof sortedAll = [];
    for (const r of sortedAll) {
      if (r.journeyId === journeyId) {
        thisJourney.push(r);
      } else if (r.journeyId) {
        const j = journeys.find((j) => j.id === r.journeyId);
        otherJourney.push({ record: r, otherTitle: j?.title ?? '另一段' });
      } else {
        unattached.push(r);
      }
    }
    return { thisJourney, otherJourney, unattached };
  }, [sortedAll, journeyId, journeys]);

  const categories = useAccountStore((s) => s.categories);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    setConfirming(true);
    // 先把 selected 中的全部设为本程
    for (const id of selected) {
      updateRecord(id, { journeyId });
    }
    // 原来在本程但被取消勾选的 → 移出
    for (const r of grouped.thisJourney) {
      if (!selected.has(r.id)) {
        updateRecord(r.id, { journeyId: undefined });
      }
    }
    // 短暂延迟再关，让 store 更新 + re-render 完成后再关 picker
    // 防止 re-render 期间 overlay click 打到背后的 AddRecordModal overlay
    setTimeout(() => {
      setConfirming(false);
      onClose();
    }, 120);
  };

  if (!open || !journey) return null;

  return (
    <div
        className={styles.overlay}
        onClick={(e) => {
          if (confirming) return; // v3.0 TASK-059 fix: confirm 期间忽略 overlay click
          if (e.target === e.currentTarget) onClose();
        }}
      >
      <div className={styles.sheet}>
        <div className={styles.header}>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
          <div className={styles.headerTitle}>「{journey.title}」</div>
          <div className={styles.headerSpacer} />
        </div>

        <div className={styles.subTitle}>
          勾选要纳入「{journey.title}」的记录
          <span className={styles.subHint}>
            已选 {selected.size} 条 · 共 {sortedAll.length} 条
          </span>
        </div>

        <div className={styles.list}>
          {sortedAll.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📋</span>
              <span className={styles.emptyText}>暂无同类型记录</span>
            </div>
          )}

          {/* 已关联到这里 */}
          {grouped.thisJourney.length > 0 && (
            <Section
              label="已关联到这里"
              count={grouped.thisJourney.length}
              tag={tagThis}
            >
              {grouped.thisJourney.map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  category={categories.find((c) => c.id === r.categoryId)}
                  selected={selected.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  tag={tagThis}
                />
              ))}
            </Section>
          )}

          {/* 已关联到其他旅游记录 */}
          {grouped.otherJourney.length > 0 && (
            <Section
              label="已关联到其他"
              count={grouped.otherJourney.length}
              tag={tagOther}
            >
              {grouped.otherJourney.map(({ record, otherTitle }) => (
                <RecordRow
                  key={record.id}
                  record={record}
                  category={categories.find((c) => c.id === record.categoryId)}
                  selected={selected.has(record.id)}
                  onToggle={() => toggle(record.id)}
                  tag={tagOther}
                  tagExtra={`原属「${otherTitle}」`}
                />
              ))}
            </Section>
          )}

          {/* 未归入任何旅游记录 */}
          {grouped.unattached.length > 0 && (
            <Section
              label="未归入"
              count={grouped.unattached.length}
              tag={tagNone}
            >
              {grouped.unattached.map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  category={categories.find((c) => c.id === r.categoryId)}
                  selected={selected.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  tag={tagNone}
                />
              ))}
            </Section>
          )}
        </div>

        <div className={styles.footer}>
          {/* v3.0 TASK-059 fix: 两个保存选项——「保存并继续选」方便批量关联 */}
          <button
            type="button"
            className={styles.saveContinueBtn}
            onClick={() => {
              setConfirming(true);
              for (const id of selected) {
                updateRecord(id, { journeyId });
              }
              for (const r of grouped.thisJourney) {
                if (!selected.has(r.id)) {
                  updateRecord(r.id, { journeyId: undefined });
                }
              }
              // 保存后重新初始化 selected（已关联本程的记录仍然勾选）
              const next = new Set<string>();
              records
                .filter((r) => r.type === type && r.journeyId === journeyId)
                .forEach((r) => next.add(r.id));
              setSelected(next);
              setConfirming(false);
            }}
          >
            保存并继续选
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
          >
            保存并关闭
          </button>
        </div>
      </div>
    </div>
  );
}

const tagThis = { label: '当前', tone: 'active' as const };
const tagOther = { label: '其他', tone: 'muted' as const };
const tagNone = { label: '未归', tone: 'plain' as const };

interface SectionProps {
  label: string;
  count: number;
  tag: { label: string; tone: 'active' | 'muted' | 'plain' };
  children: React.ReactNode;
}
function Section({ label, count, tag, children }: SectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>{label}</span>
        <span className={`${styles.sectionTag} ${styles[`tone_${tag.tone}`]}`}>{tag.label}</span>
        <span className={styles.sectionCount}>{count}</span>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}

interface RecordRowProps {
  record: ReturnType<typeof useAccountStore.getState>['records'][number];
  category?: { id: string; name: string; color: string; icon: string };
  selected: boolean;
  onToggle: () => void;
  tag: { label: string; tone: 'active' | 'muted' | 'plain' };
  tagExtra?: string;
}
function RecordRow({ record, category, selected, onToggle, tag, tagExtra }: RecordRowProps) {
  return (
    <div
      className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
      onClick={onToggle}
      role="button"
    >
      <div className={styles.rowLeft}>
        <span className={`${styles.checkbox} ${selected ? styles.checkboxOn : ''}`}>
          {selected && <Check size={12} weight="bold" />}
        </span>
        <div className={styles.rowInfo}>
          <div className={styles.rowTopLine}>
            <span className={styles.rowDate}>{record.dateKey.slice(5)}</span>
            {category && (
              <span className={styles.rowCat} style={{ color: category.color }}>
                {category.icon} {category.name}
              </span>
            )}
            <span className={`${styles.rowTag} ${styles[`tone_${tag.tone}`]}`}>{tag.label}</span>
          </div>
          <div className={styles.rowBottomLine}>
            {record.note && <span className={styles.rowNote}>{record.note}</span>}
            {tagExtra && <span className={styles.rowTagExtra}>{tagExtra}</span>}
          </div>
        </div>
      </div>
      <div className={styles.rowRight}>
        <span className={record.type === 'income' ? styles.incomeAmt : styles.expenseAmt}>
          {record.type === 'income' ? '+' : '-'}¥{formatAmount(Math.abs(record.amount))}
        </span>
      </div>
    </div>
  );
}