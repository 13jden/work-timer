/**
 * DaySheet — 日历日详情 + 工作日类型选择 + 模板多选 + 夜班加权
 *
 * v1.3.1 重构:
 *   - 删除 .toggle CSS 复用冲突(原保存按钮被覆盖为滑动开关样式)
 *   - 当日工时改为 SegmentPicker chip 多选(Bug 4 整合)
 *   - 夜班加权开关宽度增大到 52px
 *   - 整体重新设计:层级清晰、信息密度合理、操作按钮普通化
 *   - 引入 lucide-react 图标库替换 emoji
 */
import { useState, useEffect } from 'react';
import type { DayOverrideEntry, DayType, SegmentTemplate, WorkSegment } from '../../lib/types';
import { DEFAULT_MULTIPLIER } from '../../lib/types';
import { DAY_TYPE_OPTIONS } from '../../lib/constants';
import { SegmentPicker } from '../SegmentPicker';
import { ChevronDown, RefreshCw, Save, Moon } from 'lucide-react';
import styles from './DaySheet.module.css';

interface DaySheetProps {
  open: boolean;
  date: Date | null;
  /** 当天实际是否工作日 */
  isWork: boolean;
  /** 当天日均 */
  dailyEarning: number;
  /** 当前已有的 override entry */
  currentEntry: DayOverrideEntry | null;
  /** 当前薪资模式(用于过滤选项) */
  salaryMode?: 'monthly' | 'hourly' | 'daily';
  /** 模板库(用于"自定义"模式多选) */
  segmentTemplates?: SegmentTemplate[];
  onClose: () => void;
  /** 保存 override entry */
  onSave: (key: string, entry: DayOverrideEntry) => void;
  /** 重置该天 */
  onReset: (key: string) => void;
}

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function defaultMult(type: DayType): number {
  return DEFAULT_MULTIPLIER[type];
}

/**
 * 把勾选的 template segments 合并为 DayOverrideEntry.segments
 * 重复段自动 union 去重叠
 */
function mergeTemplateSegments(
  templates: SegmentTemplate[],
  selectedIds: Set<string>,
): WorkSegment[] {
  const collected: WorkSegment[] = [];
  for (const tpl of templates) {
    if (selectedIds.has(tpl.id)) {
      collected.push(...tpl.segments);
    }
  }
  if (collected.length === 0) return [];
  return collected;
}

/**
 * 从已有 segments 反推出对应的 template ids
 * (用于回显 — 当前实现:按 segments 长度粗匹配,精准可后续优化)
 */
function detectTemplateIds(
  segments: WorkSegment[] | null,
  templates: SegmentTemplate[],
): Set<string> {
  const ids = new Set<string>();
  if (!segments || segments.length === 0) return ids;
  for (const tpl of templates) {
    if (tpl.segments.length !== segments.length) continue;
    const same = tpl.segments.every((s, i) =>
      segments[i] && segments[i]!.start === s.start && segments[i]!.end === s.end,
    );
    if (same) ids.add(tpl.id);
  }
  return ids;
}

