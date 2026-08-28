/**
 * BottomNav — 移动端底部 Tab 栏(<1024px)
 */
import type { TabId } from '../Sidebar';
import styles from './BottomNav.module.css';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today',    label: '今日',    icon: '⏱' },
  { id: 'convert',  label: '换算',    icon: '🔄' },
  { id: 'calendar', label: '日历',    icon: '📅' },
  { id: 'settings', label: '设置',    icon: '⚙' },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className={styles.dock}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={styles.tabIcon}>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}