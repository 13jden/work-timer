/**
 * @fileoverview HideTimerSetting — 「隐藏计时模式」开关行（v3.1 TASK-064）
 *
 * v3.0 建于设置弹层内；v3.1 TASK-064 抽成独立组件，
 * 改为直接摆在 MINE 页底部（与结余目标行并列）。
 */
import { useConfigStore } from '../../../store/configStore';
import styles from './MinePage.module.css';

export function HideTimerSetting() {
  const hideTimerMode = useConfigStore((s) => s.hideTimerMode ?? false);
  const setConfig = useConfigStore((s) => s.setConfig);

  return (
    <div className={styles.toggleSetting}>
      <div className={styles.toggleLabel}>
        <div className={styles.toggleTitle}>隐藏计时模式</div>
        <div className={styles.toggleHint}>关闭后仅展示记账界面，计时功能保留但不可见</div>
      </div>
      <input
        type="checkbox"
        className={styles.toggleCheckbox}
        checked={hideTimerMode}
        onChange={(e) => setConfig({ hideTimerMode: e.target.checked })}
        aria-label="隐藏计时模式"
      />
    </div>
  );
}
