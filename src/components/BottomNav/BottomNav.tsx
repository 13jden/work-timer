/**
 * BottomNav — 移动端底部 Tab 栏(<1024px)
 * 深色 pill + active 用主题强调色描边 + 顶部绿色光晕
 *
 * v2.1 TASK-037:改为通用 tabs props,支持计时 / 记账双主题各 4 tab。
 */
import { NavIcons } from '../NavIcons';
import styles from './BottomNav.module.css';

export interface BottomNavTab {
  id: string;
  label: string;
}

interface BottomNavProps {
  tabs: BottomNavTab[];
  activeId: string;
  onTabChange: (id: string) => void;
}

export function BottomNav({ tabs, activeId, onTabChange }: BottomNavProps) {
  return (
    <div className={styles.wrap}>
      <nav className={styles.dock}>
        {tabs.map((tab) => {
          const isActive = activeId === tab.id;
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
