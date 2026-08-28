/**
 * Salary Timer — Theme Store
 *
 * 管理主题切换。**不带 persist**(单独处理):
 *  - 应用启动时:App.tsx 显式从 localStorage 读 → applyTheme
 *  - 用户切换主题时:更新 store + DOM + meta theme-color
 *
 * 为什么不直接用 zustand persist?
 *  - 主题需要在 hydrate 之前就应用到 DOM,否则页面闪烁白底
 *  - 自定义逻辑更可控
 */
import { create } from 'zustand';
import { THEMES } from '../lib/constants';
import type { ThemeMeta } from '../lib/constants';

// ── Store 形状 ──────────────────────────────────────────────
type ThemeId = ThemeMeta['id'];

interface ThemeStore {
  theme: ThemeId;

  /** 切换主题(更新 store + 应用到 DOM + 写入 localStorage) */
  setTheme: (theme: ThemeId) => void;
}

// ── localStorage key(独立管理,不和 configStore 混) ──────────
const STORAGE_KEY = 'salary_timer_theme_v1';

function applyToDom(theme: ThemeId): void {
  if (typeof document === 'undefined') return;

  const meta = THEMES[theme];
  document.documentElement.setAttribute('data-theme', theme);

  const metaEl = document.querySelector('meta[name="theme-color"]');
  if (metaEl) {
    metaEl.setAttribute('content', meta.paper);
  }

  // 同步写入 localStorage
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

/** 应用启动时调用,确保启动时主题正确 */
export function bootstrapTheme(): void {
  if (typeof window === 'undefined') return;
  let stored: ThemeId = 'paper';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'paper' || raw === 'obsidian' || raw === 'gold') {
      stored = raw;
    }
  } catch {
    // ignore
  }
  applyToDom(stored);
  // 不调用 setState:避免在 hydrate 之前造成不必要 re-render
  // 改用 useThemeStore.setState 同步外部 store(供 React 订阅使用)
  useThemeStore.setState({ theme: stored });
}

// ── Store 实现 ──────────────────────────────────────────────
export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'paper',

  setTheme: (theme) => {
    applyToDom(theme);
    set({ theme });
  },
}));

/** 给所有主题取一份数组(用于 UI 主题选择器) */
export const THEME_LIST: ThemeMeta[] = Object.values(THEMES);