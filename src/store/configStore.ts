/**
 * Salary Timer — Config Store
 *
 * 管理用户配置(月薪、上班时间、下班时间、咖啡单价、休息模式)。
 * 自动持久化到 localStorage。
 *
 * v1.3 升级:
 *   - 持久化 key v2 → v3
 *   - 新增字段:salaryMode / manualHourlyRate / manualDailyRate /
 *     segments / lunchEnabled / lunchStart / lunchMinutes
 *   - 老 v1/v2 数据自动迁移补默认值
 *
 * 注意:`theme` 字段虽然出现在 Config 类型中,但实际持久化由 themeStore 管理
 * —— 避免重复写入 / 来源不一致。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_CONFIG, STORAGE_KEY_V2, STORAGE_KEY_V3 } from '../lib/constants';
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

// ── v3 默认值补全(老 v1/v2 数据读取时) ────────────────────
function migrateToV3(raw: Partial<Config> | undefined): Config {
  return {
    monthlySalary: raw?.monthlySalary ?? DEFAULT_CONFIG.monthlySalary,
    startTime:     raw?.startTime ?? DEFAULT_CONFIG.startTime,
    endTime:       raw?.endTime ?? DEFAULT_CONFIG.endTime,
    coffeePrice:   raw?.coffeePrice ?? DEFAULT_CONFIG.coffeePrice,
    restMode:      raw?.restMode ?? DEFAULT_CONFIG.restMode,
    theme:         raw?.theme ?? DEFAULT_CONFIG.theme,
    recordedFromDate: raw?.recordedFromDate ?? '',
    salaryMode:    raw?.salaryMode ?? DEFAULT_CONFIG.salaryMode,
    manualHourlyRate: raw?.manualHourlyRate ?? DEFAULT_CONFIG.manualHourlyRate,
    manualDailyRate:  raw?.manualDailyRate ?? DEFAULT_CONFIG.manualDailyRate,
    segments:      raw?.segments ?? DEFAULT_CONFIG.segments,
    lunchEnabled:  raw?.lunchEnabled ?? DEFAULT_CONFIG.lunchEnabled,
    lunchStart:    raw?.lunchStart ?? DEFAULT_CONFIG.lunchStart,
    lunchMinutes:  raw?.lunchMinutes ?? DEFAULT_CONFIG.lunchMinutes,
  };
}

// ── Store 实现 ──────────────────────────────────────────────
export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
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
    }),
    {
      name: STORAGE_KEY_V3,
      storage: createJSONStorage(() => configStorage),
      // migrate v2/v1 → v3
      migrate: (persistedState, _version) => {
        const state = persistedState as Partial<Config>;
        return migrateToV3(state) as ConfigStore;
      },
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
  const v1Data = loadJSON<{ state?: Partial<Config> } | null>(STORAGE_KEY_V3.replace('_v3', '_v1'), null);
  if (v1Data?.state) {
    // 写入 v3 key,zustand persist 会自动读取
    const v3Raw = localStorage.getItem(STORAGE_KEY_V3);
    if (!v3Raw) {
      useConfigStore.setState(migrateToV3(v1Data.state));
    }
  }
}

if (typeof window !== 'undefined') {
  // 兼容老数据(老 storage 里没 theme 字段),从老结构中补全
  const existing = loadJSON<{ state?: Config }>(STORAGE_KEY_V2, { state: undefined });
  if (existing.state && !('theme' in existing.state)) {
    useConfigStore.setState({ theme: DEFAULT_CONFIG.theme });
  }
  migrateFromV1();
}