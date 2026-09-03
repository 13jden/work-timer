# v2.x 记账功能 · 总路线图（v2.0 → v2.5）

> **基线分支**：`feat/v2.1-mobile`（自 `v2.0-mobile` @ cd2ed29，含 v1.3.5 修复 + 记账 Phase 1-2 + v2.1 视觉/框架）。
> **配套文档**：
> - [task-033-v2.0-accounting-prd.html](./task-033-v2.0-accounting-prd/task-033-v2.0-accounting-prd.html) — 完整 PRD（视觉原型）
> - [IMPLEMENTATION-PHASES.md](./task-033-v2.0-accounting-prd/IMPLEMENTATION-PHASES.md) — 阶段划分
>
> **目录约定**（2026-09-03 起）：v2.x 全部 TASK 文档统一收在 `v2.0/` 目录下，原 `v2.1/` 子目录已并入。

---

## 版本拆分策略

```
v2.0 基础层 ──── types + store + constants + 基础 CRUD + 单测          ✅ 已交付
    ↓
v2.1 记账核心 ── 记录 + 分类 + 线稿图标 + 双主题框架                    ✅ 已交付
    ↓
v2.2 统计日历 ── 统计页三视图 + 记账日历视图                            ← 当前（TASK-038）
    ↓
v2.3 池机制 ──── 虚拟预扣/预加 + 认领关联（核心难点）                    （TASK-039）
    ↓
v2.4 钱包目标 ── 多账户 + 存钱目标                                      （TASK-040）
    ↓
v2.5 联调发布 ── 联调 + 打磨 + 发布                                     （TASK-041）
```

每个版本验收后才写 CHANGELOG（对应版本独立文件）和提交。

---

## TASK 总索引

| TASK ID | 标题 | 版本 | Phase | 状态 | 文档 |
|---|---|---|---|---|---|
| TASK-033 | 记账功能 PRD（视觉原型） | v2.0 | - | ✅ 完成 | [`task-033-v2.0-accounting-prd/`](./task-033-v2.0-accounting-prd/) |
| TASK-034 | 记账核心：记录 + 分类 | v2.0 | Phase 1-2 | ✅ 完成 | [`TASK-034-v2.1-accounting-core.md`](./TASK-034-v2.1-accounting-core.md) |
| TASK-036 | 图标系统升级（emoji → Phosphor 线稿） | v2.1 | - | ✅ 完成 | [`TASK-036-accounting-phosphor-icons.md`](./TASK-036-accounting-phosphor-icons.md) |
| TASK-037 | 移动端双主题框架 + 上下滑切换 + 删除确认 | v2.1 | - | ✅ 完成 | [`TASK-037-dual-mode-nav-and-delete-confirm.md`](./TASK-037-dual-mode-nav-and-delete-confirm.md) |
| TASK-038 | 统计页三视图 + 记账日历视图 | v2.2 | Phase 3 | 📝 已规划 | [`TASK-038-stats-and-calendar.md`](./TASK-038-stats-and-calendar.md) |
| TASK-039 | 池机制（均摊/存池 + 认领） | v2.3 | Phase 4 | ⏳ 待细化 | [`TASK-039-pool-mechanism.md`](./TASK-039-pool-mechanism.md) |
| TASK-040 | 多账户钱包 + 存钱目标 | v2.4 | Phase 5 | ⏳ 待细化 | [`TASK-040-wallet-and-goals.md`](./TASK-040-wallet-and-goals.md) |
| TASK-041 | 联调打磨 + 发布 | v2.5 | Phase 6 | ⏳ 待细化 | [`TASK-041-polish-and-release.md`](./TASK-041-polish-and-release.md) |

> TASK-035 编号空缺（历史保留，不复用）。

---

## 当前进度

| 版本 | 交付内容 | CHANGELOG |
|---|---|---|
| v2.0 ✅ | 数据层 + 记账 MVP（快速记录 / 完整弹窗 / 分类文件夹 / 未分类区 / 今日列表） | `docs/CHANGELOG-v2.0.md` |
| v2.1 ✅ | 线稿图标系统（IconByKey）+ 双主题框架（上下滑切换）+ 分类删除确认 + 快速记录布局 | `docs/CHANGELOG-v2.1.md` |
| v2.2 🚧 | TASK-038 统计页三视图 + 记账日历视图 | 待产出 `docs/CHANGELOG-v2.2.md` |

---

