# TASK-029 · v1.3.4-patch1 桌面端月度收入 + 净工时实时累计

> **状态**:⏳ 进行中
> **依赖**:v1.3.4(`feat/v1.3.4-desktop-layout`)
> **估时**:0.8 天
> **对应版本**:v1.3.4-patch1

## 目标

2 项 UX/语义修复:

1. **桌面端左下角显示月度收入进度**(替代当前「工作日完成数」灰色进度条)
   - 「本月已赚 / 月度目标」进度条,**主题色**(`--accent`)
   - 首次打开未设置目标 → 引导「设置月度目标」+ 跳转 SettingsDrawer
2. **净工时实时累计**
   - `computeNetHours` 当前 `netMinutes = gross - slackUnionLunch + overtimeBonus + nightBonus`
   - 问题:`grossMinutes` 是总工时(固定),导致净工时一开工就显示总工时,**不会随时间增长**
   - 期望:净工时 = 当前已工作分钟数 - 已结束的摸鱼∪午休 + 加班加成 + 夜班补偿
     - 工时段内 → 已工作分钟数随时间增长
     - 午休时段内 → 净工时 = 已结束工时 - 已结束摸鱼∪午休 + 加班加成 + 夜班补偿
     - 非工时 / 加班后 → 总工时(已封顶)
     - 工时前 → 0

## 改动清单

### A · 月度收入进度(桌面端侧边栏底部)

#### A1 · 新增 store:`monthlyGoalStore.ts`

- 持久化 key:`salary_timer_monthly_goal_v1`
- 字段:`monthlyGoal: number | null`
- 默认值:`null`(未设置)
- 方法:`setGoal(goal: number | null)` / `clearGoal()`

#### A2 · 新增组件:`MonthIncomeProgress/`

- 文件:`src/components/MonthIncomeProgress/`
- Props:无(自包含 store 订阅)
- 行为:
  - 订阅 `monthlyGoalStore.monthlyGoal`
  - 订阅 `useConfigStore / useCalendarStore / HOLIDAYS`,计算 `monthEarnedSoFar`
  - 订阅 `useNow(60_000)`(1 分钟刷新)
  - 未设置目标(goal === null)时 → 显示「设置月度目标」chip + 点击跳 SettingsDrawer
  - 已设置目标时 → 显示「¥已赚 / ¥目标」+ 进度条(主题色)+ 百分比
  - 收起态(Sidebar collapsed)= → 只显示小圆环(SVG 36×36)
- 放在 `DesktopSidebar` 底部,**替换**当前的「本月完成 N/M 工作日」进度块

#### A3 · DesktopSidebar 改造

- 移除内联的月度进度逻辑
- 在 `progress` 区域渲染 `<MonthIncomeProgress collapsed={collapsed} onSetupGoal={() => setGoalDrawer(true)} />`
- 暴露 `onOpenSettings` prop(由 App.tsx 传入),通过 `SettingsDrawer.open=true` 让用户能设置月度目标

#### A4 · App.tsx 桌面端传递 onOpenSettings

- App.tsx 在桌面端分支给 `DesktopSidebar` 增加 prop:
  ```
  <DesktopSidebar
    activeTab={desktopTab}
    onTabChange={...}
    onOpenSettings={() => setSettingsOpen(true)}
  />
  ```
- `MonthIncomeProgress` 在未设置目标时调用 `onOpenSettings`

### B · 净工时实时累计

#### B1 · computeNetHours 改造

- 新增字段 `elapsedWorkedMin: number`(已工作分钟数)
  - 算法:基于 `progressPct` 的 merged segments 逻辑,按 `nowMin` 推导已工作分钟数
  - 跨天段处理:与 `progressPct` / `todayEarned` 一致(凌晨时分段合并昨日跨天段)
- `grossMinutes` 语义保持不变(总工时)
- `netMinutes` 算法改为:
  ```
  effectiveGross = min(elapsedWorkedMin, grossMinutes)
  netMinutes = effectiveGross - slackUnionLunch ∩ effectiveGross + overtimeBonus + nightBonus
  ```
  - 简化:**净工时 = 已工作 - 已发生的摸鱼∪午休 + 加班加成 + 夜班补偿**
  - 关键改动:`effectiveGross` 用 `elapsedWorkedMin` 而非 `grossMinutes`,这样净工时会随时间增长
- `slackUnionLunch ∩ effectiveGross`:已发生的摸鱼∪午休(对当前已工作时间的扣除)
  - 简化:`slackUnionLunch` 本身只算已结束 session 的分钟数(进行中 session 不计入),所以已经隐含"已发生"语义
- 加班加成 / 夜班补偿保持不变(已通过 `nightShiftMinutes × 0.5` 计算)

#### B2 · 边界情况

