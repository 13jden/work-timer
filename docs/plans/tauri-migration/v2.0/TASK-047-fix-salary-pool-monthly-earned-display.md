# TASK-047 · v2.5-fixbug 第三轮（4 个 bug 修复）

| 字段 | 值 |
|---|---|
| **分支** | `fix/v2.5-fixbug`（基于 `0d240be` HEAD） |
| **所属版本** | v2.5 patch |
| **依赖** | TASK-046（time→accounting 联动 / 联动同步 hook） |
| **优先级** | P1 |
| **状态** | 🚧 开发中 |

---

## 1. 背景

用户验收 v2.5-patch3 后再次反馈 4 个独立 bug，覆盖联动口径、首页展示、池建模与 Month 页算法。本轮逐个修复 + 配套单测。

## 2. 任务清单

| ID | 标题 | 说明 |
|---|---|---|
| T-471 | 工资池"按月覆盖"误触发 | CalendarPage `useEffect` 当前对 prev 里有但 `monthlyEarnedMap` 里消失的 key 全部回写 0，导致**切换月份 / 非工作日 / 未来日**都误删联动 record。改为只有当该 key 在当前月是"工作日且今天之前 / 今天是当月实时已赚归零"等真正生效场景才回写 0 |
| T-472 | 首页本月结余字号过大 | `AccountingTopCard.module.css` `.display` 当前 `clamp(30px, 7.5vh, 64px)`，大屏 `+¥100000.00` 会换行。缩到能一行容纳 `+100000.00` |
| T-473 | 均摊池总额被乘以周期月数 | `AddPoolModal` 选 3 个月日期范围后，`cycleMonths = eachMonthInRange(dateRange).length` 会让 `createPoolWithCycles` 在每个周期里都按 `pool.amount` 单独生成一份，触发重复均摊。改为按日模式下：`amount` 即"整个日期范围的总额"；`buildEqualizeCycleDraft` 按每个自然月"该月在范围内"的 dayCount 分摊 |
| T-474 | Month 页日均口径修正 | 用户期望"日均 = 这个月已赚总数 ÷ 非休息日模式的天数"。当前 `daily = dailySalary(year, month, ...)` = `monthlySalary / workdaysInMonth`。改为"已赚合计（含今日实时）÷ 该月 isWorkday 为 true 的天数" |

## 3. 关键设计点

### 3.1 T-471：联动按月误删修复

**当前逻辑**：
```ts
// prev 里有但 current 没有 → 视为 amount=0 调 upsert
if (!isFirst) {
  for (const key of Object.keys(prev)) {
    if (!(key in monthlyEarnedMap)) upsert(key, 0);
  }
}
```

**问题**：
- `monthlyEarnedMap` 只对 `isWorkday === true` 的日期赋值；周六/日/未来日不会出现在 map 里
- 用户在八月看到联动 → 切到九月 → prev 里八月的 key 全被回写 0，八月联动 record 全部删除
- 即使月份没变（只在月份内切日期范围），切到未来日/休息日也会被错误回写

**修复策略**：
- `monthlyEarnedMap` 只覆盖该月工作日，所以"从 map 消失"= 该日不是工作日 或 已变为非工作日（被 override 改成 rest/leave 但 leave 也算工作日，所以仅 rest 才算）
- 但**用户操作**：用户在 Month 页多选取消生成已赚（`overrides[key].earnedGenerated = false`），下一次 `monthlyEarnedMap` 也不会包含该 key —— 这才是真正应该回写 0 的场景

**区分两种情况**：
- prev 里 key 当月是工作日 → 当前也是工作日 → 不在 map = 用户把 generated 取消了 → 回写 0
- prev 里 key 当月不是工作日（休息日 / 未来日） → 不在 map 是预期 → **不**回写 0

因此把判别改为：
```ts
// prev 里存在但当前 map 没有 → 只在「当前月内、该日仍是工作日」时回写 0
if (!isFirst) {
  for (const key of Object.keys(prev)) {
    if (key in monthlyEarnedMap) continue; // 仍在工作日
    const [y, m, d] = key.split('-').map(Number);
    if (y !== year || (m ?? 0) - 1 !== month) continue; // 不是当前月（切月了）
    const date = new Date(y ?? year, (m ?? 1) - 1, d ?? 1);
    if (!isWorkday(date, effectiveConfig, overrides, HOLIDAYS)) continue; // 不是工作日
    // 走到这里 = 用户取消已赚
    upsert(key, 0);
  }
}
```

这保证：切月 / 休息日 / 未来日 都不会误删联动 record。

### 3.2 T-472：AccountingTopCard 字体

```css
.display {
  font-size: clamp(22px, 4.6vh, 40px);   /* 原 clamp(30px, 7.5vh, 64px) */
  letter-spacing: -1.2px;                /* 原 -2px */
  white-space: nowrap;                    /* 防意外换行 */
}
```

