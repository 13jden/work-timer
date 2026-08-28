# TASK-010 · 月度记录重做 + 工作日类型 + 用户记录区间

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 1.5 天 |
| **依赖** | TASK-007(monthlyStore 初版)、TASK-002(compute.ts) |
| **优先级** | P1 |
| **状态** | 🟡 进行中(2026-08-28) |
| **分支** | `feat/month-records-rework` |

---

## 1. 目标

重构月度记录体系,支持:

1. **用户记录区间**:`recordedFromDate` —— 首次打开 App 记录,作为"开始计算日"
2. **历史月份快照**:`monthlySnapshots['YYYY-MM'] = { salary, generatedAt }`
3. **手动生成** Month 页加按钮,弹窗输入月薪
4. **当前月独立**:用 `config.monthlySalary` 实时计算;历史用快照
5. **工作日类型**:`work` / `paid_overtime`(加班)/ `leave`(请假)/ 自定义倍率
6. **请假扣减**:leave 日 = 0 元,从"已赚"中扣除 daily
7. **未来拓展记账**:schema 设计预留 Transaction 类型(本次不实现)

---

## 2. 验收标准

- [ ] `dayOverrides` schema 升级到 `Record<dateKey, DayOverrideEntry>`
- [ ] `Config` 加 `recordedFromDate: string`(ISO date)
- [ ] `MonthlyRecord` 重构:含 `salary`、`workDaysCount`、`dailyOverride`、`totalEarned`
- [ ] `monthlySnapshots` 持久化:`salary_timer_monthly_snapshots_v1`
- [ ] `compute.ts` 改:`dailySalary` 接受 override map,新增 `monthEarnedWithOverrides`
- [ ] DaySheet 重做:4 种类型 radio + 倍率 input(加班 1x/1.5x/2x/3x/自定义)
- [ ] Month 页加「生成当月薪资」按钮 → 弹窗确认 + 月薪输入
- [ ] 旧 v1 dayOverrides 数据:覆盖即可,不迁移(用户接受)
- [ ] 单测覆盖:`compute.ts` 新逻辑(请假/加班倍率/历史月份)
- [ ] `docs/CHANGELOG.md` 追加

---

## 3. Schema 变更(破坏性)

### 3.1 新增类型 `src/lib/types.ts`

```ts
/**
 * 工作日类型
 * - 'work': 正常工作日,日均 1x
 * - 'paid_overtime': 加班,默认 1.5x,可手动改
 * - 'leave': 请假,日均 0x(从已赚中扣除)
 * - 'rest': 休息日,日均 0x
 */
export type DayType = 'work' | 'paid_overtime' | 'leave' | 'rest';

/**
 * 单日 override entry
 */
export interface DayOverrideEntry {
  type: DayType;
  /** 倍率(默认:work=1, paid_overtime=1.5, leave=0, rest=0) */
  multiplier: number;
}

/**
 * DayOverrides: key=YYYY-MM-DD, value=DayOverrideEntry
 */
export type DayOverrides = Record<string, DayOverrideEntry>;
```

### 3.2 Config 加字段

```ts
export interface Config {
  // ... 现有字段
  /** 用户首次打开 App 的日期(ISO),用于"用户记录区间" */
  recordedFromDate: string;
}
```

### 3.3 MonthlyRecord 重构

```ts
export interface MonthlyRecord {
  /** YYYY-MM 格式 key(如 "2026-08") */
  key: string;
  /** 该月月薪 */
  salary: number;
  /** 该月日均(根据 overrides 计算) */
  dailyBase: number;
  /** 该月总工作单位(每个工作日 × 倍率累加) */
  totalUnits: number;
  /** 该月已赚(截止 now) */
  earnedSoFar: number;
  /** 是否已锁定(历史月份 = true,当月 = false) */
  locked: boolean;
  /** 快照生成时间(ISO) */
  generatedAt: string;
}

/**
 * 历史月份快照
 * key=YYYY-MM(如 "2026-07"),value={ salary, generatedAt }
 */
export type MonthlySnapshots = Record<string, { salary: number; generatedAt: string }>;
```

