# Refactor Roadmap · Salary Timer

> 本文件定义从"HTML + Capacitor"到"Tauri + React 多端"的**完整重构路线**。
> 每个阶段有明确的**入口 / 出口标准**,任何 Agent 接手都能立刻知道当前在哪、接下来做什么。

---

## 总览

```
[阶段 0] 当前:HTML + Capacitor(可工作)
   ↓
[阶段 1] React + TS + Vite 重写(纯 Web)
   ↓
[阶段 2] Tauri 桌面端打包(Windows / macOS)
   ↓
[阶段 3] Tauri 移动端打包(iOS / Android)
   ↓
[阶段 4] 上架 / 自动更新(可选)
```

| 阶段 | 估时 | 关键产物 | 状态 |
|---|---|---|---|
| 0 | - | 现有 HTML 版本 | ✅ 在用 |
| 1 | 2-3 天 | React SPA + 计算逻辑迁移 | ⏳ 计划 |
| 2 | 1 天 | Windows .msi + macOS .app | ⏳ 计划 |
| 3 | 1-2 天 | iOS .ipa + Android .apk | ⏳ 计划 |
| 4 | 按需 | 商店发布 / 自动更新 | ⏸ 可选 |

---

## 阶段 1:React + TS + Vite 重写

**目标**:把现有 HTML 拆解出的 JS 模块迁移到 React,保留所有功能,**计算逻辑 100% 复用**。

### 子任务

| TASK ID | 标题 | 估时 | 依赖 |
|---|---|---|---|
| TASK-001 | 初始化 Vite + React + TS 项目 | 0.5 天 | - |
| TASK-002 | 迁移 `lib/compute.ts` 纯函数 + 单测 | 0.5 天 | TASK-001 |
| TASK-003 | 迁移 storage / theme / state 到 Zustand | 0.5 天 | TASK-001 |
| TASK-004 | 迁移今日页 UI(Timer + Stats) | 0.5 天 | TASK-002,003 |
| TASK-005 | 迁移换算页 + 物品 sheet | 0.5 天 | TASK-004 |
| TASK-006 | 迁移日历页 + 日期 sheet | 0.5 天 | TASK-004 |
| TASK-007 | 迁移设置页 + 月度记录 | 0.5 天 | TASK-004 |
| TASK-008 | 响应式布局(mobile / desktop) | 0.5 天 | TASK-007 |
| TASK-009 | 主题系统接入 + 切换动画 | 0.5 天 | TASK-008 |

**出口标准**:
- ✅ `npm run dev` 可启动,UI 与 HTML 版一致
- ✅ `npm run build` 可产出 `dist/`
- ✅ `compute.ts` 单测覆盖率 > 90%
- ✅ `docs/CHANGELOG.md` 记录所有变更
- ✅ `index.html` 标记为 deprecated(仍保留)

---

## 阶段 2:Tauri 桌面端打包

**目标**:用 Tauri 2.x 包装 React SPA,产出 Windows / macOS 安装包。

### 子任务

| TASK ID | 标题 | 估时 | 依赖 |
|---|---|---|---|
| TASK-010 | 安装 Tauri CLI + 初始化 `src-tauri/` | 0.3 天 | 阶段 1 完成 |
| TASK-011 | 配置 `tauri.conf.json`(窗口、图标、权限) | 0.3 天 | TASK-010 |
| TASK-012 | Windows 端 .msi 构建 + 测试 | 0.3 天 | TASK-011 |
| TASK-013 | macOS 端 .dmg 构建 + 签名 | 0.3 天 | TASK-011 |
| TASK-014 | 桌面端存储迁移(localStorage → tauri-plugin-fs) | 0.5 天 | TASK-012 |

**出口标准**:
- ✅ Windows 上 `npm run tauri build` 产出可安装的 .msi
- ✅ macOS 上产出 .dmg(本机测试)
- ✅ 数据持久化到 `~/Library/Application Support/work-timer/`(macOS)

---

## 阶段 3:Tauri 移动端打包

**目标**:同一份代码,产出 iOS 和 Android 安装包。

### 子任务

| TASK ID | 标题 | 估时 | 依赖 |
|---|---|---|---|
| TASK-015 | 配置 Tauri Mobile + Android target | 0.3 天 | TASK-014 | ✅ 用户手动完成 |
| TASK-016 | Android APK / AAB 构建 + 测试 | 0.5 天 | TASK-015 | ✅ 2026-08-29(universal APK + 签名 + 自定义 logo) |
| TASK-017 | iOS target 配置(Xcode + 签名) | 0.5 天 | TASK-015 |
| TASK-018 | iOS .ipa 构建 + 测试 | 0.5 天 | TASK-017 |
| TASK-019 | 删除 Capacitor 相关代码(`android/`、`capacitor.config.json`、`build-apk.ps1`) | 0.2 天 | TASK-016 |

**出口标准**:
- ✅ Android APK 可在真机安装运行
- ✅ iOS 在真机 / 模拟器测试通过
- ✅ 移除 `android/` 整个目录
- ✅ `package.json` 中移除 `@capacitor/*` 依赖

---

## 阶段 4:上架 / 自动更新(可选)

只有当需要发布到商店或自动更新时才做。

| TASK ID | 标题 | 说明 |
|---|---|---|
| TASK-020 | Apple Developer 账号 + iOS App Store 发布 | 需付费账号 |
| TASK-021 | Play Console + Android Play Store 发布 | 需付费账号 |
| TASK-022 | Tauri 自动更新 + 应用内弹窗 | 桌面端 |
| TASK-023 | 网站 + 下载页 + 文档站 | 用户引导 |

---

## 当前进度

```
[阶段 0] ████████████████████ 100%  (现网在跑)
[阶段 1] ░░░░░░░░░░░░░░░░░░░░   0%  (未开始)
[阶段 2] ░░░░░░░░░░░░░░░░░░░░   0%
[阶段 3] ░░░░░░░░░░░░░░░░░░░░   0%
[阶段 4] ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## 风险与决策点

### 已知风险
1. **Tauri 移动端成熟度** —— Tauri 2.x 移动端刚稳定,如遇坑可暂时回退 Capacitor
2. **代码签名** —— 桌面 / 移动端分发都需要证书,首次成本较高
3. **iOS 上架审核** —— "纯工具"类 App 容易被拒,需要合理的元数据

### 决策点(在阶段 1 之前必须确认)
- [ ] CSS Modules vs Tailwind(推荐:CSS Modules + 现有 token)
- [ ] 是否引入路由(`react-router` vs 自己写 tab state)
- [ ] 是否引入国际化(`react-i18next`)—— MVP 阶段不做
- [ ] 桌面端是否需要"导出数据"功能

---

## 文档同步规则

每完成一个 TASK,必须:
1. 在对应 `TASK-XXX.md` 标记 ✅ 完成
2. 在 `docs/CHANGELOG.md` 的 `[Unreleased]` 段追加记录
3. 如果涉及架构变更,更新 `docs/ARCHITECTURE.md`

---

*最后更新:2026-08-28 · 重构启动*