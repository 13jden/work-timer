# TASK-007 · 迁移设置页 + 月度记录

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 0.5 天 |
| **依赖** | TASK-004 |
| **优先级** | P2 |
| **状态** | ⏳ 待开始 |

---

## 1. 目标

迁移 `#page-settings`(设置页):
- 薪资配置(月薪、上班、下班、咖啡单价)
- 休息模式下拉
- 主题切换器
- 月度记录列表
- 自动保存到 store(实时持久化)

---

## 2. 验收标准

- [ ] `src/pages/SettingsPage.tsx`
- [ ] `src/components/SettingsGroup/`(设置分组)
- [ ] `src/components/ThemeSwitcher/`(主题圆点切换)
- [ ] `src/components/MonthlyHistoryList/`(月度记录)
- [ ] 表单改动 → 实时写入 `configStore`
- [ ] 主题点击立即生效(`themeStore.setTheme`)
- [ ] 月度记录自动滚动更新(订阅 `monthlyStore`)
- [ ] `docs/CHANGELOG.md` 追加变更

---

## 3. 组件结构

```
src/pages/SettingsPage.tsx

src/components/
├── SettingsGroup/
├── ThemeSwitcher/
└── MonthlyHistoryList/
```

---

## 4. 实时双向绑定

参考现有 HTML 版的 "实时派生统计",在 React 中:

```tsx
import { useConfigStore } from '../store/configStore';

export function SettingsPage() {
  const config = useConfigStore();
  const setConfig = useConfigStore(s => s.setConfig);

  return (
    <SettingsGroup title="薪资 · Salary">
      <SettingsRow label="月薪">
        <input
          type="number"
          value={config.monthlySalary}
          onChange={e => setConfig({ monthlySalary: +e.target.value })}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
```

**不需要单独的 "保存" 按钮**,Zustand persist 自动写入 localStorage。

---

## 5. 月度记录 store

```ts
// src/store/monthlyStore.ts
interface MonthlyRecord { /* ... */ }

interface MonthlyStore {
  records: Record<string, MonthlyRecord>; // key: "YYYYMM"
  generateForMonth: (year: number, month: number) => void;
  lockPrevMonth: () => void;
}

export const useMonthlyStore = create<MonthlyStore>()(
  persist(
    (set, get) => ({
      records: {},
      generateForMonth: (year, month) => {
        const key = `${year}${String(month + 1).padStart(2, '0')}`;
        if (get().records[key]) return;
        // 生成新记录...
        set({ records: { ...get().records, [key]: newRec } });
      },
      lockPrevMonth: () => {
        // 锁定上一月...
      },
    }),
    { name: MONTHLY_KEY }
  )
);
```

---

## 6. 自动月度生成

在 `App.tsx` 中用 `useEffect` + `setInterval`(1 分钟):

```tsx
useEffect(() => {
  const tick = () => {
    const now = new Date();
    useMonthlyStore.getState().generateForMonth(now.getFullYear(), now.getMonth());
    // 检查跨月 → 锁定
  };
  tick();
  const id = setInterval(tick, 60_000);
  return () => clearInterval(id);
}, []);
```

---

## 7. 操作步骤

1. 复制 `src/styles/page-settings.css`
2. 创建 `SettingsGroup`、`ThemeSwitcher`、`MonthlyHistoryList`
3. 创建 `SettingsPage`
4. 创建 `monthlyStore`(如 TASK-003 没做)
5. 接入所有 store
6. `npm run dev` 验证
7. 更新 `docs/CHANGELOG.md`

---

## 8. 不要做的事

- ❌ 不要做"重置全部配置"按钮(避免误操作,先用浏览器 devtools)
- ❌ 不要做导出 / 导入配置(后期任务)

---

## 9. 完成提交信息

```
feat(settings): migrate Settings page with monthly history

- Componentize SettingsGroup, ThemeSwitcher, MonthlyHistoryList
- Wire configStore with real-time two-way binding
- Add monthlyStore with auto-generation
- Update CHANGELOG.md
```

---

*创建于 2026-08-28*