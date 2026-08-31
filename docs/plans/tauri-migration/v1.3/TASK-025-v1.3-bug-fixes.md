# TASK-025 · v1.3 Bug Fixes · UI 重排 + 图标库 + 弹窗重设计

> **状态**:⏳ 进行中
> **依赖**:v1.3.0 已发布
> **估时**:0.5 天
> **分支**:`fix/v1.3-bug-fixes`

## 目标

修复 v1.3 上线后发现的 5 类问题,涉及 4 个页面 + 1 个图标体系。

## Bug 清单

### 1️⃣ 首页 SlackingWidget 顺序错位

**问题**:`TodayPage.tsx` 中 `SlackingWidget` 插在 `QuoteCard` 与 `StatsRow` 之间,导致首页下半段视觉重量失衡。
**期望**:摸鱼卡片移至 `StatsRow` **之后**,作为页面最下方组件。

**改动**:
- `src/pages/TodayPage.tsx` — 移动 `<SlackingWidget />` JSX 块到 `<div className={styles.statsRow}>` 之后
- `src/pages/TodayPage.module.css` — 新增 `.slackingBottom` 间距样式(沿用 `.slackingWrap`)

### 2️⃣ 图标统一替换为开源库

**问题**:全站用 emoji (⚡✨🎯) + 零散 inline SVG 表达图标,在深色主题下表现差,且不同浏览器渲染不一致。
**期望**:引入 [`lucide-react`](https://lucide.dev)(MIT 协议,按需 tree-shaking,主流 React 库)。

**图标映射**:

| 原 emoji/svg | 替换为 lucide 图标 |
|---|---|
| ⚡ (加班胶囊) | `<Zap />` |
| 🎯 (自由模式胶囊) | `<Target />` |
| ✨ (次日徽章) | `<Sparkles />` |
| ⚡ (摸鱼图标) | `<Zap />` |
| 😎 / emoji 状态 | `<Coffee />` 或 `<Sun />` |
| TimerCard `<svg>` 时钟 | `<Clock />` |
| ＋ (添加按钮) | `<Plus />` |
| ✕ (移除按钮) | `<X />` |
| ‹ › (月份导航) | `<ChevronLeft />` / `<ChevronRight />` |
| `now` (回到当前月) | `<LocateFixed />` |
| `→` (详情链接) | `<ArrowRight />` |
| `▾` (下拉菜单) | `<ChevronDown />` |
| `›` (select 箭头) | `<ChevronRight />` |

**改动**:
- `package.json` — 新增 `"lucide-react": "^0.460.0"`(最新稳定)
- 替换所有文件中的 emoji 与零散 SVG

### 3️⃣ SegmentsEditor 时间 input 宽度

**问题**:当某段为跨天段时,显示 `✨ 次日` 徽章会挤压 `time` input 的渲染宽度;在窄屏(360px 以下)尤为明显。
**期望**:`time` input 宽度固定(略缩),徽章不挤压其布局。

**改动**:
- `src/components/SegmentsEditor/SegmentsEditor.module.css`:
  - `.time { width: 64px; min-width: 64px; }` — 显式固定
  - `.row` 添加 `min-width: 0` 允许子元素收缩
  - 徽章在 input 之后,不再强制占满

### 4️⃣ 多段工时语义重设(设置页 → 模板库 → 日历页勾选)

**问题**:v1.3 设计中,设置页直接保存到 `config.segments`(全局生效),用户期望"在设置页配置可选的时间段模板,日历页点击日期 → 自定义 → 勾选需要的模板"。
**期望**:解耦"全局默认工时"与"日历页可选模板"。

**数据模型变更**:
```ts
interface SegmentTemplate {
  id: string;             // uuid
  label: string;          // 用户命名,默认 '时段 1'
  segments: WorkSegment[];// 一组时间段
}

// Config 新增
segmentTemplates: SegmentTemplate[];   // 默认含 1 个:09:00–18:00

// 行为:
- settings 页:配置 segmentTemplates(命名 + 段列表)
- DaySheet 自定义模式:列出 segmentTemplates,多选勾选,合并后写入 entry.segments
- config.segments(全局默认)移除或仅作为兜底
```

**改动**:
- `src/lib/types.ts`:
  - 新增 `SegmentTemplate` 接口
  - `Config` 移除 `segments: WorkSegment[] | null` 字段(或保留作为 fallback)
  - `Config` 新增 `segmentTemplates: SegmentTemplate[]`
- `src/store/configStore.ts`:
  - `migrateToV3` 补默认 1 个模板
  - `DEFAULT_CONFIG` 添加 `segmentTemplates: [{ id: 'default', label: '默认', segments: [{ start: '09:00', end: '18:00' }] }]`
- `src/lib/constants.ts`:`DEFAULT_CONFIG` 同步
- `src/pages/SettingsPage.tsx`:
  - 替换 SegmentsEditor 为模板编辑器:
    - 列出所有 templates
    - 每个可重命名 label + 编辑 segments
    - 添加 / 删除模板
  - 当月工作日计算用 templates 第一项的 segments
- `src/components/DaySheet/DaySheet.tsx`:
  - 当日工时 `inherit / custom` radio 保留
  - `custom` 模式:从 `config.segmentTemplates` 列出 chip,勾选后 union 成 `entry.segments`
  - 移除原 inline SegmentsEditor,改为 chip 选择器
- `src/components/SegmentPicker/SegmentPicker.tsx`(新建):通用 chip 多选组件

### 5️⃣ DaySheet 弹窗重设计

**问题 5a**:`DaySheet.module.css` 中 `.toggle` 类同时被用于:
- **夜班加权开关**(width:40px, height:24px,圆形)
- **保存按钮**(在 `.actions` 内,padding:16px, 大按钮)

由于 CSS 选择器优先级相同,后定义的 `.toggle` 覆盖前面的,导致**保存按钮变成滑动开关样式**。这是关键 CSS bug。

**问题 5b**:夜班加权 toggle 宽度太小,在窄屏上不够点击;且 label 文字与 toggle 不对齐。

**问题 5c**:整体弹窗视觉重量失衡,层级不清。

**期望**:用 frontend-design 重新设计弹窗,信息层级清晰,操作按钮普通化。

**改动**:
- `src/components/DaySheet/DaySheet.module.css`:
  - **删除 `.toggle` 复用** —— 重命名为 `.saveBtn` / `.nightToggle`
  - 弹窗布局调整:
    - **顶部**:日期 + 类型 select(显式下拉箭头 lucide `ChevronDown`)
    - **中区**:当日工时(radio + SegmentPicker chips)
    - **夜班加权**:toggle 宽度增大到 52px,增加 label 与 toggle 间距
    - **薪资预览**:大数字卡片(已存在,微调)
    - **底部**:常规 [重置] [保存] 按钮组(saveBtn 主色,resetBtn 边框)
  - 整体 padding 加大,呼吸感更足
- `src/components/DaySheet/DaySheet.tsx`:
  - 重写 actions 区域,使用普通按钮 class
  - 弹窗打开/关闭加 spring 动画(已有,微调 curve)

## 验证

- [ ] `npm run typecheck` 0 errors
- [ ] `npm run test` 全过(单元测试不变,数据模型变更补 migration 测试)
- [ ] `npm run build` 成功
- [ ] 5 个 Bug 各自手动验证:
  - 1️⃣ SlackingWidget 在最下面
  - 2️⃣ 所有 emoji 已被 lucide 替换
  - 3️⃣ 跨天段不挤压 time input
  - 4️⃣ 设置页 = 模板库,日历页勾选用
  - 5️⃣ 保存按钮是按钮,夜班 toggle 宽度合理

## 出口

- 更新 `docs/CHANGELOG-v1.3.md` 追加 bugfix 段
- 提交到 `fix/v1.3-bug-fixes` 分支

---

*最后更新:2026-08-30 · v1.3 bug 修复启动*