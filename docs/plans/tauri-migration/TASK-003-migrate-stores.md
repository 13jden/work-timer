# TASK-003 · 迁移 storage / theme / state 到 Zustand

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 0.5 天 |
| **依赖** | TASK-002 |
| **优先级** | P1 |
| **状态** | ⏳ 待开始 |

---

## 1. 目标

把 `src/js/storage.js`、`src/js/state.js`、`src/js/theme.js` 迁移为:
- **`storage.ts`** —— `localStorage` 封装(纯函数)
- **`store/configStore.ts`** —— Zustand store(config + 派生 actions)
- **`store/itemsStore.ts`** —— items store
- **`store/calendarStore.ts`** —— dayOverrides + calState
- **`store/themeStore.ts`** —— 主题切换

**核心思路**:
- state.js 的常量(`DEFAULT_CONFIG`、`THEMES`、`HOLIDAYS`)→ `lib/constants.ts`
- 隐式 `state` 对象 → 多个 Zustand stores(按职责拆分)

---

## 2. 验收标准

- [ ] `src/lib/storage.ts` 实现 `loadJSON` / `saveJSON`(从原 storage.js 复制,加类型)
- [ ] `src/lib/constants.ts` 包含所有原 `state.js` 导出的常量
- [ ] `src/store/configStore.ts` 提供 `useConfigStore`(读 + 写 + 自动持久化)
- [ ] `src/store/itemsStore.ts` 同上
- [ ] `src/store/calendarStore.ts` 同上
- [ ] `src/store/themeStore.ts` 主题切换 + DOM 更新
- [ ] `zustand/middleware` 用 `persist` 自动持久化
- [ ] 现有 4 个 `localStorage` key 名称**保持不变**(向后兼容旧数据)
- [ ] 单测:`storage.test.ts` + 至少 1 个 store 测试
- [ ] `docs/CHANGELOG.md` 追加变更

---

## 3. 关键设计

### 3.1 存储键保持兼容

```ts
// src/lib/constants.ts
export const STORAGE_KEY = 'salary_timer_config_v1';
export const ITEMS_KEY   = 'salary_timer_items_v1';
export const OVERRIDES_KEY = 'salary_timer_day_overrides_v1';
export const MONTHLY_KEY = 'salary_timer_monthly_v1';
```

**意义**:用户在 HTML 版输入的数据,导入到 React 版时**无需迁移**。

### 3.2 configStore 示例

```ts
// src/store/configStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY, DEFAULT_CONFIG } from '../lib/constants';
import type { Config } from '../lib/types';

interface ConfigStore extends Config {
  setConfig: (patch: Partial<Config>) => void;
  reset: () => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      setConfig: (patch) => set((s) => ({ ...s, ...patch })),
      reset: () => set(() => ({ ...DEFAULT_CONFIG })),
    }),
    { name: STORAGE_KEY }
  )
);
```

### 3.3 themeStore 注意点

主题需要同步更新 `document.documentElement[data-theme]`:

```ts
import { create } from 'zustand';

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'paper',
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.setAttribute('data-theme', theme);
    // 同步 meta theme-color
    const colors = { paper: '#F5F2EA', obsidian: '#131320', gold: '#FAF9F6' };
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[theme]);
  },
}));
```

---

## 4. 文件清单

```
src/
├── lib/
│   ├── storage.ts             ← 新建
│   ├── storage.test.ts        ← 新建
│   ├── constants.ts           ← 新建(原 state.js 的常量)
│   └── types.ts               ← 已有(TASK-002)
├── store/
│   ├── configStore.ts         ← 新建
│   ├── itemsStore.ts          ← 新建
│   ├── calendarStore.ts       ← 新建
│   ├── themeStore.ts          ← 新建
│   └── store.test.ts          ← 新建(至少 configStore 一例)
```

---

## 5. 操作步骤

1. 安装依赖:`npm i zustand`
2. 创建 `src/lib/constants.ts`(从 state.js 复制常量 + 加类型)
3. 创建 `src/lib/storage.ts`(类型化版本)
4. 创建 `src/store/*` 四个 store
5. 创建单测 `src/lib/storage.test.ts` 和 `src/store/store.test.ts`
6. `npm run test` → 通过
7. `npm run typecheck` → 通过
8. 更新 `docs/CHANGELOG.md`

---

## 6. itemsStore 特殊点

```ts
interface ItemsStore {
  items: Item[];
  add: (item: Omit<Item, 'id' | 'order'>) => void;
  update: (id: string, patch: Partial<Item>) => void;
  remove: (id: string) => void;
}
```

`add` 时生成 uuid(用 `crypto.randomUUID()`),`order` 取当前最大 +1。

---

## 7. 测试要点

### storage.ts
- `loadJSON` 解析有效 JSON
- `loadJSON` 解析失败回退到 fallback
- `saveJSON` 写入后再读能拿回

### configStore
- `setConfig({ monthlySalary: 20000 })` 后读 → 20000
- 持久化:改动后 `localStorage[STORAGE_KEY]` 有值
- 重新创建 store(模拟刷新)→ 数据仍在

---

## 8. 不要做的事

- ❌ 不要给 themeStore 用 `persist`(主题应该在每次启动从 localStorage 读,然后应用)
- ❌ 不要在 store 里写计算逻辑(应在 `compute.ts` 中)
- ❌ 不要把所有 state 合到一个 store(按职责拆分)
- ❌ 不要改 storage key 名称

---

## 9. 完成提交信息

```
feat(store): migrate to Zustand with persistence

- Replace singleton state object with 4 stores: config/items/calendar/theme
- Use zustand/middleware persist for localStorage sync
- Keep storage keys unchanged for backward compatibility
- Add unit tests
- Update CHANGELOG.md
```

---

*创建于 2026-08-28*