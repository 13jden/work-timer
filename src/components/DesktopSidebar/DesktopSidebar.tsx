/**
 * DesktopSidebar — 桌面端左侧导航（v1.3.4）
 *
 * 区别于 `Sidebar.tsx`（移动端/桌面端通用旧版）：
 * - 仅 2 个 tab：今日 / 日历（设置进抽屉，换算并入右栏）
 * - 支持收起/展开：200px ↔ 56px，状态持久化
 * - 月度进度小圆环（底部）
 * - 折叠按钮在顶部
 */
import { useConfigStore } from '../../store/configStore';
import { useThemeStore, THEME_LIST } from '../../store/themeStore';
import { useSidebarCollapsed } from '../../store/sidebarStore';
import { useCalendarStore } from '../../store/calendarStore';
import { HOLIDAYS } from '../../lib/constants';
import { workdaysInMonth, daysInMonthCalc } from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import {
  ClockCounterClockwise,
  CalendarBlank,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import styles from './DesktopSidebar.module.css';

export type DesktopTabId = 'today' | 'calendar';

interface DesktopSidebarProps {
  activeTab: DesktopTabId;
  onTabChange: (tab: DesktopTabId) => void;
}

const TABS: Array<{ id: DesktopTabId; label: string; Icon: typeof ClockCounterClockwise }> = [
  { id: 'today',    label: '今日',  Icon: ClockCounterClockwise },
  { id: 'calendar', label: '日历',  Icon: CalendarBlank },
];

export function DesktopSidebar({ activeTab, onTabChange }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  // month progress
  const now = useNow(60_000);
  const total = daysInMonthCalc(now.getFullYear(), now.getMonth());
  const done = workdaysInMonth(now.getFullYear(), now.getMonth(), config, overrides, HOLIDAYS);
  const remaining = total - done;
  const progressPct = total > 0 ? Math.min(1, done / total) : 0;

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

      {/* ── 月度进度 ── */}
      <div className={styles.progress}>
        {collapsed ? (
          <div className={styles.progressRingSmall} title={`已完成 ${done}/${total} 工作日`}>
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" className={styles.progressRingBg} />
              <circle
                cx="18"
                cy="18"
                r="14"
                className={styles.progressRingFg}
                strokeDasharray={`${progressPct * 87.96} 87.96`}
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className={styles.progressNumSmall}>{done}</span>
          </div>
        ) : (
          <div className={styles.progressBlock}>
            <div className={styles.progressEyebrow}>本月 · {now.getMonth() + 1}月</div>
            <div className={styles.progressRow}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPct * 100}%` }} />
              </div>
              <span className={styles.progressNum}>{done}/{total}</span>
            </div>
            <div className={styles.progressHint}>剩 {remaining} 工作日</div>
          </div>
        )}
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
