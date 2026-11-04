# TASK-063 · 一程命名重写 + 列表/详情 UI 重设计

> 版本：v3.1 ・ 分支：`feat/3.1` ・ 状态：✅ 已完成
> 设计参考：[`design-preview/04-travel-list.html`](../../../../design-preview/04-travel-list.html)、[`design-preview/05-travel-detail.html`](../../../../design-preview/05-travel-detail.html)

---

## 1. 目标

把「旅游记录」模块整体改造成 **一程**：命名、文案、列表页、详情页全部重做，
视觉向「旅行手账 / 护照页」靠拢，但颜色与字体沿用项目现有 token（三主题可切换）。

**不改**：数据模型、store 方法、图片管线、记录关联逻辑、其它页面。

---

## 2. 设计规格

### 2.1 设计语言

| 维度 | 规格 |
|---|---|
| 底色 | `var(--paper)`；卡片 `var(--paper-3)`；分隔线 `var(--line)` |
| 正文 | `var(--ink)`；次要 `var(--muted)`；极弱 `var(--muted-2)` |
| 金额 | 支出 `var(--expense)`，收入 `var(--income)`，数字用 `var(--font-num)` + `tnum` |
| 标题 | `var(--font-display)`（衬线），字距 `0.06em ~ 0.12em` |
| 日期 / 眉标 / 计数 | `var(--font-mono)`，`letter-spacing: 0.16em ~ 0.26em`，大字距小字号 |
| 圆角 | 卡片 20px；按钮 12–15px；邮戳圆形 |
| 签名元素 | **邮戳**：双圈虚线 + 旋转 -9°，内容「起始日期 / 支出·收入」，列表卡、详情头图、日分组共用同一语言 |

### 2.2 列表页结构

```
[← 圆钮]      ONE WAY / 一程      [+ 圆钮]
────────  3 程 · 12 笔 · 合计 ¥1,284.00  ────────
┌───────────────────────────────┐
│  封面 16:9（无图 → 墨底大字）    │
│  标题（衬线 22px 压封面左下）      │
│  日期 10-06 → 10-06 · 1 天       │
│                     ⭕ 邮戳     │
├───────────────────────────────┤
│ 4 笔 │ −¥273.00 支出 │ 日均 ¥273 │ 〉│
└───────────────────────────────┘
        ┄┄┄ 开始新的一程 ┄┄┄
             走过的路，都算数
```

### 2.3 详情页结构

```
┌───────────────────────────────┐
│  头图 300px（← / 编辑 浮动圆钮） │
│  ONE WAY · 第 N 程              │
│  千岛湖（衬线 30px）             │
│  10-06 → 10-06 · 周二 · 1 天    │  ⭕邮戳
├───────────────────────────────┤
│ 总支出 ¥273.00 │ 记录 4 笔 │ 旅途 1 天 │
├───────────────────────────────┤
│ [ + 记一笔 ]  [ 关联旧账 ]        │
├───────────────────────────────┤
│ 沿途                       共 4 笔 │
│ ▮10/06 周二 ┄┄┄ 4 笔  −¥273.00     │
│  记录行 × 4                        │
│        END OF ONE WAY · 千岛湖     │
└───────────────────────────────┘
```

### 2.4 无封面态

不使用渐变色占位。改为「墨底 + 纸纹 + 衬线大字首字」的印刷封面：

- 背景 `var(--ink)`，叠加 6% `var(--paper)` 的 45° 细纹
- 居中的标题首字，衬线 96px，`var(--paper)` 12% 透明度
- 底部 mono 小字 `没有封面的旅程`

---

## 3. 文案（全量）

见 [`ROADMAP.md`](./ROADMAP.md#文案对照全文替换代码里的-journey-标识不动)。
实现时统一走下面这份常量表，避免散落：

`JourneyListPage`：`ONE WAY` / `一程` / `开始新的一程` / `还没有启程` / `把一次远行，走成一程` / `走过的路，都算数`

`JourneyDetailPage`：`ONE WAY` / `第 N 程` / `总支出` / `记录` / `旅途` / `记一笔` / `关联旧账` / `沿途` / `END OF ONE WAY · {标题}` / `随记`

`JourneySection`：`一程` / `{n} 程` / `把一次远行，走成一程` / `{n} 笔 · 最近 {MM-DD}`

`JourneyEditModal`：`新建一程` / `编辑一程` / `这一程叫什么` / `随记（可选）` / `启程` / `保存`

`JourneySelector`：`选择一程` / `还没有一程` / `去「我的 → 一程」开始第一程`

`AddRecordModal`：字段名 `一程`，`aria-label="移除一程"`

---

## 4. 验收清单

- [x] 列表页：封面卡 / 邮戳 / 三项统计 / 虚线新建按钮 / 页脚
- [x] 列表页空态
- [x] 详情页：头图 + 浮动圆钮 + 邮戳 + 三项统计带 + 双按钮 + 沿途分组 + 页脚
- [x] 无封面时墨底大字封面（列表 + 详情）
- [x] 详情页「记一笔」新建记录自动挂到本程
- [x] 点记录行 → 编辑弹窗，chip 显示「一程 · 标题」
- [x] 三主题（paper / obsidian / gold）下颜色正常
- [x] 桌面端（≥1024px）不溢出
- [x] `npm run typecheck` / `test` / `build` 全绿

---

## 5. 涉及文件

| 文件 | 改动 |
|---|---|
| `src/components/Accounting/Journey/JourneyListPage.tsx` | 重写 |
| `src/components/Accounting/Journey/JourneyListPage.module.css` | 重写 |
| `src/components/Accounting/Journey/JourneyDetailPage.tsx` | 重写 |
| `src/components/Accounting/Journey/JourneyDetailPage.module.css` | 重写 |
| `src/components/Accounting/Journey/JourneySection.tsx` + css | 文案 + 视觉对齐 |
| `src/components/Accounting/Journey/JourneyEditModal.tsx` | 文案 |
| `src/components/Accounting/Journey/JourneySelector.tsx` | 文案 |
| `src/components/Accounting/Journey/JourneyRecordPicker.tsx` | 文案 |
| `src/components/Accounting/AddRecordModal/AddRecordModal.tsx` | 字段名 + aria-label |
| `src/components/Accounting/Journey/JourneyDetailPage.test.tsx` | aria-label 同步 |

---

*创建于 2026-10-27*
