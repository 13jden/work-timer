# TASK-044 · 多 bug 修复（v2.5-fixbug 第二轮）

| 字段 | 值 |
|---|---|
| **分支** | `fix/v2.5-fixbug`（基于 TASK-043 已提交） |
| **所属版本** | v2.5 patch |
| **依赖** | TASK-040（池与虚拟资产分解）、TASK-041/042（导航与存池结算） |
| **优先级** | P1 |
| **状态** | ⏳ 开发中 |

---

## 1. 背景

用户浏览器验收 v2.5 后报告 4 个独立 bug，涉及导航联动、资产分解 UI、池计算可读性、负数显示。

## 2. 任务清单

| ID | 标题 | 说明 |
|---|---|---|
| T-441 | TodayPage 跳转 fish 联动导航栏 | `onOpenFish` 改为同时 `setMode('accounting')` + `setTabIndex(2)`（按 v2.5 T-413 一对应：fish↔STATS），而不是只打开 mobileOverlay |
| T-442 | MinePage 虚拟/实际 UI 颠倒 | 主显示 = `virtualTotal`（含虚拟成分），breakdown「实际」= `actualTotal`（真账户余额合计）。原实现两者位置颠倒，导致用户误以为「实际 ¥5000」是真实金额 |
| T-443 | calcVirtualAssets 公式校验 + 新增回归例 | 用户怀疑「均摊支出直接加资产」。核实公式本身无 bug（expense pool 不付款时 `prepaidUnconsumed=0`、`unpaidConsumed` 不并入 `virtualTotal`）。新增回归例：刚创建均摊支出池（无认领）→ `virtualTotal = actualTotal`、新创建时 `unpaidConsumed` 等于已生成日均合计 |
| T-444 | 负数金额显示负号 | `formatAmount` 默认吞符号。审计所有「应当显示负数但目前丢失」的位置：MinePage 总额、AccountRow 账户余额、PoolSection 池内余额、AccountingTopCard 余额、StatsPage 账户 dock、GoalsSection 当前进度等。改为 `formatAmount(amount, true)` 或显式前缀 `-` |

## 3. 关键设计点

### 3.1 T-441 导航联动

按 v2.5 T-413 一对应：
- today ↔ ACCT（快速记录）
- calendar ↔ CAL（记账日历）
- **fish ↔ STATS（日统计）** ← 本次
- settings ↔ MINE（资产）

所以鱼页点击应切到 `mode='accounting'` + `tabIndex=2`。

### 3.2 T-442 UI 颠倒

原代码：
```tsx
<div className={styles.totalAmount}>¥{formatAmount(actualTotal)}</div>  // 主显示真余额
<span className={styles.virtualActual}>实际 ¥{formatAmount(virtualTotal)}</span>  // 错！实际标签在虚拟总额上
```

修正后：
```tsx
<div className={styles.totalAmount}>¥{formatAmount(virtualTotal)}</div>  // 主显示虚拟总额
<span className={styles.virtualActual}>实际 ¥{formatAmount(actualTotal)}</span>  // 实际标签在真余额
```

### 3.3 T-443 公式校验

`calcVirtualAssets` 对 expense pool 的处理：
- `claimed < generated` → `unpaidConsumed += generated - claimed`，不并入 virtualTotal（✓ 已消耗未付，红色调整项）
- `claimed >= generated` → `prepaidUnconsumed += claimed - generated`，并入 virtualTotal（✓ 已付未消耗，绿色）

公式正确。T-443 重点是**新增回归单测**确认用户担心的场景：
1. 刚创建均摊支出池（无 daily records、无 claim）→ `prepaidUnconsumed=0`、`unpaidConsumed=0`、`virtualTotal=actualTotal`
2. 创建均摊支出池 + 已生成 5 天日均 + 未付款 → `unpaidConsumed=500`、`virtualTotal=actualTotal`
3. 创建均摊支出池 + 5 天日均 + 全额预付 → `prepaidUnconsumed=2500`、`virtualTotal=actualTotal-3000+2500=actualTotal-500`

### 3.4 T-444 负号审计

需要修改的位置（按 grep `formatAmount(` 审计）：
- `MinePage.tsx:64` `formatAmount(actualTotal)` → `formatAmount(actualTotal, true)`（主显示虚拟总额也按 showSign）
- `MinePage.tsx:67` `formatAmount(virtualTotal)` → `formatAmount(virtualTotal, true)`（breakdown 实际金额）
- `AccountRow.tsx:37` `formatAmount(acc.balance)` → 加显式符号
- `PoolSection.tsx:139` `formatAmount(balance)` → 加显式符号
- `AccountingTopCard.tsx:49` 当前 `{balance >= 0 ? '+' : ''}¥{formatAmount(balance)}`（负数丢失 -），需修
- `StatsPage.tsx:530` `formatAmount(account.balance)` → 加显式符号
- `GoalsSection.tsx:95` `formatAmount(goal.currentAmount)` → 加显式符号（可能负数）

显式 `-¥未支付` / `-¥待付` 等「前缀标签」保持不变。

## 4. 验收标准

- [ ] TodayPage fish 跳转后 BottomNav 切到 STATS（acct-stats, idx 2）
- [ ] MinePage 主显示 = 虚拟总额，breakdown「实际」= 真实余额合计
- [ ] 创建均摊支出池（无任何记录）→ MinePage 总额 = 账户余额合计
- [ ] 创建均摊支出池 + 5 天日均未付 → 主显示不变，breakdown 显示「-¥500 未支付」
- [ ] 账户余额为负 → 账户行正确显示 `-¥100.00` 而不是 `¥100.00`
- [ ] 存池池内余额为负 → 池卡片显示 `-¥100.00`
- [ ] typecheck + 380+N 测试全过、build 成功

## 5. 不做的事

- ❌ 改 `calcVirtualAssets` 公式（已确认无 bug）
- ❌ 改虚拟资产 UI 文案
- ❌ 改均摊池 daily records 起始日（依然是「从 cycle 第 1 天到今天」）

---

*创建于 2026-09-04 · fix/v2.5-fixbug 第二轮*