export function DaySheet({
  open,
  date,
  isWork,
  dailyEarning,
  currentEntry,
  salaryMode = 'monthly',
  segmentTemplates = [],
  onClose,
  onSave,
  onReset,
}: DaySheetProps) {
  const [selectedType, setSelectedType] = useState<DayType>('work');
  const [customMult, setCustomMult] = useState('1.5');

  // v1.3.1:工时模式(默认 inherit,用户可切 custom)
  const [segmentsMode, setSegmentsMode] = useState<'inherit' | 'custom'>('inherit');
  // 勾选的模板 id 集合(对应 config.segmentTemplates)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());

  // 夜班加权
  const [nightShift, setNightShift] = useState(false);

  // 过滤 DAY_TYPE_OPTIONS(非 monthly 模式隐藏 work/paid_overtime)
  const filteredTypeOptions = salaryMode === 'monthly'
    ? DAY_TYPE_OPTIONS
    : DAY_TYPE_OPTIONS.filter((o) => o.value !== 'work' && o.value !== 'paid_overtime');

  // 同步状态
  useEffect(() => {
    if (open && date) {
      if (currentEntry) {
        setSelectedType(currentEntry.type);
        setCustomMult(String(currentEntry.multiplier));
        const hasCustom = currentEntry.segments && currentEntry.segments.length > 0;
        setSegmentsMode(hasCustom ? 'custom' : 'inherit');
        setSelectedTemplateIds(detectTemplateIds(currentEntry.segments, segmentTemplates));
        setNightShift(currentEntry.nightShift);
      } else {
        setSelectedType(isWork ? 'work' : 'rest');
        setCustomMult(String(defaultMult(isWork ? 'work' : 'rest')));
        setSegmentsMode('inherit');
        setSelectedTemplateIds(new Set());
        setNightShift(false);
      }
    }
  }, [open, date, currentEntry, isWork, segmentTemplates]);

  if (!date) return null;

  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const dow = DAY_NAMES[date.getDay()]!;
  const dateLabel = `${mm}月${dd}日 · 周${dow}`;
  const key = `${date.getFullYear()}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  const mult = selectedType === 'paid_overtime' ? parseFloat(customMult) || 1.5 : defaultMult(selectedType);
  const todayEarn = mult > 0 ? dailyEarning * mult : 0;

  const isOvertime = selectedType === 'paid_overtime';
  const isLeave = selectedType === 'leave';
  const isRest = selectedType === 'rest';

  function handleSave() {
    const multiplier = selectedType === 'paid_overtime'
      ? (parseFloat(customMult) || 1.5)
      : defaultMult(selectedType);
    const segments = segmentsMode === 'custom'
      ? mergeTemplateSegments(segmentTemplates, selectedTemplateIds)
      : null;
    onSave(key, { type: selectedType, multiplier, segments, nightShift });
    onClose();
  }

  function handleReset() {
    onReset(key);
    onClose();
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.sheet} ${open ? styles.sheetOpen : ''}`}>
        {/* ── 顶部:把手 + 日期 ── */}
        <div className={styles.handle} />
        <div className={styles.headRow}>
          <div className={styles.dateBlock}>
            <div className={styles.dateLabel}>日期</div>
            <h3 className={styles.date}>{dateLabel}</h3>
          </div>
          <div className={styles.dateBadge}>
            {isWork ? '工作日' : '休息日'}
          </div>
        </div>

        {/* ── 类型选择 ── */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>类型</div>
          <div className={styles.typeRow}>
            <select
              className={styles.typeSelect}
              value={selectedType}
              onChange={(e) => {
                const t = e.target.value as DayType;
                setSelectedType(t);
                setCustomMult(String(defaultMult(t)));
              }}
            >
              {filteredTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={2.2} className={styles.typeChevron} />
          </div>
        </div>

        {/* ── 倍率输入(加班时) ── */}
        {isOvertime && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>加班倍率</div>
            <div className={styles.multRow}>
              <input
                type="number"
                className={styles.multInput}
                value={customMult}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(e) => setCustomMult(e.target.value)}
                aria-label="加班倍率"
              />
              <span className={styles.multUnit}>×</span>
            </div>
          </div>
        )}

        {/* ── 当日工时(模板多选) ── */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            当日工时
            <span className={styles.sectionHint}>
              {segmentsMode === 'custom' ? '勾选后合并' : '继承全局默认'}
            </span>
          </div>

          <div className={styles.modeRow}>
            <button
              type="button"
              className={`${styles.modeChip} ${segmentsMode === 'inherit' ? styles.modeChipActive : ''}`}
              onClick={() => setSegmentsMode('inherit')}
            >
              <span className={styles.modeDot} />
              继承全局
            </button>
            <button
              type="button"
              className={`${styles.modeChip} ${segmentsMode === 'custom' ? styles.modeChipActive : ''}`}
              onClick={() => setSegmentsMode('custom')}
            >
              <span className={styles.modeDot} />
              自定义
            </button>
          </div>

          {segmentsMode === 'custom' && (
            <div className={styles.pickerWrap}>
              <SegmentPicker
                templates={segmentTemplates}
                selectedIds={selectedTemplateIds}
                onChange={setSelectedTemplateIds}
              />
            </div>
          )}
        </div>

        {/* ── 夜班加权(大开关) ── */}
        <div className={styles.section}>
          <div className={styles.nightShiftRow}>
            <div className={styles.nightShiftLabel}>
              <span className={styles.nightShiftTitle}>
                <Moon size={14} strokeWidth={2} />
                夜班加权
              </span>
              <span className={styles.nightShiftHint}>
                22:00–06:00 × 0.5 计入净工时
              </span>
            </div>
            <button
              type="button"
              className={`${styles.nightToggle} ${nightShift ? styles.nightToggleOn : ''}`}
              onClick={() => setNightShift((v) => !v)}
              role="switch"
              aria-checked={nightShift}
              aria-label="夜班加权"
            >
              <span className={styles.nightToggleKnob} />
            </button>
          </div>
        </div>

        {/* ── 薪资预览 ── */}
        <div className={styles.figure}>
          <div className={styles.earn}>
            {todayEarn > 0
              ? `¥${todayEarn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '¥0.00'}
          </div>
          <div className={styles.earnLabel}>
            {isLeave ? '请假,无当日薪资' : isRest ? '休息日,无当日薪资' : '今日值这么多'}
          </div>
        </div>

        {/* ── 操作按钮(已修复 .toggle 复用冲突) ── */}
        <div className={styles.actions}>
          {currentEntry && (
            <button type="button" className={styles.resetBtn} onClick={handleReset}>
              <RefreshCw size={14} strokeWidth={2.2} />
              重置
            </button>
          )}
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            <Save size={14} strokeWidth={2.2} />
            保存
          </button>
        </div>
      </div>
    </>
  );
}