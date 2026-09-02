/**
 * BottomNav — 移动端底部 Tab 栏(<1024px)
 * 深色 pill + active 用主题强调色描边 + 顶部绿色光晕
 */
import type { TabId } from '../Sidebar';
import { NavIcons } from '../NavIcons';
import styles from './BottomNav.module.css';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'today',    label: 'TODAY' },
  { id: 'calendar', label: 'MONTH' },
  { id: 'fish',     label: 'FISH' },
  { id: 'settings', label: 'MINE' },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className={styles.wrap}>
      <nav className={styles.dock}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className={styles.tabIcon}>{NavIcons[tab.id]}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
