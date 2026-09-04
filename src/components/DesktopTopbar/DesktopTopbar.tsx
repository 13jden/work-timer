/**
 * DesktopTopbar — 桌面端三栏布局的顶部栏（v1.3.4）
 *
 * 只占一行：
 * - 左:面包屑 / 当前页面名
 * - 右:齿轮图标（打开设置抽屉）
 *
 * 不包含主题切换：主题切换已搬进 DesktopSidebar。
 */
import { Gear } from '@phosphor-icons/react';
import type { DesktopTabId } from '../DesktopSidebar';
import styles from './DesktopTopbar.module.css';

interface DesktopTopbarProps {
  activeTab: DesktopTabId;
  onOpenSettings: () => void;
}

const TAB_LABELS: Record<DesktopTabId, { eyebrow: string; title: string }> = {
  today:      { eyebrow: 'today',      title: '今日出售时间' },
  accounting: { eyebrow: 'accounting', title: '存钱 · 记一笔' },
  calendar:   { eyebrow: 'calendar',   title: '月度日历' },
  fish:       { eyebrow: 'fish',       title: '摸鱼记录' },
};

export function DesktopTopbar({ activeTab, onOpenSettings }: DesktopTopbarProps) {
  const meta = TAB_LABELS[activeTab];
  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
        <span className={styles.eyebrow}>{meta.eyebrow}</span>
        <span className={styles.divider}>·</span>
        <span className={styles.title}>{meta.title}</span>
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onOpenSettings}
          aria-label="打开设置"
          title="设置"
        >
          <Gear size={18} weight="regular" />
        </button>
      </div>
    </div>
  );
}
