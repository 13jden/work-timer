# TASK-057 · 钱包模式开关(Phase 3)

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | 无 |
| **优先级** | P0(用户明确需求 ③) |
| **状态** | 🚧 进行中 |

> **方向变更(2026-10-14)**:初版计划是「取消钱包 · 总资产手动维护」,在 fea1fe8 提交后用户要求改为「钱包可开关」,默认关闭。下文反映最终设计。

---

## 1. 背景

多账户钱包对「只想记一笔」的用户是摩擦:记账选账户、拖拽归入、未归入红标、余额迁移;但对「分账户管钱」的用户是刚需。两种用户都要照顾。

**目标**:**钱包模式可开关**。
- **关闭(默认)**:UI 不展示任何账户归类;MinePage 顶部改为「总支出」;记录不显示关联账户;**记账记录照常保存**(保留 `accountId` 字段但不展示,数据可回滚);不出现拖拽归入 / 账户选择器。
- **开启**:沿用 v2.4 行为 —— 账户余额联动、记账选账户、拖拽归入、未归入红标;并**新增每账户详情页**,支持「快捷添加记录」改变账户余额。

切换 = 1 次点击;不删数据,只切 UI 形态。

## 2. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-571 | config 加 `walletEnabled` 开关 | `configStore.walletEnabled: boolean`,默认 `false`;持久化;迁移补默认 |
| T-572 | 总资产卡 ⚙ 按钮 | 替换现有重置图标;点击弹 WalletSwitchSheet |
| T-573 | WalletSwitchSheet 弹层 | 单选项:「开启钱包 / 关闭钱包」;切换提示副作用 |
| T-574 | UI 跟随开关隐藏账户 | RecordRow / AddRecordModal / StatsPage / CategoryDetailPanel / CategoryRecordsPage 根据 `walletEnabled` 条件渲染 |
| T-575 | MinePage 顶部双形态 | 关闭 → 「总支出」累计金额(Σ expense);开启 → v2.4 总资产卡 |
| T-576 | AccountDetailPage(每账户详情) | 入口:MinePage AccountRow 小卡(开启时);展示该账户记录 + 快捷添加 |
| T-577 | AddRecordModal 加 `defaultAccountId` | AccountDetailPage 调起时预填该账户 |

## 3. 详细设计

### 3.1 数据(T-571)

`configStore` 增加:

```ts
interface Config {
  // ... 已有
  /** v3.0 TASK-057：钱包模式开关。默认 false（关闭 = 不展示账户 UI） */
  walletEnabled?: boolean;
}
```

- 默认 `false`(用户 v3.0 首次进入即关闭)
- 持久化到 `STORAGE_KEY_V3`,迁移补默认
- 切换 = 实时生效(无 reload)

### 3.2 ⚙ 按钮(T-572)+ 弹层(T-573)

- 位置:TotalAssetsCard 标题行右侧(替代现有 `ArrowCounterClockwise` 重置按钮)
- 弹层 `WalletSwitchSheet`:单选项
  - 「开启钱包」:账户归入 / 余额联动 / 拖拽归入全部恢复;新增每账户详情页
  - 「关闭钱包」:UI 不展示账户归类;MinePage 顶部改为「总支出」;记录 `accountId` 字段保留但不展示
- 切换时弹确认(避免误触):「关闭钱包后,账户归入 / 余额联动等将不再展示,数据仍保留随时可恢复开启」
- 弹层样式:与其他 modal 一致(bottom sheet + overlay)

### 3.3 UI 改造清单(T-574)

| 位置 | 关闭时 | 开启时 |
|---|---|---|
| `RecordRow` 账户标签 | 不渲染 `<span class="acct">` | 渲染(v2.4 状态) |
| `AddRecordModal` 账户 select | 不渲染「账户」cell | 渲染(v2.4 状态) |
| `AddRecordModal` 默认 `accountId` | 第一项「未归入」 | 第一个 `accounts[0].id`(v2.4 状态) |
| `StatsPage` 日视图 | 普通 `<div>` 包记录,无 dnd 包裹 | `DndContext` + 拖拽归入(v2.4 状态) |
| `StatsPage` 拖拽时 `AccountDock` | 不渲染 | 渲染(v2.4 状态) |
| `CategoryDetailPanel` 副标题「时间 · 账户」 | 仅「时间」 | 含账户名 |
| `CategoryRecordsPage` 副标题「日期 · 账户」 | 仅「日期」 | 含账户名 |
| `MinePage` AccountRow | 不渲染 | 渲染(v2.4 状态) |

**实现方式**:每个组件读 `useConfigStore((s) => s.walletEnabled)`,在 JSX 中用条件渲染。

### 3.4 MinePage 顶部双形态(T-575)

| 模式 | label | 大数字 | 分解行 | 账户卡行 |
|---|---|---|---|---|
| 关闭 | `总支出` | Σ expense records 累计金额 | 不展示 | 不渲染 |
| 开启 | `总资产` | `virtualTotal` | chips(虚拟分解) | AccountRow |

