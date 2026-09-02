# Changelog · Salary Timer v2.0

> **v2.0 独立 changelog 文件**。从本版本起，每个大版本单独建 `docs/CHANGELOG-vX.X.md`，不再全部堆到 `docs/CHANGELOG.md`。
>
> 历史变更（阶段 1 → v1.3）见 [`docs/CHANGELOG.md`](./CHANGELOG.md) 与 [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md)。

---

## [v2.0] · 2026-09-02 · 独立记账页（Accounting MVP）

> 配套文档：
> - [`docs/plans/tauri-migration/v2.0/ROADMAP.md`](./plans/tauri-migration/v2.0/ROADMAP.md) — v2.0–v2.5 路线图
> - [`docs/plans/tauri-migration/v2.0/task-033-v2.0-accounting-prd/IMPLEMENTATION-PHASES.md`](./plans/tauri-migration/v2.0/task-033-v2.0-accounting-prd/IMPLEMENTATION-PHASES.md) — 阶段拆分
> - [`docs/plans/tauri-migration/v2.0/task-033-v2.0-accounting-prd/task-033-v2.0-accounting-prd.html`](./plans/tauri-migration/v2.0/task-033-v2.0-accounting-prd/task-033-v2.0-accounting-prd.html) — 完整 PRD（视觉原型）

### Added · 独立记账页 `AccountingPage`

- **`src/pages/AccountingPage.tsx`（新建）**：完整记账页面，移动端独立 Tab「ACCT」，桌面端独立 Sidebar tab「记账」。与 `TodayPage` 完全解耦，骨架不变。
- **`src/components/Accounting/`（目录新建）**：所有记账组件统一收纳，包含：
  - `AccountingTopCard/` — 顶部深色大卡（月度结余/目标进度）
  - `SavingsQuote/` — 存钱主题引言（按天切换）
  - `QuickAddRecord/` — 快速记录条（一行输入 + 类型 + 提交）
  - `QuickAddRow/` — 左快速记录 / 右详细记录的并排卡
  - `AddRecordModal/` — 完整添加 / 编辑记录弹窗（金额 / 分类 / 备注 / 日期 / 账户）
  - `RecordActionSheet/` — 长按记录的 Action Sheet（编辑 / 删除）
  - `UncategorizedArea/` — 未分类记录区域（横向滚动卡，有则显示）
  - `CategoryFolderGrid/` — 分类文件夹网格（颜色沾满 / 拖动排序 / 新建）
  - `AddCategoryModal/` — 自定义分类弹窗（名称 / emoji / 颜色）
  - `CategoryDetailPanel/` — 分类详情面板（月度汇总 / 三统计 / 按天卡片列表）
  - `TodayRecordsList/` — 今日记录列表（v2.1 暂未挂载到 `AccountingPage`，代码就绪）

### Added · 记账数据层（`useAccountStore`）

- **`src/store/accountStore.ts`（新建）**：Zustand store + localStorage 持久化（key `salary_timer_accounting_v1`），模块化管理：
  - `accounts` — 账户（默认 支付宝 / 微信 / 银行卡）
  - `categories` — 分类（支出 9 类 + 收入 7 类）
  - `folders` — 分类文件夹（默认从支出前 6 类创建）
  - `records` — 记账记录（含 `isUncategorized` 标记）
  - `pools` / `cycles` — 池配置与周期（v2.3 启用，schema 已就绪）
  - `savingsGoals` — 存钱目标（v2.4 启用，schema 已就绪）
- **`src/lib/accounting/`（新建）**：纯函数 + 单测
  - `index.ts` — 金额聚合、日期/分类/月份聚合、池虚拟金额计算、排序、格式化、日期工具、校验
  - `accounting.test.ts` — 33 个单测，覆盖核心计算与边界 case

### Added · 类型扩展

- **`src/lib/types.ts`** — 新增：
  - `Account` / `AccountType` / `AccountRecord` / `RecordType`
  - `Category` / `Folder`
  - `PoolConfig` / `PoolType` / `PoolCycle` / `PoolCycleStatus` / `PoolTransaction` / `PoolTransactionStatus`
  - `SavingsGoal`
  - `AccountingState`
- **`src/lib/constants.ts`** — 新增：
  - `ACCOUNTING_KEY` — localStorage key
  - `ACCOUNT_TYPE_COLORS` — 4 种账户类型色板
  - `DEFAULT_EXPENSE_CATEGORIES`（9 类）/ `DEFAULT_INCOME_CATEGORIES`（7 类）
  - `ACCOUNTING_EMOJI_CHOICES` / `SAVINGS_GOAL_EMOJI_CHOICES` / `RECORD_SORT_OPTIONS`

### Changed · 记账页内交互行为（PRD 反馈驱动）

按用户对原型与现状的对比反馈修正：

- **快速记录不再默认归到「餐饮」**：
  - **`src/components/Accounting/QuickAddRecord/QuickAddRecord.tsx`** — 提交时设置 `isUncategorized: true`，记录直接落入「未分类」区域。详细记录按钮仍可指定分类保存。
