# Changelog · Salary Timer v2.1

> **v2.1 独立 changelog 文件**。基线分支 `feat/v2.1-mobile`(自 `v2.0-mobile`)。
>
> 历史变更见 [`docs/CHANGELOG.md`](./CHANGELOG.md) 索引。

---

## [v2.1] · 2026-09-03 · 线稿图标 + 移动端双主题框架

### A · TASK-036 · 记账图标系统升级(emoji → Phosphor thin/light)

- **新增 `src/components/IconByKey/`**:key → Phosphor 线稿图标统一渲染层(65 个图标、8 组清单);未命中 key 回退渲染原 emoji,老 localStorage 数据无缝兼容
- **`src/lib/constants.ts`**:默认收支分类 icon 由 emoji 换为 icon key(餐饮→刀叉、交通→巴士、工资→钱包、兼职→递钱手等)
- **展示处替换**:`CategoryFolderGrid` 文件夹图标、`CategoryDetailPanel` 大图标/记录卡、`AddRecordModal` 分类 chip、`TodayRecordsList` 记录行,颜色显式控制(彩底白线稿 / 浅底分类色线稿)
- **`AddCategoryModal`**:emoji 九宫格 → 分组线稿 picker(餐饮/出行/购物/娱乐/居家/健康成长/钱财工作/其他),预览卡同步线稿白图标

### B · TASK-037 · 移动端双主题框架 + 上下滑切换

- **新增 `src/store/appModeStore.ts`**:`mode: 'timer' | 'accounting'`,启动默认计时
- **`src/App.tsx`**:移动端拆双主题各 4 tab,索引一一对应(TODAY↔ACCT / MONTH↔STATS / FISH↔CAL / MINE↔MINE);计时主题移除 ACCT tab
- **上下滑切换**:下滑 → 记账主题,上滑 → 计时主题;flick 判定(<350ms、纵向 >70px 且 >2 倍横向)避免与列表滚动冲突;桌面端不启用
- **`BottomNav` 改通用 tabs props**(样式不变);`NavIcons` 新增 acct-stats / acct-cal / acct-mine 线稿图标
- **新增 `PlaceholderPage`**:STATS(v2.2)/ CAL(v2.3)/ MINE(v2.4) 占位页
- **分类删除确认**:`CategoryDetailPanel` 删除文字按钮 → × 图标 + 应用内确认弹窗(取消/删除),替代 `window.confirm`

### C · 快速记录布局调整

- **`QuickAddRow`**:快速记录暗色卡占满整行;「详细」按钮内嵌记录条右侧(`QuickAddRecord onOpenFull`),移除独立「FULL · 详细记录」白卡及废弃样式

### 验证

- typecheck 0 错误、286 单测全过、build 成功
- 用户浏览器验收通过(2026-09-03)

---

*创建于 2026-09-03*
