# TASK-030 · v1.3.4-patch3 右栏加宽到 1/3 + 撤销 patch2 居中(撑满整个页面)

> **状态**:✅ 已完成
> **依赖**:v1.3.4-patch2(`feat/v1.3.4-patch2-content-tightening`)
> **估时**:0.3 天
> **对应版本**:v1.3.4-patch3

## 目标

撤销 v1.3.4-patch2 的内容居中方向,改为:

1. **左栏 2/3**(主内容撑满,无 max-width 限制)
2. **右栏 1/3**(DesktopRightPanel 从 280px → 400px)
3. **整页不再大片空白**(用户明确反馈)

**核心约束**:零修改组件内部样式,只改外层布局容器。

## 用户反馈原文

> 不是啊,大哥,你恢复一下,我是说,右侧组件的比例,跟左侧比起来太小了,你懂吗。让你参考图片不参考比率?重新来,不要管prd 听我的,首先,首页左侧,占2/3,右侧占1/3. 看图片重新设计。然后,要沾满整个页面,不要大片空白

## 改动清单

### A · 撤销 patch2 的 max-width 居中

**`src/pages/TodayPage.module.css`** — 删除 4 个容器上的 `max-width: 560px; margin: 0 auto`:

| 容器 | patch2 | patch3 |
|---|---|---|
| `.timerWrap` | `max-width: 560px; margin: 0 auto` | 删除 |
| `.quoteWrap` | `max-width: 560px; margin: 0 auto` | 删除 |
| `.statsRow` | `max-width: 560px; margin: 0 auto clamp(8px,2vh,16px)` | 保留 `margin-bottom`,删 max-width |
| `.slackingWrap` | `max-width: 560px; margin-left: auto; margin-right: auto` | 删除两侧 auto,保留 `margin-top` |

效果:1440px 屏幕上,主内容区 ≈ 840px,撑满 2/3 列,无空白。

### B · DesktopRightPanel 280px → 400px

**`src/components/DesktopRightPanel/DesktopRightPanel.module.css`**:

```diff
.panel {
-  width: 280px;
-  min-width: 280px;
-  padding: 20px 16px;
+  width: 400px;
+  min-width: 400px;
+  padding: 20px 18px;
}
```

效果:右栏内宽 248px → 364px(**1.47×**),与左 840px 配合比 = 2.1 : 1(接近 2 : 1)。

### C · CalendarPage flex 2:1 配比

**`src/pages/CalendarPage.module.css`**:

```diff
- .pageInline .mainCol {
-   max-width: 900px;
- }
- .inlineSheet {
-   width: 360px;
-   min-width: 360px;
-   padding: 20px 16px 20px 12px;
- }
+ .mainCol {
+   flex: 2;
+ }
+ .inlineSheet {
+   flex: 1;
+   min-width: 400px;
+   max-width: 400px;
+   padding: 20px 18px 20px 14px;
+ }
```

- 用 `flex: 2` / `flex: 1` 强制 2:1 比例,不依赖宽度硬编码
- 去掉 `mainCol max-width: 900px`,让主内容自然填满 2/3
- `inlineSheet` 同步到 400px,DesktopRightPanel 视觉一致

## 1440px 桌面端布局对照

| 区域 | patch2 | patch3 |
|---|---|---|
| Sidebar(左) | 200px | 200px |
| Main col(中) | `max-width: 560px` 居中 + 两侧大空白 | **撑满 840px**,无空白 |
| Right panel(右) | 280px | **400px** |
| 中 : 右 比 | ≈ 0.6 : 1(右明显大) | **2.1 : 1**(符合 2/3 + 1/3) |

## 约束

- ✅ 零修改组件内部样式:`TimerCard / StatCard / QuoteCard / TimeTrackerWidget / BottomNav / DaySheet / MiniCalendar / ConvertPanel / DesktopSidebar / DesktopTopbar` 全部未动
- ✅ 仅改 3 个外层布局 CSS:`TodayPage.module.css` / `CalendarPage.module.css` / `DesktopRightPanel.module.css`
- ✅ 移动端(<1024px)完全无影响:`desktopShell` 在 ≤1023px `display: none`,这三个 CSS 只作用于桌面端

## 验证

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **200 passed**(零破坏)
- ✅ `npm run build`:**321 KB / gzip 97 KB**(零增量,纯 CSS 微调)

## 不在本 patch 范围

- TimerCard 在 840px 宽时内部数字水平居中优化(目前由 `justify-content: center` 兜底)
- 1440px 以下屏幕的进一步自适应(clamp 已覆盖)
- 右栏内容(MiniCalendar / TodayDetail / ConvertPanel)的视觉密度调整(若仍空可后续 spot-tweak)

## 出口

1. 写 `docs/CHANGELOG-v1.3.md` v1.3.4-patch3 段 ✅
2. 更新 `docs/CHANGELOG.md` 索引表 ✅
3. 更新 `AGENTS.md` 末行版本号 ✅
4. 提交:`feat(v1.3.4-patch3): revert patch2 centering, widen right panel to 1/3, fill 2/3 left`

---

*最后更新:2026-08-31 · v1.3.4-patch3 完成*
