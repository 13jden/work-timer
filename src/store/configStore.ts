/**
 * Salary Timer — Config Store
 *
 * 管理用户配置(月薪、上班时间、下班时间、咖啡单价、休息模式)。
 * 自动持久化到 localStorage。
 *
 * 注意:`theme` 字段虽然出现在 Config 类型中,但实际持久化由 themeStore 管理
 * —— 避免重复写入 / 来源不一致。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_CONFIG, STORAGE_KEY } from '../lib/constants';
import { loadJSON } from '../lib/storage';
import type { Config } from '../lib/types';

// ── Store 形状 ──────────────────────────────────────────────
interface ConfigStore extends Config {
  /** 部分更新配置 */
  setConfig: (patch: Partial<Config>) => void;
  /** 重置为默认 */
  reset: () => void;
}

// ── 自定义 storage:不写入 theme 字段 ────────────────────────
const configStorage = {
  getItem: (name: string) => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { state?: Partial<Config> };
      // 删除 theme,让 themeStore 单独管理
      if (parsed.state) delete parsed.state.theme;
      return JSON.stringify(parsed);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

// ── Store 实现 ──────────────────────────────────────────────
export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      setConfig: (patch) =>
        set((state) => ({
          ...state,
          ...patch,
          // 始终由 themeStore 决定 theme
          theme: state.theme,
        })),
      reset: () => set(() => ({ ...DEFAULT_CONFIG })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => configStorage),
      // partialize 已由自定义 storage 完成
    },
  ),
);

/** 兼容旧数据(老 storage 里没 theme 字段),从老结构中补全 */
if (typeof window !== 'undefined') {
  const existing = loadJSON<{ state?: Config }>(STORAGE_KEY, { state: undefined });
  if (existing.state && !('theme' in existing.state)) {
    // 老版本没有 theme,补一个默认值
    useConfigStore.setState({ theme: DEFAULT_CONFIG.theme });
  }
}