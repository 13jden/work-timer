# Architecture · Salary Timer

> **本文件目标读者**:Agent / 新加入的开发者。
> 阅读完应能回答:这个项目是什么、数据怎么流动、计算逻辑是什么、怎么打包。

---

## 0. 项目定义

**Salary Timer** —— 把工作时间转换为金钱的实时可视化工具。打开应用,看到"今天已经赚了多少、每秒挣多少、咖啡要工作多久才买得起"。

**目标用户**:打工族,上班偷看 App 数钱。
**情感基调**:有态度的打工浪漫,不要严肃工具风。
**核心理念**:**不上云、不注册、不联网**,所有数据本地。

---

## 1. 技术栈(目标态)

| 层 | 技术 | 备注 |
|---|---|---|
| 前端框架 | **React 18 + TypeScript** | 替代当前 Vanilla JS |
| 构建 | **Vite 5** | 与 Tauri 完美兼容 |
| 状态管理 | **Zustand** | 轻量,无 Provider 嵌套 |
| 样式 | CSS Modules + CSS 变量 | 保持现有 token 系统 |
| 桌面 / 移动打包 | **Tauri 2.x** | 一套配置覆盖 Windows / macOS / Linux / iOS / Android |
| 数据存储 | `localStorage`(Web) + Tauri FS(桌面) | 桌面端可考虑导入导出 |
| 测试 | Vitest + RTL + Playwright | 见 `CONVENTIONS.md §6` |

**为什么 Tauri 不用 Electron**:
- 打包体积小 10-20 倍(~5MB vs ~150MB)
- 启动更快,内存占用更低
- Rust 后端,长生命周期的能力可期
- Tauri 2.x 已稳定支持移动端

**为什么不用纯 React Native / Flutter**:
- 本应用 UI 全部是 Web 技术栈(HTML + CSS + 简单交互)
- 用 WebView 包装最经济,Tauri 是最佳载体

---

## 2. 目录结构(目标态)

```
work-timer/
├── AGENTS.md                  ← AI Agent 必读
├── README.md                  ← 用户文档
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html                 ← Vite 入口(由 src/main.tsx 渲染)
├── src/                       ← 主源码
│   ├── main.tsx               ← React 入口
│   ├── App.tsx                ← 根组件 + 路由
│   ├── components/            ← 通用组件
│   ├── pages/                 ← 页面(4 个 tab)
│   ├── hooks/                 ← 自定义 hooks
│   ├── store/                 ← Zustand stores
│   ├── lib/                   ← 纯函数(从 src/js 迁移)
│   │   ├── compute.ts         ← 核心计算
│   │   ├── storage.ts         ← 存储封装
│   │   ├── theme.ts
│   │   └── time.ts
│   ├── types/                 ← 类型定义
│   └── styles/                ← 全局样式 + tokens
├── src-tauri/                 ← Tauri Rust 后端
│   ├── tauri.conf.json
│   ├── src/main.rs
│   └── icons/
├── docs/
│   ├── ARCHITECTURE.md        ← 本文件
│   ├── CONVENTIONS.md
│   ├── CHANGELOG.md
│   └── plans/
│       ├── ROADMAP.md
│       └── TASK-XXX.md
├── e2e/                       ← Playwright 测试
└── public/                    ← 静态资源
```

---

## 3. 数据模型

### 3.1 Config(用户配置)

```ts
interface Config {
  monthlySalary: number;     // 月薪,例如 15000
  startTime: string;         // "HH:MM",例如 "09:00"
  endTime: string;           // "HH:MM",例如 "18:00"
  coffeePrice: number;        // 咖啡单价,默认 ¥15
  restMode: 0 | 1 | 2;      // 0=无休, 1=单休, 2=双休
  theme: 'paper' | 'obsidian' | 'gold';
}
```

**存储键**:`salary_timer_config_v1`

### 3.2 Items(换算页物品列表)

```ts
interface Item {
  id: string;           // uuid
  name: string;         // maxlength 20
  price: number;        // > 0
  icon: string;         // 单字符 emoji
  order: number;        // 排序
}
```

**存储键**:`salary_timer_items_v1`

### 3.3 DayOverrides(日期调休)

```ts
// key = "YYYY-MM-DD"
type DayOverride = Record<string, 'work' | 'rest'>;
```

**存储键**:`salary_timer_day_overrides_v1`

### 3.4 MonthlyRecord(月度薪资记录)

```ts
interface MonthlyRecord {
  yyyy: number;
  mm: number;          // 0-11
  salary: number;      // 月薪(记录时)
  workDays: number;
  dailyRate: number;
  hourlyRate: number;
  totalEarned: number;
  locked: boolean;
  generatedAt: string; // ISO
}
```

**存储键**:`salary_timer_monthly_v1`(整体对象,key 为 `202608` 这样的数字)

### 3.5 Holidays(节假日)

```ts
const HOLIDAYS: Record<string /* YYYY-MM-DD */, string> = {
  '2026-01-01': '元旦',
  '2026-02-17': '春节',
  // ...
};
```

**未来**:从 JSON 文件加载,允许用户手动维护。

---

## 4. 计算逻辑(核心)

所有计算在 `src/lib/compute.ts` 中,**纯函数**,无副作用,无 DOM 依赖,**必须 100% 单测覆盖**。

