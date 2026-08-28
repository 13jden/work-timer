# TASK-008 · 响应式布局(mobile / desktop)

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 0.5 天 |
| **依赖** | TASK-005, 006, 007 |
| **优先级** | P2 |
| **状态** | ✅ 已完成(2026-08-28) |

---

## 1. 目标

实现桌面端 ≥1024px 的 sidebar 布局,与现有 HTML 版一致:
- 桌面:左侧 240px sidebar(品牌 + 导航 + 设置面板) + 主区(永远显示今日)
- 移动:<1024px 底部 tab 4 个 + 单列

---

## 2. 验收标准

- [ ] `src/components/Sidebar/`(桌面端专属)
- [ ] `src/components/BottomNav/`(移动端专属)
- [ ] `src/hooks/useMediaQuery.ts`
- [ ] 1024px 断点切换布局
- [ ] 桌面端 sidebar 内嵌设置表单(月薪、上班时间、下班时间等),**实时双向绑定**
- [ ] 桌面端 sidebar footer 显示主题切换器
- [ ] 移动端保留底部 4-tab
- [ ] `docs/CHANGELOG.md` 追加变更

---

## 3. 布局对比

### Mobile (< 1024px)

```
┌─────────────┐
│ Status Bar  │
├─────────────┤
│  Page       │
│  Content    │
│             │
├─────────────┤
│ ⊙  ⊙  ⊙  ⊙ │  ← Bottom Nav
└─────────────┘
```

### Desktop (≥ 1024px)

```
┌──────┬──────────────────┐
│      │ Status Bar       │
│ Side ├──────────────────┤
│ bar  │ Hero (Timer)     │
│      │ + Stats 双卡     │
│      │ + 桌面侧 Quote   │
├──────┤                  │
│ 设置 │   (今日页永远显示)  │
│ 面板 │                  │
├──────┤                  │
│主题  │                  │
└──────┴──────────────────┘
```

---

## 4. useMediaQuery hook

```ts
// src/hooks/useMediaQuery.ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);

  useEffect(() => {
    const mq = matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
```

**使用**:
```tsx
const isDesktop = useMediaQuery('(min-width: 1024px)');
return isDesktop ? <DesktopLayout /> : <MobileLayout />;
```

---

## 5. Sidebar 组件

```tsx
interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <h1>Salary Timer</h1>
        <p>实时薪资 · 上班摸鱼</p>
      </div>
      <nav>
        <button className={activeTab === 'today' ? styles.active : ''} onClick={() => onTabChange('today')}>今日</button>
        <button onClick={() => onTabChange('settings')}>设置</button>
      </nav>
      <div className={styles.configPanel}>
        <ConfigPanel />   {/* 实时双向绑定 */}
      </div>
      <div className={styles.footer}>
        <ThemeSwitcher />
      </div>
    </aside>
  );
}
```

---

## 6. 操作步骤

1. 创建 `useMediaQuery` hook
2. 创建 `Sidebar`(桌面专属,≥1024px 显示)
3. 创建 `BottomNav`(移动专属,<1024px 显示)
4. 创建 `App.tsx` 主布局,根据断点切换
5. 桌面端默认只显示今日 + 设置(其他 tab 通过 sidebar 进入)
6. 桌面端 sidebar 内嵌配置面板(实时绑定)
7. 移动端底部 4-tab + 单列
8. 测试窗口 resize 时布局切换流畅
9. 更新 `docs/CHANGELOG.md`

---

## 7. 不要做的事

- ❌ 不要做 sidebar 可折叠/可拖动
- ❌ 不要做平板断点的中间布局(只有 2 档)

---

## 8. 完成提交信息

```
feat(layout): responsive mobile/desktop layout

- Add Sidebar for desktop (≥1024px)
- Add BottomNav for mobile (<1024px)
- Add useMediaQuery hook
- Embed config panel in sidebar with real-time binding
- Update CHANGELOG.md
```

---

*创建于 2026-08-28*