- **工时前**(now 早于第一段 start)→ `elapsedWorkedMin = 0` → `netMinutes = overtimeBonus + nightBonus`(可能为 0 或仅加班加成)
- **工时段内**(now 落在某段)→ `elapsedWorkedMin = nowMin - firstStartAfter`-简化就是从合并 segments 起点累计
- **工时段间间隙**(now 落在两段之间,如 12:00-13:00 午休时段且 13:00 还没到第二段)→ 沿用 `progressPct` 的累计逻辑,前面的段已经走完,后面的段还没开始
- **收工后**(now 晚于最后一段 end)→ `elapsedWorkedMin = grossMinutes`(已封顶)
- **跨天凌晨段**(如 22:00-06:00 跨天,now=02:00)→ 已工作 = now - 昨日段起点(0:00 后段起点),与 `progressPct` 一致

#### B3 · 详情页应用

- `TimeTrackerDetailPage` 直接显示 `net.netMinutes`(已实时累计),无需修改

#### B4 · 测试用例(compute.test.ts)

新增 `computeNetHours · 净工时实时累计` describe 块:

1. **工时前**(`now=08:00`,09:00 开工)→ netMinutes = 0(无摸鱼/午休/加班)
2. **工时段内**(`now=10:00`,已工作 1h)→ netMinutes ≈ 60(无摸鱼时)
3. **工时段内 + 午休**(`now=12:30`,午休 12:00-13:00)→ 已工作 3h,扣 1h 午休 = 120min
4. **午休时段内**(`now=12:30`,lunchEnabled,午休未开始计算)→ 与 #3 同
5. **午休时段内 + 已结束摸鱼**(`now=12:30` + 10:30-10:40 摸鱼 10min)→ 已工作 3h,扣 1h 午休,扣 10min 摸鱼 = 110min
6. **收工后**(`now=19:00`)→ netMinutes = grossMinutes(9h = 540min,无任何加成)
7. **收工后 + 加班日**(`now=19:00` + paid_overtime multiplier=1.5)→ netMinutes = 540 + 540×0.5 = 810
8. **跨天凌晨段**(`now=02:00`,昨日 22:00-06:00,夜班加权)→ 已工作 4h(22-02),扣 0 + 夜班加成 4×0.5 = 2h = 120min → netMinutes = 240 + 120 = 360

### C · 不在本 patch 范围

- 月度目标的「智能推荐」(`config.monthlySalary` 自动填充但仍可改)— 后续版本
- 月度目标的「超出后变负」语义(目前封顶 100%)
- 净工时上限(目前 `min(elapsedWorkedMin, grossMinutes)`)
- 移动端 sidebar 同步显示月度收入(目前仅桌面端)

## 约束

- ✅ 不动现有组件样式 / 逻辑(TimerCard / StatCard / QuoteCard / BottomNav / DaySheet / TimeTrackerWidget / SettingsPage)
- ✅ 复用现有 `useNow` / `useConfigStore` / `useCalendarStore` / `monthEarnedSoFar`
- ✅ 不引入新依赖
- ✅ 新增 store / 组件 / hook 单独建目录
- ✅ 桌面端样式沿用现有 token(`--accent` / `--ink` / `--paper-2` 等)

## 验证

### 自动化

- [ ] `npm run typecheck` 0 errors
- [ ] `npm run test` 全通过(新增 ≥ 8 个 compute 用例)
- [ ] `npm run build` 成功

### 手工验收

- [ ] **桌面端左下角**:
  - 首次打开 App(无目标)→ 显示「设置月度目标」chip,点击 → 设置抽屉打开
  - 在设置抽屉「薪资」组填月薪 → 保存 → 关抽屉 → 月度收入进度条出现,显示「¥已赚 / ¥月薪」+ 进度填充 + 百分比
  - 进度条颜色 = 主题色(柠檬黄 / 靛蓝 / 香槟金 三主题各验)
  - 收起侧边栏 → 进度条变为小圆环,百分比居中
- [ ] **净工时实时累计**:
  - 配置 09:00-18:00 工时,12:00-13:00 午休(默认无午休,测试时手动开启)
  - 打开详情页,时间从 10:00 → 12:00(2h 内),净工时应从 60min → 120min(线性增长)
  - 12:30(午休时段),净工时停留在 120min(扣 1h 午休),不增长
  - 13:30(午休后)继续工作,净工时从 120min 增长
  - 19:00(收工),净工时 = 总工时 - 午休 = 480min

## 出口

1. 切换到最终验收:运行 typecheck + test + build
2. 写 `docs/CHANGELOG-v1.3.md` v1.3.4-patch1 段
3. 在 `docs/CHANGELOG.md` 索引表追加 v1.3.4-patch1 行
4. 更新 AGENTS.md 末行版本号
5. 提交:`feat(v1.3.4-patch1): sidebar monthly income progress + net hours live tick`

---

*最后更新:2026-08-30 · v1.3.4-patch1 启动*
