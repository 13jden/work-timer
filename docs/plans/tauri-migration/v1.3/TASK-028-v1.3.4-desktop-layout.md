# TASK-028 · v1.3.4 桌面端三栏布局重构

> **状态**:⏳ 待开始
> **依赖**:v1.3.3 主线(`feat/v1.3.3-icons-and-slacking`)
> **估时**:1.5 天
> **对应版本**:v1.3.4
> **PRD**:[`./task-028-desktop-layout.html`](./task-028-desktop-layout.html)

## 目标

把 Salary Timer 桌面端从"侧栏 + 单页（永远显示今日）"升级为完整的**三栏仪表盘**布局：

```
┌──────────────────────────────────────────────────────────┐
│ ┌────┐  ┌─────────────────────────────�  ┌─────────────┐ │
│ │ 左 │  │  中间主内容                   │  │  右侧上下文 │ │
│ │ 侧 │  │  · 今日:大计时器 + 2×2 净工时 │  │  · 迷你日历 │ │
│ │ 导 │  │    + 时间记录 Widget          │  │  · 今日详情 │ │
│ │ 航 │  │  · 日历:月历 + DaySheet 分栏  │  │  · 等价换算 │ │
│ │    │  │                             │  │             │ │
│ │ 可 │  │  ┌─ Topbar(齿轮 → 设置抽屉)─┐│  │             │ │
│ │ 收 │  │  └─────────────────────────┘│  │             │ │
│ │ 起 │  │                             │  │             │ │
│ └────┘  └─────────────────────────────┘  └─────────────� │
└──────────────────────────────────────────────────────────┘
```

**核心原则**：**不修改任何现有组件内部样式和逻辑**，只通过外层布局容器重新排布。

## 设计原则

| # | 原则 | 说明 |
|---|---|---|
| P1 | 共用组件,只改布局 | TimerCard / StatCard / QuoteCard / DaySheet / TimeTrackerWidget 全部复用 |
| P2 | 左栏可收起 | 200px 展开 / 56px 收起,状态持久化到 localStorage |
| P3 | 右栏上下文跟随 | 跟随当前页面切换内容,减少弹窗和页面跳转 |
| P4 | 断点 1024px | ≥1024 三栏,<1024 退回移动端 BottomNav 模式 |
| P5 | 设置上移齿轮 | 不占 tab,右上角抽屉 |

## 改动清单

### A · 新建组件(纯新增,不动现有)

| 组件 | 路径 | 用途 |
|---|---|---|
| `DesktopSidebar` | `src/components/DesktopSidebar/` | 左侧导航(可收起),替换 `Sidebar` 在桌面端的使用 |
| `DesktopTopbar` | `src/components/DesktopTopbar/` | 顶部栏(主题切换 + 齿轮入口) |
| `DesktopRightPanel` | `src/components/DesktopRightPanel/` | 右栏容器,根据 page 渲染对应内容 |
| `SettingsDrawer` | `src/components/SettingsDrawer/` | 包一层抽屉外壳,内部直接渲染 `<SettingsPage />` 内容 |
| `MiniCalendar` | `src/components/MiniCalendar/` | 当月迷你月历(右栏用) |
| `ConvertPanel` | `src/components/ConvertPanel/` | 从 `ConvertPage` 抽取的物品列表子组件 |

### B · 改造现有组件

| 文件 | 改动 |
|---|---|
| `src/App.tsx` | 桌面端路由重构:`isDesktop` 分支使用 `DesktopSidebar + Topbar + 主内容 + DesktopRightPanel + SettingsDrawer` |
| `src/pages/ConvertPage.tsx` | 内部列表渲染提取为 `<ConvertPanel items={items} />`,保持移动端 tab 可用 |
| `src/components/Sidebar/` | **保留不动**(移动端仍用),但桌面端改用 `DesktopSidebar` |
| 其他组件 | **零改动**(TimerCard / StatCard / QuoteCard / DaySheet / TimeTrackerWidget / BottomNav 全部保持) |

### C · 新增 store / hook

