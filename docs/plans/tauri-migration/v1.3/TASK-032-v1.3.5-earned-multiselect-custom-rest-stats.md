# TASK-032 · v1.3.5 · 已赚多选 / 自定义休息 / 统计页

> 状态：待开发 · 优先级：P0
> 设计稿（含移动端/桌面端交互原型）：`docs/plans/tauri-migration/v1.3/task-032-v1.3.5-prd/task-032-v1.3.5-prd.html`

## 背景

v1.3.4 完成桌面三栏布局后，暴露四块时间模型缺口：

1. 已赚记录只能「一键生成」，无法跳天/撤销
2. 休息模式只有固定周历（双休/单休/无休），排班制用户无法使用
3. 摸鱼/加班/净工时数据只能看单日，没有周/月视角
4. 缺少「兼职」类型，无法单独记录自定义收入的临时工作（如周末兼职项目）

## 范围（4 个功能 × 移动端 + 桌面端）

### F1 · 已赚多选生成 / 取消

- 日历页「已赚」视图：一键生成 → 多选模式
- 顶部 segmented：生成 / 取消；快捷：全选工作日 / 清空
- 只允许今天之前的日期；底部实时汇总（已选 N 天 · ¥ 前后对比）
- 生成写 `earnedGenerated` + 金额快照，不覆盖已有 DaySheet 配置
- 桌面端右栏展示选择清单（可单行移除）

### F2 · 多模板工作日标记系统

**核心变化**：从"自定义休息模式"改为"多模板分组标记"，标记即工作日，支持一天多模板叠加。

#### 2.1 模板配置
- **动态数量**：用户可无限添加模板（不限 4 个）
- **颜色循环**：预设 4 个颜色池，超出后循环使用
  ```typescript
  TEMPLATE_COLORS = ['#4ADE80', '#FBBF24', '#60A5FA', '#A78BFA'];
  // 第 5 个模板自动使用 colors[4 % 4] = '#4ADE80'
  ```
- 每个模板：`id` / `name`(可编辑) / `color`(自动分配，可手动改) / `workSegment`(单段工时)
- 默认初始化 1 个模板：`"常规班" 🟢 09:00-18:00`
- 设置页新增「工作日模板」配置区，列表展示所有模板 + 「添加模板」按钮

#### 2.2 日历页交互
- **顶部模板选择器**：横向 segmented 显示所有模板（色块 + 名称），单选当前操作模板
- **点击日期标记**：
  - 选中模板 A → 点日历格子 → 该日期添加模板 A 的标记（小点 + 工时段）
  - 切换模板 B → 再点同一日期 → **叠加**显示小点（不覆盖 A 的标记）
  - 再次点击已标记的日期 → 移除当前模板的标记
  - 所有模板标记都移除 → 恢复为未标记状态
- **多点渲染**：日历格子内日期下方显示彩色小点行（`display: flex; gap: 2px`）
- **工时合并规则**：
  - 同一天应用多个模板 → 自动合并各模板的工时段（`unionSegments` 去重叠）
  - **时间冲突校验**：添加模板标记时，检测与已有模板的时间段是否重叠
  - 重叠则提示「时间段冲突，请调整模板工时或移除已有标记」，禁止添加

#### 2.3 标记 = 工作日
- **核心规则**：日期被任意模板标记 → 自动判定为工作日
- **优先级**：模板标记 > DaySheet override > 全局 restMode
- **与 F1 联动**：批量生成已赚时，只有被标记为工作日的日期可选
- **取消工作日**：手动移除该日期的所有模板标记

#### 2.4 数据模型
```typescript
// types.ts
export interface WorkTemplate {
  id: string;              // 'tpl-<uuid>'
  name: string;            // 用户可编辑，默认 '模板1' ~ '模板N'
  color: string;           // CSS hex 颜色（循环分配）
  workSegment: WorkSegment; // 单段工时（如 09:00-18:00）
}

export interface DayOverrideEntry {
  // ... 现有字段保留
  templateMarks?: string[];  // 标记该日期的模板 ID 列表
}

// configStore
interface ConfigState {
  // ... 现有字段
  workTemplates: WorkTemplate[];  // 动态模板列表
}
```

