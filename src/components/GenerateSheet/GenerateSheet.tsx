/**
 * GenerateSheet — 生成月度薪资确认弹窗
 * 点击 Month header dot 触发
 */
import { useState, useEffect } from 'react';
import type { Config, DayOverrides, HolidayMap } from '../../lib/types';
import { workdaysInMonth, dailySalary } from '../../lib/compute';
import styles from './GenerateSheet.module.css';

interface GenerateSheetProps {
  open: boolean;
  year: number;
  month: number;
  config: Config;
  defaultSalary: number;
  overrides: DayOverrides;
  holidays: HolidayMap;
  onClose: () => void;
  onConfirm: (salary: number) => void;
}

export function GenerateSheet({
  open,
  year,
  month,
  config,
  defaultSalary,
  overrides,
  holidays,
  onClose,
  onConfirm,
}: GenerateSheetProps) {
  const [salary, setSalary] = useState(String(defaultSalary));

  useEffect(() => {
    if (open) setSalary(String(defaultSalary));
  }, [open, defaultSalary]);

  const salaryNum = parseFloat(salary) || 0;
  const previewConfig = { ...config, monthlySalary: salaryNum };
  const workDays = workdaysInMonth(year, month, config, overrides, holidays);
  const previewDaily = salaryNum > 0 ? dailySalary(year, month, previewConfig, overrides, holidays) : 0;

  const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const label = `${year}年 ${MONTH_NAMES[month]}`;

  function handleConfirm() {
    const n = parseFloat(salary);
    if (n > 0) onConfirm(n);
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
        <h3 className={styles.title}>生成 {label}</h3>

        <div className={styles.field}>
          <label className={styles.label}>月薪</label>
          <div className={styles.inputRow}>
            <span className={styles.prefix}>¥</span>
            <input
              type="number"
              className={styles.input}
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              min={0}
              placeholder="0"
            />
          </div>
        </div>

        <div className={styles.preview}>
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>工作日</span>
            <span className={styles.previewValue}>{workDays} 天</span>
          </div>
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>日均</span>
            <span className={styles.previewValue}>
              {salaryNum > 0 ? `¥${Math.round(previewDaily).toLocaleString('en-US')}` : '—'}
            </span>
          </div>
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>总收入</span>
            <span className={`${styles.previewValue} ${styles.previewHighlight}`}>
              {salaryNum > 0 && workDays > 0
                ? `¥${Math.round(previewDaily * workDays).toLocaleString('en-US')}`
                : '—'}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={handleConfirm}
            disabled={!salaryNum}
          >
            确认生成
          </button>
        </div>
      </div>
    </>
  );
}
