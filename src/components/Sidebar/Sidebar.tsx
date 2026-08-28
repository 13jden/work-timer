/**
 * Sidebar — 桌面端侧边栏(≥1024px)
 *
 * 包含:品牌 + 导航(Today / Convert / Calendar / Settings) + 主题切换 + 底部版权
 */
import { THEME_LIST } from '../../store/themeStore';
import { useThemeStore } from '../../store/themeStore';
import styles from './Sidebar.module.css';

export type TabId = 'today' | 'convert' | 'calendar' | 'settings';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today',    label: '今日',    icon: '⏱' },
  { id: 'convert',  label: '换算',    icon: '🔄' },
  { id: 'calendar', label: '日历',    icon: '📅' },
  { id: 'settings', label: '设置',    icon: '⚙' },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <h1 className={styles.brandTitle}>Salary Timer</h1>
        <p className={styles.brandSub}>实时薪资 · 上班摸鱼</p>
      </div>

      <nav className={styles.nav}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.navItem} ${activeTab === tab.id ? styles.navItemActive : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className={styles.navIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <hr className={styles.divider} />

      <div className={styles.themeRow}>
        <span className={styles.themeLabel}>主题</span>
        {THEME_LIST.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            className={`${styles.swatch} ${theme === t.id ? styles.swatchActive : ''}`}
            style={{ background: t.paper }}
            onClick={() => setTheme(t.id)}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <p className={styles.footerText}>Salary Timer · 2026</p>
      </div>
    </aside>
  );
}