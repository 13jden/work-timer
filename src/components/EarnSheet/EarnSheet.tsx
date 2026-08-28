/**
 * EarnSheet — 点击已赚卡片,修改月薪
 */
import { useState, useEffect } from 'react';
import styles from './EarnSheet.module.css';

interface EarnSheetProps {
  open: boolean;
  year: number;
  month: number;
  /** 当前快照中的月薪 */
  currentSalary: number;
  onClose: () => void;
  /** 确认修改月薪(会影响当月) */
  onConfirm: (salary: number) => void;
}

export function EarnSheet({
  open,
  year,
  month,
  currentSalary,
  onClose,
  onConfirm,
}: EarnSheetProps) {
  const [salary, setSalary] = useState(String(currentSalary));

  useEffect(() => {
    if (open) setSalary(String(currentSalary));
  }, [open, currentSalary]);

  const salaryNum = parseFloat(salary) || 0;
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
        <h3 className={styles.title}>调整月薪</h3>
        <p className={styles.sub}>{label} · 仅影响当月实时计算</p>

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
            确认
          </button>
        </div>
      </div>
    </>
  );
}
