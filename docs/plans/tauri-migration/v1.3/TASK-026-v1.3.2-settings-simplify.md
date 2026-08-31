# TASK-026 · v1.3.2 SettingsPage 极简化 + DaySheet 自由日配置增强

> **状态**:⏳ 进行中
> **依赖**:v1.3.1 已发布
> **估时**:0.6 天
> **分支**:`fix/v1.3.2-settings-simplify`

## 目标

把 SettingsPage 从「什么都能配」收回到「只配真正长期不变的东西」,让日常调节(休息模式、临时的自由日薪资/工时)走到更合适的入口。

### 三块改动

1. **SettingsPage 极简化** — 把休息模式从「薪资卡」里拆出来,挪到薪资下方独立一行,降低薪资卡的密度
2. **「默认工时」重构** — 主页面只展示当前默认模板的摘要,可点击"自定义模板"进入弹窗编辑模板库(弹窗取代内联 TemplateEditor)
3. **DaySheet 自由日增强** — 当 type=`freelance` 时,支持设置当日的临时日薪/时薪 + 临时工时(模板多选),让"周末去兼职"这种用例可落地

## Bug 清单(从 v1.3.1 沿袭)

### Bug 1 · 休息模式藏在薪资卡里,语义错位

**问题**:「休息模式」属于"长期不变的休息制度",却被塞在「薪资」卡最后一行。视觉上像"薪资的子配置",但它其实影响的是"月薪分母 / 当月工作日计算",独立成行更清晰。
**期望**:从「薪资」卡移除,作为独立的「休息模式」组放在薪资卡下方。

**改动**:
- `src/pages/SettingsPage.tsx`:
  - 删除薪资卡内的 `<div className={styles.row}>`(含 select)
  - 在「薪资」组下方新增 `<div className={styles.group}>`(休息模式 · Rest Mode)+ 单行 select
  - 非月薪模式下,该组降级为只读说明文字
- `src/pages/SettingsPage.module.css`:
  - 删除 `.select` / `.chevron` / `.disabledHint`(已存在但未充分使用,本次保留并扩展)

### Bug 2 · 「默认工时」区块过重,挤压首页

**问题**:v1.3.1 把 TemplateEditor 全量内联到 SettingsPage 「高级」抽屉里,用户首次打开设置就能看到一堆「模板 1 / 模板 2」+ 内联 SegmentsEditor。视觉重量过重,**且**用户日常根本不需要在这里编辑模板 —— 模板应该在"用的时候"(DaySheet)才需要看到。
**期望**:
- SettingsPage 主页面:**只**展示当前默认模板(第一个 template)的摘要(如 `09:00–18:00 · 默认工时`)
- 摘要旁边一个「自定义模板」chevron 入口,点击打开**弹窗**编辑模板库
- 弹窗里复用 TemplateEditor(从内联版挪过去)
- 「高级」抽屉里**不再**有"模板"区块(模板入口已上移到主页面)

**改动**:
- `src/pages/SettingsPage.tsx`:
  - 「默认工时」卡:显示 `summarizeSegments(firstTemplate.segments)` + 「自定义模板」chevron 按钮
  - 点击 → `setTemplateModalOpen(true)`
  - 弹窗复用现有的 `.modal*` 系列样式(若没有则新增)
  - 「高级」抽屉内:删除「工作时间模板」subGroup(整体上移)
  - 「高级」抽屉剩余:午休 / 换算 / 主题 / 月度记录 / 兼职历史(若启用)
- 新增弹窗样式:`.templateModal*` / `.modalBackdrop` / `.modalCard`
- `src/pages/SettingsPage.module.css`:新增上述弹窗样式

### Bug 3 · freelance 类型 DaySheet 没法自定义(关键功能缺失)

**问题**:用户在月薪模式下,周末偶尔想兼职一天。DaySheet 把这一天切到 `freelance` 类型后,只能乘 multiplier=1,**没有任何方式**告诉 App"今天我按 ¥XXX/天(或 ¥XX/h)算,工作 10:00–16:00"。这导致 freelance 类型在 monthly 模式下完全无意义。
**期望**:DaySheet type=`freelance` 时:
- 展开「当日薪资」区(默认折叠,展开后可见):
  - Segmented:「按时薪」/「按日薪」
  - 输入数值(¥XX / h 或 ¥XX / d)
  - 摘要行:估算当日值
- 展开「当日工时」区(沿用现有 inherit/custom + SegmentPicker)
  - inherit = 用默认模板,custom = 勾选模板合并
- 这两个配置写入 `DayOverrideEntry`,**不影响全局 config**

**数据模型变更**(v3.2):

