/**
 * Salary Timer — App Mode Store
 *
 * v2.1 TASK-037:移动端双主题框架。
 * - 'timer':计时主题(原 4 tab)
 * - 'accounting':记账主题(4 tab,其余页 2.2–2.4 补)
 *
 * 不 persist:启动默认计时主题;切换由上下滑手势驱动。
 */
import { create } from 'zustand';

export type AppMode = 'timer' | 'accounting';

interface AppModeStore {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useAppModeStore = create<AppModeStore>((set) => ({
  mode: 'timer',
  setMode: (mode) => set({ mode }),
}));
