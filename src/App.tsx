/**
 * Salary Timer — Root Component
 *
 * v1.3.4-patch4 桌面端布局重构:
 * - 桌面端(≥1024px):Sidebar(auto) + ContentArea(2fr | 1fr)
 *   - 主区 2/3:Topbar + 主内容(TimerCard | Quote+Worth / TimeTrackerWidget / Net Hours)
 *   - 右栏 1/3:DesktopRightPanel
 *     - today → RecordsPanel(记录列表,可滚动)
 *     - calendar → DaySheet 内联(日历选中日期的设置)
 * - 移动端(<1024px):BottomNav + 页面切换,完全独立分支
 */
import { useEffect, useRef, useState } from 'react';
import { bootstrapTheme, useThemeStore } from './store/themeStore';
import { useAppModeStore } from './store/appModeStore';
import { useIsDesktop } from './hooks/useMediaQuery';
import { useDesktopScale, BASE_WIDTH, BASE_HEIGHT } from './hooks/useDesktopScale';
import { type TabId } from './components/Sidebar';
import { BottomNav, type BottomNavTab } from './components/BottomNav';
import { PlaceholderPage } from './components/PlaceholderPage';
import { StatsPage } from './components/Accounting/StatsPage';
import { AccountingCalendar } from './components/Accounting/AccountingCalendar';
import { TodayPage } from './pages/TodayPage';
import { AccountingPage } from './pages/AccountingPage';
import { ConvertPage } from './pages/ConvertPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { FishPage } from './pages/FishPage';
import { DesktopSidebar, type DesktopTabId } from './components/DesktopSidebar';
import { DesktopRightPanel } from './components/DesktopRightPanel';
import { SettingsDrawer } from './components/SettingsDrawer';
import './styles/tokens.css';
import styles from './App.module.css';

// ── 桌面端子页面(与桌面端 Sidebar 的 tab 映射)─────────────
function DesktopContent({
  activeTab,
  onPickedDate,
  selectedDate,
}: {
  activeTab: DesktopTabId;
  onPickedDate: (date: Date) => void;
  selectedDate: Date | null;
}) {
  if (activeTab === 'today') {
    return <TodayPage onOpenConvert={() => {}} />;
  }
  if (activeTab === 'accounting') return <AccountingPage />;
  if (activeTab === 'fish') return <FishPage />;
  return <CalendarPage isDesktopInline onPickDate={onPickedDate} selectedDate={selectedDate} />;
}

function renderPage(tab: TabId, onOpenConvert: () => void, onOpenFish: () => void) {
  switch (tab) {
    case 'today':    return <TodayPage onOpenConvert={onOpenConvert} onOpenFish={onOpenFish} />;
    case 'accounting': return <AccountingPage />;
    case 'convert':  return <ConvertPage />;
    case 'calendar': return <CalendarPage />;
    case 'settings': return <SettingsPage />;
    case 'fish':     return <FishPage />;
  }
}

// ── v2.1 TASK-037:移动端双主题 4 tab(索引一一对应)──────────────
const TIMER_TABS: BottomNavTab[] = [
  { id: 'today',    label: 'TODAY' },
  { id: 'calendar', label: 'MONTH' },
  { id: 'fish',     label: 'FISH' },
  { id: 'settings', label: 'MINE' },
];

const ACCT_TABS: BottomNavTab[] = [
  { id: 'accounting', label: 'ACCT' },
  { id: 'acct-stats', label: 'STATS' },
  { id: 'acct-cal',   label: 'CAL' },
  { id: 'acct-mine',  label: 'MINE' },
];

/** 记账主题页面:0=ACCT,1=STATS,2=CAL(v2.2),3=MINE 占位(v2.4) */
function renderAcctPage(index: number) {
  switch (index) {
    case 0:  return <AccountingPage />;
    case 1:  return <StatsPage />;
    case 2:  return <AccountingCalendar />;
    default: return <PlaceholderPage title="我的" plannedIn="v2.4" />;
  }
}

