/**
 * NoticeModal — 公告 / 更新弹窗（v3.2）
 *
 * 两种形态：
 * - 公告：纯展示，一个「知道了」按钮关闭
 * - 更新：展示目标版本 + 下载入口（Web 端下载 APK，App 端提示去应用商店）
 *
 * 样式沿用主应用的纸张/主题 token，不污染现有组件。
 */
import { useEffect, useState } from 'react';
import { X, ArrowUpRight, Sparkle } from '@phosphor-icons/react';
import { markDismissed, type Notice } from '../../lib/notice';
import styles from './NoticeModal.module.css';

interface Props {
  notice: Notice | null;
  onClose: () => void;
}

export function NoticeModal({ notice, onClose }: Props) {
  const [leaving, setLeaving] = useState(false);

  // 弹窗打开时锁背景滚动
  useEffect(() => {
    if (!notice) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [notice]);

  // Esc 关闭
  useEffect(() => {
    if (!notice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  if (!notice) return null;

  const isUpdate = notice.type === 'update';

  function close() {
    setLeaving(true);
    setTimeout(() => {
      markDismissed(notice!);
      setLeaving(false);
      onClose();
    }, 140);
  }

  function handlePrimary() {
    // 更新类型：跳转到下载页（Web 端）
    if (isUpdate && notice!.version) {
      const url = `/downloads/SalaryTimer-${notice!.version}-arm64.apk`;
      window.open(url, '_blank', 'noopener');
    }
    close();
  }

  return (
    <div className={styles.backdrop} onClick={close} role="presentation">
      <div
        className={`${styles.card} ${leaving ? styles.leaving : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={notice.title}
      >
        <button className={styles.close} onClick={close} aria-label="关闭">
          <X size={16} weight="bold" />
        </button>

        <div className={styles.eyebrow}>
          {isUpdate ? (
            <>
              <ArrowUpRight size={12} weight="bold" />
              新版本可用
            </>
          ) : (
            <>
              <Sparkle size={12} weight="fill" />
              公告
            </>
          )}
        </div>

        <h2 className={styles.title}>{notice.title}</h2>

        {isUpdate && notice.version && (
          <div className={styles.versionRow}>
            <span className={styles.version}>v{notice.version}</span>
            <span className={styles.versionHint}>建议升级到最新版本</span>
          </div>
        )}

        {notice.body && <div className={styles.body}>{notice.body}</div>}

        <div className={styles.actions}>
          {isUpdate && notice.version && (
            <button className={styles.primary} onClick={handlePrimary}>
              下载新版
              <ArrowUpRight size={14} weight="bold" />
            </button>
          )}
          <button className={isUpdate ? styles.secondary : styles.primary} onClick={close}>
            {isUpdate ? '稍后再说' : '知道了'}
          </button>
        </div>
      </div>
    </div>
  );
}
