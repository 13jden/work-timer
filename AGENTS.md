# AGENTS.md · Salary Timer

> **强制必读**:每次会话开始前,Agent 必须完整阅读本文件。

## 项目

**Salary Timer** —— 实时薪资计时器,打工人的秒薪计数器。
核心情感:每一秒都在为咖啡努力。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| 状态 | Zustand |
| 样式 | CSS Modules |
| 存储 | localStorage |
| 移动端 | Tauri 2.x(待接入) |

## 文档体系(每次必读)

```
docs/ARCHITECTURE.md         ← 架构+计算公式
docs/CONVENTIONS.md          ← 代码规范
docs/CHANGELOG.md            ← 版本索引 + 阶段 1 ~ v1.2 历史变更记录
docs/CHANGELOG-v1.3.md       ← v1.3 + v1.3.1 + v1.3.2 变更记录(独立文件)
docs/plans/README.md         ← 项目索引
docs/plans/tauri-migration/
├── ROADMAP.md               ← 重构总路线图
└── v1.3/                    ← v1.3 任务
    ├── ROADMAP.md
    └── TASK-021 ~ TASK-025
```

> **版本变更记录分文件**:
> - v1.0 → v1.2 写 `docs/CHANGELOG.md`
> - v1.3 起每个独立版本单独建 `docs/CHANGELOG-vX.X.md`,避免主文件膨胀
> - `docs/CHANGELOG.md` 顶部保留**索引表**,指向各版本的独立文件

## 开发流程(强制)

```
读 ROADMAP.md → 读 TASK-XXX.md → 改代码 → 跑 typecheck + test + build
                                       → 用户在浏览器验收通过
                                       → 才能更新 CHANGELOG(对应版本文件) → 提交
```

> **CHANGELOG 与提交是「验收后产物」,不是「开发过程产物」。**
> 没通过用户验收前,改动只留在代码 + `dev.log`,不要写 CHANGELOG / 创建 commit / 写 TASK 文档终稿。

## 启动检查清单

- [ ] 读 `docs/plans/README.md`
- [ ] 读 `docs/plans/<project>/ROADMAP.md`(当前活跃版本)
- [ ] 读 `docs/CHANGELOG.md` + `docs/CHANGELOG-vX.X.md`(当前版本)
- [ ] 读 `docs/CONVENTIONS.md`
- [ ] 读 `docs/ARCHITECTURE.md`
- [ ] 读对应的 `TASK-XXX.md`
- [ ] **然后才开始动手**

## 必做

- ✅ 有 TASK 先读 TASK,没有就新建再动手
- ✅ 核心逻辑必须有单测(`src/lib/compute.ts`)
- ✅ **不动现有组件样式**:新增功能尽量新建组件,避免污染已稳定的 UI
- ✅ **共用组件优先**:为后续桌面端复用设计,移动端 / 桌面端共享同一份组件
- ✅ **验收后才写 CHANGELOG / 提交**:改动跑完 typecheck + test + build,还要让用户在浏览器/终端**实际看过效果并明确通过**之后,才能追加 CHANGELOG 与创建 commit

## 禁做

- ❌ 在没有 TASK 的情况下做大改动
- ❌ 引入云同步等超出 MVP 的功能
- ❌ **修改现有组件样式**(TimerCard / StatCard / QuoteCard / BottomNav 等)除非明确 TASK 允许
- ❌ 把所有 changelog 堆到 `docs/CHANGELOG.md`,新版本必须独立文件
- ❌ **未通过用户验收的内容禁止写入 CHANGELOG / 创建 commit / 写 TASK 文档**:方向不对或效果不好的改动只是过程产物,记到 `dev.log`(临时调试日志,不会被 git 跟踪)即可,绝不污染正式文档
- ❌ **同一 patch 反复推倒重来**:若一次改动被用户否定,在确认新方向前不要急着覆盖前一次的 CHANGELOG 条目 / 提交记录;先与用户对齐再动笔

---

*最后更新:2026-08-31 · v1.3.4-patch3 发布(右栏 1/3 + 左 2/3 撑满)*