/**
 * RestModeSheet — 切换月度休息模式弹窗
 * 点击 Month 页「工作日」卡片触发
 *
 * - 当前月 → 修改 configStore.restMode(全局生效)
 * - 历史月 → 修改 calendarStore.monthlyRestModes[YYYY-MM](仅覆盖该月)
 */
import { useState, useEffect } from 'react';
import styles from './RestModeSheet.module.css';

interface RestModeSheetProps {
  open: boolean;
  year: number;
  month: number;
  /** 当前生效的 restMode(已考虑月度覆盖) */
  currentMode: 0 | 1 | 2;
  /** 是否当前月 */
  isCurrentMonth: boolean;
  onClose: () => void;
  /** 确认回调:返回选的 mode + 是否清除月度覆盖(null=清除覆盖) */
  onConfirm: (mode: 0 | 1 | 2 | null) => void;
}

const OPTIONS: Array<{ mode: 0 | 1 | 2; label: string; desc: string }> = [
  { mode: 0, label: '无休', desc: '全月都是工作日' },
  { mode: 1, label: '单休', desc: '周日休息' },
  { mode: 2, label: '双休', desc: '周六、周日休息' },
];

const MONTH_NAMES = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

export function RestModeSheet({
  open,
  year,
  month,
  currentMode,
  isCurrentMonth,
  onClose,
  onConfirm,
}: RestModeSheetProps) {
  const [mode, setMode] = useState<0 | 1 | 2>(currentMode);

  useEffect(() => {
    if (open) setMode(currentMode);
  }, [open, currentMode]);

  function handleConfirm() {
    onConfirm(mode);
    onClose();
  }

  function handleResetOverride() {
    // 清除月度覆盖,恢复全局设置
    onConfirm(null);
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
        <h3 className={styles.title}>{year}年 {MONTH_NAMES[month]}</h3>
        <p className={styles.sub}>
          {isCurrentMonth ? '设置全局休息模式' : '仅覆盖该月休息模式'}
        </p>

        <div className={styles.options}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              className={`${styles.option} ${mode === opt.mode ? styles.optionActive : ''}`}
              onClick={() => setMode(opt.mode)}
            >
              <div className={styles.optionLabel}>{opt.label}</div>
              <div className={styles.optionDesc}>{opt.desc}</div>
              {mode === opt.mode && (
                <span className={styles.check}>✓</span>
              )}
            </button>
          ))}
        </div>

        {!isCurrentMonth && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleResetOverride}
          >
            恢复全局设置
          </button>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={handleConfirm}
          >
            确认
          </button>
        </div>
      </div>
    </>
  );
}