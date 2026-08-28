# Changelog · Salary Timer

All notable changes are documented here.

Format: `## [Unreleased] · YYYY-MM-DD` for unreleased, `## [v1.x.x] · YYYY-MM-DD` for releases.

---

## [Unreleased] · 2026-08-28

### Changed · 文档结构调整

- `docs/plans/` 目录按项目分组:
  - 新建 `docs/plans/README.md` 作为索引
  - 所有 `TASK-XXX.md` + `ROADMAP.md` 移入 `docs/plans/tauri-migration/`
  - `AGENTS.md` 同步更新路径引用

### Added · TASK-001 完成

- **`index.html`** — 重写为 Vite 入口(指向 `/src/main.tsx`)
- **`src/main.tsx`** — React 入口,挂载 `<App />`
- **`src/App.tsx`** — 根组件占位,显示阶段进度
- **`vite.config.ts`** — Vite 5 配置(端口 5173、source map、ES2022 target)
- **`tsconfig.json`** — TypeScript 严格模式(`strict` + `noUncheckedIndexedAccess`)
- **`tsconfig.node.json`** — Vite 配置专用
- **`package.json`** — 2.0.0,移除 `@capacitor/*` 依赖,新增 React/Vite/TS
- **`legacy/`** — 新建历史归档目录,保留旧版 `index.html`(只读,不再维护)
- **`.gitignore`** — 补充 `dist/`、`.vite/`、`src-tauri/target/`、`src-tauri/gen/`

### Removed · 清理

- `@capacitor/android` `@capacitor/assets` `@capacitor/cli` `@capacitor/core` 全部卸载
- `ws` 旧依赖移除
- `node_modules` 从 218 包精简到 66 包

### Verified

- ✅ `npm run typecheck` 通过(0 errors)
- ✅ `npm run build` 成功(`dist/index.html` 1KB,`dist/assets/index-*.js` 143KB / gzip 46KB)
- ✅ 构建耗时 ~572ms
- ✅ 旧版 `www/index.html` 保留,Capacitor 端未受影响

### Notes

- 阶段 1 进度:**1 / 9** (TASK-001 ✅)
- 旧版 HTML 应用仍可运行(Capacitor 走 `www/index.html`)
- 重构产物独立在 `src/` + `dist/`,两个版本暂共存

---

## [Unreleased] · 2026-08-28

### Architecture · 重构启动

**决策**:从"HTML + Capacitor + Android Studio"激进重构为"Tauri + React + TypeScript"多端架构。

**目标**:
- 一份代码覆盖 Web / Windows / macOS / iOS / Android
- 摆脱 Capacitor 的笨重链路(JDK 21 / Android Studio / Gradle)
- 用 Vite 替代静态 HTML,获得现代化开发体验
- 用 Tauri 2.x 替代 Capacitor,体积更小、性能更好

### Added · 文档体系建立

- **`AGENTS.md`** — AI Agent 强制必读文件,包含项目定义、技术栈现状、行为守则、启动检查清单
- **`docs/ARCHITECTURE.md`** — 重写,加入多端目标、技术栈选型理由、数据流图
- **`docs/CONVENTIONS.md`** — 新建,代码规范(命名、TypeScript、React、Git、测试、文档同步)
- **`docs/plans/ROADMAP.md`** — 新建,完整重构路线图(4 阶段 23 个 TASK)
- **`docs/plans/TASK-001` ~ `TASK-009`** — 阶段 1 的 9 个详细任务规格
  - TASK-001: 初始化 Vite + React + TS
  - TASK-002: 迁移 `compute.ts` 纯函数 + 单测
  - TASK-003: 迁移到 Zustand store
  - TASK-004: 迁移今日页 UI
  - TASK-005: 迁移换算页 + 物品 sheet
  - TASK-006: 迁移日历页 + 日期 sheet
  - TASK-007: 迁移设置页 + 月度记录
  - TASK-008: 响应式布局
  - TASK-009: 主题系统接入

### Planned · 阶段划分

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | HTML + Capacitor(现有) | ✅ |
| 1 | React + TS + Vite 重写 | ⏳ 计划 |
| 2 | Tauri 桌面端 | ⏳ 计划 |
| 3 | Tauri 移动端 | ⏳ 计划 |
| 4 | 上架 + 自动更新 | ⏸ 可选 |

### Notes

- 阶段 1 完成后,旧 `index.html` 标记 deprecated,保留用于 Capacitor
- 阶段 3 完成后,删除整个 `android/` 目录、`capacitor.config.json`、`build-apk.ps1`
- 所有 storage key 保持向后兼容,旧数据可平滑迁移
- `src/lib/compute.ts` 是核心,所有计算逻辑 100% 迁移并 100% 单测覆盖

---

## [Unreleased] · 2026-08-27

