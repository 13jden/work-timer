# TASK-009 · 主题系统接入 + 切换动画

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 0.5 天 |
| **依赖** | TASK-008 |
| **优先级** | P3 |
| **状态** | ✅ 已完成(2026-08-28,随 TASK-003 themeStore) |

---

## 1. 目标

把现有 3 套主题(paper / obsidian / gold)完整迁移:
- CSS 变量 token
- 主题切换器(设置页 + sidebar footer)
- `data-theme` 切换平滑过渡
- meta theme-color 同步更新

---

## 2. 验收标准

- [ ] `src/styles/tokens.css` 三套主题完整
- [ ] 切换主题时背景、文本、accent 全部变化
- [ ] 过渡动画 200ms(避免突兀)
- [ ] `meta[name="theme-color"]` 同步更新
- [ ] localStorage 记忆主题
- [ ] `docs/CHANGELOG.md` 追加变更

---

## 3. 文件结构

```
src/styles/
├── tokens.css          ← CSS 变量定义
├── base.css            ← 全局基础
└── transitions.css     ← 主题切换过渡
```

---

## 4. tokens.css 内容(参考现有)

```css
:root {
  --font-display: "Cormorant Garamond", serif;
  --font-sans: "Figtree", system-ui;
  --font-mono: "JetBrains Mono", monospace;

  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;

  --radius-sm: 6px; --radius-md: 12px; --radius-lg: 24px;
}

[data-theme="paper"] {
  --ink: #0F0F0F;     --ink-2: #2A2A2A;    --ink-3: #4A4A4A;
  --paper: #F5F2EA;   --paper-2: #ECE7DC;
  --accent: #C8FF00;  --accent-deep: #95BD00;
  --accent-shadow: rgba(200, 255, 0, 0.4);
  --card: #FFFFFF;    --line: #1A1A1A;    --line-soft: #DDD5C5;
  --muted: #6B6B6B;   --muted-2: #999999;
}

[data-theme="obsidian"] {
  --ink: #E8E8F0;     --ink-2: #C8C8D0;    --ink-3: #888898;
  --paper: #131320;   --paper-2: #1A1A28;
  --accent: #7C6FF7;  --accent-deep: #5A4DD9;
  --accent-shadow: rgba(124, 111, 247, 0.5);
  --card: #1F1F30;    --line: #2A2A3A;    --line-soft: #20202E;
  --muted: #888898;   --muted-2: #5A5A6A;
}

[data-theme="gold"] {
  --ink: #2A2520;     --ink-2: #4A4540;    --ink-3: #6A6560;
  --paper: #FAF9F6;   --paper-2: #F0EDE5;
  --accent: #C9A84C;  --accent-deep: #8B7430;
  --accent-shadow: rgba(201, 168, 76, 0.3);
  --card: #FFFFFF;    --line: #C9A84C;    --line-soft: #E8DDC5;
  --muted: #7A7570;   --muted-2: #5A5550;
}
```

---

## 5. transitions.css

```css
:root {
  --theme-transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

body, .card, .stat-card, .timer-card, .settings-card {
  transition:
    background-color var(--theme-transition),
    color var(--theme-transition),
    border-color var(--theme-transition);
}
```

---

## 6. themeStore 已存在(TASK-003)

确认 `themeStore.setTheme` 同时:
- 更新 store 状态
- 设置 `document.documentElement[data-theme]`
- 更新 `meta[name="theme-color"]`

---

## 7. ThemeSwitcher 组件

```tsx
const themes = [
  { id: 'paper', label: '柠檬黄', color: '#C8FF00' },
  { id: 'obsidian', label: '靛蓝', color: '#7C6FF7' },
  { id: 'gold', label: '香槟金', color: '#C9A84C' },
];

export function ThemeSwitcher() {
  const current = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);

  return (
    <div className={styles.switcher}>
      {themes.map(t => (
        <button
          key={t.id}
          aria-label={t.label}
          className={current === t.id ? styles.active : ''}
          style={{ background: t.color }}
          onClick={() => setTheme(t.id)}
        />
      ))}
    </div>
  );
}
```

---

## 8. 操作步骤

1. 创建 `src/styles/tokens.css`(从现有版本复制 + 微调)
2. 创建 `src/styles/base.css`
3. 创建 `src/styles/transitions.css`
4. 创建 `ThemeSwitcher` 组件
5. 在 `main.tsx` 引入 styles
6. 在设置页 + sidebar footer 显示 ThemeSwitcher
7. 测试 3 套主题切换流畅
8. 更新 `docs/CHANGELOG.md`

---

## 9. 不要做的事

- ❌ 不要做"自定义主题"功能(MVP 只支持 3 套)
- ❌ 不要在 JS 中改颜色(只通过 CSS 变量)

---

## 10. 完成提交信息

```
feat(theme): migrate theme tokens with transition animations

- Add tokens.css with 3 themes
- Add transitions.css for smooth theme switch
- Componentize ThemeSwitcher
- Sync meta theme-color on change
- Update CHANGELOG.md
```

---

*创建于 2026-08-28*