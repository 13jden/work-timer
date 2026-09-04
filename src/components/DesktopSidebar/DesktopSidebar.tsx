/**
 * DesktopSidebar — 桌面端左侧导航（v1.3.4）
 *
 * 区别于 `Sidebar.tsx`（移动端/桌面端通用旧版）：
 * - 仅 2 个 tab：今日 / 日历（设置进抽屉，换算并入右栏）
 * - 支持收起/展开：200px ↔ 56px，状态持久化
 * - 月度进度小圆环（底部）
 * - 折叠按钮在顶部
 */
import { useThemeStore, THEME_LIST } from '../../store/themeStore';
import { useSidebarCollapsed } from '../../store/sidebarStore';
import {
  ClockCounterClockwise,
  CalendarBlank,
  FishSimple,
  BookOpenText,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { MonthIncomeProgress } from '../MonthIncomeProgress';
import styles from './DesktopSidebar.module.css';

export type DesktopTabId = 'today' | 'accounting' | 'calendar' | 'fish';

interface DesktopSidebarProps {
  activeTab: DesktopTabId;
  onTabChange: (tab: DesktopTabId) => void;
  /** 点击"设置月度目标"时调用(由 App.tsx 打开 SettingsDrawer) */
  onOpenSettings?: () => void;
}

const TABS: Array<{ id: DesktopTabId; label: string; Icon: typeof ClockCounterClockwise }> = [
  { id: 'today',      label: '今日',  Icon: ClockCounterClockwise },
  { id: 'accounting', label: '记账',  Icon: BookOpenText },
  { id: 'calendar',   label: '日历',  Icon: CalendarBlank },
  { id: 'fish',       label: 'Fish',  Icon: FishSimple },
];

export function DesktopSidebar({ activeTab, onTabChange, onOpenSettings }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  // v1.3.4-patch1:月度收入进度由 MonthIncomeProgress 组件内部计算,Sidebar 不再订阅额外 state

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* ── 折叠按钮 ── */}
      <button
        type="button"
        className={styles.collapseBtn}
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? '展开导航' : '收起导航'}
        title={collapsed ? '展开' : '收起'}
      >
        {collapsed ? <CaretRight size={14} weight="bold" /> : <CaretLeft size={14} weight="bold" />}
      </button>

      {/* ── Brand ── */}
      {!collapsed && (
        <div className={styles.brand}>
          <h1 className={styles.brandTitle}>Salary</h1>
          <h1 className={styles.brandTitleAccent}>Timer</h1>
          <p className={styles.brandSub}>实时薪资 · v1.3.4</p>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => onTabChange(id)}
              title={collapsed ? label : undefined}
              aria-label={label}
            >
              <span className={styles.navIcon}>
                <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
              </span>
              {!collapsed && <span className={styles.navLabel}>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* ── Theme swatches (收起态只露一个圆点;展开态展示 3 色) ── */}
      {!collapsed && (
        <div className={styles.themeRow}>
          <span className={styles.themeLabel}>主题</span>
          <ThemeSwatches />
        </div>
      )}

      {/* ── 月度收入进度(v1.3.4-patch1) ── */}
      <div className={styles.progress}>
        <MonthIncomeProgress collapsed={collapsed} onOpenSettings={onOpenSettings} />
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────
// ThemeSwatches — 内部组件,只让展开态用
// ─────────────────────────────────────────────────────────
function ThemeSwatches() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div className={styles.swatches}>
      {THEME_LIST.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          className={`${styles.swatch} ${theme === t.id ? styles.swatchActive : ''}`}
          style={{ background: t.accent }}
          onClick={() => setTheme(t.id)}
          aria-label={t.label}
        />
      ))}
    </div>
  );
}
