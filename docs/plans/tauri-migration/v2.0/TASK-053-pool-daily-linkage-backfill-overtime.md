# TASK-053 · v2.5 反馈修正 · 池日均口径 + 联动跨天持久化 + 摸鱼模式默认

| 字段 | 值 |
|---|---|
| **分支** | `fix/v2.5-feedback-3rd`（基于 v2.5-patch14 HEAD） |
| **所属版本** | v2.5 patch |
| **优先级** | P1（数据展示 / 数据完整度 / 默认交互） |
| **状态** | ✅ 已完成（2026-09-10 用户验收通过） |

---

## 1. 背景

用户验收 v2.5-patch14 后,反馈 3 个独立改进项,本轮统一修复:

1. **池日均口径**：薪资池(联动工资池)在「今日进行中」时,日均把今日部分薪资稀释进了其他完整日的均值。期望：日均只算「完整工作日」的薪资,**今日部分单独扣减**,这样日均数字能精准反映「完整一天赚多少」。
2. **联动跨天持久化**：用户验收 v2.5-patch14 时反馈「8.1 看到的数据,8.2 早晨打开就消失」。根因:`useSalaryLinkageSync` 删除循环的「取消已赚」语义被跨午夜时 `prevMonthlyRef` 残留的昨日 key 误触发 —— 昨日非 `todayKey` 且无用户快照,新 map 不含昨日但 `prev` 仍存在,原逻辑视作「用户取消已赚」并 `upsert(key, 0)` 删除联动 record。期望:跨午夜后昨日联动 record 保留,且**不擅自**给用户没启用的工作日补联动 record。
3. **摸鱼模式默认**：Today 页 TimeTrackerWidget 的 `idleLabel` 当前以 `state.mode === 'active'` 判定——但 `mode: 'active'` 既包含「正在工时段内」也包含「等待开工」,导致**上班前**也默认「摸鱼」,与用户期望不符。期望：仅在「正在工时段内」才默认「摸鱼」,其它场景(上班前 / 下班后 / 休息日)默认「加班」。

---

## 2. 任务清单

| ID | 标题 | 说明 |
|---|---|---|
| T-531 | 薪资池日均口径修正 | `PoolSection.EqualizeCard` 中,薪资池 `poolDaily` 计算改为 `(grandTotal - todayAccumulated) / totalDays`,今日部分从分母与分子同时扣减,日均 = 完整工作日均值 |
| T-532 | 联动跨天持久化守卫 | `useSalaryLinkageSync` 删除循环加一行跨天守卫 `if (cmpDateKey(key, todayKey) < 0) continue;`,仅此一行;移除 v2.5-patch15 误入的 backfill effect 及其 `effectiveDailyRate` import / `shiftMonthKey` 工具函数 |
| T-533 | 摸鱼模式默认加班 | `TimeTrackerWidget` 的 `idleLabel` 改为「仅 `state.mode === 'active' && state.status === '工作计价中'` 时默认摸鱼」,其余默认加班 |

---

## 3. 关键设计点

### 3.1 T-531 · 薪资池日均口径

**当前**(PoolSection.EqualizeCard):
```ts
const completedSalaryPoolRecords = isTodayInProgress
  ? salaryPoolRecords.filter((r) => r.dateKey !== todayKeyLocal)
  : salaryPoolRecords;
const salaryPoolDateSet = ...; // size = N（今日排除时）
const totalDays = salaryPoolDateSet?.size ?? 0;
const poolDaily = totalDays > 0 ? Math.round((grandTotal / totalDays) * 100) / 100 : 0;
```

**问题**:
- 当今日进行中：totalDays = N（今日排除）,grandTotal = (N × 完整日均) + 今日部分
- `poolDaily = (N × X + 部分) / N = X + 部分/N` → 被今日部分稀释

**修复**:
```ts
const todayAccumulated = isTodayInProgress
  ? salaryPoolRecords
      .filter((r) => r.dateKey === todayKeyLocal)
      .reduce((sum, r) => sum + r.amount, 0)
  : 0;
const poolDaily = totalDays > 0
  ? Math.round(((grandTotal - todayAccumulated) / totalDays) * 100) / 100
  : 0;
```