| 文件 | 用途 |
|---|---|
| `src/hooks/useLocalStorageState.ts`(新建) | 通用 localStorage 同步 state(用于 sidebarCollapsed) |
| `src/store/sidebarStore.ts`(新建) | `sidebarCollapsed: boolean`,持久化 key `salary_timer_sidebar_collapsed_v1` |

### D · 断点策略

```css
/* ≥ 1024px: 桌面端三栏布局 */
@media (min-width: 1024px) {
  .app-desktop { display: grid; grid-template-columns: var(--sidebar-w) 1fr var(--rightpanel-w); }
  .bottom-nav { display: none; }
}

/* < 1024px: 移动端单列布局 */
@media (max-width: 1023px) {
  .desktop-shell { display: none; }
  .bottom-nav { display: flex; }
}
```

### E · 各页面右栏内容

| 页面 | 右栏内容 |
|---|---|
| `today` | MiniCalendar + 今日详情 + ConvertPanel(Top 5 + 查看全部) |
| `calendar` | DaySheet(inline,无 modal 外壳) |

### F · 设置抽屉

- 右上角齿轮 → 右侧滑出
- 抽屉内**完整复用** `SettingsPage` 的渲染逻辑,仅去掉外层 page wrapper
- 遮罩 + ESC 关闭
- 打开时 `document.body` overflow hidden

## 约束

- ✅ **不动现有组件样式 / 逻辑**(TimerCard / StatCard / QuoteCard / BottomNav / DaySheet / TimeTrackerWidget / SettingsPage / ConvertPage 内部均不改)
- ✅ **不引入新依赖**(只用现有 `lucide-react` / `@phosphor-icons/react`)
- ✅ **新增组件单独建目录**,每个目录 `index.ts + 组件名.tsx + 组件名.module.css`
- ✅ **桌面端样式用新 token**,不动全局 `tokens.css`
- ✅ 桌面端 `<1024px` 视口不显示,移动端不受影响

## 验证

### 自动化

- [ ] `npm run typecheck` 0 errors
- [ ] `npm run test` 全通过(不破坏现有 compute.test)
- [ ] `npm run build` 成功,dist 增量 < 15KB

### 手工验收(对应 PRD §9)

- [ ] **断点**:≥1024 三栏布局,<1024 回退到移动端 BottomNav 正常
- [ ] **左栏收起**:点折叠按钮 → 56px 图标栏;刷新页面状态保持
- [ ] **今日仪表盘**:大 TimerCard + QuoteCard/咖啡卡 + 净工时 2×2 + TimeTrackerWidget,数据实时
- [ ] **今日右栏**:MiniCalendar 当天高亮 / 今日详情同步 / 换算面板 Top 5 + 查看全部
- [ ] **日历分栏**:点日历某天 → 右栏显示对应 DaySheet;编辑保存 → 日历格状态实时更新
- [ ] **设置抽屉**:齿轮点开 → 抽屉滑出 → 完整设置项可用 → 保存即时生效
- [ ] **组件零修改**:TimerCard / StatCard / DaySheet 等核心组件 `git diff` 均为空

## 出口

1. 切换到最终验收:运行 typecheck + test + build
2. 写 `docs/CHANGELOG-v1.3.md` v1.3.4 段
3. 在 `docs/CHANGELOG.md` 索引表追加 v1.3.4 行
4. 更新 `AGENTS.md` 末行版本号
5. 提交:`feat(v1.3.4): desktop three-column layout (sidebar/topbar/rightpanel/settings-drawer)`

## 详细任务分解(执行顺序)

1. **基础设施**:`useLocalStorageState` + `sidebarStore`
2. **桌面端新组件**:`DesktopSidebar` → `DesktopTopbar` → `MiniCalendar` → `ConvertPanel` → `SettingsDrawer` → `DesktopRightPanel`
3. **App.tsx 桌面端路由重构**
4. **CSS 断点接入**
5. **手工验收 8 条**

---

*最后更新:2026-08-30 · v1.3.4 启动*