- **手机端快速添加样式错位 / 宽度太大修复**：
  - **`QuickAddRecord.module.css`** — 输入区 + 类型切换 + 提交按钮全部缩小、紧凑布局，移动端 6px gap + 38px 高度；桌面端 10px gap + 44px 高度。`.inputWrap` 使用 `flex: 1 1 0; min-width: 0;` 防止溢出。
  - **`QuickAddRow.module.css`** — 移动端两卡改为纵向叠放（`grid-template-columns: 1fr`），避免横向溢出；桌面端仍并排（`1.45fr 1fr`），左卡稍宽。
- **「未分类」区域已可见**：
  - **`UncategorizedArea`** 本身已实现「有则显示 / 无则隐藏」逻辑（v2.0 起用户开始使用快速记录后会自然出现）。
- **分类文件夹颜色沾满背景**：
  - **`CategoryFolderGrid.module.css`** — 整张卡片用 `folder.color` 沾满背景，文字反白（带阴影保证可读），数量徽章也用主题强调色 `var(--accent)` 凸显。
- **分类文件夹可拖动排序 + 自定义添加**：
  - **`CategoryFolderGrid.tsx`** — HTML5 drag-and-drop（`draggable` / `dragstart` / `dragover` / `drop`），实时持久化到 `store.reorderFolders`。
  - **新增 `AddCategoryModal`** — 自定义分类：类型（支出/收入）+ 名称（最多 8 字）+ emoji（24 候选）+ 颜色（12 色板）+ 实时预览。提交时同时创建 `Category` + 对应 `Folder`。
- **该页面先不展示「今日记录」**：
  - **`AccountingPage.tsx`** — 移除了 `<TodayRecordsList />` 区块。组件代码保留供后续 v2.5 挂回或迁移到新页。

### Added · 分类详情面板（点开文件夹即看）

- **`src/components/Accounting/CategoryDetailPanel/`（新建）**：
  - **`CategoryDetailPanel.tsx`** — 从 `CategoryFolderGrid` 点击文件夹滑入的抽屉式面板（移动端从底部滑入，桌面端从右侧滑入）。
  - 顶部：分类图标 + 名称 + 月度总支出 + 「本月 N 笔 · 日均 ¥X」。
  - 三宫格统计：单笔最多（强调色）/ 日均 / 占总支出比例。
  - 按天分组的卡片列表：每张卡片显示 icon / 名称 / 时间 + 账户 / 金额；点击 → 打开 `AddRecordModal` 编辑。
  - Esc 键 / 点击遮罩 / 点 ‹ 按钮均可关闭。

### Changed · 路由 / 导航

- **`src/App.tsx`** — 桌面端 `DesktopSidebar` 与移动端 `BottomNav` 均已挂载 `accounting` tab（v2.0 上线前已就绪）。
- **`src/components/Sidebar/Sidebar.tsx` / `src/components/DesktopSidebar/DesktopSidebar.tsx`** — Tab 列表已含「记账」/「ACCT」入口。

### Changed · 类型字段补齐

- **`src/lib/types.ts`** — `AccountRecord` 新增 `isUncategorized?: boolean` 字段（用于识别「未分类」状态，区别于已分配分类的 `categoryId`）。
- **`src/store/accountStore.ts`** — `getUncategorizedRecords` 已支持 `isUncategorized=true || !categoryId` 两种情况识别。

### Changed · 文档与脚本

- **`docs/CHANGELOG.md`** — 版本索引表新增 v2.0 入口。
- **`docs/plans/tauri-migration/v2.0/ROADMAP.md`** — 已记录数据模型、阶段拆分（v2.0–v2.5）。

### 验收

- ✅ **TypeScript**：`npm run typecheck` 0 error
- ✅ **单测**：`npm run test` — **286 tests passed**（含 `src/lib/accounting/accounting.test.ts` 33 个新单测）
- ✅ **生产构建**：`npm run build` 成功（`dist/assets/index-*.js` 392 KB / 119 KB gzip）

### 后续（v2.1 → v2.5 顺序）

- v2.1 尾巴：「未分类」记录拖拽到分类文件夹完成归类（HTML5 拖拽 + drop handler，已有 folder 列表可接收）
- v2.2：统计三视图（日/月/年）+ 记账日历
- v2.3：池机制（均摊 / 存池 / 认领）
- v2.4：多账户 + 存钱目标
- v2.5：联调打磨 + 拖拽改期 + 动画 + 性能

---### Fixed · 分类创建与详情页返回体验（2026-09-03）

- **新增分类提交修复**：新建分类后同时创建对应分类文件夹，并立即显示在支出分类网格中；新增文件夹带有可定位标识，创建后自动平滑定位到该分类。
- **分类详情页改为覆盖式页面**：点击分类后在记账页上方打开独立详情页面，保留底层记账页 DOM，关闭后恢复进入详情前的滚动位置，包括从底部返回的场景。
- **详情页交互保持完整**：分类详情中的记录编辑、分类删除校验和返回操作继续可用。

### 验证

- `npm run typecheck` 通过
- `npm run test` 通过：6 个测试文件，286 个测试
- `npm run build` 通过

---

*最后更新：2026-09-03 · v2.0 记账页修复*