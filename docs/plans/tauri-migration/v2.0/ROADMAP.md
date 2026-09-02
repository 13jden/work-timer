# v2.0 记账功能 · 实现拆分计划

> 配套文档：
> - [task-033-v2.0-accounting-prd.html](./task-033-v2.0-accounting-prd.html) — 完整 PRD
> - [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md) — 阶段划分

---

## 版本拆分策略

```
v2.0 基础层 ──── types + store + constants + 基础 CRUD + 单测
    ↓
v2.1 记账核心 ── 记录 + 分类（首页记账模式 + 分类管理）
    ↓
v2.2 统计日历 ── 统计页 + 记账日历视图
    ↓
v2.3 池机制 ──── 虚拟预扣/预加 + 认领关联（核心难点）
    ↓
v2.4 钱包目标 ── 多账户 + 存钱目标
    ↓
v2.5 联调发布 ── 联调 + 打磨 + CHANGELOG + 发布
```

每个版本验收后才写 CHANGELOG 和提交。

---

## v2.0 · 数据层基础（对应 Phase 1）

### 目标
跑通数据模型和 store，为 UI 层铺路。

### 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-001 | 设计记账数据结构 | `AccountRecord` / `Category` / `Folder` / `Account` / `PoolConfig` / `PoolCycle` / `PoolTransaction` |
| T-002 | 扩展 `src/lib/types.ts` | 添加记账相关类型定义 |
| T-003 | 扩展 `src/lib/constants.ts` | 添加记账 storage key 和默认分类 |
| T-004 | 创建 `src/store/accountStore.ts` | Zustand store，分模块组织 |
| T-005 | localStorage 持久化 | storage key 命名规范，数据迁移钩子 |
| T-006 | 基础 CRUD 方法 | `src/lib/accounting/` 纯函数 + 单测 |
| T-007 | 与现有 store 边界隔离 | 计时 store 与记账 store 互不干扰 |

### 数据模型预览

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
  icon: string;          // emoji
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
  
  // 池关联
  poolId?: string;
  poolDirection?: 'in' | 'out';  // 'in'=存入池，'out'=从池取出
  poolStatus?: 'virtual' | 'confirmed';  // 'virtual'=虚拟，'confirmed'=已确认
  
  // 分配状态
  assignedFolderId?: string;
}

// 池配置
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

// 存钱目标
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

### 验收标准
- [ ] TypeScript 编译通过
- [ ] accountStore CRUD 单测全部通过
- [ ] 与 timer store 无交叉污染

---

## v2.1 · 记账核心（对应 Phase 2）

### 目标
能记账、能分类、能看列表 —— 最基础闭环。

### 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-101 | 首页记账模式入口 | 下滑手势切换，内容原位替换 |
| T-102 | 快速记录 | 一行输入 + 按钮，金额 + 类型 + 分类 |
| T-103 | 完整添加弹窗 | 底部半屏模态框 |
| T-104 | 分类文件夹 | 新建/删除/长按拖动排序 |
| T-105 | 未分类区域 | 有则显示，无则隐藏 |
| T-106 | 首页今日记录列表 | 显示当日记账记录 |
| T-107 | 记录编辑/删除 | 长按/滑动操作 |

### 验收标准
- [ ] 能完成：记一笔 → 选分类 → 看列表的完整流程
- [ ] 浏览器验收通过

---

## v2.2 · 统计日历（对应 Phase 3）

### 目标
能看数据趋势，知道钱花哪了。

### 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-201 | 统计页三视图切换 | 日/月/年 |
| T-202 | 日视图 | 纯记录列表 |
| T-203 | 月/年视图 | 收支双柱柱状图 + 分类排行条形列表 |
| T-204 | 收入/支出切换 | SegmentedControl |
| T-205 | 记账日历视图 | 月历格子 + 每日收支 |
| T-206 | 日详情弹窗 | 点击日历某天查看明细 |
| T-207 | 分类详情页 | 点击分类进入该分类记录 |

### 验收标准
- [ ] 统计页三视图数据正确
- [ ] 日历可点击查看每日明细

---

## v2.3 · 池机制（对应 Phase 4）

### 目标
虚拟预扣/预加 + 认领关联 —— 最有价值也最复杂。

### 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-301 | 池管理列表 | 设置页池区域 |
| T-302 | 均摊型池 | 长期循环 + 自定义时间范围 + 日均虚拟记录生成 |
| T-303 | 存池型池 | 押金模式，不关联天数 |
| T-304 | 认领机制 | 添加记录时关联池（存入/取出方向） |
| T-305 | 状态流转 | 全虚拟 → 部分确认 → 已确认/已逾期 |
| T-306 | 记录转均摊 | 长按普通记录转为池 |
| T-307 | 虚拟/实际切换筛选 | 统计页筛选 |

### 验收标准
- [ ] 创建均摊池 → 每日虚拟记录生成 → 实际到账认领 → 状态变更

---

## v2.4 · 钱包目标（对应 Phase 5）

### 目标
多账户管理 + 存钱进度。

### 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-401 | 多账户管理 | 增删改 |
| T-402 | 总资产卡片 | 设置页钱包区域 |
| T-403 | 记录关联账户 | 添加记录时选择账户 |
| T-404 | 存钱目标 | 创建/进度/关联账户 |
| T-405 | 设置页集成 | 钱包 + 池 + 存钱目标 |

### 验收标准
- [ ] 多账户数据正确
- [ ] 存钱目标进度实时更新

---

## v2.5 · 联调发布（对应 Phase 6）

### 目标
收尾、体验优化、正式发布。

### 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-501 | 各页面数据联动验证 | 首页/日历/统计/设置数据一致性 |
| T-502 | 拖拽交互 | 记录拖到分类文件夹/账户 |
| T-503 | 页面切换动画 | 下滑抽屉动画 |
| T-504 | 空状态/错误处理 | 各种边界情况 |
| T-505 | 性能优化 | 大量记录时列表渲染 |
| T-506 | E2E 验证 | typecheck + test + build |
| T-507 | CHANGELOG | `docs/CHANGELOG-v2.0.md` |
| T-508 | 发布 | Git tag + 发布 |

### 验收标准
- [ ] 全流程跑通
- [ ] `npm run build` 通过
- [ ] 用户确认上线

---

## 依赖关系图

```
v2.0 ──┬── v2.1 ── v2.2 ── v2.3 ── v2.5
       │
       └── v2.4 (可与 v2.3 并行)
```

- v2.1 完成即有记账 MVP
- v2.4 可与 v2.3 并行开发
- v2.5 是最后收尾

---

*最后更新：2026-09-02 · v2.0 启动*
