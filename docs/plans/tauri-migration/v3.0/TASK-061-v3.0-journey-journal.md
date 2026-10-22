# TASK-061 · 一程详情页手账化 + 钱包开关一致性修复

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | TASK-059（一程）/ TASK-056（记录附图）/ TASK-057（钱包开关） |
| **优先级** | P1（体验修复 + 叙事强化） |
| **状态** | ✅ 完成（2026-10-22 用户验收通过） |

---

## 1. 背景

用户在使用 v3.0 时反馈三个问题：

1. **关闭钱包后，MINE 页资产卡片仍显示「未分类」** —— 钱包关闭后没有账户归类概念，
   「未分类」（= 未归入账户的待调整项 `pendingAdjust`）这个金额对用户没有意义。
2. **一程详情页的记录只能看，不能改** —— 统计页的记录列表可以点击编辑，
   一程详情页却是静态列表，用户在「这趟花了什么」的回顾场景里无法就地纠错。
   更严重的是：在编辑弹窗里点 chip 上的 ✕ 取消关联一程后点「完成」，**关联并没有被解除**
   （记录仍留在这一程里）。
3. **有照片的记录在详情页没有差异化展示** —— 记一笔时拍了张「野生菌火锅」的照片，
   在详情页却和其他记录长得一模一样，用户无法快速回忆「那天吃了什么」。

---

## 2. 需求详情

### 2.1 钱包关闭时隐藏「未分类」（T-611）

- 位置：`MinePage.tsx` → `TotalAssetsCard` 的 `virtualRow`
- 规则：`walletEnabled === false` 时不渲染 `pendingAdjust` 对应的「未分类」chip
- 连带：`hasPending` / `hasBreakdown` 的计算也要排除该项，避免出现空的 `pendingBox`
- **不影响**：池相关的「未支付 / 待付 / 预付未消耗 / 已赚未到账 / 待退」照常展示

### 2.2 一程详情页记录可编辑 + 解除关联修复（T-612）

**2.2.1 记录可点击编辑**

- 详情页记录行的点击行为与统计页 `RecordRow` 一致 → 打开 `AddRecordModal`（edit 模式）
- 键盘可达：`role="button"` + `tabIndex=0` + Enter/Space 触发

**2.2.2 修复「取消关联一程保存不生效」**

根因：`AddRecordModal.handleSave` 里 patch 的构造是

```ts
...(journeyId ? { journeyId } : {}),   // ← journeyId 为空时整个键都不存在
```

而 `accountStore.updateRecord` 的合并语义是 `{ ...oldRecord, ...patch }`：
**不传键 = 不改动**。所以「取消关联」时旧 `journeyId` 被原样保留。

修复：编辑分支显式传键

```ts
updateRecord(editingRecord.id, {
  ...patchBase,
  journeyId: journeyId || undefined,   // ← 显式 undefined = 解除关联
  imageId: savedImageId,
});
```

`handleSave` 与 `handleSaveAndAgain` 两处都要改。

### 2.3 一程详情页记录区手账化重设计（T-613）

**设计定位**：旅行手账。已有的英雄封面 + 圆形邮戳是这页的视觉语言，
记录区把同一套「实体旅行物件」语言延伸下去：

- **墨块日期章**（签名元素）：日期以实心墨块 + 轻微旋转呈现，右侧接一条手账虚线，
  虚线尽头浮着当日笔数与小计。日期章 = 封面邮戳的矩形变体。
- **拍立得贴片**（有照片的记录）：白边 + 投影 + 轻微旋转的方形照片，
  呼应「贴在手账上的照片」这一实体隐喻。照片是页面里唯一饱和的颜色块，自然成为视觉焦点。
- **紧凑行**（无照片的记录）：左槽放分类圆标（弱化），保持与有图记录相同的栅格节奏。

**布局约定**

```
┌────────────────────────────────────────┐
│ ▌10/21 周三 ┈┈┈┈┈┈┈  2 笔  -¥163      │  ← 日期章 + 虚线 + 当日小计
│  ┌──────┐  餐饮                       │
│  │ IMG  │  野生菌火锅          -¥128  │  ← 有图：拍立得 + 大号备注
│  └──────┘                              │
│   ●  餐饮  烤乳扇              -¥35   │  ← 无图：分类圆标 + 单行备注
└────────────────────────────────────────┘
```

