/**
 * DaySheet — 日历日详情 + 工作日类型选择 + 模板多选 + 夜班加权 + 自由日配置
 *
 * v1.3.2 增强:
 *   - freelance 类型:展开「当日薪资」(时薪/日薪 segmented + 输入)+ 当日工时(SegmentPicker)
 *   - 预览金额 todayEarn:freelance 时按 user input rate 计算
 *   - 薪资/工时都写入 DayOverrideEntry(freelanceDaily/Hourly + segments)
 *
 * v1.3.1 重构保留:
 *   - 删除 .toggle CSS 复用冲突(原保存按钮被覆盖为滑动开关样式)
 *   - 当日工时改为 SegmentPicker chip 多选(Bug 4 整合)
 *   - 夜班加权开关宽度增大到 52px
 *   - 整体重新设计:层级清晰、信息密度合理、操作按钮普通化
 *   - 引入 @phosphor-icons/react 图标库替换 emoji(lucide 已迁移,v1.3.3)
 */
import { useState, useEffect, useMemo } from 'react';
import type { DayOverrideEntry, DayType, SegmentTemplate, WorkSegment } from '../../lib/types';
import { DEFAULT_MULTIPLIER } from '../../lib/types';
import { DAY_TYPE_OPTIONS } from '../../lib/constants';
import { SegmentPicker } from '../SegmentPicker';
import { toMinutes } from '../../lib/time';
import {
  CaretDown,
  ArrowsClockwise,
  FloppyDisk,
  Moon,
  Coins,
} from '@phosphor-icons/react';
import styles from './DaySheet.module.css';

