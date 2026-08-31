/**
 * Salary Timer — Root Component
 *
 * v1.3.4 桌面端三栏布局：
 * - 桌面端（≥1024px）：DesktopSidebar（可收起）+ Topbar（齿轮）+ 主内容 + DesktopRightPanel（上下文）
 * - 移动端（<1024px）：BottomNav + 页面切换（Today / Convert / Calendar / Settings）
 */
import { useEffect, useState } from 'react';
import { bootstrapTheme, useThemeStore } from './store/themeStore';
import { useIsDesktop } from './hooks/useMediaQuery';
import { type TabId } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { TodayPage } from './pages/TodayPage';
import { ConvertPage } from './pages/ConvertPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { DesktopSidebar, type DesktopTabId } from './components/DesktopSidebar';
import { DesktopTopbar } from './components/DesktopTopbar';
import { DesktopRightPanel } from './components/DesktopRightPanel';
import { SettingsDrawer } from './components/SettingsDrawer';
import './styles/tokens.css';
import styles from './App.module.css';

// ── 桌面端子页面（与桌面端 Sidebar 的 tab 映射）─────────────
function DesktopContent({ activeTab }: { activeTab: DesktopTabId }) {
  if (activeTab === 'today') {
    return <TodayPage onOpenConvert={() => {}} />;
  }
  // calendar tab：CalendarPage 桌面端用 inline DaySheet（不使用 modal）
  return <CalendarPage isDesktopInline />;
}

function renderPage(tab: TabId, onOpenConvert: () => void) {
  switch (tab) {
    case 'today':    return <TodayPage onOpenConvert={onOpenConvert} />;
    case 'convert':  return <ConvertPage />;
    case 'calendar':  return <CalendarPage />;
    case 'settings':  return <SettingsPage />;
  }
}

export function App() {
  const isDesktop = useIsDesktop();
  const theme = useThemeStore((s) => s.theme);
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [desktopTab, setDesktopTab] = useState<DesktopTabId>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 启动时：同步主题到 DOM（防止页面闪烁）
  useEffect(() => {
    bootstrapTheme();
  }, []);

  // ── 桌面端三栏布局 ─────────────────────────────────────────
  if (isDesktop) {
    return (
      <div
        data-theme={theme}
        className={styles.desktopShell}
      >
        {/* 左栏：可收起导航 */}
        <DesktopSidebar
          activeTab={desktopTab}
          onTabChange={(tab) => {
            setDesktopTab(tab);
            // 桌面端切 tab 不影响移动端 tab state
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* 中间：Topbar + 主内容 */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <DesktopTopbar activeTab={desktopTab} onOpenSettings={() => setSettingsOpen(true)} />
          <main style={{ flex: 1, overflow: 'auto' }}>
            <DesktopContent activeTab={desktopTab} />
          </main>
        </div>

        {/* 右栏：上下文面板 */}
        <DesktopRightPanel
          page={desktopTab}
          onNavigateToCalendar={(_dateKey) => {
            setDesktopTab('calendar');
          }}
        />

        {/* 设置抽屉 */}
        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
          <SettingsPage />
        </SettingsDrawer>
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
      {renderPage(activeTab, () => setActiveTab('convert'))}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