## 移动端记账主题 tab 填充进度

TASK-037 已搭好双主题框架，记账主题 4 个 tab 的实现进度：

| 索引 | tab | 页面 | 实现版本 |
|---|---|---|---|
| 0 | ACCT | AccountingPage（记账首页） | ✅ v2.0/v2.1 |
| 1 | STATS | 统计页 | TASK-038（v2.2） |
| 2 | CAL | 记账日历 | TASK-038（v2.2） |
| 3 | MINE | 记账设置（钱包 / 池 / 目标） | TASK-039/040（v2.3/v2.4） |

---

## 依赖关系图

```
TASK-034 ── TASK-036/037 ── TASK-038 ── TASK-039 ── TASK-041
                                            │
                                            └── TASK-040（可与 039 并行）──┘
```

- TASK-038 完成即有「记账 + 看账」完整体验
- TASK-039 完成即 v2.0 PRD 核心价值（池机制）落地
- TASK-040 相对独立，可与 TASK-039 并行
- TASK-041 是最后收尾

---

## 数据模型（v2.0 已实现，存档参考）

> 实际定义以 `src/lib/types.ts` 为准，此处为设计存档。

```typescript
// 账户
interface Account {
  id: string;
  name: string;
  type: 'alipay' | 'wechat' | 'card' | 'cash';
  balance: number;       // 实时余额
  color: string;         // 卡片背景色
  order: number;
}

// 分类
interface Category {
  id: string;
  name: string;
  icon: string;          // v2.1 起为 icon key（IconByKey 渲染，旧 emoji 自动回退）
  color: string;         // 背景色
  type: 'income' | 'expense';
  parentId?: string;     // 子分类归属
  order: number;
}

// 分类文件夹（用于首页展示）
interface Folder {
  id: string;
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

// 记账记录
interface AccountRecord {
  id: string;
  dateKey: string;       // YYYY-MM-DD
  amount: number;        // 正数=收入，负数=支出
  type: 'income' | 'expense';
  categoryId: string;
  note?: string;
  accountId: string;
  createdAt: number;     // 时间戳
  updatedAt: number;

  // 池关联（TASK-039 启用）
  poolId?: string;
  poolDirection?: 'in' | 'out';  // 'in'=存入池，'out'=从池取出
  poolStatus?: 'virtual' | 'confirmed';

  // 分配状态
  assignedFolderId?: string;
  isUncategorized?: boolean;     // v2.1：未分类标记
}

// 池配置（TASK-039 启用）
interface PoolConfig {
  id: string;
  name: string;
  type: 'equalize' | 'deposit';  // 'equalize'=均摊型，'deposit'=存池型
  amount: number;           // 每月/每周期总金额
  cycleMonths: number;      // 周期月数（均摊型）
  dayRange?: { start: number; end: number };  // 每周期天数范围（均摊型）
  targetAccountId?: string; // 目标账户（存池型）
  createdAt: number;
}

// 池周期记录
interface PoolCycle {
  id: string;
  poolId: string;
  monthKey: string;        // YYYY-MM
  totalAmount: number;
  dayCount: number;         // 实际天数
  dailyVirtual: number;     // 日均虚拟金额
  status: 'generating' | 'confirmed' | 'overdue';
  transactions: PoolTransaction[];
}

// 池交易记录
interface PoolTransaction {
  id: string;
  cycleId: string;
  dateKey: string;
  recordId?: string;       // 关联的 AccountRecord id
  amount: number;
  direction: 'in' | 'out';
  status: 'virtual' | 'confirmed';
  confirmedAt?: number;
}

// 存钱目标（TASK-040 启用）
interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetAccountId?: string;
  deadline?: string;        // YYYY-MM-DD
  createdAt: number;
}
```

---

## 流程规则（每个 TASK 通用）

1. 读 ROADMAP → 读 TASK-XXX.md → 改代码
2. `npm run typecheck` + `npm run test` + `npm run build` 全绿
3. 用户在浏览器 / 真机验收通过
4. **先**写 CHANGELOG（对应版本独立文件 `docs/CHANGELOG-vX.X.md` + 主文件索引）
5. **再**创建 commit（message 引用 TASK ID + 版本号）

> 未通过验收的改动只留代码 + `dev.log`，不写 CHANGELOG / commit / TASK 终稿。

---

*最后更新：2026-09-03 · v2.1 目录并入，TASK-038 ~ 041 规划落地*
