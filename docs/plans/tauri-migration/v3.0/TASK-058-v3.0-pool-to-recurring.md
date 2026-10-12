# TASK-058 · 池 → 「定期账」：简化 + 更名（Phase 4）

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | TASK-057（资产页新布局先定稿） |
| **优先级** | P0（用户明确需求 ①） |
| **状态** | ⏳ 待开发 |

---

## 1. 背景

池机制是 v2.3 的核心价值（均摊收支 + 押金），但建池表单 12 个字段、四个会计概念（虚拟 / 认领 / 周期 / 先付后付）让用户望而却步。

**目标**：**机制一行不动，门槛砍一半**——
1. 更名：池 → **定期账**；均摊型 → **均摊**；存池型 → **押金**（代码内部保留 `pool*` 标识）
2. 创建流程简化为 3 步直觉表单
3. 卡片 / 结算文案去术语化

## 2. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-581 | 定期账创建弹窗 | 新组件 `RecurringCreateModal`：3 步表单替代 12 字段表单 |
| T-582 | 定期账卡片 | 新组件 `RecurringCard`：去术语展示（日均 / 已结进度 / 待退待付） |
| T-583 | MINE 页替换 | `PoolSection` → `RecurringSection`（新组件），旧组件验收后删除 |
| T-584 | 结算文案 | 「认领 / 存入取出」→「记一笔还款 / 记一笔到账 / 退回了」；结算流程沿用 v2.5-patch8 的卡片直接编辑 |
| T-585 | 工资池隐藏 | `noDailyVirtual` 联动池从列表隐藏（内部机制继续运行） |
| T-586 | 编辑弹窗简化 | `EditPoolModal` 同步简化：常用字段外露，其余收进「高级选项」 |

## 3. 详细设计

### 3.1 创建表单（T-581）—— 12 字段 → 3 步

```
第 1 步 · 这是哪种钱？（三张大卡片，一句话解释）
  ┌ 均摊支出 ┐  ┌ 均摊收入 ┐  ┌ 押金 ┐
  │ 房租/会员 │  │ 工资/收款 │  │ 会退的钱 │
  └─────────┘  └─────────┘  └────────┘

第 2 步 · 叫什么 + 多少钱
  名字：预置 chips（房租 / 会员 / 年费 / 保险 / 工资 / 押金…）+ 自定义
  金额：大字号输入

第 3 步 · 什么节奏
  均摊：[每月（默认，零配置）| 自定义日期范围（复用 DateRangePicker）]
  押金：无周期，改问「已经付了吗？」→ 已付(prepay) / 还没付(postpay)

底部实时预览：自动均摊 ≈ ¥100 / 天
高级选项（折叠）：手动日均(dailyAmount) · 每月几号起(dayRange) · 分类选择（均摊支出）
```

字段映射（写入现有 `PoolConfig`，**数据结构不变**）：

| 表单输入 | PoolConfig 字段 |
|---|---|
| 均摊支出 / 均摊收入 | `type='equalize'` + `direction='expense'/'income'` |
| 押金 | `type='deposit'` + `settleMode` 由「已经付了吗」决定 |
| 每月 | `cycleMode='monthly'`，dayRange 缺省 |
| 自定义日期范围 | `cycleMode='daily'` + `dateRange` |
| 分类（高级） | `categoryId`；未选时挂「未分类」，可后补 |

### 3.2 卡片展示（T-582）

| 类型 | 卡片内容 |
|---|---|
| 均摊 | 名称 + `¥X/天` + 本期进度「已结 ¥2,100 / ¥3,000」+ 状态徽标（进行中 / 已结清 / 已逾期） |
| 押金 · 已付 | 名称 + 「退租/到期时退回」+ 绿色 `待退 +¥X` |
| 押金 · 未付 | 名称 + 红色 `待付 −¥X` |
| 工资联动池 | **不显示**（T-585） |

- 卡片操作：结算（记一笔还款 / 到账）、编辑、删除（删除确认文案说明「已生成的均摊记录会保留」）
- 不再出现「虚拟 / 交易 / 周期 / 认领」字样；记录行上的「虚拟均摊 / 虚拟到账」标记改为「均摊 · 定期账名」/「预计到账 · 定期账名」

### 3.3 存量兼容

- 已建的池自动按新卡片渲染，无需数据迁移
- 旧 `AddPoolModal` / `PoolSection` / `EditPoolModal` 在验收通过后删除；过渡期 `RecurringSection` 与 `PoolSection` 不并存（MinePage 直接切换引用）

### 3.4 机制红线（不动清单）

- ❌ 不改 `lib/accounting/pool.ts` 任何生成 / 认领 / 回滚逻辑
- ❌ 不改 `PoolCycle.transactions` 匹配规则
- ❌ 不动 `pool-store.test.ts` 既有用例（只允许新增）
- ❌ 不动统计页「含虚拟」过滤口径（`visibleRecords` / `listableRecords`）

## 4. 新增 / 改动文件

| 文件 | 改动 |
|---|---|
| `src/components/Accounting/PoolPage/RecurringCreateModal.tsx` | 新增：3 步创建表单 |
| `src/components/Accounting/PoolPage/RecurringCard.tsx` | 新增：去术语卡片 |
| `src/components/Accounting/PoolPage/RecurringSection.tsx` | 新增：列表 + 入口（替代 PoolSection） |
| `src/components/Accounting/PoolPage/EditPoolModal.tsx` | 简化重排（常用外露 / 高级折叠） |
| `src/components/Accounting/MinePage/MinePage.tsx` | PoolSection → RecurringSection |
| `src/components/Accounting/StatsPage/StatsPage.tsx`、`TodayRecordsList/*` | 记录行池标记文案更新 |
| 旧 `AddPoolModal.tsx` / `PoolSection.tsx` | 验收后删除 |

## 5. 验收标准

- [ ] 3 步可建均摊支出 / 均摊收入 / 押金三种定期账，逐日生成与结算行为与 v2.5 完全一致
- [ ] 「已经付了吗」开关正确映射 prepay / postpay，总资产待付 / 待退展示正确
- [ ] 存量池在新卡片下展示正确，结算 / 编辑 / 删除全流程可用
- [ ] 工资联动池不在列表出现（开启联动时内部记录仍正常写入）
- [ ] 全局无「池 / 虚拟 / 认领」字样残留（搜索验证）
- [ ] `pool.ts` 与 `pool-store.test.ts` 零改动；typecheck / test / build 全绿
- [ ] 三套主题配色正确 + 用户浏览器验收通过

## 6. 不做的事

- ❌ 池机制任何逻辑改动（含长按转均摊等历史未做项）
- ❌ 定期账图表趋势（v3.1+ 评估）

---

*创建于 2026-10-09 · 状态：待开发*
