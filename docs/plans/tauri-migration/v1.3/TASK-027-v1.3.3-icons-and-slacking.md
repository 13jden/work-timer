# TASK-027 · v1.3.3 图标替换 + 摸鱼计时重设计

> **状态**:📋 方案待确认
> **依赖**:v1.3.2 已发布
> **估时**:0.5 天
> **分支**:`feat/v1.3.3-icons-and-slacking`

## 目标

两件事:①把全站 lucide-react 图标替换为 Phosphor Icons(6 种粗细可选,视觉层级更精致);②首页「摸鱼计时」重命名为「时间记录」,工作模式(摸鱼/加班)移到详情页设置,其中 22:00–06:00 时段自动标记夜班。

---

## 改动 1 · 图标库替换:lucide-react → Phosphor Icons

### 现状

v1.3.1 引入了 `lucide-react`(`^0.460.0`),全站已替换 emoji。

### 目标

Phosphor Icons 是 Phosphor 团队的开源图标库( MIT License ),有 6 种粗细(`thin`/`light`/`regular`/`bold`/`fill`/`duotone`),可以用粗细做视觉层级,适合"精致感"。

```
# 包
npm install @phosphor-icons/react

# 用法示例
import { Coffee, Clock, Zap } from '@phosphor-icons/react';
<Coffee weight="regular" size={16} />
```

### 替换清单

| 当前位置 | 原 lucide 图标 | Phosphor 替换 |
|---|---|---|
| TimerCard | `<Clock />` | `<Clock weight="duotone" />` |
| TimerCard | `<Zap />`(加班) | `<Lightning weight="duotone" />` |
| DaySheet | `<Save />` | `<FloppyDisk weight="regular" />` |
| DaySheet | `<RefreshCw />` | `<ArrowsClockwise weight="regular" />` |
| DaySheet | `<Moon />` | `<Moon weight="regular" />` |
| DaySheet | `<ChevronDown />` | `<CaretDown weight="bold" />` |
| SettingsPage | `<Settings2 />` | `<Gear weight="regular" />` |
| SettingsPage | `<Coffee />` | `<Coffee weight="regular" />` |
| SettingsPage | `<Palette />` | `<Palette weight="regular" />` |
| SettingsPage | `<History />` | `<ClockCounterClockwise weight="regular" />` |
| SettingsPage | `<Edit3 />` | `<PencilSimple weight="regular" />` |
| SettingsPage | `<ChevronRight />` | `<CaretRight weight="bold" />` |
| SettingsPage | `<ChevronDown />` | `<CaretDown weight="bold" />` |
| SlackingWidget | `<Coffee />` | `<Coffee weight="duotone" />` |
| SlackingWidget | `<ChevronDown />` | `<CaretDown weight="bold" />` |
| SlackingWidget | `<ArrowRight />` | `<ArrowRight weight="bold" />` |
| SlackingDetailPage | `<ArrowRight />` | `<ArrowRight weight="bold" />` |
| SegmentsEditor | `<Plus />` | `<Plus weight="bold" />` |
| SegmentsEditor | `<X />` | `<X weight="bold" />` |
| SegmentsEditor | `<Sparkles />` | `<Sparkles weight="duotone" />` |
| SegmentPicker | `<Sparkles />` | `<Sparkles weight="duotone" />` |
| CalendarPage | `<ChevronLeft />` | `<CaretLeft weight="bold" />` |
| CalendarPage | `<ChevronRight />` | `<CaretRight weight="bold" />` |
| CalendarPage | `<LocateFixed />` | `<Crosshair weight="regular" />` |
| ConvertPage | `<Coffee />` | `<Coffee weight="duotone" />` |

### 视觉层级策略

- **duotone**:用于 TimerCard 秒数计时(`<Clock weight="duotone" />`) / 摸鱼图标等"主体视觉"
- **bold**:用于按钮内联图标、下拉箭头(`<CaretDown weight="bold" />`)等"操作提示"
- **regular**:用于次要标签、辅助信息

### 改动

- `package.json` — 替换 `"lucide-react": "^0.460.0"` → `"@phosphor-icons/react": "^2.1.7"`(最新稳定)
- 替换所有文件中的 `lucide-react` import
- 删除 `lucide-react` 依赖(可选,留着备用也可)