#### 2.5 桌面端适配
- 日历页顶部模板选择器同移动端
- 右栏可显示当前选中日期的模板标记列表（带移除按钮）
- 设置页模板管理列表 + 添加/编辑/删除操作

#### 2.6 迁移策略
- 首次加载时初始化 1 个默认模板（09:00-18:00）
- 现有 `dayOverrides` 中的工作日类型保留，不自动转换为模板标记
- 用户手动标记后，模板标记优先级高于原逻辑

### F3 · 时间记录新增「兼职」类型

#### 3.1 类型定义
- 在现有时间记录标签基础上新增 `'parttime'` 类型
- 显示文案：「兼职」🎯
- 特性：
  - **可自定义收入**：类似加班，但语义区分（兼职 ≠ 加班）
  - **工作时间计入加班统计**：兼职时长合并到「加班」累计中展示
  - **独立显示**：时间记录列表中标记为「兼职」，不混淆为「加班」

#### 3.2 数据模型扩展
```typescript
// types.ts
export type TimeRecordLabel = 'slack' | 'overtime' | 'parttime' | 'other';

export interface TimeRecord {
  // ... 现有字段
  label: TimeRecordLabel;
  /** parttime 类型专用：自定义收入金额（¥） */
  parttimeEarned?: number | null;
}

// constants.ts
export const SLACKING_LABEL_TEXT = {
  slack: '摸鱼',
  overtime: '加班',
  parttime: '兼职',
  other: '其他',
};

export const SLACKING_LABEL_ICON = {
  slack: '🐟',
  overtime: '⚡',
  parttime: '🎯',
  other: '✨',
};
```

#### 3.3 UI 交互
- **今日页添加记录**：时间记录标签选择器增加「兼职」选项
- **兼职收入输入**：选择「兼职」后，底部出现「收入金额」输入框（可选填）
- **统计合并**：
  - 净工时计算：兼职时长 **不计入** 净工时（与摸鱼类似扣除）
  - 加班统计：兼职时长 **计入** 加班累计展示（Fish 页「加班补偿」卡片合并显示）
- **列表展示**：时间记录列表显示 🎯 兼职标记 + 收入金额（如有）

#### 3.4 计算逻辑
```typescript
// compute.ts
function computeNetHours(...) {
  // 兼职时段从 gross 中扣除（不计入正常工时）
  const parttimeMinutes = sessions
    .filter(s => s.label === 'parttime')
    .reduce(...);
  
  const netMinutes = gross - slackUnionLunch - parttimeMinutes + overtimeBonus + nightBonus;
  
  // 兼职时长合并到 overtimeElapsed 展示
  const overtimeElapsed = overtimeSessions + parttimeSessions;
}
```

### F4 · Fish · 时间记录页（日 / 周 / 月）

- 移动端 BottomNav 保持 4 tabs：今日 / 日历 / Fish / 设置，**移除「换算」tab**（换算并入首页咖啡卡片，点击打开详情 push 页）
- Fish 页日 / 周 / 月三态，**默认「日」**= 现有 SlackingDetailPage 内容迁入（不再是 TodayPage 内部 state 切换）；首页摸鱼 Widget 点「详情」跳转至此
- 周 / 月视图：翻页 + 4 汇总卡（净工时/平均净时薪/摸鱼/加班补偿）
- `TrendBars`：纯 SVG 柱状图（不引入图表库），柱色：普通绿 / 加班靛蓝 / 休息灰 / 今天虚线
- 点柱联动当日明细（移动端黑底条 / 桌面右栏）
- 摸鱼/加班/兼职记录折叠列表，按日分组
- 桌面端：左侧导航新增「Fish」第 3 项

## 数据模型（v3.4）

见 PRD 05 节，本次升级关键变更：

### Config 扩展
```typescript
interface Config {
  // ... 现有字段
  workTemplates: WorkTemplate[];  // 动态工作日模板列表
}

interface WorkTemplate {
  id: string;              // 'tpl-<uuid>'
  name: string;            // 用户可编辑
  color: string;           // 循环分配（4 色池）
  workSegment: WorkSegment; // 单段工时
}
```