```ts
interface DayOverrideEntry {
  type: DayType;
  multiplier: number;
  segments: WorkSegment[] | null;
  nightShift: boolean;
  // ── v1.3.2 新增 ──
  /** freelance 模式临时日薪(¥),仅 type==='freelance' 生效 */
  freelanceDaily?: number | null;
  /** freelance 模式临时时薪(¥),仅 type==='freelance' 生效 */
  freelanceHourly?: number | null;
}
```

- `null` / `undefined` = 用全局 config(对 monthly 用户,fee=0)
- 写入时机:`DaySheet.handleSave`,仅当 type===`freelance` 时携带这两个字段

**compute 变更**(`src/lib/compute.ts`):
- `effectiveDailyRate` 在 `type==='freelance'` 时:
  - `freelanceHourly` 存在 → `freelanceHourly × segmentsHours × multiplier`
  - 否则 `freelanceDaily` 存在 → `freelanceDaily × multiplier`
  - 否则(月薪用户未填)→ fallback 到 `manualDailyRate × multiplier`(已存在的逻辑)
- `dailySalary` 同步更新

**改动**:
- `src/lib/types.ts`:
  - `DayOverrideEntry` 新增 `freelanceDaily` / `freelanceHourly` 字段
- `src/store/calendarStore.ts`:
  - `setDayOverride` 入口:不破坏老数据,新字段可选
- `src/lib/compute.ts`:
  - `effectiveDailyRate` 优先级:override `freelanceHourly/Daily` > config `manualHourly/Daily` × segmentsHours
- `src/components/DaySheet/DaySheet.tsx`:
  - `selectedType === 'freelance'` 时,渲染「当日薪资」+「当日工时」区
  - 否则当日工时区也保留(用于自定义工时)
  - 新增 `freelanceRateMode: 'hourly' | 'daily'` + `freelanceRate: number` state
  - `handleSave` 携带新字段
- `src/components/DaySheet/DaySheet.module.css`:
  - 新增 `.freelanceRateRow` / `.freelanceRateInput` / `.freelanceRateUnit`(沿用 .multRow 风格)

### Bug 4 · 修正 v1.3.1 残留:freelanceStore 引用不存在

**问题**:`SettingsPage.tsx` 仍在 `import { useFreelanceStore } from '../store/freelanceStore'`,但 `freelanceStore.ts` 已不存在。这是 v1.3.1 迁移遗留,导致 typecheck 应该报错(用户没运行所以没暴露)。
**期望**:
- 删除 `useFreelanceStore` import
- 删除 `freelanceHistory` state 引用
- 「兼职记录」subGroup 替换为静态说明"到「日历」页点击日期 → 自定义 → 类型选「自由/兼职」临时设置",不展示历史(因为没有 store)

**改动**:
- `src/pages/SettingsPage.tsx`:删除 freelance 相关 import / state / subGroup

### Bug 5 · SegmentsEditor 时间 input 宽度偏窄

**问题**:v1.3.1 把 time input 固定到 88px,在 360px 窄屏下够用,但用户主观觉得"再宽一点点会更舒服"。跨天段「次日」徽章也偏挤。
**期望**:time input 略加宽到 **96px**,跨天段徽章 padding 略加。

**改动**:
- `src/components/SegmentsEditor/SegmentsEditor.module.css`:
  - `.time { width: 96px; min-width: 96px; max-width: 96px; }`
  - `.crossBadge { padding: 1px 8px; }`

## 数据模型兼容性

- 老 v3 / v3.1 数据:`DayOverrideEntry` 缺失 `freelanceDaily/Hourly` → 自动补 `undefined`,读写路径全部走可选链,无破坏
- `migrateToV3` 链保持不变

## 验证

- [ ] `npm run typecheck` 0 errors(尤其确认 freelanceStore 引用清除)
- [ ] `npm run test` 全过(补 compute freelance rate 用例 ≥ 3 条)
- [ ] `npm run build` 成功
- [ ] 5 个 Bug 各自手动验证:
  - 1️⃣ 休息模式独立成行,在薪资卡**下方**
  - 2️⃣ 默认工时只显示摘要,「自定义模板」弹窗可编辑
  - 3️⃣ DaySheet 切到 freelance,可填时薪/日薪 + 工时
  - 4️⃣ typecheck 通过(无 freelanceStore 残留)
  - 5️⃣ SegmentsEditor time input 略宽,跨天徽章不挤

## 出口

- 更新 `docs/CHANGELOG-v1.3.md` 追加 v1.3.2 段
- 提交到 `fix/v1.3.2-settings-simplify` 分支

---

*最后更新:2026-08-30 · v1.3.2 启动*