---

## 改动 2 · 摸鱼计时重命名 + 模式重设计

### 现状

- 首页组件叫 `SlackingWidget`("摸鱼计时")
- 模式是固定的(摸鱼),不可切换
- 22:00–06:00 没有自动识别夜班

### 目标

- 组件重命名为 `TimeTrackerWidget`("时间记录")
- 工作模式(摸鱼/加班)移到详情页设置
- 22:00–06:00 的记录自动标记夜班(计入净工时补偿)
- 首页组件只显示状态 + 开始/结束按钮

### 数据模型变更

```ts
// src/lib/types.ts
type TimeRecordLabel = 'slack' | 'overtime' | 'other'; // rename SlackingLabel

interface TimeRecord {
  id: string;
  dateKey: string;
  label: TimeRecordLabel; // 'slack' | 'overtime'
  customLabel?: string;    // for 'other'
  startTs: number;
  endTs: number | null;
  // v1.3.3:自动夜班标记(22:00-06:00)
  nightShift: boolean;
}
```

> `SlackingSession` → 重命名为 `TimeRecord`
> `SlackingSessions` → 重命名为 `TimeSessions`
> `SlackingLabel` → 重命名为 `TimeRecordLabel`
> 全部在 `types.ts` 内做 alias 兼容,store 层面保持 key 不变

### 夜班自动标记规则

```
自动标记条件:startTs 或 endTs 在 [22:00, 06:00) 时间窗口内
→ entry.nightShift = true
→ 后续 compute.ts netHours 自动计入 nightBonus
```

### 改动

- `src/lib/types.ts`:
  - `SlackingLabel` → `TimeRecordLabel`(`slack`/`overtime`/`other`)
  - `SlackingSession` → `TimeRecord`
  - `SlackingSessions` → `TimeSessions`
  - 新增 `nightShift: boolean`
  - 保留老类型别名(alias)向后兼容
- `src/store/slackingStore.ts`:
  - `addSession(label: SlackingLabel, dateKey)` → `addSession(label: TimeRecordLabel, dateKey)`
  - 自动检测夜班:根据 startTs 判断是否 22:00–06:00
- `src/lib/constants.ts`:
  - `SLACKING_LABEL_TEXT` → 扩展 `overtime` 的文案
  - `SLACKING_LABEL_ICON` → 扩展 `overtime` 的 icon
- `src/pages/TodayPage.tsx`:
  - `SlackingWidget` → `TimeTrackerWidget`
  - 注释改为「时间记录」
- `src/components/TimeTrackerWidget/TimeTrackerWidget.tsx`(重命名自 SlackingWidget):
  - 移除标签选择器(移到详情页)
  - 组件名/文件名/目录名同步更新
  - 内部 state 只管开始/结束/暂停
- `src/pages/TimeTrackerDetailPage.tsx`(重命名自 SlackingDetailPage):
  - 新增 segmented:「摸鱼」/「加班」(默认「摸鱼」)
  - 标签选择器跟随 segmented 切换
  - 新增 `nightShiftBadge` 展示:夜间 22:00–06:00 标记
  - 已有的 `nightShift` 字段回显
- `src/lib/compute.ts`:
  - `computeNetHours` — 已有 `nightShift` 字段,无需改动
  - 新增 `isNightShift(ts: number)` helper
- `src/lib/compute.test.ts`:
  - 补 2 条夜班自动标记单元测试
- 替换 `lucide-react` → `phosphor-icons` 在所有相关组件中

---

## 验证

- [ ] `npm run typecheck` 0 errors
- [ ] `npm run test` 全过(补 ≥ 2 条夜班自动标记测试)
- [ ] `npm run build` 成功
- [ ] 手动验证:
  1️⃣ 所有图标已替换为 Phosphor
  2️⃣ 首页「时间记录」组件无标签选择器
  3️⃣ 详情页可切换「摸鱼/加班」模式
  4️⃣ 22:00 开始计时,记录自动标记 nightShift
  5️⃣ NightShift badge 在详情页正确显示

## 出口

- 更新 `docs/CHANGELOG-v1.3.md` 追加 v1.3.3 段
- 提交到 `feat/v1.3.3-icons-and-slacking` 分支

---

*最后更新:2026-08-30 · v1.3.3 方案待确认*
