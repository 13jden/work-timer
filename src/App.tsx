import { useEffect } from 'react';
import { bootstrapTheme, useThemeStore } from './store/themeStore';
import { TodayPage } from './pages/TodayPage';
import './styles/tokens.css';

/**
 * Salary Timer — Root Component
 * 当前阶段:TASK-004 · 今日页 UI
 */
export function App() {
  const theme = useThemeStore((s) => s.theme);

  // 启动时:同步主题到 React state(bootstrapTheme 已经更新了 DOM)
  useEffect(() => {
    bootstrapTheme();
  }, []);

  return (
    <div data-theme={theme} style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <TodayPage onOpenConvert={() => {
        // TASK-005 实现后接入路由
        alert('换算页(TASK-005)');
      }} />
    </div>
  );
}