# TASK-059 · 「一程」：消费块 + 瀑布流（Phase 5）

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | TASK-056（图片管线）· TASK-057（记录弹窗已无账户选择） |
| **优先级** | P0（用户明确需求 ②） |
| **状态** | ✅ 完成（Phase 1/2 已分别提交，本次 Phase 3 + 文案改名 + RecordRow chip） |

---

## 1. 背景

一次旅行的 12 笔支出散落在多个分类与日期里，一笔兼职收入混在工资中间——系统答不出「这件事总共花了多少」。
「一程」= 围绕一件事的记录集合：可以是支出程（云南 7 日游），也可以是收入程（设计兼职），带一张封面，在「我的」页以小红书式瀑布流陈列。

## 2. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-591 | 数据层 | `Journey` 类型 + `AccountRecord.journeyId` + accountStore CRUD |
| T-592 | 聚合纯函数 | `journeyTotals`：按程聚合笔数 / 总额 / 起止日期（必须单测） |
| T-593 | 一程瀑布流页 | `JourneyListPage`：双列瀑布流，封面 + 标题 + 金额，按时间排列 |
| T-594 | 一程详情页 | `JourneyDetailPage`：封面头图 + 总账 + 关联记录清单 + 「给这一程记一笔」 |
| T-595 | 记录关联 | AddRecordModal / 编辑弹窗新增「所属一程」选择器（只列同类型程 + 内联新建） |
| T-596 | MINE 页入口 | 「我一程」区：最近 2 程预览卡 + 「查看全部」 |
| T-597 | 封面管理 | 建程 / 编辑时设封面：相册选取（复用 TASK-056 压缩 + IndexedDB）或从本程记录附图挑选 |
| T-598 | 删除语义 | 删程保留记录（清 journeyId）；删记录程总额自动减；封面级联清理 |

## 3. 详细设计

### 3.1 数据模型（T-591 / T-592）

```ts
interface Journey {
  id: string;
  title: string;              // ≤ 20 字
  type: RecordType;           // 支出程 / 收入程
  coverImageId?: string;
  note?: string;
  startKey?: string;          // 展示用起止（默认取关联记录 min/max dateKey）
  endKey?: string;
  createdAt: number;
  updatedAt: number;
}
// AccountRecord 扩展：journeyId?: string
```

```ts
/** 按程聚合：总额 = Σ 关联记录金额（绝对值求和，符号由 type 决定展示） */
journeyTotals(journeys, records): Map<journeyId, {
  count: number; total: number; firstKey: string; lastKey: string;
}>
```

- **金额口径**：总额只算 `journeyId` 命中的记录；`claimed`（已关联定期账 · 不计统计）记录**计入**一程总额（旅行中付的房费也是旅行花费），与统计页口径差异需在详情页标注「含定期账还款 X 笔」
- 关联校验：记录与程必须同 `type`（支出记录只能挂支出程），选择器从源头过滤

### 3.2 瀑布流页（T-593）

- 入口：MINE 页「我一程」区 → 全屏页（带返回，复用 CategoryRecordsPage 的整页覆盖模式）
- 布局：CSS `column-count: 2` 瀑布流；卡片 = 封面（自然比例，`max-height` 220px 裁切）+ 标题 + 金额 + 「N 笔 · 结束日期」
- 排序：`lastKey`（或 createdAt）降序 —— 新的在上，左右交错由瀑布流自然形成
- 无封面程：渐变占位卡（按程类型着色：支出暖调 / 收入绿调）+ 大字金额，不留空图
- 右上角「＋ 新建一程」：标题 + 类型即可创建（封面后补）
- 空态：插画 + 「把一次旅行、一次兼职记成一程」

### 3.3 详情页（T-594）

```
封面头图（132px，点按可换图）
标题 · 起止日期
总账条：总金额 | N 笔 | 跨度天数
记录清单（按日期降序，行内可点编辑 / 移出本程）
[＋ 给这一程记一笔]   ← 打开 AddRecordModal，预填 journeyId + type
菜单：编辑一程（标题/备注/封面）· 删除一程
```

### 3.4 记录关联交互（T-595）

- AddRecordModal 在「图片」区下方新增「所属一程」行：默认「无」，点按弹出选择器
- 选择器内容：同类型程列表（按最近使用排序）+ 「＋ 新建一程」（内联输入标题即建）
- 编辑记录时可改挂 / 移出；快速记录（QuickAdd）不暴露该选项（保持三秒主路径），需要时进编辑弹窗挂
- 记录行展示：挂程的记录在副标题显示「一程 · 云南 7 日游」小标

### 3.5 删除与清理（T-598）

```
删除一程：records.journeyId 清空（记录保留）；封面图片无引用则删
记录移出/删除：程总额自动重算（纯展示层聚合，无冗余字段）
```

## 4. 新增 / 改动文件

| 文件 | 改动 |
|---|---|
| `src/lib/types.ts` | `Journey`；`AccountRecord.journeyId?` |
| `src/lib/accounting/journey.ts` + 单测 | 新增：`journeyTotals` 等聚合纯函数 |
| `src/store/accountStore.ts` + 单测 | journeys CRUD、记录挂程 / 移出、删程清理 |
| `src/components/Accounting/Journey/JourneyListPage.tsx` + css | 新增：瀑布流 |
| `src/components/Accounting/Journey/JourneyDetailPage.tsx` + css | 新增：详情页 |
| `src/components/Accounting/Journey/JourneyEditModal.tsx` | 新增：建程 / 编辑（含封面选择） |
| `src/components/Accounting/Journey/JourneySection.tsx` | 新增：MINE 页入口区 |
| `src/components/Accounting/AddRecordModal/*` | 「所属一程」选择器 |
| `src/components/Accounting/RecordRow/*` | 挂程小标展示 |
| `src/components/Accounting/MinePage/MinePage.tsx` | 插入 JourneySection（总资产卡之下） |

## 5. 验收标准

- [ ] 建支出程 / 收入程各一，记账时挂程，瀑布流按时间排列展示封面 + 标题 + 金额
- [ ] 详情页总额 = 关联记录之和（增删记录实时变化），含定期账还款笔数标注
- [ ] 支出记录无法挂到收入程（选择器不显示）
- [ ] 封面：相册选取经压缩入 IndexedDB；可从本程记录附图挑选；无封面显示渐变占位卡
- [ ] 删程后记录全部保留且不再挂程；封面孤儿图被清理
- [ ] 「给这一程记一笔」预填 journeyId 与类型，保存后直接出现在程清单
- [ ] MINE 页入口区展示最近 2 程，「查看全部」进瀑布流
- [ ] 三套主题配色正确；桌面端布局不受影响
- [ ] typecheck / test / build 全绿 + 用户浏览器验收通过

## 6. 不做的事

- ❌ 一程预算（「这趟旅行预算 5000」→ v3.1+ 与月度预算一起评估）
- ❌ 批量多选记录挂程（先走单条编辑挂程，验证需求后再加）
- ❌ 一程分享 / 导出海报

---

*创建于 2026-10-09 · 状态：待开发*
