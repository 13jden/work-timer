# TASK-001 · 初始化 Vite + React + TypeScript 项目

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 0.5 天 |
| **依赖** | 无 |
| **优先级** | P0(阻塞后续所有任务) |
| **状态** | ✅ 已完成(2026-08-28) |
| **负责人** | Agent(自动) |

---

## 1. 目标

初始化一个干净的 **Vite + React 18 + TypeScript** 项目,与现有 HTML 版本共存,**不修改 `index.html`**,为后续 TASK 铺路。

---

## 2. 验收标准

完成后,**每一项都必须为真**:

- [ ] 仓库根目录下 `npm run dev` 可启动(默认端口 5173) — ✅ 已验证
- [ ] 仓库根目录下 `npm run build` 可产出 `dist/` — ✅ 已验证(143KB / gzip 46KB)
- [ ] `npm run typecheck`(`tsc --noEmit`)通过 — ✅ 已验证
- [ ] `package.json` 中依赖列表正确(见 §3) — ✅ 已验证
- [ ] 新建 `src/main.tsx`,渲染一个最小的 React 组件(<App /> 显示 "Salary Timer") — ✅ 已完成
- [ ] `tsconfig.json` 启用 `strict` + `noUncheckedIndexedAccess` — ✅ 已配置
- [ ] `.gitignore` 包含 `node_modules/`、`dist/`、`src-tauri/`(预防性) — ✅ 已更新
- [ ] 旧文件**完全保留**:`index.html`、`www/`、`android/` 都不动 — ⚠️ **部分保留**(已新建 `legacy/` 保存原版)
- [ ] `docs/CHANGELOG.md` 追加本次变更 — ✅ 已完成

---

## 6. 执行说明(2026-08-28 实际)

### 偏离 TASK 规范的说明

原 TASK 规定"不要修改 index.html",但 Vite 必须有同名 `index.html` 作为入口。
**处理方式**:
1. 旧版 HTML 从 git HEAD 恢复到 `www/index.html`(Capacitor 仍可用)
2. 在 `legacy/index.html` 留一份历史归档
3. 在 `AGENTS.md` 更新"旧 index.html"指向 `legacy/`,而非根目录

### 实际产物

```
work-timer/
├── legacy/index.html              ← 旧版(归档)
├── www/index.html                 ← 旧版(Capacitor 用)
├── index.html                     ← 新版(Vite 入口)
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── package.json                   ← React 18 + Vite 5 + TS 5.5
├── src/
│   ├── main.tsx                   ← React 入口
│   └── App.tsx                    ← 占位组件
└── docs/
    └── CHANGELOG.md               ← 已追加
```

---

## 3. 依赖清单

### 3.1 `dependencies`

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

### 3.2 `devDependencies`

```json
{
  "@types/react": "^18.3.3",
  "@types/react-dom": "^18.3.0",
  "@vitejs/plugin-react": "^4.3.1",
  "typescript": "^5.5.3",
  "vite": "^5.3.4"
}
```

**未来任务会加**(本任务**不要**提前加):
- `zustand`(TASK-003)
- `vitest` + `@testing-library/react`(TASK-002)

---

## 4. 文件清单(本任务需新建)

```
work-timer/
├── package.json              ← 新建
├── vite.config.ts            ← 新建
├── tsconfig.json             ← 新建
├── tsconfig.node.json        ← 新建(vite 配置专用)
├── index.html                ← 替换(改为 Vite 入口)
└── src/
    ├── main.tsx              ← 新建
    └── App.tsx               ← 新建(占位)
```

**注意**:`index.html` 是新建的 Vite 入口,**但与现有 HTML 不冲突**(现有 HTML 在 `www/index.html` 和 Capacitor 中)。

---

## 5. 关键文件内容

### 5.1 `package.json`(片段)

```json
{
  "name": "work-timer",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}
```

### 5.2 `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

### 5.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 5.4 `index.html`(Vite 入口)

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Salary Timer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 5.5 `src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 5.6 `src/App.tsx`

```tsx
export function App() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Salary Timer</h1>
      <p>React 重写阶段启动。详见 docs/plans/ROADMAP.md。</p>
    </div>
  );
}
```

---

## 6. 操作步骤

1. **不要删除任何旧文件**
2. 在仓库根目录创建 `package.json`、`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`
3. 创建 `index.html`(新 Vite 入口)
4. 创建 `src/main.tsx`、`src/App.tsx`
5. 运行 `npm install`
6. 运行 `npm run typecheck` → 应当通过
7. 运行 `npm run build` → 应当成功产出 `dist/`
8. 运行 `npm run dev` → 应当启动并显示 "Salary Timer"
9. 更新 `docs/CHANGELOG.md` 追加变更记录
10. 更新本文件状态为 ✅ 完成

---

## 7. 不要做的事

- ❌ 不要删除 / 修改现有 `index.html`(它在 `www/index.html` 仍被 Capacitor 使用)
- ❌ 不要提前安装 zustand、vitest 等后续任务的依赖
- ❌ 不要开始 TASK-002 的工作(单测框架等下一任务)
- ❌ 不要修改 `android/`、`capacitor.config.json` 任何东西

---

## 8. 完成后的提交信息

```
chore(scaffold): init Vite + React + TypeScript project

- Initialize package.json with React 18, Vite 5, TypeScript 5.5
- Configure strict TypeScript with noUncheckedIndexedAccess
- Add minimal App.tsx as placeholder
- Keep old HTML version intact for Capacitor
- Update CHANGELOG.md
```

---

## 9. 相关文档

- 父级计划:[ROADMAP.md § 阶段 1](./ROADMAP.md#阶段-1react--ts--vite-重写)
- 规范:[CONVENTIONS.md § 2 TypeScript 规范](../../CONVENTIONS.md)
- 架构:[ARCHITECTURE.md § 2 目录结构](../../ARCHITECTURE.md)

---

*创建于 2026-08-28*