- 左槽固定 76px，有图 / 无图共用同一条竖向基线
- 有图记录：备注 15px / 最多 2 行；无图记录：备注 13px / 单行省略
- 照片点击 → 全屏 `ImagePreview`（复用 TASK-056 已有组件），`stopPropagation` 不触发编辑
- 记录行点击 → 打开编辑弹窗

**分组逻辑落点**：抽成纯函数 `groupJourneyRecordsByDay` 放
`src/lib/accounting/journey.ts`（可单测），配套 `journeyStampDate` / `journeyWeekday`。

---

## 3. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-611 | 钱包关闭隐藏「未分类」 | `MinePage.tsx` `TotalAssetsCard` |
| T-612a | 详情页记录可点击编辑 | `JourneyDetailPage.tsx` + `AddRecordModal` edit 实例 |
| T-612b | 修复解除关联保存不生效 | `AddRecordModal.tsx` `handleSave` / `handleSaveAndAgain` |
| T-613a | 纯函数抽取 | `groupJourneyRecordsByDay` / `journeyStampDate` / `journeyWeekday` |
| T-613b | 新组件 | `JourneyPhotoTile.tsx`（拍立得贴片） |
| T-613c | 样式 | `JourneyDetailPage.module.css` 记录区重做 |
| T-614 | 单测覆盖 | 分组纯函数 + 详情页组件 + 资产卡 |

---

## 4. 详细设计

### 4.1 纯函数（`src/lib/accounting/journey.ts`）

```ts
export interface JourneyDayGroup {
  dateKey: string;
  items: AccountRecord[];
  expense: number;  // Σ|amount|（仅 expense）
  income: number;   // Σ|amount|（仅 income）
}

export function groupJourneyRecordsByDay(records: AccountRecord[]): JourneyDayGroup[];
export function journeyStampDate(dateKey: string): string;   // '2026-10-21' → '10/21'
export function journeyWeekday(dateKey: string): string;    // '2026-10-21' → '周三'
```

分组顺序 = 首次出现顺序（调用方传入已按 `dateKey` 降序的记录 → 得到倒序日期）。

### 4.2 详情页结构

```tsx
<AddRecordModal open={addRecordOpen} defaultType={journey.type}
                defaultJourneyId={journeyId} onClose={...} />
<AddRecordModal open={!!editingRecord} editingRecord={editingRecord}
                onClose={() => setEditingRecord(null)} />
<ImagePreview imageId={previewImageId} onClose={() => setPreviewImageId(null)} />
```

### 4.3 关键样式

| 类名 | 作用 |
|---|---|
| `.dayStamp` | 墨块日期章（`--ink` 底 / `--paper` 字，`rotate(-1.4deg)`） |
| `.dayRule` | 手账虚线（radial-gradient 点阵） |
| `.photoTile` | 拍立得贴片（白边 + 投影 + `rotate(-1.6deg)`，hover 摆正放大） |
| `.entryGlyph` | 无图记录的分类圆标 |
| `.entry` | 栅格 `76px minmax(0,1fr) auto` |

---

## 5. 验收标准

- [x] 关闭钱包 → MINE 资产卡片不显示「未分类」，池相关 chip 照常显示
- [x] 一程详情页点记录 → 打开编辑弹窗，字段全部正确回填（含所属一程）
- [x] 编辑弹窗里点 ✕ 取消关联一程 → 点「完成」→ 记录从该一程列表消失，`journeyId` 被清空
- [x] 详情页记录按日期分组，日期章显示 `M/D + 星期`，右侧显示当日笔数与小计
- [x] 有照片的记录显示拍立得贴片（大图 + 备注 + 金额），无照片的显示分类圆标紧凑行
- [x] 点击照片 → 全屏预览；点击照片不触发编辑弹窗
- [x] typecheck / test / build 全绿 + 用户浏览器验收通过

---

## 6. 不做的事

- ❌ 不改一程详情页的封面 / 邮戳 / 总账条（本次只重做记录区）
- ❌ 不改统计页 `RecordRow` 的样式（共用组件，稳定性优先）
- ❌ 不给记录区加新的图片压缩策略（沿用 TASK-056 的 `compressImage`）
- ❌ 不做记录区的多选 / 批量操作

---

*创建于 2026-10-21 · 状态：开发中*
