# TASK-060 · 模式切换设置：记账纯净模式

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | TASK-059（一程）|
| **优先级** | P1（体验优化） |
| **状态** | 🚧 开发中 |

---

## 1. 背景

当前应用同时具备**计时模式**（Timer）和**记账模式**（Accounting），底部 nav 可在两者间切换。
但对于只需记账的用户，计时相关的入口、切换按钮、薪资同步提示都是噪音。

需要提供一个「记账纯净模式」设置：
- **UI 层面**：隐藏计时模式入口，记账成为唯一界面
- **功能层面**：薪资关联等后台同步逻辑继续运行（用户可能在未来重新启用计时模式）

---

## 2. 需求详情

### 2.1 功能定义

在记账模式的「设置」页新增开关：

```
[ ] 隐藏计时模式
    关闭后仅展示记账界面,计时功能保留但不可见
```

- **默认值**：`false`（两模式都可见，保持现有行为）
- **开启后行为**：
  - 底部 nav 不再显示计时/记账切换按钮
  - 应用启动直接进入记账模式（`/accounting`）
  - 薪资关联同步（`useSalaryLinkageSync`）、定期账每日同步等后台逻辑**继续运行**
  - 计时相关路由（`/timer`, `/calendar`, `/today`）不可访问（可返回 `/accounting`）

### 2.2 交互细节

- 设置项位置：记账模式「我的」→「设置」→「显示偏好」区块最上方
- 开关类型：Toggle 开关 + 灰色小字说明
- 修改即时生效：切换开关后直接隐藏/恢复计时模式入口，无需重启
- 若当前在计时模式页面且用户开启「隐藏」：自动跳转到 `/accounting`

### 2.3 存储层

新增配置字段：

```ts
// src/lib/types.ts
interface AppConfig {
  // ... 现有字段
  hideTimerMode?: boolean;  // true = 隐藏计时模式
}
```

存储位置：复用 `accountStore` 的 `config` 字段（记账模式的全局配置）

---

## 3. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-601 | 数据层 | `AppConfig.hideTimerMode?` + getter/setter + localStorage 持久化 |
| T-602 | BottomNav 条件渲染 | 当 `hideTimerMode` 为 `true` 时仅显示记账模式 tabs |
| T-603 | 路由守卫 | 访问计时路由时若隐藏模式开启则重定向至 `/accounting` |
| T-604 | 启动逻辑 | App 初始化时若隐藏模式开启则默认路由至 `/accounting` |
| T-605 | 设置页 UI | 新增「隐藏计时模式」开关 + 说明文案 |
| T-606 | 单测覆盖 | 配置读写 + 路由重定向逻辑 |

---

## 4. 详细设计

### 4.1 数据层（T-601）

```ts
// src/store/accountStore.ts
setHideTimerMode: (hide: boolean) => {
  set((state) => {
    state.config.hideTimerMode = hide;
  });
},

getHideTimerMode: (): boolean => {
  return get().config.hideTimerMode ?? false;
},
```

### 4.2 BottomNav 条件渲染（T-602）

```tsx
// src/components/Accounting/BottomNav.tsx
const hideTimerMode = useAccountStore(s => s.config.hideTimerMode);

// 如果隐藏计时模式,tabs 只保留记账相关
const tabs = hideTimerMode
  ? accountingTabs  // 仅记账模式的 tabs
  : [...timerTabs, ...accountingTabs];  // 完整 tabs
```

### 4.3 路由守卫（T-603）

```tsx
// src/App.tsx 或路由配置中
const hideTimerMode = useAccountStore(s => s.config.hideTimerMode);
const location = useLocation();

useEffect(() => {
  if (hideTimerMode && location.pathname.startsWith('/timer')) {
    navigate('/accounting', { replace: true });
  }
}, [hideTimerMode, location.pathname]);
```

### 4.4 启动逻辑（T-604）

```tsx
// src/App.tsx - 初始化路由时检查
const hideTimerMode = useAccountStore(s => s.config.hideTimerMode);

useEffect(() => {
  if (hideTimerMode && location.pathname === '/') {
    navigate('/accounting', { replace: true });
  }
}, []);
```

### 4.5 设置页 UI（T-605）

```tsx
// src/components/Accounting/MinePage/SettingsPage.tsx
<div className={styles.section}>
  <div className={styles.sectionTitle}>显示偏好</div>
  
  <div className={styles.settingRow}>
    <div className={styles.settingLabel}>
      <div>隐藏计时模式</div>
      <div className={styles.settingHint}>
        关闭后仅展示记账界面,计时功能保留但不可见
      </div>
    </div>
    <Toggle
      checked={hideTimerMode}
      onChange={(checked) => setHideTimerMode(checked)}
    />
  </div>
</div>
```

---

## 5. 验收标准

- [ ] 设置页新增「隐藏计时模式」开关,默认关闭
- [ ] 开启开关后:
  - [ ] 底部 nav 仅显示记账模式 tabs（首页/统计/我的）
  - [ ] 访问 `/timer`、`/calendar` 等计时路由自动跳转至 `/accounting`
  - [ ] 应用重启后进入 `/accounting`（而非计时模式首页）
  - [ ] 薪资关联同步继续在后台运行（检查 `useSalaryLinkageSync` 逻辑未受影响）
- [ ] 关闭开关后:
  - [ ] 底部 nav 恢复计时/记账两模式切换
  - [ ] 计时路由可正常访问
- [ ] 配置持久化（刷新页面后设置保持）
- [ ] typecheck / test / build 全绿 + 用户浏览器验收通过

---

## 6. 不做的事

- ❌ 完全卸载计时模式代码（保留全部功能,只是隐藏入口）
- ❌ 反向「隐藏记账模式」（当前产品定位以记账为主）
- ❌ 复杂的权限控制或多用户配置

---

*创建于 2026-10-21 · 状态：开发中*