桌面端规则保持：`@media (min-aspect-ratio: 3/2)` 不再二次放大。

### 3.3 T-473：均摊池"总额被乘以月数"

**当前代码**：
```ts
// AddPoolModal.handleSubmit
createPoolWithCycles({
  amount: total,                            // 用户填的总额
  cycleMonths: eachMonthInRange(dateRange).length,  // 跨 N 月 → N
  cycleMode: 'daily',
  dateRange,
  dailyAmount: hasDaily ? dailyVal : undefined,
});
```

```ts
// accountStore.createPoolWithCycles (按 mode 分支)
if (pool.cycleMode === 'daily' && pool.dateRange) {
  const monthKeys = eachMonthInRange(pool.dateRange);
  for (const monthKey of monthKeys) {
    const draft = buildEqualizeCycleDraft(pool, monthKey);   // totalAmount = pool.amount
    ...
  }
}
```

```ts
// pool.buildEqualizeCycleDraft
return {
  totalAmount: pool.amount,                                 // 每个 cycle 都按总额
  ...
};
```

`pool.amount` 在每个自然月都被当 totalAmount = 3000。3 个月范围 → 3 个 cycle，每个 totalAmount=3000 → sync 生成 3 × N 条记录、每月日均基于"总额"算 → 实际重复 3 倍。

**修复**：按日模式下，每个月的 `cycle.totalAmount` 应按"该月在范围内"的天数 × 日均（即 pool.dailyAmount 或 pool.amount / totalDays）= 该月分摊额。
- 全局日均 = `pool.dailyAmount ?? pool.amount / totalDays`
- 单个 cycle `totalAmount` = `dailyVirtual × 该月天数` (本就是 dailyVirtual 的 N 倍)

为保持向后兼容，新增 `splitEqualizeTotalAcrossCycles`：把 `pool.amount` 按"各月在范围内的天数 / 总天数"分配到各 cycle。`buildEqualizeCycleDraft` 接收可选的 `overrideTotalAmount` 参数。

修复点：
1. `buildEqualizeCycleDraft` 接收可选 `overrideTotalAmount?: number`；未传时用 `pool.amount`
2. `createPoolWithCycles` 按日模式分支先算 totalDays / dailyVirtual，再给每个月传 `overrideTotalAmount = dailyVirtual × 该月天数`
3. `syncPoolCycles` 跨月补齐按月模式时（`cycleMode !== 'daily'`）保持原逻辑不动

### 3.4 T-474：Month 日均 = 已赚 ÷ 工作日数

当前：
```ts
const daily = useMemo(() => {
  if (snapshot) return snapshot.dailyRate;
  return dailySalary(year, month, effectiveConfig, overrides, HOLIDAYS);
}, [...]);
```

改为：
```ts
// workdaysInMonth 函数复用 compute.workdaysInMonth,但分母用"本月 isWorkday 天数"
// 分子 = monthEarned(本月已赚合计,含今日实时)
const earnedDays = useMemo(() => {
  let count = 0;
  const days = daysInMonthCalc(year, month);
  for (let d = 1; d <= days; d++) {
    if (isWorkday(new Date(year, month, d), effectiveConfig, overrides, HOLIDAYS)) count++;
  }
  return count;
}, [year, month, effectiveConfig, overrides]);

const daily = useMemo(() => {
  if (earnedDays === 0) return 0;
  return monthEarned / earnedDays;
}, [monthEarned, earnedDays]);
```

- `monthEarned` 已在 CalendarPage 现成（已生成 earnedAmount 之和 + 今日实时已赚）
- 快照模式下用户期望保持原行为：仍使用 `snapshot.dailyRate`（已锁定的当月日均）
- 当 monthEarned = 0 时返回 0（避免除零）
- 未来月 / 当月无工作日 → 0

## 4. 验收标准

- [ ] 切到九月 → 八月的联动 record 仍保留
- [ ] 用户在 Month 页多选"取消已赚" → 联动 record 同步减少
- [ ] AccountingTopCard 大屏下 `+¥100000.00` 一行不换行
- [ ] 均摊池选 3 个月日期范围 → 单个月份的"日均"基于"整个日期范围日均"而非按月×3
- [ ] Month 页日均 = 已赚合计 / 工作日数（含今日实时已赚）
- [ ] typecheck + 380+N 测试全过、build 成功

## 5. 不做的事

- ❌ 不改联动开关 / 已赚联动语义（仅修"误删"边界）
- ❌ 不动存池型
- ❌ 不改 `.display` 之外的样式
- ❌ 不动 `compute.dailySalary` 函数签名（仅修 CalendarPage 的"日均"派生口径）

---

*创建于 2026-09-05 · v2.5-fixbug 第三轮*