### Added
- **休息模式配置** (`restMode`): 设置页新增下拉选择双休 / 单休 / 无休,联动工作日数量计算
- **月度薪资记录** (`salary_timer_monthly_v1`): 每月生成一条记录,当月实时累计,月初自动锁定上月记录,不再受薪资调整影响
- **月度记录列表**: 设置页底部展示所有历史月度薪资记录,显示已锁定金额和工作天数
- **主题切换**: 三套配色方案(paper/dark/gold),设置页一键切换,配置持久化
- **文档目录**: `docs/ARCHITECTURE.md` + `docs/CHANGELOG.md`

### Fixed
- 改下班时间后进度条不更新: `submitSettings()` 末尾补调 `renderToday()`
- 改休息日后日薪/时薪不刷新: `toggleDay()` 末尾补调 `renderToday()`
- 进度条百分比未扣除午休时长,导致下班时间越晚误差越大: `progressPct()` 改用 `totalWorkMins = endM - startM - lunchBreak * 60`
- `todayEarned()` 午休判断添加 `config.lunchRest` 开关

### Changed
- `config.workDays` 字段移除,工作日数量完全由 `restMode` + 月份 + `dayOverrides` 动态计算
- `DEFAULT_CONFIG` 新增 `restMode: 2`, `lunchRest: true`, `theme: 'paper'`
- `progressPct()` 修复: 分母从 `(endM - startM)` 改为 `(endM - startM - lunchBreak * 60)`,排除午休时长

---

## [Unreleased] · 2026-08-28

### Added
- **Desktop Sidebar (≥1024px)**: 左侧 240px 固定侧边栏
  - `Salary Timer` 品牌头
  - 仅两个导航项: `今日` (默认激活) + `设置` (可点击展开)
  - **设置面板内嵌 sidebar**: 月薪 / 上班时间 / 下班时间 / 休息模式 / 咖啡单价,实时双向绑定到 `config`
  - **实时派生统计**: 时薪 / 每秒 / 日均,跟随输入立刻刷新
  - 主题切换器 (柠檬黄 / 靛蓝 / 香槟金) 置于 sidebar footer
  - 移动端 (<1024px) 隐藏 sidebar,保留底部 tab 导航
- **Desktop 集成主页**: timer card + 收入/价值双卡 + quote 全部直接显示,无需切换 tab
- **桌面端今日页默认始终可见** (`.page-today` 永久 `is-active`),移动端仍走 tab 切换
- **Theme swatch active class 统一同步**: `applyTheme()` 自动标记当前主题 active 态

### Removed
- **午休设置功能** (`config.lunchBreak` / `config.lunchStart` / `config.lunchRest` 字段)
  - 设置页移除「午休开始 / 午休时长」输入项
  - `todayEarned()` / `progressPct()` / `workSeconds()` 不再扣除午休时长
  - 计算逻辑简化为: `hourly = monthly / days / workHours`,workHours = end - start

### Fixed
- **手机框移除**: 移除了原来的手机模拟框(`.stage` + `.device`),改为自适应全宽布局;桌面端切换到 sidebar + main 双栏结构
- **`dayState` / `progressPct` 时间 bug**: 漏写 `now.getMinutes()`,全天时间判断比真实时间慢约 30 分钟
- **完成工时定格**: 下班后 (`now >= endTime`) 计时器显示定格 `00:00:00` + 「今日已完成」,不再继续倒数

### Changed
- **`DEFAULT_CONFIG`**: 移除 `lunchBreak` / `lunchStart` / `lunchRest` 三个字段
- **`workSeconds()`**: 简化为 `Math.max(endM - startM, 0) * 60`
- **`progressPct()`**: 分母从 `(endM - startM - lunchBreak * 60)` 改为 `(endM - startM)`
- **`dayState()` done 模式**: 不再返回总工作时长,而是定格 `00:00:00` + 「今日已完成」
- **`updateQuote()`**: 简化为单一 quote 元素 (桌面/移动共享)
- **`bindEvents()`**: 增加 sidebar 设置面板交互 + 实时 config 同步 + `syncMobileForm()` 双向同步移动端表单

---

## [v1.0.0] · 2026-08-27

### Added
- **计时器卡片**: 实时显示距下班倒计时,支持上班前/工作中/已下班三种状态
- **进度条**: 实时进度百分比 + 进度填充动画
- **今日收入卡片**: 实时显示已赚金额、时薪、每秒收益
- **等价换算页**: 预设咖啡/奶茶/球鞋,支持自定义物品,显示需要工作多少时间
- **日历页**: 月度工作日网格,点击日期可手动切换工作日/休息日,显示每日薪资
- **设置页**: 月薪、上班时间、下班时间、午休时长、咖啡单价
- **法定节假日**: 内置 2026 年节假日映射
- ** Capacitor Android 打包**: 完整 Android 工程,支持生成 APK
