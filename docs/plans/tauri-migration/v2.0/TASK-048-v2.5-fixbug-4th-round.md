# TASK-048 · v2.5-fixbug 第四轮（4 bug 修复 + 4 新需求）

| 字段 | 值 |
|---|---|
| **分支** | `fix/v2.5-fixbug`（基于 `0d240be` HEAD） |
| **所属版本** | v2.5 patch |
| **依赖** | TASK-047（4 个 bug 修复）；TASK-046（time→accounting 联动） |
| **优先级** | P1 |
| **状态** | 🚧 开发中 |

---

## 1. 背景

本轮合并两批反馈：

**4 个老 bug**（TASK-047 已实现，本轮定稿）：
- T-471 联动按月误删
- T-472 首页本月结余字号过大（**用户验收时反馈还是太大**，再缩）
- T-473 均摊池总额被乘以周期月数
- T-474 Month 页日均口径修正

**4 个新需求**（用户 2026-09-05 第二轮反馈）：
- N-481 取消首页的记账关联存款记录（去掉 time→accounting 联动展示与写入）
- N-482 mine 页结余目标分母改总资产口径（与首页本月结余脱钩）
- N-483 池可修改（编辑金额/日期范围/结算方式等）
- N-484 重置资产功能（清零账户余额，记录保留）

---

## 2. 任务清单

| ID | 标题 | 说明 |
|---|---|---|
| T-471 | 工资池"按月覆盖"误触发 | TASK-047 已实现，保留 |
| T-472 | 首页本月结余字号过大（再次缩小） | TASK-047 已改成 `clamp(24px, 4.6vh, 40px)`，仍然 `+¥100000.00` 换行；本轮调到 `clamp(20px, 3.6vh, 32px)` 让一行容纳 |
| T-473 | 均摊池总额被乘以周期月数 | TASK-047 已实现，保留 |
| T-474 | Month 页日均口径修正 | TASK-047 已实现，保留 |
| N-481 | 取消首页记账关联存款记录 | 移除 MinePage 的 `<LinkageSection>` 整块；`config.salaryLinkageEnabled` 默认改 `false`；CalendarPage 仅在开启时才写联动 record；保留 store action 接口（避免破坏数据迁移） |
| N-482 | mine 页结余目标改总资产口径 | `GoalsSection` 当前 `balance = Σ本月 records.amount`；改为 `balance = accounts Σ balance`（实际总资产，与首页本月完全脱钩）。当前结余 % = 总资产 / 目标 |
| N-483 | 池可修改 | 新增 `<EditPoolModal>` 复用 `AddPoolModal` 表单结构。修改金额 → 重建 `cycle.totalAmount`（已生成均摊记录保留 poolCycleTotal 快照；新增差额按已生成天数追加/扣减）。修改日期范围 → 重新拆 cycle 元数据；超出范围的均摊记录保留（带 poolCycleStart/End 快照），只在范围内的继续触发。修改名称/分类/方向/结算方式 → 仅元数据更新。EditPoolModal 调用 `accountStore.updatePool` 并新增 `rebuildPoolCycles(poolId)` 重新生成 cycles |
| N-484 | 重置资产 | 新增 `accountStore.resetAssets()`：把所有 `accounts[].balance` 置 0；**保留**所有 records（已发生事实不能抹去）。虚拟资产口径相应变化：联动/均摊虚拟不受影响（本就未动余额），账户余额确实归零。UI 入口：MinePage `TotalAssetsCard` 右上角小图标（rotate-ccw），二次确认后执行 |

---

## 3. 关键设计点

### 3.1 N-481 · 取消联动

- 移除 `<LinkageSection>` import 与渲染（MinePage.tsx）
- 移除 `LinkageSection.tsx` 文件
- `config.salaryLinkageEnabled` 默认值 `true` → `false`（constants.ts、types.ts）
- CalendarPage 的 `useEffect` 已用 `config.salaryLinkageEnabled` 守卫，只需确保默认 false 后从首页打开不会触发联动 record 写入
- 保留 `ensureSalaryPool` / `upsertSalaryLinkageForDate` store action（用户未来想恢复联动仍可手动开开关触发）；保留 `linkageSource` 类型字段
- 现有用户的联动 record 不主动删（用户关联动 → 历史保留，关一段时间再开 → 历史能继续累加）

### 3.2 N-482 · mine 页结余目标口径