**显示口径**:
- 日均 ¥X = 完整工作日均值(不含今日部分)
- 已赚 ¥Y = grandTotal(仍含今日部分,与现有 `consumedByTime = poolDaily × totalDays + todayAccumulated = grandTotal` 口径一致)

实际 `consumedByTime` 在 salary pool 路径下始终等于 `grandTotal`,无需调整。

### 3.2 T-532 · 联动跨天持久化守卫

**当前**(`useSalaryLinkageSync.ts` 删除循环):

```ts
// 取消 / 消失
if (!isFirst) {
  for (const key of Object.keys(prev)) {
    if (key in monthlyEarnedMap) continue;
    const parsed = parseLocalDateKey(key);
    if (!parsed) continue;
    const [py, pm, pd] = parsed;
    if (py !== y || pm !== m) continue; // 不是真实当月 → 跨期查看,不动
    const date = new Date(py, pm, pd);
    if (!isWorkday(date, effectiveConfig, dayOverrides, HOLIDAYS)) continue; // 非工作日预期
    upsert(key, 0);
  }
}
```

**根因**:
- 删除循环的本意是处理「用户主动取消已赚」:`dayOverrides[key].earnedGenerated = false` → 月度 tick 的 map 不再包含 key → 删除循环触发 → `upsert(key, 0)` → record 删除
- `monthlyEarnedMap` 填充规则:**只有** `key === todayKey`(今日实时)和「用户手动生成过快照」的 key 才进 map
- 跨午夜时(8.1 → 8.2):8.1 既不是 `todayKey`,也没用户手动快照 → 新 map 不含 8.1,但 `prev` 里仍残留 8.1(来自昨天实时 tick 写过的 record)
- 删除循环遍历:8.1 → 不在新 map → 同月 → 工作日 → `upsert('2026-08-01', 0)` → **8.1 record 被误删**

**修复策略**:

一行守卫,把 bug 路径关掉:

```ts
// ── v2.5-patch15 T-532：跨天守卫 ──
// 昨日及更早永不自动删除 —— 跨午夜时 prev 含昨天、当前 map 不含昨天
// (昨天非 todayKey 且无用户快照,实时 tick 未写入),原逻辑会把它误判为
// 「用户取消已赚」并删除,造成「8.1 23:59 有数据,8.2 00:00 消失」。
// 用户取消今日已赚仍正常(key === todayKey 时守卫不生效,继续走同月 + 工作日判定)。
if (cmpDateKey(key, todayKey) < 0) continue;
```

**语义保留(关键)**:`cmpDateKey(key, todayKey) < 0` 是严格小于,`key === todayKey` 返回 0,**不**满足 `< 0`,守卫不生效,今日用户取消已赚路径完全保留。

**不依赖 `now` 秒级变化**:守卫用到的 `todayKey = formatDateKey(now)`,而 `now` 已是 `useEffect` 依赖项(1s 同步 effect 里已有),无需额外依赖。

**移除 backfill 误入**:v2.5-patch15 早期版本曾尝试用 backfill effect(遍历 `recordedFromDate` → 当前月前一个月所有工作日,主动 upsert)「解决」这个消失现象 —— 用户明确否定:**该方案会擅自给用户没启用 App 期间的工作日补 record**(用户月中启用,7 月也会被 backfill),违反用户意图。修复方案回到一行守卫,backfill effect 整段删除(连同其 `effectiveDailyRate` import 与 `shiftMonthKey` 工具函数,后者只有 backfill 自用)。

**不需要做的事**:
- ❌ 不擅自给用户没启用 App 期间的工作日补联动 record(7 月不补)
- ❌ 不改月度 tick 的「新增 / 改值」循环(写 record 路径完全不动)
- ❌ 不改 `upsertSalaryLinkageForDate` 接口或行为
- ❌ 不改 `monthlyEarnedMap` 的填充规则(只有 `todayKey` 和用户快照进 map 仍是对的)
- ❌ 不动切月 / 休息日的同月守卫 / 工作日守卫(原 v2.5-patch3 T-471 行为保留)

