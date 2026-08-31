# TASK-024 · DaySheet 增强 + 加班胶囊 + 换算时薪

> **状态**:⏳ 待开始
> **依赖**:TASK-021, TASK-022
> **估时**:1.0 天

## 目标

落地 A 和 D 模块:加班实时时薪(TimerCard ⚡ 胶囊)+ 换算页当日时薪 + 换算页加班胶囊 + DaySheet 单日覆盖 + 跨天段 + 夜班加权。

## 改动清单

### 1. DaySheet 扩展

修改 `src/components/DaySheet/DaySheet.tsx`:

#### 新增 UI 区段

```
类型与倍率(已有)
─────────────────
当日工时(新增)
  ◯ 继承全局 (09:00–18:00)
  ● 自定义(展开 SegmentsEditor)
─────────────────
夜班加权(新增)
  [开关] 22:00–06:00 的分钟 × 1.5 计入净工时
  说明文字:预估值 · 夜班 8h → 净工时额外 + 4h
─────────────────
[保存] [重置为全局默认]
```

#### 类型与倍率区:hourly/daily 模式
- workday 模式下"工作日 / 加班" option 仍可见
- hourly / daily 模式下"工作日 / 加班"隐藏,只显示 `freelance` / `leave` / `rest`

#### 自定义 SegmentsEditor
- 复用 `src/components/SegmentsEditor/`
- 跨天段自动"次日"徽章
- 空态 + 自动 type=rest:输入空数组时,提示"空工时自动标记为休息日",强制 type='rest'

#### 夜班加权
- toggle,绑定 entry.nightShift
- 说明文字固定写死(不带 token 替换)

#### 边界处理
- segments 混合全局:segments !== null 完全覆盖全局,不走 fallback
- 已存在 entry 但 v3 字段缺失时,migration 自动补默认值

### 2. TimerCard 加班胶囊

#### 修改 `src/components/TimerCard/TimerCard.tsx`

在 `.status` 行右侧新增加班胶囊 `<span class="overtimeBadge">⚡ ×1.5</span>`:

- 仅 paid_overtime 类型日显示
- 仅 monthly 模式生效(hourly/daily 不显示)
- multiplier > 1 时显示 "⚡ ×{multiplier}"
- 全局样式用现有深色卡底,胶囊内文字 accent 色,背景 ink

**不动现有 .status / .card / .display 等样式**,仅新增 `.overtimeBadge` 类。

### 3. TodayPage 当日 effective 时薪

#### 修改 `src/pages/TodayPage.tsx`

- `hourlyRate(...)` 替换为 `effectiveHourlyRate(...)`(传入 day override)
- StatCard income 卡的 sub 行:显示 `¥{hourly}/小时`(已存在)
- 当 paid_overtime:`¥hourly(加班)`
- 当 hourly 模式:显示 manualHourlyRate
- 当 daily 模式:显示 manualDailyRate / segmentsHours

**不动现有组件 prop 接口**。

### 4. ConvertPage 加班胶囊 + 当日时薪

#### 修改 `src/pages/ConvertPage.tsx`

顶部 page-head 之下新增一行胶囊(条件渲染):

- paid_overtime + monthly:`⚡ 加班日 · 按今日时薪 ¥XX.XX/h 换算`(accent 背景胶囊)
- hourly:`🎯 自由模式 · 手动时薪 ¥XX.XX/h`(paper 背景胶囊)
- daily:`🎯 自由模式 · 按日结 ¥XX.XX/天`
- 普通 monthly:不显示胶囊

每件物品的"需要工作"使用 effectiveHourlyRate 计算(替换原 hourlyRate)。

**不动现有 list 行的结构**,仅:
1. 在 page-head 下方加一行胶囊(条件渲染)
2. 计算公式替换 hourlyRate → effectiveHourlyRate

### 5. CalendarPage 联动

(CalendarPage 已经在 v2 TASK-011 完成,DaySheet 是触发入口)

- 仅需确认 CalendarPage 调用 DaySheet 时,DaySheet 内部使用最新 store(无须改动 CalendarPage)
- 月工作日数计算:`workdaysInMonth` 内部对 freelance 类型 skip,所以月工作日不变

### 6. 跨天 02:00 边界

#### compute.ts `dayState` 扩展(实现跨天段识别)

- 当前日 segments 为空 / 单段不跨天 → 用原逻辑
- 当前日 segments 包含跨天段 → 检查 now 是否在跨天段内
  - 例:override 22:00–06:00,当前 02:00 → mode='active',倒计时 04:00:00
  - 跨天段的归属日期 = startTs 日期(覆盖日)
- 凌晨 02:00 时,合并昨日的跨天段(shift 到今日坐标系)→ effectiveSegmentsOn

`dayState` 新增逻辑:在 isWorkday=true 后,先合并昨日跨天段到今日坐标系,再判断 nowM。

## 验证

PRD §7 验收标准:
- [ ] **#1 加班实时时薪**:paid_overtime ×1.5:effectiveHourlyRate = 基准 × 1.5;todayEarned ≈ dailyRate × 1.5;咖啡从 21 分 → 14 分(误差 ≤ 10 秒)
- [ ] **#4 自由模式 hourly**:时薪 ¥120,segments 7h,freelance 日 → dailyRate = ¥840
- [ ] **#5 segments union**:[9-12]+[11:30-14]重叠 30m → totalMinutes = 270 = 4.5h
- [ ] **#6 跨天段**:override 22-06,当前 02:00 → mode='active',倒计时 04:00:00 ± 5s
- [ ] **#7 夜班加权**:22-06 段 + nightShift=true → nightBonus = 240m;面板显示 +4h
- [ ] **#8 Draft 切换不污染**:切 hourly → 填 ¥120 → 不保存 → 切 monthly → 保存 → config 仍为 monthly
- [ ] **#9 老数据回归**:载入 v2 config + overrides → 所有页面数值与 v2 一致

## 出口

切换到最终验收:运行 typecheck + test + build,写 CHANGELOG-v1.3.md,更新 AGENTS.md。
