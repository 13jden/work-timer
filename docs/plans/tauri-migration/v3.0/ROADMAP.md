# v3.0 「回归简单记账」· 总路线图

> **基线**：v2.5-patch18（`feat/v2.5-mobile`，415 单测全绿）。
> **配套文档**：
> - [task-054-v3.0-prd.html](./task-054-v3.0-prd/task-054-v3.0-prd.html) — v3.0 产品思路（可视化 PRD，含界面示意与命名决策）
>
> **范围约定**：v3.0 只动**记账主题**（+ 共用存储层），计时主题任何页面不改。

---

## 版本主题

v2.x 用五个版本搭完记账体系，也累积了四处复杂度溢出（池概念重、钱包多余、统计图表优先、记录无叙事）。
v3.0 做一次 **减法 + 叙事**：

```
减法 ── ① 池 → 「定期账」简化更名   ③ 取消钱包 · 总资产直接改   ⑤ 统计页列表优先
叙事 ── ② 「一程」消费块            ④ 记录附图
```

三条设计原则（所有取舍的裁决依据）：

1. **三秒记一笔** —— 主路径最短，高级能力全部折叠挂载
2. **所见即账** —— 统计默认看记录，总资产是用户亲手写的数
3. **钱要有故事** —— 均摊、押金、一趟旅行，都给名字和封面

---

## 命名决策（待用户最终确认，见 PRD §09）

| 旧 | 新 | 代码内部标识 |
|---|---|---|
| 池 Pool（均摊型 / 存池型） | **定期账**（均摊 / 押金） | 保留 `pool*`，仅 UI 文案更名 |
| 消费块 | **一程** Journey | 新增 `journey*` |

---

## TASK 总索引

| TASK ID | 标题 | 阶段 | 依赖 | 状态 | 文档 |
|---|---|---|---|---|---|
| TASK-054 | v3.0 产品思路 PRD | — | — | ✅ 完成 | [`task-054-v3.0-prd/`](./task-054-v3.0-prd/task-054-v3.0-prd.html) |
| TASK-055 | 统计页列表优先 | Phase 1 | 无 | ✅ 完成 | [`TASK-055-v3.0-stats-list-first.md`](./TASK-055-v3.0-stats-list-first.md) |
| TASK-056 | 记录附图（本地图片） | Phase 2 | 无 | ⏳ 待开发 | [`TASK-056-v3.0-record-images.md`](./TASK-056-v3.0-record-images.md) |
| TASK-057 | 取消钱包 · 总资产直接改 | Phase 3 | 无 | ✅ 完成 | [`TASK-057-v3.0-total-assets.md`](./TASK-057-v3.0-total-assets.md) |
| TASK-058 | 池 → 定期账（简化 + 更名） | Phase 4 | TASK-057 | ⏳ 待开发 | [`TASK-058-v3.0-pool-to-recurring.md`](./TASK-058-v3.0-pool-to-recurring.md) |
| TASK-059 | 一程（消费块 + 瀑布流） | Phase 5 | TASK-056 / 057 | ✅ 完成 | [`TASK-059-v3.0-journey.md`](./TASK-059-v3.0-journey.md) |
| TASK-060 | 模式切换设置：记账纯净模式 | Phase 6 | TASK-059 | 🚧 开发中 | [`TASK-060-v3.0-mode-toggle.md`](./TASK-060-v3.0-mode-toggle.md) |
| TASK-061 | 一程详情页手账化 + 钱包开关一致性修复 | Phase 6 | TASK-059 / 056 / 057 | ✅ 完成 | [`TASK-061-v3.0-journey-journal.md`](./TASK-061-v3.0-journey-journal.md) |
| TASK-062 | 支持 0 元记录（别人请客也能记） | Phase 6 | TASK-056 | ✅ 完成 | [`TASK-062-v3.0-zero-amount-record.md`](./TASK-062-v3.0-zero-amount-record.md) |

**推进顺序理由**：055 / 056 是无数据迁移的独立小改，先拿快赢；057 是数据迁移重头，单独一阶段；058 依赖 057 定稿的资产页新布局；059 依赖 056 的图片管线与 057 之后的记录弹窗（账户选择器已移除，避免二次改动）。

---

## 数据模型演进（设计存档，实际以 `src/lib/types.ts` 为准）

```typescript
// ── v3.0 新增 ─────────────────────────────────────────────

/** 一程：围绕「一件事」的记录集合（支出或收入） */
interface Journey {
  id: string;
  title: string;              // ≤ 20 字
  type: RecordType;           // 支出程 / 收入程，关联记录须同类型
  coverImageId?: string;      // 封面（IndexedDB）
  note?: string;
  startKey?: string;          // 可选起止（展示用，YYYY-MM-DD）
  endKey?: string;
  createdAt: number;
  updatedAt: number;
}

/** 总资产调整快照（手动修改留痕，上限 200 条环形裁剪） */
interface AssetSnapshot {
  id: string;
  before: number;
  after: number;
  delta: number;              // after - before
  note?: string;
  createdAt: number;
}

/** accountStore 新增字段 */
interface AssetsState {
  totalAssets: number;        // 手动维护的总资产
  updatedAt: number;
}

// ── v3.0 扩展 ─────────────────────────────────────────────

interface AccountRecord {
  // ...v2.5 全部字段保留
  journeyId?: string;         // TASK-059：所属一程
  imageId?: string;           // TASK-056：附图（IndexedDB）
  // accountId 冻结：新记录恒写 ''，不再参与任何逻辑（TASK-057）
}

// ── v3.0 保留不动 ─────────────────────────────────────────
// PoolConfig / PoolCycle / PoolTransaction —— 机制零改动，仅 UI 更名（TASK-058）

// ── v3.0 废弃（UI 层） ────────────────────────────────────
// Account 选择器 / 拖拽归入 / AccountDock / 未归入标记（TASK-057）
// Account[] 数据只读存档，迁移 Σ 余额 → 初始总资产
```

**图片存储**：IndexedDB `salary_timer_images`（`imageId → Blob`），记录附图与一程封面共用；
入库前压缩：最长边 ≤1280px、JPEG 0.8（单张约 100–300KB）。localStorage 不存图片。

---

## 优化建议 backlog（v3.1+ 候选，见 PRD §05）

| 建议 | 优先级 | 说明 |
|---|---|---|
| 月度预算 | P1 | 预算额 + 进度条 + 80%/100% 预警 |
| 资产趋势 | P1 | TASK-057 快照 → 趋势线（数据已天然产生） |
| 账单搜索 | P2 | 备注 / 分类关键词过滤，配列表优先使用 |
| CSV 导出 | P2 | 本地导出记录表；建议提前为 057 迁移做安全网 |
| 智能分类建议 | P3 | 按时段高亮候选分类 |
| 一键再来一笔 | P3 | 长按记录复制同额同类到今天 |

---

## 流程规则（每个 TASK 通用，同 v2.x）

1. 读 ROADMAP → 读 TASK-XXX.md → 改代码
2. `npm run typecheck` + `npm run test` + `npm run build` 全绿
3. 用户在浏览器 / 真机验收通过
4. **先**写 CHANGELOG（`docs/CHANGELOG-v3.0.md` + 主文件索引）
5. **再**创建 commit（message 引用 TASK ID + 版本号）

> 未通过验收的改动只留代码 + `dev.log`，不写 CHANGELOG / commit / TASK 终稿。

---

*创建于 2026-10-09 · v3.0 产品思路定稿，待用户评审命名与解耦决策*
