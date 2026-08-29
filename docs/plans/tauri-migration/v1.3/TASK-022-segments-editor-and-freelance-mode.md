# TASK-022 · SegmentsEditor 通用组件 + 自由模式设置页

> **状态**:⏳ 待开始
> **依赖**:TASK-021
> **估时**:0.8 天

## 目标

新建 SegmentsEditor 通用组件,SettingsPage 接入薪资模式 segmented + 多段工时 + 午休配置。

## 改动清单

### 1. 新建 `src/components/SegmentsEditor/`

#### `SegmentsEditor.tsx`
- Props:
  ```ts
  interface Props {
    segments: WorkSegment[];
    onChange: (segs: WorkSegment[]) => void;
    maxSegments?: number; // 默认 10
    showTotal?: boolean;  // 默认 true
    readOnly?: boolean;
  }
  ```
- UI(参考 PRD § 设计-segments):
  - 每段:`编号 · 09:00 – 18:00 [✨ 次日] ×`
  - end < start 自动显示"✨ 次日 Xh"徽章
  - 底部合计:"合计 17.5 小时 / 天"
  - 底部 `+ 添加一段工时` 按钮
  - 段数达上限按钮 disabled
- 移动端单列布局,等宽 time input

#### `SegmentsEditor.module.css`
- 与现有 styles/tokens.css 完全对齐(var(--font-mono) / var(--line) / var(--r-sm) 等)
- 跨天徽章用 var(--tag-new-bg/fg) 配色

#### `index.ts`
- 导出 SegmentsEditor

### 2. 修改 `src/pages/SettingsPage.tsx`

#### 新增到 Draft 类型
```ts
type Draft = {
  // v2 字段
  monthlySalary: number;
  startTime: string;
  endTime: string;
  coffeePrice: number;
  restMode: 0 | 1 | 2;
  theme: ThemeMeta['id'];
  // v3 新增
  salaryMode: SalaryMode;
  manualHourlyRate: number;
  manualDailyRate: number;
  segments: WorkSegment[] | null;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchMinutes: number;
};
```

#### 新增"薪资 · Salary"组:segmented 控件 + 动态输入框
- `<SegmentedControl>` 自实现(简单 flex 3 等分按钮):
  - 按月结 / 按时结 / 按日结
  - active = draft.salaryMode
- 按月结:显示月薪 input
- 按时结:显示"时薪 ¥"input(bind manualHourlyRate)
- 按日结:显示"日薪 ¥"input(bind manualDailyRate)
- 当月工作日仍按 draft.restMode + 当前 config 算

#### 新增"时间 · Hours"组:SegmentsEditor
- 显示 SegmentsEditor,value = draft.segments ?? 单段
- draft.segments = null 时显示单段(09:00–18:00)
- 添加/删除段同步到 draft.segments
- 注:`restMode` 行在非 monthly 模式下灰显,文案 "disabled · 到日历页勾选当日"

#### 新增"午休 · Lunch"组
- 启用午休 toggle
- 午休开始 time input
- 午休时长 number input(30-180,step 15)
- 仅 monthly 模式显示,其他模式灰显

#### 草稿语义保持
- 所有新增字段走 draft,不立刻写 store
- handleSave 一次性写入 configStore(含 v3 字段)

### 3. 新建 `src/components/SegmentedControl/`

通用 segmented 三态控件:

```ts
interface Props<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}
```

简单 CSS Modules,active 态白底深字 + 阴影。

## 验证

- [ ] typecheck 通过
- [ ] 切换薪资模式,各 input 字段正确显示/隐藏
- [ ] 添加/删除工时段,合计实时更新
- [ ] 跨天段自动显示"次日"徽章
- [ ] 草稿保存语义:未点保存前 store 不变

## 出口

切换到 TASK-023。
