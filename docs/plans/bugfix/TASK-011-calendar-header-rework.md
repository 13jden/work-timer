# TASK-011 · CalendarPage header 与历史月份显示重做

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **依赖** | TASK-010(monthlyStore / GenerateSheet / EarnSheet) |
| **优先级** | P1 |
| **状态** | 🟡 进行中(2026-08-28) |
| **分支** | 同 TASK-010(`feat/month-records-rework`) |

---

## 1. 目标

1. **Month header**:去掉右上角 dot 按钮与点击逻辑,改为「月份」文字居中可点击
2. **点击月份** → 弹出 `GenerateSheet`(生成当月薪资)
3. **历史月份无快照时**:
   - 仍显示 summary 三卡(工作日 / 日均 / 已赚 = ¥0)
   - 日历格不显示收入金额
   - 「已赚」卡片右上角加一个小圆点,提示可点击
   - 点击「已赚」→ 弹出 `GenerateSheet`,生成后:
     - 日历格出现金额
     - 「已赚」卡片显示真实数据
     - 「已赚」卡片圆点消失
4. **已生成快照后**:
   - 「已赚」卡片无圆点
   - 点击「已赚」→ 弹出 `EarnSheet`,可调整月薪
   - **若调整的是当前月** → 同时更新 `config.monthlySalary`(已有逻辑)
   - **若调整的是历史月** → 只更新快照

---

## 2. 验收标准

- [ ] Header 月份居中,无 dot 按钮
- [ ] 点击「月份」→ 打开 `GenerateSheet`
- [ ] 当前月无快照:summary 显示三卡,已赚 = ¥0,日历无金额
- [ ] 历史月无快照:summary 显示三卡,已赚 = ¥0,日历无金额
- [ ] 「已赚」卡片右上角小圆点(无快照时存在,有快照时不存在)
- [ ] 点击「已赚」(无快照)→ `GenerateSheet` 生成 → 已赚变真实数字 + 圆点消失
- [ ] 点击「已赚」(有快照)→ `EarnSheet` 调整
- [ ] 当前月调整月薪 → 同步更新 `config.monthlySalary`
- [ ] 历史月调整月薪 → 仅更新快照
- [ ] `npm run typecheck` 0 errors
- [ ] `npm run test` 全部通过(本任务不引入新测试,因为 UI 行为类逻辑)
- [ ] `docs/CHANGELOG.md` 追加

---

## 3. UI 改造

### 3.1 Header(月份居中)

```
┌─────────────────────────────────────┐
│            八月 2026                │
└─────────────────────────────────────┘
```

- 整个 `head` 居中布局:`justify-content: center`
- 「月份」点击 → `setGenOpen(true)`
- 点击区域包含 `month + year`(整块可点)

### 3.2 Summary(所有月份都显示)

```
┌─────────────────────────────────────┐
│  工作日 22 │ 日均 ¥1,000 │ 已赚 ¥0 •│  ← 圆点在已赚右上
└─────────────────────────────────────┘
```

- **无快照**:`已赚 = ¥0`,右上角小圆点指示器
- **有快照**:`已赚 = 真实数字`,无圆点
- 「已赚」卡片点击逻辑:
  - 无快照 → 打开 `GenerateSheet`
  - 有快照 → 打开 `EarnSheet`

### 3.3 Calendar grid(无快照时不显示金额)

- **有快照 + 过去工作日**:`¥{daily × units}`
- **有快照 + 今天**:`¥{todayEarn}` 实时刷新
- **有快照 + 其他**(周末 / 未来):不显示
- **无快照**:一律不显示金额

---

## 4. 状态判断

```ts
// 已赚卡片
onClick: () => {
  if (hasSnapshot) setEarnOpen(true);
  else setGenOpen(true);
}

// 是否显示圆点
showDot = !hasSnapshot && !isBeforeRecordedDate;
```

---

## 5. 数据流

```
CalendarPage header (click month)
  → setGenOpen(true)
  → <GenerateSheet>
  → onConfirm(salary) → createSnapshot
  → snapshots 更新
  → hasSnapshot = true
  → 圆点消失,已赚显示真实数字

CalendarPage 已赚 card (click)
  → hasSnapshot ? setEarnOpen(true) : setGenOpen(true)
  → <EarnSheet> / <GenerateSheet>
  → onConfirm(salary)
    - 当月:createSnapshot + setConfig({ monthlySalary })
    - 历史:createSnapshot
```

---

## 6. 不在本任务范围

- ❌ 修改快照后日历数据的重新计算逻辑(已有,无需改)
- ❌ 月份选择器 / 日期选择器
- ❌ 历史月份列表 / 导出

---

*创建于 2026-08-28 · 基于 TASK-010 增量调整*