interface DaySheetProps {
  open: boolean;
  date: Date | null;
  /** 当天实际是否工作日 */
  isWork: boolean;
  /** 当天日均(非 freelance 类型的预览基准) */
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

function segmentsTotalMinutes(segs: WorkSegment[]): number {
  let total = 0;
  for (const s of segs) {
    const start = toMinutes(s.start);
    let end = toMinutes(s.end);
    if (end <= start) end += 24 * 60;
    total += end - start;
  }
  return total;
}

/**
 * 把勾选的 template segments 合并为 DayOverrideEntry.segments
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

/**
 * 计算有效工时段(优先 override.segments,fallback 用 templates 第一项)
 */
function pickEffectiveSegments(
  entry: DayOverrideEntry | null,
  templates: SegmentTemplate[],
  selectedIds: Set<string>,
  segmentsMode: 'inherit' | 'custom',
): WorkSegment[] {
  if (segmentsMode === 'custom' && selectedIds.size > 0) {
    return mergeTemplateSegments(templates, selectedIds);
  }
  if (entry?.segments && entry.segments.length > 0) return entry.segments;
  if (templates[0]) return templates[0].segments;
  return [{ start: '09:00', end: '18:00' }];
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

  // v1.3.2:freelance 模式临时费率
  const [freelanceRateMode, setFreelanceRateMode] = useState<'hourly' | 'daily'>('daily');
  const [freelanceRate, setFreelanceRate] = useState('800');

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
        // v1.3.2:freelance 费率回显
        if (currentEntry.type === 'freelance') {
          if (currentEntry.freelanceHourly != null && currentEntry.freelanceHourly > 0) {
            setFreelanceRateMode('hourly');
            setFreelanceRate(String(currentEntry.freelanceHourly));
          } else if (currentEntry.freelanceDaily != null && currentEntry.freelanceDaily > 0) {
            setFreelanceRateMode('daily');
            setFreelanceRate(String(currentEntry.freelanceDaily));
          }
        }
      } else {
        setSelectedType(isWork ? 'work' : 'rest');
        setCustomMult(String(defaultMult(isWork ? 'work' : 'rest')));
        setSegmentsMode('inherit');
        setSelectedTemplateIds(new Set());
        setNightShift(false);
      }
    }
  }, [open, date, currentEntry, isWork, segmentTemplates]);

  const isOvertime = selectedType === 'paid_overtime';
  const isLeave = selectedType === 'leave';
  const isRest = selectedType === 'rest';
  const isFreelance = selectedType === 'freelance';

  // 当前显示的工时(用于 freelance 预览 + picker 回退)
  const previewSegments = useMemo(
    () => pickEffectiveSegments(currentEntry, segmentTemplates, selectedTemplateIds, segmentsMode),
    [currentEntry, segmentTemplates, selectedTemplateIds, segmentsMode],
  );

  const mult = isOvertime ? parseFloat(customMult) || 1.5 : defaultMult(selectedType);

  // 预览金额
  const todayEarn = useMemo(() => {
    if (mult === 0) return 0;
    if (isFreelance) {
      const r = parseFloat(freelanceRate) || 0;
      if (r === 0) return 0;
      if (freelanceRateMode === 'hourly') {
        const hours = segmentsTotalMinutes(previewSegments) / 60;
        return r * hours * mult;
      }
      return r * mult;
    }
    return dailyEarning * mult;
  }, [mult, isFreelance, freelanceRate, freelanceRateMode, previewSegments, dailyEarning]);

  if (!date) return null;

  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const dow = DAY_NAMES[date.getDay()]!;
  const dateLabel = `${mm}月${dd}日 · 周${dow}`;
  const key = `${date.getFullYear()}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  function handleSave() {
    const multiplier = isOvertime
      ? (parseFloat(customMult) || 1.5)
      : defaultMult(selectedType);
    const segments = segmentsMode === 'custom' && selectedTemplateIds.size > 0
      ? mergeTemplateSegments(segmentTemplates, selectedTemplateIds)
      : null;

    const entry: DayOverrideEntry = {
      type: selectedType,
      multiplier,
      segments,
      nightShift,
    };

    // v1.3.2:freelance 写入费率
    if (isFreelance) {
      const r = parseFloat(freelanceRate) || 0;
      if (freelanceRateMode === 'hourly') {
        entry.freelanceHourly = r;
        entry.freelanceDaily = null;
      } else {
        entry.freelanceDaily = r;
        entry.freelanceHourly = null;
      }
    }

    onSave(key, entry);
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
            <CaretDown size={16} weight="bold" className={styles.typeChevron} />
          </div>
        </div>

        {/* ── 加班倍率输入 ── */}
        {isOvertime && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>加班倍率</div>
            <div className={styles.multRow}>
              <input
                type="number"
                className={styles.multInput}
                value={customMult}
                min={0}
                max={10}
                step={0.1}
                onChange={(e) => setCustomMult(e.target.value)}
                aria-label="加班倍率"
              />
              <span className={styles.multUnit}>×</span>
            </div>
          </div>
        )}

        {/* ── v1.3.2:freelance 临时费率(仅 freelance 类型显示) ── */}
        {isFreelance && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              <Coins size={11} weight="regular" style={{ verticalAlign: -1, marginRight: 4 }} />
              当日薪资
              <span className={styles.sectionHint}>
                {freelanceRateMode === 'hourly'
                  ? `× ${segmentsTotalMinutes(previewSegments) / 60} 小时`
                  : '一次性'}
              </span>
            </div>
            <div className={styles.freelanceRateRow}>
              <div className={styles.freelanceModeRow}>
                <button
                  type="button"
                  className={`${styles.freelanceModeChip} ${freelanceRateMode === 'daily' ? styles.freelanceModeChipActive : ''}`}
                  onClick={() => setFreelanceRateMode('daily')}
                >
                  按日薪
                </button>
                <button
                  type="button"
                  className={`${styles.freelanceModeChip} ${freelanceRateMode === 'hourly' ? styles.freelanceModeChipActive : ''}`}
                  onClick={() => setFreelanceRateMode('hourly')}
                >
                  按时薪
                </button>
              </div>
              <div className={styles.freelanceRateInputRow}>
                <span className={styles.freelanceRatePrefix}>¥</span>
                <input
                  type="number"
                  className={styles.freelanceRateInput}
                  value={freelanceRate}
                  min={0}
                  onChange={(e) => setFreelanceRate(e.target.value)}
                  aria-label={freelanceRateMode === 'hourly' ? '时薪' : '日薪'}
                />
                <span className={styles.freelanceRateUnit}>
                  / {freelanceRateMode === 'hourly' ? 'h' : '天'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 当日工时(模板多选)— freelance 必填 / 其他类型可选 ── */}
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
                <Moon size={14} weight="regular" />
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
            {isLeave
              ? '请假,无当日薪资'
              : isRest
                ? '休息日,无当日薪资'
                : isFreelance
                  ? '今日兼职值这么多'
                  : '今日值这么多'}
          </div>
        </div>

        {/* ── 操作按钮 ── */}
        <div className={styles.actions}>
          {currentEntry && (
            <button type="button" className={styles.resetBtn} onClick={handleReset}>
              <ArrowsClockwise size={14} weight="regular" />
              重置
            </button>
          )}
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            <FloppyDisk size={14} weight="regular" />
            保存
          </button>
        </div>
      </div>
    </>
  );
}
