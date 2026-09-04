# TASK-043 · 编辑模式池关联可编辑（v2.5-fixbug）

| 字段 | 值 |
|---|---|
| **分支** | `fix/v2.5-fixbug`（基于 `origin/main`） |
| **所属版本** | v2.5 patch |
| **依赖** | v2.4 T-410（池自动退休 + 记录周期快照） |
| **优先级** | P1 |
| **状态** | ⏳ 开发中 |

---

## 1. 背景

v2.3 E 段原文：`AddRecordModal` 新增「池关联(认领)」下拉（支出→全部池,收入→仅存池型），保存后自动认领。该设计原本预期**添加和修改记录时**都能设置关联池。

v2.4 G 段加 T-410 后，编辑模式下的池关联 UI 被改为**纯只读**（展示周期快照、实际关联时间/金额），目的是"池自动退休后靠快照溯源"。但代价是：

1. 编辑均摊记录 / 已认领记录 / 已确认记录时**没有任何入口修改池关联**
2. 一条已认领记录若想**切到别的池**或**解绑重绑**，必须删了重建
3. `retireFinishedPools` 删除池后，`pools.find()` 找不到，编辑时显示「未知池」（`AddRecordModal.tsx` line 339、349）也无入口处理

## 2. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-431 | store 加 `unclaimToPool` action | 解除记录池关联，按 poolStatus 分三种回退（均摊付款回退 paidAmount / 存池移除 transaction / 每日均摊仅清 recordId 防重生），同时清空记录上所有池字段（poolId/poolStatus/poolDirection/poolName/poolCycleStart/End/Total/poolSettledAt/Amount） |
| T-432 | `updateRecord` patch 支持 `poolId: undefined` 显式解绑 | 当前泛用 patch 已能改 poolId，但**仅修改字段不回退池业务**（cycles[].paidAmount 等）。不直接复用 updateRecord 处理池逻辑；改由 UI 层协调：先调 `unclaimToPool`，再调 `updateRecord` 写其他字段，最后视情况 `claimToPool` 到新池 |
| T-433 | `AddRecordModal` 编辑模式池关联改下拉 | 删除"只读池信息"分支，统一为下拉（添加 + 编辑共用同一段）。编辑模式初始 `poolId = editingRecord.poolId ?? ''`；切换/解除时通过 `unclaimToPool` + 可选 `claimToPool` 完成 |
| T-434 | 已退休池选项保留 | 编辑模式下若 `editingRecord.poolId` 不在 `claimablePools`（已退休），选项里追加一项「{poolName}（已退休）」，让用户可保留现状或解除 |
| T-435 | 单测覆盖 | `unclaimToPool` 三分支（均摊付款 / 存池 / 每日均摊）+ 切换池场景（解绑 + 绑到新池）+ 编辑模式残留池字段清空断言 |

## 3. 关键设计点

### 3.1 `unclaimToPool` 行为对齐 `deleteRecord`

`deleteRecord` 已经处理了"删除带池关联记录"的回退逻辑，`unclaimToPool` 复用同样的三分支处理，**只**是不真正删除记录，最后再清空记录的池字段。

```ts
unclaimToPool: (recordId: string) => number  // 返回解除的金额（对称 claimToPool）
```

### 3.2 编辑模式 UI 协调顺序

```ts
// 伪代码
if (editingRecord) {
  updateRecord(editingRecord.id, { amount, type, categoryId, note, dateKey, accountId, goalId, isUncategorized: false });
  if (oldPoolId !== newPoolId) {
    if (oldPoolId) unclaimToPool(editingRecord.id);
    if (newPoolId) claimToPool(editingRecord.id, newPoolId);
  }
}
```

**为什么用三步而非一步合并**：claimToPool 内部对 `record.poolStatus` 有早期返回（`if (record.poolStatus) return 0`），必须先 unclaim 再 claim 才能切换到新池。

### 3.3 已退休池不复活

按用户对齐结果：「不复活已退休池」。仅在编辑模式当前记录池被退休时，下拉里追加「{poolName}（已退休）」占位项供保留/解除；不允许新建认领到已退休池。

## 4. 验收标准

- [ ] 编辑均摊记录：可选择「不关联」解除（paidAmount 回退）；可切到别的池
- [ ] 编辑已认领记录：同上加 cycle 状态回退正确
- [ ] 编辑已确认记录（存池型）：可解除（对应 transaction 移除）；可切池
- [ ] 编辑普通记录（无 poolId）：可新增池关联（同添加模式）
- [ ] 已退休池的记录编辑：下拉显示「已退休」标记，可解除或保留
- [ ] typecheck / test / build 全绿（目标 +N 条单测）

## 5. 不做的事

- ❌ 已退休池的复活（不允许新建认领到已退休池）
- ❌ 自动迁移均摊记录池（cycle 变化不动旧均摊记录）
- ❌ 编辑模式 UI 大改（保留现有字段顺序、按钮位置、删除按钮）

---

*创建于 2026-09-04 · fix/v2.5-fixbug*