**当前**（AccountTopCard.tsx / GoalsSection.tsx）：
```ts
const monthRecords = records.filter((r) => r.dateKey.startsWith(monthKey));
const balance = monthRecords.reduce((sum, r) => sum + r.amount, 0);
const pct = balance / effectiveGoal;
```

**新口径**：
```ts
const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
const balance = totalBalance;  // 实际总资产（账户余额合计）
const pct = balance / effectiveGoal;
```

`AccountTopCard`（首页）继续按本月口径（不动）；GoalsSection（mine）改总资产。

### 3.3 N-483 · 池编辑

#### store 新增

```ts
interface AccountStore {
  /** 重算池的周期元数据：按当前 pool.cycleMode / dateRange / dayRange 重建 cycles。已存在的 cycle 保留 monthKey/totalAmount，差额按当前规则追加。 */
  rebuildPoolCycles: (poolId: string) => void;
}
```

#### 修改金额语义

`pool.amount` 改变时：
- 已生成的均摊记录保留 `poolCycleTotal` 旧值（作为快照），不再二次调整
- 周期 `cycle.totalAmount` 按新 amount 重新算
- 差额处理：
  - 已生成 N 天 record（amount_i = oldDailyVirtual ± 误差），剩余天数按新日均补差额
  - 用 `splitDailyAmount(newTotal - Σ(record.amount), remainingDays)` 写入新 transaction / record（pending 状态）

为简化，本轮采用：**修改 pool.amount 后，已生成的均摊记录保持原值**，仅调整未来未生成的部分：
- `cycle.dailyVirtual = newPoolAmount / cycle.dayCount`（新日均）
- 下一次 `syncPoolCycles` 按新日均补生成
- 用户可通过"删除池重建"获得完全干净的均摊（这是合理回退路径）
- `cycle.totalAmount` 直接置为新 `newPoolAmount`
- 已生成均摊记录的 `poolCycleTotal` 仍保留旧值（**作为历史快照**），下个 patch 单独加 "cycle.totalAmount 同步到 record.poolCycleTotal" 时再考虑

#### 修改日期范围（按日模式）

- 如果新范围 < 旧范围：超出日期范围的 cycle + transactions 删除（已生成均摊 record 保留，与范围外的同步）
- 如果新范围 > 旧范围：追加新 cycle，sync 时按新范围补 record

#### store 接口

```ts
updatePool: (id, patch) => {
  // 1. 仅元数据（name / categoryId / direction / settleMode / dayRange / dateRange / cycleMode）→ 直接更新
  // 2. amount 变化 → 重建 cycles（rebuildPoolCycles）
  // 3. cycleMode / dateRange 跨月结构变化 → 重建 cycles
}
```

### 3.4 N-484 · 重置资产

```ts
interface AccountStore {
  /** 把所有账户余额清零。records / pools / cycles 不动(已发生事实)。 */
  resetAssets: () => void;
}
```

UI：
- MinePage `TotalAssetsCard` 右上角小图标 `<ArrowCounterClockwise size={14} />` 
- 点击 → `window.confirm('重置资产？所有账户余额将归零（记账记录保留）。')` → 调 `resetAssets()`

---

## 4. 验收标准

- [ ] T-471：切到九月 → 八月联动 record 仍保留（关闭联动开关状态下）
- [ ] T-472：`+¥100000.00` 一行不换行（字号 ≤ 32px 封顶）
- [ ] T-473：均摊池选 3 个月 → 单个月份日均基于整体日期范围日均
- [ ] T-474：Month 页日均 = 已赚合计 / 工作日数
- [ ] N-481：MinePage 没有"联动"区，CalendarPage 打开不写联动 record（关闭默认状态）
- [ ] N-482：Mine 页结余 = Σaccounts[].balance（与首页本月脱钩）
- [ ] N-483：池卡片能编辑，金额/日期范围变化能落库
- [ ] N-484：重置资产按钮 → 账户余额归零，记账记录保留
- [ ] typecheck + 410+ 测试全过、build 成功

## 5. 不做的事

- ❌ 不改池退休逻辑（按 T-410 保留）
- ❌ 不动均摊池金额修改时已生成记录的二次调整（保留快照语义）
- ❌ 不在重置资产时清理 pools/cycles
- ❌ 不动 AccountTopCard（首页本月结余）口径

---

*创建于 2026-09-05 · v2.5-fixbug 第四轮（TASK-047 增量 + N-481~N-484 新需求）*
