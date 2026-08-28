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
import { DEFAULT_CONFIG, STORAGE_KEY_V2 } from '../lib/constants';
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
    (set, _get) => {
return {
      ...DEFAULT_CONFIG,
      recordedFromDate: (() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      })(),
      setConfig: (patch) =>
        set((state) => ({
          ...state,
          ...patch,
          // 始终由 themeStore 决定 theme
          theme: state.theme,
        })),
      reset: () => set(() => ({ ...DEFAULT_CONFIG })),
    };
    },
    {
      name: STORAGE_KEY_V2,
      storage: createJSONStorage(() => configStorage),
      // partialize 已由自定义 storage 完成
      onRehydrateStorage: () => (state) => {
        // 首次打开时,若 recordedFromDate 为空,写入今天
        if (state && !state.recordedFromDate) {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          state.recordedFromDate = todayStr;
        }
      },
    },
  ),
);

/** 兼容旧 v1 数据:从旧 storage key 迁移字段 */
function migrateFromV1(): void {
  const v1Data = loadJSON<{ state?: Partial<Config> } | null>(STORAGE_KEY_V2.replace('_v2', '_v1'), null);
  if (v1Data?.state) {
    // 写入 v2 key,zustand persist 会自动读取
    const v2Raw = localStorage.getItem(STORAGE_KEY_V2);
    if (!v2Raw) {
      // v2 还没有数据,用 v1 数据初始化
      useConfigStore.setState({
        monthlySalary: v1Data.state.monthlySalary ?? DEFAULT_CONFIG.monthlySalary,
        startTime: v1Data.state.startTime ?? DEFAULT_CONFIG.startTime,
        endTime: v1Data.state.endTime ?? DEFAULT_CONFIG.endTime,
        coffeePrice: v1Data.state.coffeePrice ?? DEFAULT_CONFIG.coffeePrice,
        restMode: v1Data.state.restMode ?? DEFAULT_CONFIG.restMode,
        recordedFromDate: new Date().toISOString().slice(0, 10),
      });
    }
  }
}

if (typeof window !== 'undefined') {
  // 兼容老数据(老 storage 里没 theme 字段),从老结构中补全
  const existing = loadJSON<{ state?: Config }>(STORAGE_KEY_V2.replace('_v2', '_v1'), { state: undefined });
  if (existing.state && !('theme' in existing.state)) {
    useConfigStore.setState({ theme: DEFAULT_CONFIG.theme });
  }
  migrateFromV1();
}