### DayOverrideEntry 扩展
```typescript
interface DayOverrideEntry {
  // ... 现有字段
  templateMarks?: string[];     // 模板标记列表
  earnedGenerated?: boolean;    // 已赚批量生成标记
  earnedAmount?: number | null; // 已赚金额快照
}
```

### TimeRecord 扩展
```typescript
type TimeRecordLabel = 'slack' | 'overtime' | 'parttime' | 'other';

interface TimeRecord {
  // ... 现有字段
  label: TimeRecordLabel;
  parttimeEarned?: number | null;  // 兼职自定义收入
}
```

## compute.ts 新增

- `hasTemplateMarks(date, overrides)` - 检查日期是否有模板标记
- `isWorkDayByTemplate(date, overrides)` - 基于模板标记判定工作日
- `validateTemplateTimeConflict(date, templateId, templates, overrides)` - 校验模板时间冲突
- `mergeTemplateSegments(templateIds, templates)` - 合并多个模板的工时段
- `getEffectiveSegments` 优先级链更新（模板标记优先）
- `batchGenerateEarned(dates, config, overrides)` - 批量生成已赚
- `computeRangeStats(start, end, ...)` - 聚合逐日净工时
- `computeNetHours` 扩展兼职类型处理（从 gross 扣除，但计入 overtimeElapsed 展示）

## 单测要求

- `hasTemplateMarks` / `isWorkDayByTemplate`（多模板叠加/空标记）≥3 条
- `validateTemplateTimeConflict`（无冲突/部分重叠/完全包含）≥3 条
- `mergeTemplateSegments`（多段合并/去重叠）≥2 条
- `batchGenerateEarned`（生成/取消/保留手工配置）≥3 条
- `computeRangeStats`（跨周/跨月/休息日/加班日）≥3 条
- `computeNetHours` 兼职类型处理（扣除净工时/计入加班展示）≥2 条
- 模板标记优先级验证（模板 > override > restMode）≥2 条

## 验收

见 PRD 08 节（8 条），重点：
- **模板系统**：
  - 设置页可添加/编辑/删除模板（名称/颜色/工时段）
  - 日历页顶部模板选择器正确显示所有模板
  - 点击日期正确添加/移除当前模板标记
  - 同一日期可同时显示多个模板小点（颜色正确、不重叠）
  - 有模板标记的日期在批量生成已赚时可选
  - 时间冲突校验正常（重叠时禁止添加并提示）
- **兼职类型**：
  - 今日页可添加「兼职」记录，输入自定义收入
  - 兼职时长从净工时扣除，但计入加班统计展示
  - Fish 页「加班补偿」卡片正确合并兼职+加班时长
  - 时间记录列表正确显示 🎯 兼职标记
- **Fish 页**：
  - 周/月视图柱状图渲染正确，点击联动明细
  - 4 汇总卡数据正确（净工时/平均时薪/摸鱼/加班补偿）
  - 摸鱼/加班/兼职记录折叠列表按日分组展示
- **技术检查**：
  - typecheck 0 errors，build 增量 < 25KB
  - 现有组件（TimerCard / StatCard / QuoteCard / TimeTrackerWidget）零改动
  - <1024px 回退移动端布局正常
- **数据持久化**：
  - 刷新页面后模板配置和标记不丢失
  - 模板标记写入 `dayOverrides[].templateMarks`
  - 模板配置写入 `config.workTemplates`
  - 兼职记录写入 `timeSessions[]`

## 文件影响预估

| 类型 | 文件 |
|---|---|
| 新增 | `TemplateSelector/` `TemplateEditor/` `TemplateDot/` `ParttimeInput/` `FishPage/` `TrendBars/` |
| 改造 | `CalendarPage` `SettingsPage` `TodayPage` `SlackingDetailPage` `ConvertPage` `BottomNav` `DesktopSidebar` `compute.ts` `types.ts` `constants.ts` `configStore.ts` `calendarStore.ts` `timerStore.ts` |
| 不动 | `TimerCard` `StatCard` `QuoteCard` `TimeTrackerWidget` `DaySheet`（样式不动，仅 TodayPage 层加点击行为） |

## 完成后

- 更新 `docs/CHANGELOG-v1.3.md` 追加 `[v1.3.5]` 节
- 更新 `docs/plans/README.md` 索引
