# TASK-004 · 迁移今日页 UI(Timer + Stats)

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 0.5 天 |
| **依赖** | TASK-002, TASK-003 |
| **优先级** | P1 |
| **状态** | ⏳ 待开始 |

---

## 1. 目标

把 `index.html` 中 `#page-today` + Hero 区块(Timer Card + Stats 双卡)迁移为 React 组件,**视觉与现有 HTML 版完全一致**。

---

## 2. 验收标准

- [ ] `src/pages/TodayPage.tsx` 渲染 Timer + 2 个 Stats
- [ ] `src/components/TimerCard/` 组件化 Timer
- [ ] `src/components/StatCard/` 组件化 Stats
- [ ] `src/components/StatusBar/` 状态栏(时间 + 信号 + 电池)
- [ ] 每秒自动刷新(用 `setInterval`,cleanup 正确)
- [ ] 使用 `compute.ts` 的纯函数(`dayState`、`todayEarned` 等)
- [ ] 字体使用 Google Fonts(Cormorant Garamond / Figtree / JetBrains Mono)
- [ ] 主题变量正确切换(`var(--ink)`、`var(--accent)` 等)
- [ ] `docs/CHANGELOG.md` 追加变更

---

## 3. 组件拆分

```
src/components/
├── TimerCard/
│   ├── TimerCard.tsx
│   ├── TimerCard.module.css
│   └── index.ts
├── StatCard/
│   ├── StatCard.tsx
│   ├── StatCard.module.css
│   └── index.ts
└── StatusBar/
    ├── StatusBar.tsx
    ├── StatusBar.module.css
    └── index.ts

src/pages/
└── TodayPage.tsx
```

---

## 4. TimerCard 设计

```tsx
interface TimerCardProps {
  startTime: string;
  endTime: string;
}

export function TimerCard({ startTime, endTime }: TimerCardProps) {
  // 每秒调用 dayState(),progressPct(),todayEarned()
  // ...

  return (
    <div className={styles.card}>
      <div className={styles.status}>
        <span className={styles.dot} />
        <span>{statusText}</span>
      </div>
      <div className={styles.display}>{display}</div>
      <div className={styles.label}>{label}</div>
      <div className={styles.shift}>...</div>
      <div className={styles.progress}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.range}>
        <span>{startTime}</span>
        <span>{endTime}</span>
      </div>
    </div>
  );
}
```

---

## 5. 全局 ticker hook

抽出一个 `useNow()` hook,避免每个组件自己 setInterval:

```ts
// src/hooks/useNow.ts
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

---

## 6. CSS 迁移策略

**直接复制现有 CSS** 到 CSS Modules:
1. 从 `src/styles/tokens.css` 复制 CSS 变量到 `src/styles/tokens.css`(项目级)
2. 从 `src/styles/base.css` 复制基础样式到 `src/styles/base.css`
3. 从 `src/styles/shared.css` 复制共享样式到 `src/styles/shared.css`
4. 页面专属 CSS → 对应组件的 `.module.css`

**注意**:CSS Modules 会把类名 hash,所以现有选择器需要重命名(如 `.timer-card` → `.card`)。

---

## 7. 操作步骤

1. 从 `index.html` + `src/styles/*` 复制 HTML 结构和 CSS
2. 安装依赖(如需要 `clsx` 用于条件 class)
3. 创建 `src/hooks/useNow.ts`
4. 创建 `src/components/StatusBar/`
5. 创建 `src/components/TimerCard/`
6. 创建 `src/components/StatCard/`
7. 创建 `src/pages/TodayPage.tsx`
8. 更新 `src/App.tsx` 临时显示 `<TodayPage />`
9. `npm run dev` → 视觉对比原 HTML 版
10. 修复样式细节直到一致
11. 更新 `docs/CHANGELOG.md`

---

## 8. 字体加载

在 `index.html` 中加 `<link>` 到 Google Fonts(参考现有版本):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Figtree:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## 9. 测试要点

- 组件快照测试:`TimerCard.test.tsx` 验证渲染
- 行为测试:模拟不同 `dayState()` 返回值,验证显示内容

---

## 10. 不要做的事

- ❌ 不要修改 `compute.ts` 的 API(本任务只调用,不重构)
- ❌ 不要在这一步做响应式布局(TASK-008 专门处理)
- ❌ 不要在这一步接状态管理细节(用 props 传 config,后续 store 接入在专门任务)

---

## 11. 完成提交信息

```
feat(today): migrate Today page to React

- Componentize StatusBar, TimerCard, StatCard
- Add useNow hook for second-by-second updates
- Migrate CSS to CSS Modules
- Visual parity with original HTML version
- Update CHANGELOG.md
```

---

*创建于 2026-08-28*