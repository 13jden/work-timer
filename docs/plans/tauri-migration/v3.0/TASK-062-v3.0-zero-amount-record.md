# TASK-062 · 支持 0 元记录（别人请客等场景）

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | TASK-056（记一笔弹窗）/ TASK-057（钱包开关） |
| **优先级** | P2（小功能，记账体验补齐） |
| **状态** | ✅ 已完成（2026-10-22 验收通过） |

---

## 1. 背景

用户反馈：现实中存在「吃了但没花钱」的消费 —— 别人请客、公司买单、霸王餐。
这类消费值得被记下来（想知道去哪吃了、某天花了多少），但金额是 0。

当前 v3.0 的记一笔弹窗**不接受 0 元**：

- `AddRecordModal.handleSave`：`if (!isFinite(amount) || amount <= 0) → 报错`
- `AddRecordModal.canSubmit`：`amt > 0` 才允许点「完成」
- `QuickAddRecord.handleSubmit`：`amount <= 0` 直接 return

用户要么被迫填一个假金额（污染统计），要么干脆不记（丢失消费轨迹）。

---

## 2. 需求详情

### 2.1 允许保存 0 元记录（T-621）

- 弹窗内输入 `0` 后，「完成」/「再记」按钮可点，保存出 `amount === 0` 的记录
- 空输入仍然非法（必须真的输入了 0，而不是「什么都没填」）
- 负数仍然非法，错误提示区分为：
  - 非数字 / 空 → 「请输入有效金额」
  - 负数 → 「金额不能为负数」

### 2.2 0 元记录的语义（T-622）

| 维度 | 行为 |
|---|---|
| 账户余额 | 不变（金额为 0，delta = 0） |
| 收支统计 | 计入「笔数」，但对总额 / 占比贡献为 0 |
| 列表展示 | 金额显示 `¥0.00`，**不带正负号**（避免出现 `-¥0`） |
| 分类聚合 | 归入对应分类，`total` 贡献 0，`count` +1 |

### 2.3 交互提示（T-623）

- 弹窗内金额为 0 时，金额区下方显示一行灰色提示：
  「¥0 记录 · 例如别人请客，不计入金额统计」
- 快速记录（`QuickAddRecord`）同样允许 0

---

## 3. 改动清单

| 文件 | 改动 |
|---|---|
| `src/components/Accounting/AddRecordModal/AddRecordModal.tsx` | 校验放开 0；负数单独提示；0 元提示行；0 元不产生 `-0` |
| `src/components/Accounting/AddRecordModal/AddRecordModal.module.css` | 新增 `.zeroHint`（灰色居中小字） |
| `src/components/Accounting/QuickAddRecord/QuickAddRecord.tsx` | 允许 0；不产生 `-0` |
| `src/components/Accounting/RecordRow/RecordRow.tsx` | 0 元记录不显示正负号 |
| `src/lib/accounting/index.ts` | `isValidAmount` 允许 0 |
| `src/lib/accounting/accounting.test.ts` | 更新 `isValidAmount(0)` 期望 |
| `src/components/Accounting/AddRecordModal/AddRecordModal.test.tsx` | 新增：0 元保存 / 余额不变 / 统计不变 |

---

## 4. 验收标准

- [ ] 记一笔 → 输入 `0` → 「完成」可点，保存后列表出现 `¥0.00` 记录
- [ ] 未输入金额时「完成」仍为禁用态
- [ ] 输入负数（如 `0−5`）报错「金额不能为负数」
- [ ] 0 元记录不改变账户余额、不改变当日/当月收支合计
- [ ] 快速记录输入 0 可提交

---

*创建: 2026-10-22 · 用户需求「可以记录 0 元的记录，比如别人请客的情况」*
