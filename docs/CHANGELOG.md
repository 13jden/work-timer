# Changelog · Salary Timer

All notable changes are documented here.

Format: `## [Unreleased] · YYYY-MM-DD` for unreleased, `## [v1.x.x] · YYYY-MM-DD` for releases.

## [Unreleased] · 2026-08-28

### Added · TASK-006 完成 · 日历页 + 日期 sheet

- **`src/pages/CalendarPage.tsx`** + `CalendarPage.module.css`
- **`src/components/DaySheet/`** — 日期详情弹窗

### Features

- 月度网格:工作日白 / 周末灰 / 今日黑色高亮
- override 天数右上角小圆点标记
- 上月 / 下月 / 今天 导航
- Summary:工作日数 + 日均 + 已赚
- 点击日期 → DaySheet(切换 work/rest + 重置)
- 订阅 calendarStore,月切换和 override 均持久化
- 网格 1 分钟级更新,避免秒级重渲染

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:67 / 67 通过

### Notes

- 阶段 1 进度:**6 / 9**
- 农历 / 节日高亮未做(节假日仅用于判定)

---

## [Unreleased] · 2026-08-28

### Added · TASK-005 完成 · 换算页 + 物品 sheet

- **`src/pages/ConvertPage.tsx`** + `ConvertPage.module.css`
- **`src/components/ItemSheet/`** — 底部弹窗(添加 / 编辑 / 删除)

### Features

- 物品列表:`icon / name / 需要工作 X 小时分钟`
- 点击列表项 → 编辑模式(sheet 预填字段)
- 添加按钮 → sheet 空白,默认 icon `📦`
- 实时校验:名称正则、单价 > 0
- 删除按钮仅编辑模式可见
- 订阅 itemsStore / configStore 实现实时重算
- sheet 关闭:点 backdrop 或保存 / 删除后自动 close

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:67 / 67 通过

### Notes

- 阶段 1 进度:**5 / 9**
- 路由未接入,App.tsx 暂未显示 ConvertPage(由后续 TAB 切换组件统一管理)
- 滑动删除未做(TASK-008 响应式时一起处理)

---

## [Unreleased] · 2026-08-28

### Added · TASK-004 完成 · 今日页 UI

- **`src/hooks/useNow.ts`** — 全局 ticker,每秒返回 Date
- **`src/hooks/useNowTime.ts`** — StatusBar 用,分钟级同步时间
- **`src/components/StatusBar/`** — 顶栏(时间 + 信号 + 电池)
- **`src/components/TimerCard/`** — 主计时卡(签名元素)
- **`src/components/StatCard/`** — 数据卡(Income / Worth)
- **`src/components/QuoteCard/`** — 每日 quote
- **`src/pages/TodayPage.tsx`** — 今日页组合
- **`src/pages/TodayPage.module.css`** — 响应式 grid 布局
- **`src/styles/tokens.css`** — 全局设计令牌(三套主题 + reset)
- **`src/css.d.ts`** — CSS Modules 类型声明

### Changed

- **`src/App.tsx`** — 接入 `bootstrapTheme()`(防止主题闪烁),渲染 `<TodayPage />`

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:67 / 67 通过(本任务未加新测试)
- ✅ `npm run build`:**155KB / gzip 51KB**

### Notes

- 阶段 1 进度:**4 / 9**(TASK-001 ~ 004 完成)
- TimerCard 黑底 / 倒计时 display 字体 / 进度条 / dot 脉冲动画与原 HTML 版完全一致
- Obsidian 主题下 TimerCard 自动反转配色
- 桌面端 quote 在 hero 下方,移动端 quote 在 hero 内(响应式)
- 路由层未接入,目前只有 TodayPage;TASK-005 完成后接 Tab 切换

---

## [Unreleased] · 2026-08-28

### Added · TASK-003 完成 · 状态层迁移到 Zustand

- **`zustand`** v5 安装
- **`src/lib/constants.ts`** — 从 `state.js` 迁移所有常量(STORAGE_KEY、DEFAULT_CONFIG、THEMES、DEFAULT_ITEMS、QUOTES、EMOJI_CHOICES、HOLIDAYS)
- **`src/lib/storage.ts`** — `loadJSON` / `saveJSON` / `removeJSON` 类型化封装
- **`src/store/configStore.ts`** — 配置 store(自动持久化,排除 theme 字段)
- **`src/store/itemsStore.ts`** — 物品 store(自动持久化,add 时 uuid 自增 order)
- **`src/store/calendarStore.ts`** — 日历 store(年/月 + dayOverrides)
- **`src/store/themeStore.ts`** — 主题 store(独立 storage key,DOM + meta 同步,导出 `bootstrapTheme()`)
- **`src/lib/storage.test.ts`** — storage 单测(7 例)
- **`src/store/store.test.ts`** — 全部 store 单测(19 例)

### Changed

- **`storage key 保持向后兼容`**:
  - `salary_timer_config_v1`(config)
  - `salary_timer_items_v1`(items)
  - `salary_timer_day_overrides_v1`(overrides)
  - `salary_timer_theme_v1`(新增,独立管理 theme)
- 旧版 HTML 应用的数据**无需迁移**即可被 React 版读取

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:**67 / 67 通过**
- ✅ 覆盖率:**96.92% statements / 91.3% branches / 95.23% functions / 99.11% lines**
- ✅ `npm run build`:143KB / 600ms

### Notes

- 阶段 1 进度:**3 / 9**(TASK-001 ✅ TASK-002 ✅ TASK-003 ✅)
- 状态层完成,后续 UI 任务可以直接订阅 store
- `bootstrapTheme()` 需要在 App.tsx 启动时调用,防止主题闪烁

---

## [Unreleased] · 2026-08-28

### Added · TASK-002 完成 · 核心计算层迁移

- **`src/lib/types.ts`** — 类型定义(Config / DayOverrides / HolidayMap / DayState 判别联合等)
- **`src/lib/time.ts`** — 时间工具(parseTime / toMinutes / pad2 / formatDateKey / formatHMS)
- **`src/lib/compute.ts`** — 核心计算纯函数,所有依赖从隐式 state 改为显式参数
- **`src/lib/compute.test.ts`** — 40 个单元测试用例
- **`vitest.config.ts`** — vitest + jsdom + v8 coverage 配置

### Changed · 计算层重构

**所有原 `src/js/compute.js` 的隐式 state 依赖改为显式参数**:
- `isWorkday(date, config, overrides, holidays)` — 4 参数
- `dailySalary(year, month, config, overrides, holidays)` — 5 参数
- `hourlyRate(...)` / `perSecond(...)` / `todayEarned(...)` / `monthEarnedSoFar(...)` / `progressPct(...)` 同模式
- `dayState(...)` 返回 `DayState` 判别联合(TS 自动收窄)

**好处**:
- 100% 可测试(无全局 state 依赖)
- 调用方(store)负责注入状态
- 类型安全:DayState 通过 `mode` 自动收窄

### Verified

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **40 / 40 通过**(耗时 ~1.3s)
- ✅ 覆盖率:**Statements 99% / Branches 97.36% / Functions 94.44% / Lines 98.86%**(目标 >90%)
- ✅ `npm run build` 仍成功(143KB / gzip 46KB)

### Notes

- 阶段 1 进度:**2 / 9**(TASK-001 ✅ TASK-002 ✅)
- 旧版 `src/js/compute.js` 仍保留(用于 Capacitor),新逻辑在 `src/lib/compute.ts`
- `nowInMinutes` 未被 compute.ts 使用,从 export 列表移除

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
