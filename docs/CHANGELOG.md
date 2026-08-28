# Changelog · Salary Timer

All notable changes are documented here.

Format: `## [Unreleased] · YYYY-MM-DD` for unreleased, `## [v1.x.x] · YYYY-MM-DD` for releases.

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