### 3.3 T-533 · 摸鱼模式默认加班

**当前**(`TimeTrackerWidget.tsx`):
```ts
const state = dayState(now, config, overrides, HOLIDAYS);
const idleLabel: TimeRecordLabel =
  state.mode === 'active' ? 'slack' : 'overtime';
```

**问题**:
- `dayState` 在「等待开工」与「工作计价中」时都返回 `mode: 'active'`
- 用户早上 7 点打开 App → 还在上班前 → 当前 default `slack`(摸鱼)→ 实际应该是 `overtime`(加班,提前来)
- 用户加班中(状态: 'active' 仍在工时段) → 仍然 `slack`(摸鱼),这个其实也值得讨论,但用户当前只反馈「工作时间外」

**修复**:
```ts
// 仅在「正在工时段内」才默认摸鱼,其余一律加班
const state = dayState(now, config, overrides, HOLIDAYS);
const idleLabel: TimeRecordLabel =
  state.mode === 'active' && state.status === '工作计价中' ? 'slack' : 'overtime';
```

**判定对照表**:

| 场景 | state.mode | state.status | 当前 idleLabel | 修复后 |
|---|---|---|---|---|
| 休息日 | 'rest' | - | 'overtime' ✓ | 'overtime' ✓ |
| 上班前(等待开工) | 'active' | '等待开工' | 'slack' ❌ | 'overtime' ✓ |
| 工作时段内 | 'active' | '工作计价中' | 'slack' ✓ | 'slack' ✓ |
| 下班后 | 'done' | - | 'overtime' ✓ | 'overtime' ✓ |

**不需要做的事**:
- ❌ 不改 dayState 内部(不增加新的 mode,语义保留)
- ❌ 不改正在跑 session 的行为(已有 session 时仍用 `currentSession.label`)
- ❌ 不改 `handleStart`(与 idleLabel 保持一致,确保 chip 与按钮文字同步)

---

## 4. 验收标准

- [x] T-531：今日进行中时,薪资池「日均」= 完整工作日均值(不含今日部分);「已赚」= grandTotal(含今日)
- [x] T-532：跨午夜后昨日联动 record 保留(8.1 23:59 写入 → 8.2 00:00 仍能在 accountStore.records 中查到)
- [x] T-532：不擅自给用户没启用 App 期间的工作日补联动 record(用户月中启用,7 月不会被 backfill 补 record)
- [x] T-532：今日用户取消已赚,今日联动 record 仍被自动删除(key === todayKey 时守卫不生效,语义保留)
- [x] T-533：上班前 / 下班后 / 休息日,TimeTrackerWidget chip 默认显示「加班」
- [x] T-533：工作时段内,chip 仍然默认「摸鱼」(无变化)
- [x] typecheck 0 错误、单测全过、build 成功

## 5. 不做的事

- ❌ 不擅自给用户没启用 App 期间的工作日补联动 record(用户月中启用,7 月不应被 backfill 补 record)
- ❌ 不改 `recordedFromDate` 字段语义或初始化时机(仍然是首次启用日)
- ❌ 不改 `useSalaryLinkageSync` 月度 tick 的「新增 / 改值」循环(写 record 路径完全不动)
- ❌ 不改 `monthlyEarnedMap` 填充规则(只有 `todayKey` 与用户快照进 map,仍正确)
- ❌ 不改切月 / 休息日的同月守卫 / 工作日守卫(v2.5-patch3 T-471 行为保留)
- ❌ 不改 `upsertSalaryLinkageForDate` 接口或行为
- ❌ 不改 `dayState` 的 mode 集合
- ❌ 不改 `TimeTrackerWidget` 中已有 session 的行为
- ❌ 不写 CHANGELOG / commit(验收通过后再做)

---

*创建于 2026-09-08 · v2.5 反馈修正第三轮(池日均 + 联动跨天持久化 + 摸鱼默认)*
