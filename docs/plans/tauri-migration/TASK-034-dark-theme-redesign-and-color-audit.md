# TASK-034 · 暗色主题重设计 + 页面级组件主题色审计

| 字段 | 值 |
|---|---|
| **分支** | `v1.3.5-fix-bug` |
| **依赖** | TASK-009(主题系统) |
| **优先级** | P1 |
| **状态** | ✅ 已完成(2026-09-03,用户验收通过,随 v1.3.5 APK 发布) |

---

## 1. 背景与问题

用户反馈两个问题:

1. **首页计时器右上角光晕不跟随主题**:光晕硬编码为柠檬黄 `rgba(200, 255, 0, 0.18)`,切到香槟金等主题后仍是黄色。
2. **暗紫主题(现 obsidian「靛蓝」)显示不清楚、适配差**:紫色系对比度低,多处文字/边框在暗色下难以辨认。

要求:
- 检查页面级组件配色,尽量全部匹配主题变量;
- 重新设计一个暗色主题替代现有「暗紫」。

## 2. 根因(影响面排查结果)

### 2.1 硬编码主题色清单(需要修复)

| 位置 | 问题 |
|---|---|
| `TimerCard.module.css` `.card::before` | 光晕 `rgba(200,255,0,.18)` 写死柠檬黄 |
| `SettingsPage.module.css` `@keyframes savePulse` | 脉冲光圈 `rgba(200,255,0,*)` 写死 |
| `SettingsPage.module.css` `.templateModalBtn:hover` | accent 浅底 `rgba(200,255,0,.04)` 写死 |
| `DaySheet.module.css` `.modeChipActive` | accent 浅底写死;obsidian 覆盖又单独写死紫色 |
| `SlackingDetailPage.module.css` `.nightBadge` | 紫底 `rgba(124,111,247,.12)` 写死 |
| `SlackingDetailPage.module.css` `.popupRowTotal` / `.sumLabel` | paper 白 rgba 写死,暗色主题反转成浅底后近乎不可见 |
| `ItemSheet.module.css` `.input:focus` | focus 圈 `rgba(159,204,0,.15)` 写死 |
| `TimeTrackerWidget.module.css` `.actionBtnStart:hover` | `#1a1e26` 写死;obsidian 下浅底 + 暗 accent 文字对比度差 |

中性阴影/遮罩(黑、白低透明度)不属于主题色,保留不动。
`BottomNav` 深色 pill 为明确设计意图(注释声明不跟随主题),保留。
`CalendarPage` `[data-theme='paper'] .headTitle { color:#000 }` 为 paper 专属作用域,保留。

### 2.2 旧暗紫主题的问题

- 紫灰底色(#131320 / #1E1E30)色相干扰重,文字对比度不足;
- `--muted`(#7070A0)、`--ink-3`(#7070A0)在暗底上发糊;
- `--accent-deep`(#5A50D4)用于暗底卡片上的文字时过暗;
- `--line`(#2A2A45)与卡片底色过近,边框看不清;
- 缺 `--card-hover`。

## 3. 方案

### 3.1 新 token(tokens.css)

每套主题新增两个语义变量:

| token | 语义 |
|---|---|
| `--accent-glow` | 大面積径向光晕(低透明度) |
| `--accent-tint` | accent 浅底(chip/hover/badge 背景) |

### 3.2 新暗色主题「曜石青」(id 保持 `obsidian`,不破坏 localStorage)

设计方向:中性石墨底(去紫色相)+ 青色 accent,全面提高文字/边框对比度。

| token | 旧值(暗紫) | 新值(曜石青) |
|---|---|---|
| --ink | #E8E8F0 | #F2F4F8 |
| --ink-2 | #B0B0C8 | #C9D0DD |
| --ink-3 | #7070A0 | #9AA4B8 |
| --accent | #7C6FF7 | #2DD4BF |
| --accent-deep | #5A50D4 | #5EEAD4(暗底上需更亮才可读) |
| --accent-shadow | rgba(124,111,247,.30) | rgba(45,212,191,.35) |
| --paper | #131320 | #101318 |
| --paper-2 | #1C1C2E | #171B23 |
| --card | #1E1E30 | #1C212C |
| --card-hover | (缺失) | #242B38 |
| --line | #2A2A45 | #333C4D |
| --line-soft | #252540 | #262D3A |
| --muted | #7070A0 | #8E99AE |
| --muted-2 | #9090C0 | #B7C0D0 |
| --danger | #F76F7A | #FF7A82 |
| --faint | #4A4A6A | #4E586C |
| --surface-dark | #0E0E1A | #0B0E13 |

`constants.ts` 同步:`THEMES.obsidian` → `label: '曜石青'`、`accent: '#2DD4BF'`、`paper: '#101318'`。

### 3.3 组件修复

按 §2.1 清单逐项替换为主题变量;`SlackingDetailPage` 反转区块改用 `currentColor` / `var(--paper)` 自动适配;`TimeTrackerWidget` 增加 obsidian 覆盖(青底深字按钮)。

## 4. 验收标准

- [ ] 三主题下首页计时器光晕颜色随主题变化
- [ ] 设置页保存按钮脉冲、模板按钮 hover 随主题变化
- [ ] 新「曜石青」主题下各页面文字、边框、卡片清晰可辨
- [ ] localStorage 中已存 `obsidian` 的用户无缝升级,无需重选
- [ ] `npm run typecheck` / `npm run test` / `npm run build` 全绿
- [ ] 用户浏览器验收通过

## 5. 不做的事

- ❌ 不改主题 id / 不增删主题数量(保持 3 套)
- ❌ 不动 BottomNav 固定深色 pill 设计
- ❌ 不引入自定义主题功能
- ❌ 验收前不写 CHANGELOG、不提交终稿文档

---

*创建于 2026-09-03 · 完成于 2026-09-03 · 随 v1.3.5 APK 发布*