### 3.4 storage key

| key | 用途 |
|---|---|
| `salary_timer_day_overrides_v2` | 升级版 dayOverrides(DayOverrideEntry) |
| `salary_timer_config_v2` | 升级版 config(含 recordedFromDate) |
| `salary_timer_monthly_snapshots_v1` | 新增:历史月份快照 |

---

## 4. compute.ts 重构

### 4.1 `dailySalary` 不变(单一日均)

```ts
export function dailySalary(year, month, config, overrides, holidays): number {
  // 月薪 / 当月工作日数
  const days = workdaysInMonth(year, month, config, overrides, holidays);
  return config.monthlySalary / Math.max(days, 1);
}
```

### 4.2 新增 `dayUnits`

```ts
/**
 * 单日的"薪资单位"
 * - work: 1
 * - paid_overtime: multiplier(默认 1.5)
 * - leave / rest: 0
 * - 没 override 且是工作日(weekday 非周末非节假日):1
 * - 没 override 且是周末/节假日:0
 */
export function dayUnits(date, config, overrides, holidays): number {
  const key = formatDateKey(date);
  const ov = overrides[key];
  if (ov) return ov.multiplier;

  // 没 override → 用 isWorkday 判断
  return isWorkday(date, config, overrides, holidays) ? 1 : 0;
}
```

### 4.3 新增 `monthEarnedByUnits`

```ts
/**
 * 当月已赚 = dailyBase × Σ(units of past days) + todayUnits × todayEarnedRatio
 *
 * - past day(已过):直接贡献 dailyBase × units
 * - today:根据 now 处于工作时间段的比例
 * - future day:不贡献
 */
export function monthEarnedByUnits(year, month, now, config, overrides, holidays): number {
  const dailyBase = dailySalary(year, month, config, overrides, holidays);
  const days = daysInMonthCalc(year, month);
  let earned = 0;

  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    const units = dayUnits(date, config, overrides, holidays);
    if (units === 0) continue;
    if (date > now) break;

    if (isSameDay(date, now)) {
      // 今天:按 workedMin 占比
      const startM = toMinutes(config.startTime);
      const endM = toMinutes(config.endTime);
      const nowM = now.getHours() * 60 + now.getMinutes();

      if (nowM <= startM) continue;
      const workedRatio = nowM >= endM ? 1 : (nowM - startM) / (endM - startM);
      earned += dailyBase * units * workedRatio;
    } else {
      earned += dailyBase * units;
    }
  }
  return earned;
}
```

### 4.4 旧 `monthEarnedSoFar` 标记 deprecated,内部转调新函数

```ts
/** @deprecated use monthEarnedByUnits instead */
export function monthEarnedSoFar(year, month, now, config, overrides, holidays) {
  return monthEarnedByUnits(year, month, now, config, overrides, holidays);
}
```

---

## 5. store 改造

### 5.1 calendarStore

- `dayOverrides` 类型变 `DayOverrides`(已是)
- 新增 action `setDayOverride(key: string, entry: DayOverrideEntry | null)`
- 旧 `toggleDay(key, 'work' | 'rest')` 保留但内部转 `setDayOverride`

### 5.2 configStore

- `DEFAULT_CONFIG` 加 `recordedFromDate: ''`
- store 初始化时:若 `recordedFromDate === ''`,写入今天日期(且不覆盖已有值)
- 新 action `markRecordedFrom(date: string)`(幂等)

### 5.3 monthlyStore 重构

- 移除 `generateForMonth` 的自动调用语义
- 新 action `createSnapshot(year, month, salary)` —— 用户手动点击触发
- 新 action `getOrCompute(year, month)` —— 当月实时算,历史用快照
- 新 action `updateSnapshot(year, month, salary)` —— 修改历史月份

---

## 6. UI 改造

### 6.1 DaySheet 重做