- 关闭时不调用 `calcVirtualAssets`(避免无意义计算)
- 关闭时大数字 = `records.filter(r => r.type === 'expense' && r.poolStatus !== 'claimed').reduce((s, r) => s + Math.abs(r.amount), 0)`
  - 排除 `claimed`(认领付款预付不计入消费)
  - 池逐日均摊:支出池是实际消费记录(已 `r.amount < 0`),正常计入

### 3.5 AccountDetailPage(T-576)

**入口**:开启钱包时,MinePage AccountRow 横向小卡点击 → 进入全屏页

**结构**(对齐 CategoryRecordsPage 视觉):
```
┌──────────────────────────────┐
│ ‹  支付宝                      │
│                               │
│   ¥12,500                     │ ← 大数字余额
│   累计 N 笔                  │ ← 副标题
│                               │
│ ── 2026-09 ──────────────── │
│ 9月15日 · ¥120                │
│ 9月10日 · ¥500                │
│ ...                           │
│ ── 2026-08 ──────────────── │
│ ...                           │
│                               │
│      [+ 记一笔]               │ ← 快捷添加(打开 AddRecordModal,defaultAccountId=this)
└──────────────────────────────┘
```

- 路由:组件级 state(`<AccountDetailPage accountId="...">` 由 MinePage 控制)
- 数据:`records.filter(r => r.accountId === accountId).sort(...)`,按月分组
- 关闭钱包时:此页不可访问(入口不存在)
- 编辑记录:点击记录行 → 打开 AddRecordModal 编辑

### 3.6 AddRecordModal 加 `defaultAccountId`(T-577)

```ts
interface AddRecordModalProps {
  // ... 已有
  /** v3.0 TASK-057：钱包详情页快捷添加时预填账户 */
  defaultAccountId?: string;
}
```

- 优先级:`editingRecord.accountId` > `defaultAccountId` > `accounts[0]?.id`(开启时) / `''`(关闭时)

## 4. 新增 / 改动文件

| 文件 | 改动 |
|---|---|
| `src/lib/types.ts` | `Config.walletEnabled?: boolean` |
| `src/lib/constants.ts` | `DEFAULT_CONFIG.walletEnabled = false` |
| `src/store/configStore.ts` | `migrateToV3` 补 `walletEnabled` 默认值 |
| `src/components/Accounting/MinePage/WalletSwitchSheet/*` | **新增**:开关弹层 |
| `src/components/Accounting/MinePage/AccountDetailPage/*` | **新增**:每账户详情页 |
| `src/components/Accounting/MinePage/MinePage.tsx` | TotalAssetsCard 双形态 + ⚙ 按钮 + 详情页路由;AccountRow 入口接通 |
| `src/components/Accounting/RecordRow/RecordRow.tsx` | `walletEnabled` 隐藏账户标签 |
| `src/components/Accounting/AddRecordModal/AddRecordModal.tsx` | 隐藏账户 select + `defaultAccountId` prop |
| `src/components/Accounting/StatsPage/StatsPage.tsx` | 关闭时不渲染 `DndContext` + `AccountDock`;记录包 `<div>` 而非 `DraggableRecordRow` |
| `src/components/Accounting/CategoryDetailPanel/CategoryDetailPanel.tsx` | 副标题条件渲染 |
| `src/components/Accounting/CategoryRecordsPage/CategoryRecordsPage.tsx` | 副标题条件渲染 |

## 5. 验收标准

- [ ] 首次升级 v3.0:`walletEnabled` 默认 false;MinePage 顶部显示「总支出」;不展示账户卡
- [ ] 点 ⚙ → 弹层 → 选「开启钱包」→ 回到 MinePage 看到账户卡、虚拟分解;其他页面同步出现账户标签
- [ ] 关闭后:总资产卡 = Σ expense;记录行不显示账户;AddRecordModal 无账户 select;StatsPage 无拖拽 dock
- [ ] 开启时:点击账户小卡 → AccountDetailPage 全屏;展示该账户所有记录;点「+ 记一笔」打开 AddRecordModal,默认账户 = 该账户
- [ ] 切换不丢数据:`accounts` / `accountId` 字段保留
- [ ] 三套主题配色正确;桌面端布局不受影响
- [ ] typecheck / test / build 全绿 + 用户浏览器验收通过

## 6. 不做的事

- ❌ 多币种
- ❌ 钱包统计 / 余额趋势图(v3.1 backlog)
- ❌ 账户转账(从一个账户转到另一个)
- ❌ 修改现有组件样式(用条件渲染新增分支,不动稳定样式)
- ❌ 开关持久化的二次弹层(切换实时生效,无 reload)

---

*创建于 2026-10-09 · 方向调整为「钱包可开关」于 2026-10-14*
