/**
 * SettingsDrawer — 设置抽屉（v1.3.4）
 *
 * - 桌面端右上角齿轮 → 右侧滑出
 * - 抽屉内完整复用 `<SettingsPage />` 的渲染逻辑
 * - 遮罩点击 / ESC 关闭
 * - 打开时锁定 body 滚动
 *
 * 实现：把 `<SettingsPage />` 当作 children 传入，由 App 路由层决定渲染时机。
 * 本组件只负责外壳（遮罩 + 抽屉 + 关闭按钮）。
 */
import { useEffect, useState, useCallback } from 'react';
import { X } from '@phosphor-icons/react';
import styles from './SettingsDrawer.module.css';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** 抽屉最大宽度 */
const MAX_W = 480;
/** 右侧保留边距 */
const RIGHT_MARGIN = 20;

export function SettingsDrawer({ open, onClose, children }: SettingsDrawerProps) {
  // 窗口缩放时动态计算宽度，防止超出视口
  const [drawerWidth, setDrawerWidth] = useState(MAX_W);

  const recalcWidth = useCallback(() => {
    setDrawerWidth(Math.min(MAX_W, window.innerWidth - RIGHT_MARGIN));
  }, []);

  useEffect(() => {
    if (open) recalcWidth();
  }, [open, recalcWidth]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', recalcWidth);
    return () => window.removeEventListener('resize', recalcWidth);
  }, [open, recalcWidth]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <aside
        className={styles.drawer}
        style={{ width: drawerWidth }}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
      >
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <span className={styles.eyebrow}>preferences</span>
            <span className={styles.divider}>·</span>
            <span className={styles.title}>设置</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="关闭设置"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
      </aside>
    </>
  );
}
