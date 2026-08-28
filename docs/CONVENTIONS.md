# Code Conventions · Salary Timer

> 本文件定义项目的代码规范。所有 PR 和 AI Agent 改动都必须遵守。
> 任何规范冲突,优先看本文件 + `AGENTS.md`,再讨论修改。

---

## 1. 通用原则

### 1.1 哲学
- **可读性 > 巧妙性** —— 写得像散文,而不是密码
- **小步提交** —— 每个 commit 只做一件事
- **纯函数优先** —— 计算逻辑必须可测试
- **本地优先** —— 不要假设有后端、云端、用户系统

### 1.2 命名规则

| 类型 | 命名 | 示例 |
|---|---|---|
| 变量 | camelCase | `monthlySalary` |
| 常量 | UPPER_SNAKE | `STORAGE_KEY` |
| 函数 | camelCase,动词开头 | `getRate()`, `parseDate()` |
| 类 / 组件 | PascalCase | `<TodayPage>` |
| 文件名(JS) | kebab-case | `render-today.ts` |
| 文件名(组件) | PascalCase | `TodayPage.tsx` |
| CSS 类名 | kebab-case | `.timer-card` |
| 数据库键 | snake_case + 版本 | `salary_timer_config_v1` |

### 1.3 注释规则

**何时写注释**(满足任一):
- 解释"为什么"而不是"做了什么"
- 提醒容易踩的坑
- 引用外部文档 / RFC
- 标注算法的数学依据

**何时不写**:
- 重复代码本身的意思(例如 `i++ // 计数器递增`)
- 标记明显的 section(`// ── imports ──` 仅在长文件可保留)

**JSDoc** —— 所有 export 函数必须写,关键参数 + 返回值:
```ts
/**
 * 计算当前分钟数(含秒小数)。
 * @param date - Date 对象,默认现在
 * @returns 总分钟数,例如 14:30:45 → 870.75
 */
export function nowInMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}
```

---

## 2. TypeScript 规范

### 2.1 严格性
- `"strict": true` + `"noUncheckedIndexedAccess": true`
- 不允许 `any`,用 `unknown` + 类型守卫代替

### 2.2 类型定义位置
- 跨模块类型 → `src/types/index.ts`
- 单文件私有类型 → 文件顶部

### 2.3 接口 vs 类型别名
- **对象结构**用 `interface`(便于扩展)
- **联合 / 工具类型**用 `type`

```ts
// 好
interface Config { monthlySalary: number; ... }
type RestMode = 0 | 1 | 2;

// 不好
type Config = { monthlySalary: number; ... }
```

---

## 3. React 规范(目标栈)

### 3.1 组件
- 函数组件 + Hooks,**不要** class 组件
- 每个组件一个文件,文件名 PascalCase
- Props 必须显式 `interface`,**不要** `React.FC`(避免隐式 children)

```tsx
interface TimerProps {
  startTime: string;
  endTime: string;
}

export function Timer({ startTime, endTime }: TimerProps) {
  // ...
}
```

### 3.2 Hooks 使用
- 状态:`useState` / `useReducer`(复杂状态用 reducer)
- 全局:`zustand` store,**不要** Context 嵌套地狱
- 副作用:`useEffect` 依赖必须完整,**禁止** lint-disable
- 性能:`useMemo` / `useCallback` 只在确实必要时用

### 3.3 目录结构
```
src/
├── components/       ← 通用组件
│   ├── TimerCard/
│   │   ├── index.tsx
│   │   ├── TimerCard.tsx
│   │   └── TimerCard.module.css
├── pages/            ← 页面级组件
│   ├── TodayPage.tsx
│   ├── CalendarPage.tsx
│   └── SettingsPage.tsx
├── hooks/            ← 自定义 hooks
├── store/            ← zustand stores
├── lib/              ← 纯函数(从 src/js 迁移)
├── types/            ← 类型定义
└── styles/           ← 全局样式 + 主题 token
```

---

## 4. CSS 规范

### 4.1 主题 token
**所有颜色 / 间距必须用 CSS 变量**,禁止硬编码:

```css
/* 好 */
.card { background: var(--paper); padding: var(--space-4); }

/* 不好 */
.card { background: #F5F2EA; padding: 16px; }
```

### 4.2 命名
- BEM 风格:`.block__element--modifier`
- 例外:CSS Modules 自动 hash,**不要**手动 BEM

### 4.3 主题切换
通过 `data-theme` 属性 + CSS 变量,**禁止** JS 改 inline style:

```ts
// 好
document.documentElement.setAttribute('data-theme', 'dark');

// 不好
document.body.style.background = '#000';
```

---

## 5. Git 规范

### 5.1 Commit message(Conventional Commits)
```
<type>(<scope>): <subject>

<body>

<footer>
```

| type | 说明 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修复 |
| `refactor` | 重构(既不修 bug 也不加功能) |
| `docs` | 文档 |
| `test` | 测试 |
| `chore` | 构建 / 工具 / 杂项 |

**scope** 限定模块:`today`, `calendar`, `settings`, `tauri`, `docs` 等。

**示例**:
```
feat(today): add flip animation on income update

- Use setFlipText with CSS transition
- Trigger on every earned value change
- Animate the difference smoothly
```

### 5.2 分支策略
- `main` —— 始终可运行
- `feat/<name>` —— 新功能
- `fix/<name>` —— 修复
- `chore/<name>` —— 杂项

**不要**直接 commit 到 main。

---

## 6. 测试规范

### 6.1 必须测试
- `lib/compute.ts` —— **所有纯函数**必须有单测
- 状态 reducer
- 复杂 UI 交互(用 Playwright)

### 6.2 测试框架
- 单元:**Vitest**
- 组件:**React Testing Library**
- E2E:**Playwright**

### 6.3 测试文件位置
- 与源文件同目录:`compute.ts` ↔ `compute.test.ts`
- **不要**单独 `tests/` 目录

### 6.4 命名
```ts
describe('dailySalary', () => {
  it('returns monthly salary divided by workdays', () => {
    expect(dailySalary(15000, 22)).toBeCloseTo(681.81, 2);
  });
});
```

---

## 7. 文件 / 目录约定

### 7.1 不允许
- ❌ 在 `src/` 根目录放 `.tsx` 文件
- ❌ 单文件超过 500 行(必须拆分)
- ❌ 循环依赖(用 import type 解决)
- ❌ 隐式全局变量

### 7.2 必须
- ✅ 每个 `.ts` 文件顶都有 `@fileoverview`
- ✅ 所有 export 函数有 JSDoc
- ✅ 公共常量集中到 `lib/constants.ts`
- ✅ 配置相关 schema 用 Zod / TypeScript 接口校验

---

## 8. 文档同步规范

| 改动类型 | 必须更新的文档 |
|---|---|
| 新增功能 | `CHANGELOG.md` + `ARCHITECTURE.md`(如涉及模型) |
| 重构 | `CHANGELOG.md` + `ARCHITECTURE.md`(章节) |
| Bug 修复 | `CHANGELOG.md` |
| 规范变更 | `CONVENTIONS.md` + `CHANGELOG.md` |
| 任务完成 | 对应 `TASK-XXX.md` 标记完成 + `CHANGELOG.md` |

---

## 9. 性能与体验底线

- 首屏 < 500ms(本地优先,不该慢)
- 每秒更新 UI 时,**不要**全局重渲染(用精细订阅)
- 触摸目标 ≥ 44×44 px
- 不引入超过 50KB 的新依赖前必须评估

---

*最后更新:2026-08-28 · 重构启动*