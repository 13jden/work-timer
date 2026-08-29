/**
 * DaySheet — 日历日详情 + 工作日类型选择 + 自定义工时 + 夜班加权
 *
 * v1.3 扩展:
 *   - 当日工时自定义(SegmentsEditor)
 *   - 夜班加权开关
 *   - salaryMode 传入过滤 DAY_TYPE_OPTIONS
 */
import { useState, useEffect } from 'react';
import type { DayOverrideEntry, DayType, WorkSegment } from '../../lib/types';
import { DEFAULT_MULTIPLIER } from '../../lib/types';
import { DAY_TYPE_OPTIONS } from '../../lib/constants';
import { SegmentsEditor } from '../SegmentsEditor';
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

export function DaySheet({
  open,
  date,
  isWork,
  dailyEarning,
  currentEntry,
  salaryMode = 'monthly',
  onClose,
  onSave,
  onReset,
}: DaySheetProps) {
  const [selectedType, setSelectedType] = useState<DayType>('work');
  const [customMult, setCustomMult] = useState('1.5');

  // v1.3:工时模式
  const [segmentsMode, setSegmentsMode] = useState<'inherit' | 'custom'>('inherit');
  const [customSegments, setCustomSegments] = useState<WorkSegment[]>([
    { start: '09:00', end: '18:00' },
  ]);

  // v1.3:夜班加权
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
        setSegmentsMode(currentEntry.segments ? 'custom' : 'inherit');
        setCustomSegments(currentEntry.segments ?? [{ start: '09:00', end: '18:00' }]);
        setNightShift(currentEntry.nightShift);
      } else {
        setSelectedType(isWork ? 'work' : 'rest');
        setCustomMult(String(defaultMult(isWork ? 'work' : 'rest')));
        setSegmentsMode('inherit');
        setCustomSegments([{ start: '09:00', end: '18:00' }]);
        setNightShift(false);
      }
    }
  }, [open, date, currentEntry, isWork]);

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
    const segments = segmentsMode === 'custom' ? customSegments : null;
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
        <div className={styles.handle} />
        <h3 className={styles.date}>{dateLabel}</h3>

        {/* ── 类型选择 ── */}
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
        </div>

        {/* ── 倍率输入(加班时) ── */}
        {isOvertime && (
          <div className={styles.multRow}>
            <span className={styles.multLabel}>倍率</span>
            <input
              type="number"
              className={styles.multInput}
              value={customMult}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(e) => setCustomMult(e.target.value)}
            />
            <span className={styles.multUnit}>×</span>
          </div>
        )}

        {/* ── v1.3 当日工时 ── */}
        <div className={styles.sectionLabel}>当日工时</div>
        <div className={styles.radioGroup}>
          <div
            className={`${styles.radioOption} ${segmentsMode === 'inherit' ? styles.selected : ''}`}
            onClick={() => setSegmentsMode('inherit')}
          >
            <div className={styles.radioDot} />
            <span className={styles.radioLabel}>继承全局</span>
            <span className={styles.radioHint}>09:00–18:00</span>
          </div>
          <div
            className={`${styles.radioOption} ${segmentsMode === 'custom' ? styles.selected : ''}`}
            onClick={() => setSegmentsMode('custom')}
          >
            <div className={styles.radioDot} />
            <span className={styles.radioLabel}>自定义</span>
          </div>
        </div>

        {segmentsMode === 'custom' && (
          <div style={{ marginBottom: 10 }}>
            <SegmentsEditor
              segments={customSegments}
              onChange={setCustomSegments}
              showTotal
            />
          </div>
        )}

        {/* ── v1.3 夜班加权 ── */}
        <div className={styles.nightShiftRow}>
          <div className={styles.nightShiftLabel}>
            <span className={styles.nightShiftTitle}>夜班加权</span>
            <span className={styles.nightShiftHint}>22:00–06:00 × 0.5 计入净工时</span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${nightShift ? styles.on : ''}`}
            onClick={() => setNightShift((v) => !v)}
            aria-label="夜班加权"
          />
        </div>

        {/* ── 薪资卡片 ── */}
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

        <div className={styles.actions}>
          {currentEntry && (
            <button type="button" className={styles.reset} onClick={handleReset}>
              重置
            </button>
          )}
          <button type="button" className={styles.toggle} onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </>
  );
}
