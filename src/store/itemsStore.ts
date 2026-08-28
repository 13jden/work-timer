/**
 * Salary Timer — Items Store
 *
 * 管理换算页物品列表。
 * 自动持久化到 localStorage。
 * 首次使用时填入 DEFAULT_ITEMS。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_ITEMS, ITEMS_KEY } from '../lib/constants';
import { loadJSON } from '../lib/storage';
import type { Item } from '../lib/types';

// ── Store 形状 ──────────────────────────────────────────────
interface ItemsStore {
  items: Item[];

  /** 添加物品(id 自动生成,order 自动递增) */
  add: (item: Omit<Item, 'id' | 'order'>) => void;
  /** 更新物品(按 id) */
  update: (id: string, patch: Partial<Item>) => void;
  /** 删除物品 */
  remove: (id: string) => void;
  /** 重置为默认 */
  reset: () => void;
}

// ── 默认值判断:首次使用时填充预设 ────────────────────────────
const initialItems = (() => {
  const stored = loadJSON<Item[] | null>(ITEMS_KEY, null);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return DEFAULT_ITEMS.slice();
})();

// ── id 工具:简单 uuid v4(避免依赖外部包) ──────────────────────
function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback
  return 'item-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36);
}

// ── Store 实现 ──────────────────────────────────────────────
export const useItemsStore = create<ItemsStore>()(
  persist(
    (set, get) => ({
      items: initialItems,

      add: (item) => {
        const maxOrder = get().items.reduce((max, it) => Math.max(max, it.order), -1);
        const newItem: Item = {
          ...item,
          id: uuid(),
          order: maxOrder + 1,
        };
        set({ items: [...get().items, newItem] });
      },

      update: (id, patch) => {
        set({
          items: get().items.map((it) =>
            it.id === id ? { ...it, ...patch } : it,
          ),
        });
      },

      remove: (id) => {
        set({ items: get().items.filter((it) => it.id !== id) });
      },

      reset: () => set({ items: DEFAULT_ITEMS.slice() }),
    }),
    {
      name: ITEMS_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);