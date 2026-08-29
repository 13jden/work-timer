# TASK-023 · 摸鱼 Store + Widget + 详情页 + 午休配置

> **状态**:⏳ 待开始
> **依赖**:TASK-021
> **估时**:1.0 天

## 目标

落地 B 模块:摸鱼计时 + 净工时主页 widget + 摸鱼详情页 + 设置页午休配置。

## 改动清单

### 1. 新建 `src/store/slackingStore.ts`

```ts
interface SlackingState {
  sessions: SlackingSessions; // key=YYYY-MM-DD, value=SlackingSession[]
  // 当前正在进行的摸鱼(全局同时只能一段,PRD 开放问题 #2)
  currentSessionId: string | null;

  // Actions
  startSession: (dateKey: string, label: SlackingLabel, customLabel?: string) => string;
  stopCurrentSession: () => void;
  addPastSession: (dateKey: string, label: SlackingLabel, startTs: number, endTs: number) => void;
  updateSession: (id: string, patch: Partial<SlackingSession>) => void;
  removeSession: (id: string) => void;

  // Selectors
  getSessionsByDate: (dateKey: string) => SlackingSession[];
  getCurrentSession: () => SlackingSession | null;
  getTodaySlackingMinutes: (dateKey: string) => number;
}
```

持久化:`slacking_timer_slacking_sessions_v1`

### 2. 新建 `src/components/SlackingWidget/`

#### `SlackingWidget.tsx`

主页 Today 页 QuoteCard 下方紧凑型卡片。

显示:
- 当前状态行:进行中 / 未开始
- 进行中显示:"进行中 · 🏃 摸鱼 · 5:23"
- 进行中显示:进行时长(MM:SS,实时)
- 已完成当日总时长:"今日摸鱼 22:17"
- 主按钮:
  - 未开始:`开始摸鱼 ▾`(下拉选标签:厕所/摸鱼/吃饭/其他)
  - 进行中:`结束摸鱼 ▾`(同上)
  - 休息日:disabled + "休息日无需摸鱼 😎"
- 副按钮:`+ 临时`(弹 InputTimeRange sheet 加历史记录)
- 链接:`详情 →`(进入 SlackingDetailPage)

#### `SlackingWidget.module.css`
- 与现有 Token 对齐
- 进行中状态:pulse-dot accent 色

#### `index.ts`

### 3. 新建 `src/pages/SlackingDetailPage/`

#### `SlackingDetailPage.tsx`

四区块结构:

**A · 仪表盘 2×2 grid**
| 总工时 | 午休扣除 |
| 摸鱼扣除 | 加班补偿(点击弹窗) |

加班补偿弹窗:
```
加班 60 min × 倍率
─────────
夜班 5h × 0.5 身体补偿
```

**B · 底部深色 summary 横条**
- 净工时(大号 accent)
- 净时薪(大号 accent)

**C · 摸鱼记录列表**
- 每行:icon / 标签 / 起止时间 / 时长 / 编辑 / 删除
- 编辑:弹 sheet 改 label + startTs + endTs
- 删除:二次确认
- 底部:`+ 添加记录`(弹 sheet)

**D · 公式说明(纸色背景)**
```
净时薪 = 今日已赚 ÷ (总工时 − 摸鱼∪午休 + 加班补偿)
```

#### `SlackingDetailPage.module.css`

#### `index.ts`

#### 路由
- 在 App.tsx 加 `slacking` tab(仅移动端)
- BottomNav 现有 4 tab 不变,slacking 通过 widget 的"详情"链接进入
- 返回按钮在页面顶部,使用 navigate(-1)

### 4. 修改 `src/pages/TodayPage.tsx`

在 QuoteCard 下方新增 `<SlackingWidget />`:

```tsx
<div className={styles.quoteWrap}>
  <QuoteCard index={dayOfYear} />
</div>
<div className={styles.slackingWrap}>
  <SlackingWidget />
</div>
```

**不动现有样式**:仅添加 .slackingWrap 容器,样式复 quoteWrap。

### 5. 摸鱼 Sheet(详情页内 inline)

新建 `src/components/SlackingRecordSheet/`:
- Add / Edit 模式
- 标签 select(厕所/摸鱼/吃饭/其他)
- label=other 显示自定义输入
- 开始时间 / 结束时间(time input + date picker,简化版用 time)
- 保存 / 删除(edit 模式)

### 6. 修改 `src/pages/SettingsPage.tsx`

午休配置组已在 TASK-022 中加入(共三控件:启用/开始/时长)。
本任务无需额外改动,只在 TASK-022 实现午休组后,本次确认生效。

### 7. 净时薪联动

Today 页 StatCard(收入卡)新增 sub 行(可选,不影响现有 sub):
- 显示 `净时薪 ¥XX.XX`(compute netHourlyRate)

注:**不动现有样式**,仅追加 sub prop,StatCard 自身可自适应。需在 TodayPage 调用 `useSlackingStore` + `computeNetHours`。

## 验证

- [ ] 摸鱼开始/结束,widget 实时刷新
- [ ] 详情页 2×2 卡片数值正确
- [ ] 净时薪公式符合 PRD §7 #3 验收:总工时6h、午休1h、摸鱼22m、无夜班→net=278m;¥300→netHourly≈¥64.74
- [ ] 摸鱼跨 00:00 自动截断(边界 #3)
- [ ] 休息日 widget disabled
- [ ] 摸鱼与午休重叠取 union(边界 #1)

## 出口

切换到 TASK-024。