```
┌─────────────────────────────────────┐
│ 2026-08-28 周五                     │
├─────────────────────────────────────┤
│ 类型:                              │
│ ◯ 正常工作  ●加班  ◯请假  ◯休息    │
├─────────────────────────────────────┤
│ 倍率: [1.5x ▼]  [或输入: 1.5 ]      │
├─────────────────────────────────────┤
│ 当日薪资: ¥1,341                   │
│ 累计已赚: ¥22,341                  │
├─────────────────────────────────────┤
│ [重置]                    [保存]    │
└─────────────────────────────────────┘
```

倍率下拉:1x / 1.5x / 2x / 3x / 自定义(数字 input)
加班默认 1.5x,可在 input 改

### 6.2 Month 页加按钮

```
┌─────────────────────────────────────┐
│ <   今天      生成当月薪资   >     │
└─────────────────────────────────────┘
```

点击 → 弹窗:
```
┌─────────────────────────────────────┐
│ 生成 2026-08 月度薪资              │
├─────────────────────────────────────┤
│ 月薪: [ 22000 ]                     │
│ 工作日: 22 天                       │
│ 日均: ¥1,000                       │
├─────────────────────────────────────┤
│ [取消]                [确认生成]    │
└─────────────────────────────────────┘
```

### 6.3 Summary 卡片「已赚」改为可点击

点击「已赚」→ 跳到"历史月份列表"(类似 Settings 现有的)

---

## 7. 数据迁移

- 旧 `salary_timer_day_overrides_v1`:覆盖即可,不迁移
- 旧 `salary_timer_config_v1`:升级 v2,新增 `recordedFromDate`
- 旧 `salary_timer_monthly_v1`(records):迁移为 v2,新增字段

迁移在 store 初始化时做,失败则清空。

---

## 8. 测试策略

### 8.1 compute.test.ts 新增

- `dayUnits`: work=1 / overtime=1.5 / leave=0 / rest=0 / 周末无 override=0
- `monthEarnedByUnits`:
  - 全 work 月,过去日期已赚 = daily × days
  - 加班日:额外 +0.5 × daily
  - 请假日:过去扣 daily,已赚 = 22 daily(若 22 个工作日中 1 个请假)
  - 历史月份:用 snapshot.salary,不受 config 变化影响
  - 今日部分:按比例累加

### 8.2 store 测试

- configStore.recordedFromDate 首次写入幂等
- monthlyStore.createSnapshot 写入 snapshot,updateSnapshot 覆盖
- calendarStore.setDayOverride 切换 work↔leave

### 8.3 覆盖率目标

- compute.ts: >90%
- store/: >85%

---

## 9. 实施步骤(顺序)

| 步骤 | 内容 | 估时 |
|---|---|---|
| 1 | types.ts 新增 DayType / DayOverrideEntry / MonthlySnapshots | 30 min |
| 2 | constants.ts 加新 storage key | 5 min |
| 3 | compute.ts 新增 dayUnits / monthEarnedByUnits | 1 h |
| 4 | compute.test.ts 新增用例 | 1 h |
| 5 | configStore 加 recordedFromDate + 迁移 | 20 min |
| 6 | calendarStore setDayOverride action | 20 min |
| 7 | monthlyStore 重构 createSnapshot / getOrCompute | 1 h |
| 8 | DaySheet 重做 + radio + 倍率 input | 1.5 h |
| 9 | Month 页加「生成当月薪资」按钮 + 弹窗 | 1 h |
| 10 | CHANGELOG 更新 + 提交 | 15 min |

总计:~7h ≈ 1 天

---

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 旧 v1 数据被覆盖 | 用户确认接受 |
| DayOverrideEntry schema 升级后,旧 'work'/'rest' 字符串会 TS 报错 | 在 setDayOverride 入口做兼容转换 |
| 月薪修改后,已生成的 snapshot 怎么办 | snapshot 锁定,不受 config 影响 |
| 请假日恰好是今天,earn 计算复杂 | 按 workedMin 比例 × units |

---

## 11. 不在本任务范围

- ❌ 记账(Transactions)功能 —— schema 预留
- ❌ 多用户支持
- ❌ 数据导出/导入
- ❌ 云同步

---

*创建于 2026-08-28 · `feat/month-records-rework` 分支*