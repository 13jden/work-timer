# TASK-037 · 移动端双主题框架(计时/记账)+ 上下滑切换 + 分类删除确认

| 字段 | 值 |
|---|---|
| **分支** | `feat/v2.1-mobile` |
| **依赖** | v2.0 记账 MVP |
| **优先级** | P0 |
| **状态** | ✅ 已完成(2026-09-03,用户验收通过) |

---

## 1. 背景

v2.0 给 App 增加了记账能力,但移动端仍是单主题 5 tab。用户要求:

- 移动端拆成**两个主题**:计时主题(原 4 页)与记账主题(4 页,当前仅 ACCT 实现,其余 2.2–2.4 补)
- 两个主题**都是 4 个底部导航**
- **上下滑切换主题**:下滑 → 记账主题;上滑 → 计时主题
- **tab 索引对应**:在哪个位置切换,就落到另一个主题的同一位置(today ↔ ACCT 都是第 1 个)
- 分类详情页删除:文字按钮改 **×**,点击弹**应用内确认弹窗**,确认才删

## 2. 设计

### 2.1 导航结构

| 索引 | 计时主题 | 记账主题 |
|---|---|---|
| 0 | TODAY(TodayPage) | ACCT(AccountingPage) |
| 1 | MONTH(CalendarPage) | STATS(占位,v2.2) |
| 2 | FISH(FishPage) | CAL(占位,v2.3) |
| 3 | MINE(SettingsPage) | MINE(占位,v2.4) |

- 计时主题移除原 ACCT tab(记账入口改由滑动进入)
- `tabIndex` 单一状态,主题切换时索引不变

### 2.2 主题切换手势

- 移动端根容器 `onTouchStart/onTouchEnd` 记录位移 + 时长
- **flick 判定**:`dt < 350ms` 且 `|dy| > 70` 且 `|dy| > 2|dx|`
  - dy > 0(下滑)→ 记账主题
  - dy < 0(上滑)→ 计时主题
- 用速度阈值避免与列表滚动冲突;桌面端不启用

### 2.3 状态

- 新增 `src/store/appModeStore.ts`:`mode: 'timer' | 'accounting'` + `setMode`(不 persist,启动默认计时)

### 2.4 占位页

- 新增 `src/components/PlaceholderPage/`:居中图标 + 标题 + 「v2.x 规划中」提示,纯主题变量

### 2.5 分类删除确认

- `CategoryDetailPanel` 头部「删除」文字 → Phosphor `X` 图标按钮
- 点击 → 应用内居中确认弹窗(取消 / 删除,删除用 `--danger`)
- 替换 `window.confirm`(原生弹窗移动端体验差)
- 仍保留「有记录不可删」前置条件

## 3. 改动文件

| 文件 | 改动 |
|---|---|
| `src/store/appModeStore.ts` | 新增 |
| `src/components/PlaceholderPage/*` | 新增 |
| `src/App.tsx` | 移动端双主题渲染 + tabIndex + 滑动手势 |
| `src/components/BottomNav/BottomNav.tsx` | 改为通用 tabs props(样式不动) |
| `src/components/NavIcons.tsx` | 新增 acct-stats / acct-cal / acct-mine 图标 |
| `CategoryDetailPanel.tsx/.module.css` | × 按钮 + 确认弹窗 |

## 4. 验收标准

- [ ] 计时主题 4 tab、记账主题 4 tab,样式与原 dock 一致
- [ ] 下滑进记账、上滑回计时;在第 N 个 tab 切换后落在对方第 N 个
- [ ] 占位页显示规划版本提示,不崩不白屏
- [ ] 列表正常滚动不被手势误触发(快速 flick 才切换)
- [ ] 分类详情 × → 确认弹窗 → 确认后删除;取消不删
- [ ] 桌面端布局不受影响
- [ ] typecheck / test / build 全绿 + 用户浏览器验收

## 5. 不做的事

- ❌ 记账其余三页功能(v2.2–v2.4)
- ❌ 主题切换动画(后续打磨)
- ❌ mode 持久化

---

*创建于 2026-09-03 · 状态:开发中*