export function App() {
  const isDesktop = useIsDesktop();
  const theme = useThemeStore((s) => s.theme);
  const scale = useDesktopScale();
  // v2.1 TASK-037:移动端双主题;tabIndex 跨主题保持索引对应
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const [tabIndex, setTabIndex] = useState(0);
  const [desktopTab, setDesktopTab] = useState<DesktopTabId>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOverlay, setMobileOverlay] = useState<'convert' | 'fish' | null>(null);

  // 上下滑切换主题:flick 判定(快 + 纵向位移大),避免与列表滚动冲突
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const s = touchRef.current;
    touchRef.current = null;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const dy = t.clientY - s.y;
    const dx = t.clientX - s.x;
    const dt = Date.now() - s.t;
    if (dt > 350 || Math.abs(dy) < 70 || Math.abs(dy) < 2 * Math.abs(dx)) return;
    setMode(dy > 0 ? 'accounting' : 'timer');
  }

  // v1.3.4-patch4:日历页选中日期,提到 App 层让 DesktopRightPanel 共用
  const [pickedDate, setPickedDate] = useState<Date | null>(null);

  // 启动时:同步主题到 DOM(防止页面闪烁)
  useEffect(() => {
    bootstrapTheme();
  }, []);

  // ── 桌面端布局 ─────────────────────────────────────────
  if (isDesktop) {
    return (
      <div data-theme={theme} className={styles.scaleWrap}>
        <div
          className={styles.scaleSpacer}
          style={{
            width: BASE_WIDTH * scale,
            height: BASE_HEIGHT * scale,
          }}
        >
          <div
            className={styles.desktopShell}
            style={{ transform: `scale(${scale})` }}
          >
          {/* 左栏:可收起导航 */}
          <DesktopSidebar
            activeTab={desktopTab}
            onTabChange={(tab) => {
              setDesktopTab(tab);
              // 切 tab 时清空选中日期(避免右侧显示 stale 日期)
              if (tab !== 'calendar') setPickedDate(null);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          {/* 内容区:2fr 主区 + 1fr 右栏(2:1 比例自动保持) */}
          <div className={styles.contentArea}>
            {/* 中间:主内容(移除 Topbar) */}
            <div className={styles.mainColumn}>
              <main className={styles.main}>
                <DesktopContent
                  activeTab={desktopTab}
                  selectedDate={pickedDate}
                  onPickedDate={(d) => {
                    setPickedDate(d);
                  }}
                />
              </main>
            </div>

            {/* 右栏:上下文面板 */}
            <DesktopRightPanel
              page={desktopTab}
              pickedDate={pickedDate}
              onClosePickedDate={() => setPickedDate(null)}
              onNavigateToCalendar={(_dateKey) => {
                setDesktopTab('calendar');
              }}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>

          {/* 设置抽屉 */}
          <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
            <SettingsPage />
          </SettingsDrawer>
          </div>
        </div>
      </div>
    );
  }

  // ── 移动端 BottomNav 布局(双主题 + 上下滑切换)──────────────────
  const tabs = mode === 'timer' ? TIMER_TABS : ACCT_TABS;
  const safeIndex = Math.min(tabIndex, tabs.length - 1);
  const activeId = tabs[safeIndex]?.id ?? tabs[0]!.id;

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        paddingBottom: '72px',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {mobileOverlay === 'convert' ? (
        <ConvertPage onBack={() => setMobileOverlay(null)} />
      ) : mobileOverlay === 'fish' ? (
        <FishPage />
      ) : mode === 'timer' ? (
        renderPage(activeId as TabId, () => setMobileOverlay('convert'), () => setMobileOverlay('fish'))
      ) : (
        renderAcctPage(safeIndex)
      )}
      <BottomNav
        tabs={tabs}
        activeId={activeId}
        onTabChange={(id) => {
          // 从 overlay 点击底部导航：先关闭 overlay，再切换 tab
          if (mobileOverlay) {
            setMobileOverlay(null);
          }
          const idx = tabs.findIndex((t) => t.id === id);
          if (idx >= 0) setTabIndex(idx);
        }}
      />
    </div>
  );
}
