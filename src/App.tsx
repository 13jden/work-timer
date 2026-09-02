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
import { useEffect, useState } from 'react';
import { bootstrapTheme, useThemeStore } from './store/themeStore';
import { useIsDesktop } from './hooks/useMediaQuery';
import { useDesktopScale, BASE_WIDTH, BASE_HEIGHT } from './hooks/useDesktopScale';
import { type TabId } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
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

export function App() {
  const isDesktop = useIsDesktop();
  const theme = useThemeStore((s) => s.theme);
  const scale = useDesktopScale();
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [desktopTab, setDesktopTab] = useState<DesktopTabId>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOverlay, setMobileOverlay] = useState<'convert' | null>(null);

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

  // ── 移动端 BottomNav 布局 ──────────────────────────────────
  return (
    <div
      data-theme={theme}
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        paddingBottom: '72px',
      }}
    >
      {mobileOverlay === 'convert' ? (
        <ConvertPage onBack={() => setMobileOverlay(null)} />
      ) : (
        renderPage(activeTab, () => setMobileOverlay('convert'), () => setActiveTab('fish'))
      )}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          // 从 convert overlay 点击底部导航：先关闭 overlay，再切换 tab
          if (mobileOverlay === 'convert') {
            setMobileOverlay(null);
          }
          setActiveTab(tab);
        }}
      />
    </div>
  );
}
