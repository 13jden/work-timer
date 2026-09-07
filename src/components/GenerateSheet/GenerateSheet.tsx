/**
 * GenerateSheet — 生成月度薪资确认弹窗
 *
 * v2.5-patch7 (TASK-051):点击月份头部 → 预览当月 摸鱼时长 + 净工时 + 基础日均 + 总收入。
 * - 摸鱼时长:仅在 > 0 时显示(避免空数据噪音)
 * - 净工时:始终显示(扣除午休/摸鱼/加成夜班,基于 computeRangeStats 计算)
 */
import { useState, useEffect, useMemo } from 'react';
import type { Config, DayOverrides, HolidayMap, SlackingSessions } from '../../lib/types';
import {
  workdaysInMonth,
  dailySalary,
  daysInMonthCalc,
  computeNetHours,
} from '../../lib/compute';
import { formatDateKey } from '../../lib/time';
import styles from './GenerateSheet.module.css';

interface GenerateSheetProps {
  open: boolean;
  year: number;
  month: number;
  config: Config;
  defaultSalary: number;
  overrides: DayOverrides;
  holidays: HolidayMap;
  /** 当月（含历史）的摸鱼 sessions,key = YYYY-MM-DD */
  sessions: SlackingSessions;
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
  sessions,
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

  // ── 摸鱼 + 净工时 ──
  // 用户点击"生成已赚"前预览：
  //   - 摸鱼时长:当月所有工作日的 slack 标签 session 时长求和(含进行中)
  //   - 净工时:当月所有工作日的 computeNetHours.netMinutes 求和(扣除午休/摸鱼,加成夜班/加班)
  // 两者均基于当前 sessions 实际数据,不随 input 中的月薪变化
  // (因为工时模板/摸鱼/午休都与月薪无关)
  const { totalSlackingMin, totalNetMin } = useMemo(() => {
    let slack = 0;
    let net = 0;
    const days = daysInMonthCalc(year, month);
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d);
      const dateKey = formatDateKey(date);
      const daySessions = sessions[dateKey] ?? [];
      for (const s of daySessions) {
        if (s.label !== 'slack') continue;
        const end = s.endTs ?? Date.now();
        const dur = Math.max(0, end - s.startTs);
        slack += dur / 60000;
      }
      const atDayEnd = new Date(year, month, d, 23, 59, 59, 999);
      const breakdown = computeNetHours({
        date: atDayEnd,
        config: previewConfig,
        overrides,
        holidays,
        slackingSessions: daySessions,
      });
      net += Math.max(0, breakdown.netMinutes);
    }
    return { totalSlackingMin: slack, totalNetMin: net };
  }, [year, month, sessions, previewConfig, overrides, holidays]);

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
          {totalSlackingMin > 0 && (
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>摸鱼时长</span>
              <span className={styles.previewValue}>{formatHM(totalSlackingMin)}</span>
            </div>
          )}
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>净工时</span>
            <span className={styles.previewValue}>{formatHM(totalNetMin)}</span>
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

/** 分钟数 → "Xh Ym" 紧凑格式 */
function formatHM(min: number): string {
  if (!isFinite(min) || min <= 0) return '0m';
  const totalMin = Math.round(min);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}