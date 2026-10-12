# TASK-057 · 取消钱包 · 总资产直接改（Phase 3）

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | 无（建议在 TASK-055 之后，避免统计页二次改动） |
| **优先级** | P0（用户明确需求 ③） |
| **状态** | ⏳ 待开发 |

---

## 1. 背景

多账户钱包对「只想记一笔」的用户是摩擦：记账选账户、拖拽归入、未归入红标、余额迁移。用户心里的资产只有一个数——**我总共有多少钱**。

**目标**：
1. 移除账户关联（账户选择 / 拖拽归入 / 未归入状态全部下线）
2. 总资产变成**用户手动维护的单一数字**，点按即可修改
3. 修改总资产支持 **± 表达式计算**（与记账金额输入同一套逻辑），每次修改留痕

**立场**：记账记录**不再自动改动总资产**。流水负责「钱去哪了」，总资产负责「我现在有多少」，两者解耦（见 PRD §09 Q2，待用户最终确认）。

## 2. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-571 | assets 状态 + 迁移 | accountStore 新增 `assets { totalAssets, updatedAt }` + `migratedV3` 标记；rehydrate 一次性迁移 |
| T-572 | 资产计算器 Sheet | 点总资产卡打开：± 表达式输入 + 实时预览 + 备注 + 保存 |
| T-573 | 调整历史 | `AssetSnapshot[]`（上限 200）+ 历史弹层（时间 / 前后值 / 备注），预留趋势图数据源 |
| T-574 | 账户 UI 下线 | 移除账户选择器 / AccountRow / AddAccountModal / 拖拽归入 / AccountDock / 未归入标记 |
| T-575 | 虚拟资产口径改写 | `calcVirtualAssets` 的 actualTotal 改读手动总资产；移除账户口径的 pendingAdjust |
| T-576 | 记录 accountId 冻结 | 新记录恒 `accountId=''`；`recordAffectsBalance` 恒 false；旧字段保留兼容 |

## 3. 详细设计

### 3.1 数据与迁移（T-571）

```ts
interface AssetsState { totalAssets: number; updatedAt: number }
interface AssetSnapshot {
  id: string; before: number; after: number; delta: number;
  note?: string; createdAt: number;
}
```

迁移规则（`onRehydrateStorage` / store 初始化，幂等）：

```
if !state.migratedV3:
  totalAssets = Σ accounts[].balance          // 无账户则 0
  assets = { totalAssets, updatedAt: now }
  migratedV3 = true
  （accounts 数据保留只读存档，不删除 —— 可回滚）
```

### 3.2 资产计算器（T-572）

- 触发：总资产卡整体可点（右上角「✎」提示）；原「重置资产」入口移入计算器内（「清零」快捷）
- 输入规则（与记账金额同一套数字键盘 / 系统键盘）：

```ts
/** 解析 ± 表达式。合法：'13000' '+500' '-200' '12500+500-200' '+1,200.5'
 *  返回 { mode: 'absolute' | 'delta', value }；非法返回 null
 *  absolute：直接作为新总额；delta：新总额 = 当前 + value */
parseAssetExpression(input: string): { mode: 'absolute' | 'delta'; value: number } | null
```

- 实时预览行：`当前 +¥12,500 → 调整后 +¥13,000`（表达式合法才显示）
- 备注输入（可选，placeholder「工资到账 / 交完房租…」）
- 保存 → 更新 `assets` + 追加 snapshot；空表达式 / 结果与当前一致时保存按钮禁用

### 3.3 账户 UI 下线清单（T-574）

| 位置 | 处理 |
|---|---|
| MinePage `AccountRow` / `AddAccountModal` | 移除渲染与文件 |
| MinePage 总资产卡 | 重写：大数字 + 分解 chips + 「点我调整」提示（新布局见 PRD §04-③） |
| AddRecordModal 账户选择器 | 移除；新记录 `accountId=''` |
| StatsPage 日视图 DndContext / AccountDock / DragRecordCard | 移除；记录行保留点击编辑 |
| 记录行账户标签 / 「未归入」红标 | 移除 |
| QuickAddRecord 默认账户逻辑 | 移除 |
| `recordAffectsBalance` | 恒 false（函数保留一个版本以便回滚，内部直接 return false） |

### 3.4 虚拟资产口径（T-575）

```
virtualTotal = assets.totalAssets                    // 手动值，替代原 actualTotal 账户求和
             + depositRefundable + prepaidUnconsumed + earnedUnarrived
             − unpaidConsumed − depositPending
```

- 原「未分类调整项 pendingAdjust」（accountId='' 记录与账户余额的差）概念**整体移除**——记录不再与资产对账
- 四个定期账分解项（待退 / 待付 / 预付未消耗 / 已赚未到账）计算逻辑不变
- `virtual.test.ts` 存量用例按新口径重写基线，新增「手动总资产 ± 分解项」用例

### 3.5 安全网（建议，见 PRD §09 Q5）

迁移前提供一次性「导出旧账户余额 + 记录表 CSV」入口（总资产卡菜单内，迁移完成后保留 30 天或直接常驻到 v3.1 正式导出功能）。若用户评审认为不需要可砍。

## 4. 新增 / 改动文件

| 文件 | 改动 |
|---|---|
| `src/lib/types.ts` | `AssetsState` / `AssetSnapshot`；AccountRecord.accountId 注释更新 |
| `src/lib/accounting/assetExpr.ts` + 单测 | 新增：`parseAssetExpression` |
| `src/lib/accounting/virtual.ts` + 单测 | actualTotal 入参改为手动总资产；口径用例重写 |
| `src/store/accountStore.ts` + 单测 | assets / snapshots / migrateV3 / setTotalAssets；recordAffectsBalance 冻结 |
| `src/components/Accounting/MinePage/*` | 总资产卡重写；移除 AccountRow / AddAccountModal |
| `src/components/Accounting/AssetSheet/*` | 新增：资产计算器 |
| `src/components/Accounting/AssetHistorySheet/*` | 新增：调整历史 |
| `src/components/Accounting/AddRecordModal/*` | 移除账户选择器 |
| `src/components/Accounting/StatsPage/*` | 移除 dnd 归入账户相关 |
| `src/components/Accounting/QuickAddRecord/*`、`TodayRecordsList/*` | 移除账户标签展示 |

## 5. 验收标准

- [ ] 升级后总资产 = 原各账户余额之和，迁移只发生一次（刷新不重复）
- [ ] 点总资产卡打开计算器：`+500` / `-200` / `13000` / `12500+500-200` 均正确，非法输入无预览且不可保存
- [ ] 保存后总资产更新、历史新增一条（含备注）；历史弹层按时间倒序
- [ ] 记账弹窗无账户选项；新记录不再影响任何余额；统计页无拖拽归入
- [ ] 总资产分解 chips（待退 / 待付 / 预付未消耗 / 已赚未到账）在有定期账数据时仍正确
- [ ] 旧账户数据仍在 localStorage（只读存档，可回滚验证）
- [ ] 三套主题配色正确；桌面端布局不受影响
- [ ] typecheck / test / build 全绿 + 用户浏览器验收通过

## 6. 不做的事

- ❌ 资产趋势图（v3.1，数据已备好）
- ❌ 多币种
- ❌ 删除 Account 存量数据（保留存档以便回滚）

---

*创建于 2026-10-09 · 状态：待开发*
