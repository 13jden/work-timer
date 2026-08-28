/**
 * Salary Timer — Root Component
 *
 * 响应式布局:
 * - 桌面端(≥1024px):Sidebar + 永远显示今日
 * - 移动端(<1024px):BottomNav + 页面切换
 */
import { useEffect, useState } from 'react';
import { bootstrapTheme, useThemeStore } from './store/themeStore';
import { useIsDesktop } from './hooks/useMediaQuery';
import { Sidebar, type TabId } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { TodayPage } from './pages/TodayPage';
import { ConvertPage } from './pages/ConvertPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import './styles/tokens.css';

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

  // 启动时:同步主题到 DOM(防止页面闪烁)
  useEffect(() => {
    bootstrapTheme();
  }, []);

  if (isDesktop) {
    return (
      <div
        data-theme={theme}
        style={{ display: 'flex', minHeight: '100vh', background: 'var(--paper)' }}
      >
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main style={{ flex: 1, overflow: 'auto' }}>
          <TodayPage onOpenConvert={() => setActiveTab('convert')} />
        </main>
      </div>
    );
  }

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