### 4.1 时间工具

```ts
parseTime("09:30")   // → { h: 9, m: 30 }
toMinutes("09:30")   // → 570
nowInMinutes()       // → 当前时刻的分钟数(含秒小数)
```

### 4.2 工作秒数 / 日

```ts
workSeconds = max((endMin - startMin), 0) * 60
```

### 4.3 月工作日数

```ts
isWorkday(date):
  if state.dayOverrides[key] → 直接返回
  if HOLIDAYS[key]            → false
  if restMode === 0           → true
  if restMode === 1           → dow !== 0 (Sunday)
  if restMode === 2           → dow !== 0 && dow !== 6
```

### 4.4 日薪 / 时薪 / 秒薪

```ts
dailyRate   = monthlySalary / workdaysInMonth
hourlyRate  = dailyRate / (workSeconds / 3600)
perSecond   = hourlyRate / 3600
```

### 4.5 今日已赚

```ts
if !isWorkday(today) → 0
if nowM <= startM   → 0
if nowM >= endM     → dailyRate
else:
  workedMin = nowM - startM
  earned = perSecond * workedMin * 60
```

### 4.6 进度百分比

```ts
totalWorkMins = max(endM - startM, 1)
workedMins    = min(nowM - startM, totalWorkMins)
progressPct   = clamp(workedMins / totalWorkMins, 0, 1) * 100
```

### 4.7 当月累计

```ts
sum over d=1..today: if isWorkday(d) then dailyRate else 0
```

---

## 5. UI 架构

### 5.1 页面(对应 4 个 tab)

| 路由 | 组件 | 说明 |
|---|---|---|
| `/` | `TodayPage` | 默认,timer + 收入 + 价值 |
| `/convert` | `ConvertPage` | 物品换算 |
| `/calendar` | `CalendarPage` | 月度日历 |
| `/settings` | `SettingsPage` | 配置 |

### 5.2 响应式断点

| 断点 | 宽度 | 行为 |
|---|---|---|
| mobile | < 768px | 底部 tab + 单列 |
| tablet | 768-1023px | 底部 tab + 双列卡片 |
| desktop | ≥ 1024px | 左侧 sidebar(240px)+ 主区,只显示今日 + 设置(其他 tab 收进 sidebar 子菜单) |

### 5.3 设计 token

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
  --ink: #0F0F0F;  --paper: #F5F2EA;  --accent: #C8FF00;
}
[data-theme="obsidian"] {
  --ink: #E8E8F0;  --paper: #131320;  --accent: #7C6FF7;
}
[data-theme="gold"] {
  --ink: #2A2520;  --paper: #FAF9F6;  --accent: #C9A84C;
}
```

---

## 6. 多端打包流程

### 6.1 命令

```bash
# Web 构建
npm run build              # → dist/

# Tauri 桌面
npm run tauri dev          # 开发
npm run tauri build        # → src-tauri/target/release/

# 平台特定
npm run tauri build -- --target x86_64-pc-windows-msvc      # Windows
npm run tauri build -- --target x86_64-apple-darwin         # macOS Intel
npm run tauri build -- --target aarch64-apple-darwin        # macOS Apple Silicon
npm run tauri build -- --target aarch64-apple-ios           # iOS(需 Xcode)
npm run tauri build -- --target aarch64-linux-android       # Android(需 Android SDK)
```

### 6.2 产物

| 平台 | 输出 |
|---|---|
| Windows | `.msi` 安装包 / `.exe` |
| macOS | `.app` / `.dmg` |
| iOS | `.ipa`(需 Apple Developer 签名) |
| Android | `.apk` / `.aab` |

### 6.3 自动更新
- Tauri 内置 `tauri-plugin-updater`
- 桌面端可静默更新;移动端走 App Store / Play Store

---

## 7. 数据流(运行时)

```
            ┌─────────────┐
            │   Storage   │  localStorage
            └──────┬──────┘
                   │ load / save
            ┌──────▼──────┐
            │   Store     │  Zustand
            └──────┬──────┘
                   │ selectors
       ┌───────────┼───────────┐
       │           │           │
  ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
  │  Today  │ │ Calendar│ │ Settings│
  │  Page   │ │   Page  │ │   Page  │
  └─────────┘ └─────────┘ └─────────┘

   每秒 tick → 调用 lib/compute.ts 纯函数
            → 更新 store
            → 各组件订阅 → 自动重渲染
```

**关键**:计算逻辑全部纯函数化,UI 只做渲染。

---

## 8. 安全 / 隐私

- **零网络**:没有 fetch / XHR
- **零追踪**:没有 analytics SDK
- **本地数据**:所有数据在用户设备,清除 App 数据 = 清除所有
- **桌面端特殊考虑**:Tauri 的 `tauri-plugin-fs` 读写文件需用户授权

---

## 9. 迁移路径(简版)

完整任务拆解见 `docs/plans/ROADMAP.md`。

```
阶段 0(现在)    HTML + Capacitor
   ↓
阶段 1    React + TypeScript 重写(核心逻辑直接迁移)
   ↓
阶段 2    Tauri 包装 + 桌面端构建
   ↓
阶段 3    Tauri Mobile 配置 + iOS / Android
   ↓
阶段 4    自动更新 + 商店发布
```

---

*最后更新:2026-08-28 · 重构启动*