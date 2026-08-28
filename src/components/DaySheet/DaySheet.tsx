/**
 * DaySheet — 日历日详情 + 工作日类型选择
 * 样式参考:¥380.95 + 工作日/加班下拉 + 重置按钮
 */
import { useState, useEffect } from 'react';
import type { DayOverrideEntry, DayType } from '../../lib/types';
import { DEFAULT_MULTIPLIER } from '../../lib/types';
import { DAY_TYPE_OPTIONS } from '../../lib/constants';
import styles from './DaySheet.module.css';

interface DaySheetProps {
  open: boolean;
  date: Date | null;
  /** 当天实际是否工作日(用于初始状态) */
  isWork: boolean;
  /** 当天日均 */
  dailyEarning: number;
  /** 当前已有的 override entry */
  currentEntry: DayOverrideEntry | null;
  onClose: () => void;
  /** 保存 override entry */
  onSave: (key: string, entry: DayOverrideEntry) => void;
  /** 重置该天 */
  onReset: (key: string) => void;
}

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

/** 当前选中类型的默认倍率 */
function defaultMult(type: DayType): number {
  return DEFAULT_MULTIPLIER[type];
}

export function DaySheet({
  open,
  date,
  isWork,
  dailyEarning,
  currentEntry,
  onClose,
  onSave,
  onReset,
}: DaySheetProps) {
  const [selectedType, setSelectedType] = useState<DayType>('work');
  const [customMult, setCustomMult] = useState('1.5');

  // 打开时同步状态
  useEffect(() => {
    if (open && date) {
      if (currentEntry) {
        setSelectedType(currentEntry.type);
        setCustomMult(String(currentEntry.multiplier));
      } else {
        // 默认:按当前 isWork 推断
        setSelectedType(isWork ? 'work' : 'rest');
        setCustomMult(String(defaultMult(isWork ? 'work' : 'rest')));
      }
    }
  }, [open, date, currentEntry, isWork]);

  if (!date) return null;

  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const dow = DAY_NAMES[date.getDay()]!;
  const dateLabel = `${mm}月${dd}日 · 周${dow}`;
  const key = `${date.getFullYear()}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

  // 当日薪资 = 日均 × 倍率
  const mult = selectedType === 'paid_overtime' ? parseFloat(customMult) || 1.5 : defaultMult(selectedType);
  const todayEarn = mult > 0 ? dailyEarning * mult : 0;

  function handleSave() {
    const multiplier = selectedType === 'paid_overtime'
      ? (parseFloat(customMult) || 1.5)
      : defaultMult(selectedType);
    onSave(key, { type: selectedType, multiplier });
    onClose();
  }

  function handleReset() {
    onReset(key);
    onClose();
  }

  const isOvertime = selectedType === 'paid_overtime';
  const isLeave = selectedType === 'leave';
  const isRest = selectedType === 'rest';

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.sheet} ${open ? styles.sheetOpen : ''}`}>
        <div className={styles.handle} />
        <h3 className={styles.date}>{dateLabel}</h3>

        {/* 类型选择 */}
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
            {DAY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 倍率输入(加班时显示) */}
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

        {/* 薪资卡片 */}
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