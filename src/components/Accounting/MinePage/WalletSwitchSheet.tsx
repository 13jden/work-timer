/**
 * @fileoverview WalletSwitchSheet — 钱包模式开关弹层（v3.0 TASK-057 T-573）
 *
 * MinePage 顶部 ⚙ 按钮触发。
 * 单选项:「开启钱包 / 关闭钱包」,当前值带 ✓ 标记。
 * 切换时弹确认对话框(避免误触,数据保留说明)。
 *
 * v3.0 TASK-060 扩展: 新增「隐藏计时模式」Toggle 开关
 *
 * 切换通过 setConfig({ walletEnabled: boolean }) 实时生效,无 reload。
 */
import { useState } from 'react';
import { useConfigStore } from '../../../store/configStore';
import styles from './MinePage.module.css';

interface WalletSwitchSheetProps {
  open: boolean;
  onClose: () => void;
}

type Option = { value: boolean; label: string; hint: string };

const OPTIONS: Option[] = [
  {
    value: true,
    label: '开启钱包',
    hint: '账户余额联动 · 拖拽归入 · 账户标签 · 每账户详情页',
  },
  {
    value: false,
    label: '关闭钱包',
    hint: '只显示流水 · 不展示账户归类(数据保留,随时可恢复)',
  },
];

/**
 * 钱包模式开关弹层。
 * - 选与当前值不同的项 → 弹确认(避免误触)
 * - 确认后 setConfig({ walletEnabled }) 实时切换,onClose
 * - v3.0 TASK-060: 新增「隐藏计时模式」Toggle(下方显示)
 */
export function WalletSwitchSheet({ open, onClose }: WalletSwitchSheetProps) {
  const walletEnabled = useConfigStore((s) => s.walletEnabled ?? false);
  const hideTimerMode = useConfigStore((s) => s.hideTimerMode ?? false);
  const setConfig = useConfigStore((s) => s.setConfig);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  if (!open) return null;

  const handlePick = (value: boolean) => {
    if (value === walletEnabled) return; // 已是当前值,无变化
    setPendingValue(value);
  };

  const handleConfirm = () => {
    if (pendingValue === null) return;
    setConfig({ walletEnabled: pendingValue });
    setPendingValue(null);
    onClose();
  };

  const handleCancelPending = () => {
    setPendingValue(null);
  };

  // v3.0 TASK-060: 切换隐藏计时模式
  const handleToggleHideTimer = (checked: boolean) => {
    setConfig({ hideTimerMode: checked });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>显示设置</div>

        {/* 钱包模式 */}
        <div className={styles.settingSection}>
          <div className={styles.settingSectionTitle}>钱包模式</div>
          <div className={styles.walletOptionList}>
            {OPTIONS.map((opt) => {
              const selected = walletEnabled === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  className={`${styles.walletOption} ${selected ? styles.walletOptionActive : ''}`}
                  onClick={() => handlePick(opt.value)}
                >
                  <span className={styles.walletOptionLabel}>
                    {opt.label}
                    {selected && <span className={styles.walletOptionCheck}>✓</span>}
                  </span>
                  <span className={styles.walletOptionHint}>{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* v3.0 TASK-060: 隐藏计时模式 Toggle */}
        <div className={styles.settingSection}>
          <div className={styles.settingSectionTitle}>显示偏好</div>
          <div className={styles.toggleSetting}>
            <div className={styles.toggleLabel}>
              <div className={styles.toggleTitle}>隐藏计时模式</div>
              <div className={styles.toggleHint}>关闭后仅展示记账界面,计时功能保留但不可见</div>
            </div>
            <input
              type="checkbox"
              className={styles.toggleCheckbox}
              checked={hideTimerMode}
              onChange={(e) => handleToggleHideTimer(e.target.checked)}
              aria-label="隐藏计时模式"
            />
          </div>
        </div>

        <button type="button" className={styles.submitBtn} onClick={onClose}>
          关闭
        </button>
      </div>

      {pendingValue !== null && (
        <div className={styles.confirmOverlay} onClick={handleCancelPending}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>
              {pendingValue ? '开启钱包' : '关闭钱包'}?
            </div>
            <div className={styles.confirmText}>
              {pendingValue
                ? '开启后,账户余额联动 / 拖拽归入 / 账户标签 / 每账户详情页恢复。'
                : '关闭后,账户归类 / 余额联动等将不再展示,记录 accountId 字段保留,数据不丢,随时可恢复开启。'}
            </div>
            <div className={styles.confirmBtns}>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={handleCancelPending}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.confirmPrimary}
                onClick={handleConfirm}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
