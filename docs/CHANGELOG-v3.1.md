# Changelog · Salary Timer v3.1

> **v3.1 独立 changelog 文件**。基线分支 `feat/3.1`（自 v3.0 `main` @ `9d69b4c`）。
>
> 主题：**一程** —— 把「旅游记录」模块整体改造成一个人的旅行手账。
>
> 历史变更见 [`docs/CHANGELOG.md`](./CHANGELOG.md) 索引。

---

## [v3.1] · 2026-11-04 · 一程命名重写 + 列表/详情 UI 重设计 (TASK-063)

v3.0 把「消费块」做成了功能，但视觉仍是通用 App 风格：彩色渐变占位、卡片网格，
文案沿用「旅游记录」这个功能词。

v3.1 做一件事：**把「一程」当成一个人的旅行手账来做**。

```
命名 ── 「旅游记录」→「一程」，配套动词重写（启程 / 沿途 / 记一笔）
视觉 ── 护照页语言：纸感封面、邮戳、衬线大标题、等宽小字
结构 ── 列表 = 一张张封面卡；详情 = 头图 → 总账带 → 沿途流水
```

### A · 命名与文案全量重写

| 位置 | 旧 | 新 |
|---|---|---|
| 模块名 | 旅游记录 | 一程 |
| 列表眉标 | PASSPORT | ONE WAY |
| 列表统计行 | 2 段旅程 / 4 笔 / ¥273.00 | 2 程 · 4 笔 · 合计 ¥273.00 |
| 新建入口 | 开始一段新旅程 | 开始新的一程 |
| 空态标题 / 引导 | 还没有旅游记录 / 把一次旅行串成一个有故事的小册 | 还没有启程 / 把一次远行，走成一程 |
| 页脚 | EVERY TRIP DESERVES A LEDGER | 走过的路，都算数 |
| 详情主按钮 / 次按钮 | 给这段记一笔 / 关联其他 | 记一笔 / 关联旧账 |
| 记录区标题 | 记录 | 沿途 |
| 详情页脚 | — | END OF ONE WAY · {标题} |
| 备注区标题 | 备注 | 随记 |
| 新建 / 编辑弹窗 | 新建旅游记录 / 编辑旅游记录 | 新建一程 / 编辑一程 |
| 选择器 / 关联选择器 | 选择旅游记录 | 选择一程 |

代码里的 `journey*` 标识、数据模型、store 方法、图片管线全部不动。

### B · 签名元素：邮戳

双圈虚线 + 旋转 -9°，内容为「起始日期 + 支出/收入」，在**列表卡、详情头图、日分组**三处
共用同一套语言。其余元素保持安静，邮戳是页面上唯一的花活。

### C · 列表页重做

- 头部：小圆钮返回 + 居中「ONE WAY / 一程」+ 墨色圆钮新建
- 统计行：细线夹住「N 程 · N 笔 · 合计 ¥X」
- 封面卡：16:9 封面压衬线标题 + 角落邮戳 + 底部三项统计（笔数 / 支出·收入 / 日均）
- 尾部：虚线「开始新的一程」按钮 + mono 页脚「走过的路，都算数」
- 空态：邮戳形状的 `00/00` 印记 + 「还没有启程」

### D · 详情页重做

- 头图 300px：浮动圆钮（返回 / 编辑）+ 角落邮戳 + 「ONE WAY · 第 N 程」+ 衬线标题压图
- 总账带三栏：总支出 / 记录 / 旅途（细线分隔）
- 双按钮：「记一笔」（墨底）/「关联旧账」（描边）
- 沿途：按日分组，每组一个墨块日期章 + 虚线 + 当日小计
- 收尾：`END OF ONE WAY · {标题}`

### E · 无封面态

不再使用渐变色占位。改为「墨底 + 纸纹 + 标题首字」的印刷封面：

- 背景 `var(--ink)`，叠加 6% `var(--paper)` 的 45° 细纹
- 居中的标题首字，衬线大字，`var(--paper)` 12% 透明度
- 底部 mono 小字「没有封面的旅程」

### F · 修复与细节

- `ChevronRight` 在 `@phosphor-icons/react` 中不存在 → 改用 `CaretRight`
- 列表页卡片键盘交互：支持 `Space` 键打开（原先只有 `Enter`）
- 详情页金额为 0 的记录显示 `¥0.00`（不带正负号），与 v3.0 的 0 元记录语义对齐
- 详情页封面加载中（`useImage` status ≠ ok）时显示墨底态，避免空白头图

### G · 新增文件

- `docs/plans/tauri-migration/v3.1/ROADMAP.md`
- `docs/plans/tauri-migration/v3.1/TASK-063-v3.1-oneway-ui.md`
- `docs/CHANGELOG-v3.1.md`

### 涉及文件

| 文件 | 改动 |
|---|---|
| `src/components/Accounting/Journey/JourneyListPage.tsx` + `.module.css` | 重写 |
| `src/components/Accounting/Journey/JourneyDetailPage.tsx` + `.module.css` | 重写 |
| `src/components/Accounting/Journey/JourneySection.tsx` | 文案 + 入口卡对齐 |
| `src/components/Accounting/Journey/JourneyEditModal.tsx` | 文案 |
| `src/components/Accounting/Journey/JourneySelector.tsx` | 文案 |
| `src/components/Accounting/Journey/JourneyRecordPicker.tsx` | 文案 |
| `src/components/Accounting/AddRecordModal/AddRecordModal.tsx` | 字段名 + aria-label |
| `src/components/Accounting/Journey/JourneyDetailPage.test.tsx` | aria-label 同步 |

### 验证

- `npm run typecheck` 通过
- `npm run test` 466 / 466 通过
- `npm run build` 成功

---

## v3.1 · 2026-11-04 · 统计页汇总带重设计 (TASK-065)

统计页顶部原来是一张白卡（`--card`），夹在纸色页面里跟整体「护照页 / 手账」语言不搭；
卡片内的「列表 / 统计」切换沿用共用 `SegmentedControl`，在卡片底部显得松散。

**只改顶部汇总带，其他一律不动**：

- 去掉白卡底色 / 圆角 / 阴影，改为纸面直排 + 上下细线（和一程详情页「总账带」同一语言）
- 期间标签 / 范围 / 支出 / 收入 统一 mono 小字 + 大字距
- 金额改数字专用体（`--font-num`），支出 `--expense`、收入 `--income`，
  环比好/坏同色系（替代原先偏亮的 `--danger`）
- 「列表 / 统计」改为本地 `ModeSwitch`（墨底胶囊 + mono 字），不动共用 `SegmentedControl` 样式

同时分类排行改为**支出 / 收入 两套同时展示**（不再用「排行口径」切换器），点分类时带上所属口径。

**未改动**：列表展示（`GroupedRecordList` / `RecordRow`）、分类排行卡片样式、
柱状图卡片、日视图列表卡、页面级「日 / 月 / 年」切换。

验证：`npm run typecheck` / `npm run test`（470 / 470 通过）/ `npm run build` 全绿。

---

## v3.1 · 2026-11-04 · MINE 页布局重排 (TASK-064)

MINE 页原本是「总资产 → 结余目标大卡 → 一程 → 定期账列表」的纵向长列表，底部空一大块。

现在改成「总资产 → 并排两卡（一程 / 定期账）→ 结余目标行 + 隐藏计时模式行」，定期账列表挪进独立全屏页。

验证：`npm run typecheck` / `npm run test`（470 / 470 通过）/ `npm run build` 全绿。

---

*创建于 2026-11-04 · v3.1 一程 UI 重设计*
