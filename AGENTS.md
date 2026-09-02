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
docs/CHANGELOG-v2.0.md       ← v2.0 记账功能变更记录(独立文件)
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
                                       → 更新 CHANGELOG(对应版本文件)
                                       → 提交
```

### 验收后产物顺序(强制)

**用户验收通过后,先写 CHANGELOG(写到对应版本的独立文件),再创建 commit。两步都做完才算交付完成。**

| 步骤 | 产出 | 写入位置 | 备注 |
|---|---|---|---|
| 1 | 更新 CHANGELOG | `docs/CHANGELOG-vX.X.md`(当前开发版本) | **不是** `docs/CHANGELOG.md` 主文件,除非当前版本 ≤ v1.2 |
| 1.5 | 同步 CHANGELOG 索引 | `docs/CHANGELOG.md` 顶部索引表 | 只追加新版本入口,变更详情不写到主文件 |
| 2 | 创建 commit | Git | commit message 引用 TASK ID + 版本号 |

> **CHANGELOG 与 commit 都是「验收后产物」**,不是「开发过程产物」。
> 没通过用户验收前,改动只留在代码 + `dev.log`,**不要写 CHANGELOG,不要创建 commit,不要写 TASK 文档终稿**。
> 这条优先级高于「代码已完成」—— 哪怕代码本身能跑、build 通过、test 全过,只要用户没在浏览器看过并明确通过,就**禁止**写 CHANGELOG / commit。

### CHANGELOG 写哪个文件?(强制)

**用户验收通过后,根据当前开发的版本号,追加到对应版本的独立 changelog 文件**,而不是 `docs/CHANGELOG.md` 主文件。

| 当前开发版本 | CHANGELOG 文件 |
|---|---|
| v1.0 ~ v1.2 的任何 patch / 新功能 | `docs/CHANGELOG.md`(主文件) |
| v1.3.x(含 patch) | `docs/CHANGELOG-v1.3.md` |
| v2.0.x(含 patch) | `docs/CHANGELOG-v2.0.md` |
| v2.1 ~ v2.5 | 同 v2.0 的独立文件,首次新建 `docs/CHANGELOG-v2.1.md` 等 |
| 未来版本 | 同规则,新建 `docs/CHANGELOG-vX.X.md` |

> **同时**:`docs/CHANGELOG.md` 顶部索引表要追加新版本的入口(版本号 / 日期 / 主题 / 文档链接),但**变更详情**写在对应版本的独立文件里。
>
> **禁止**:
> - 把变更详情写到 `docs/CHANGELOG.md` 主文件(会膨胀)
> - 写到错误版本的独立文件(用户验收的是 v2.1 的功能,不能写到 `CHANGELOG-v2.0.md`)
> - 未通过验收就写 CHANGELOG(方向不对的改动只留代码 + `dev.log`)
> - **跳过 CHANGELOG 直接 commit**(验收通过的产物链必须包含 CHANGELOG 一步)

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
- ✅ **调用链 / 影响面分析优先用 codegraph_explore**:查"谁在用 XXX""改这里会影响哪些地方""调用链路"时,用 `codegraph_explore` 而非 Read/Grep 遍历
- ✅ **不动现有组件样式**:新增功能尽量新建组件,避免污染已稳定的 UI
- ✅ **共用组件优先**:为后续桌面端复用设计,移动端 / 桌面端共享同一份组件
- ✅ **验收后才写 CHANGELOG / 提交**:改动跑完 typecheck + test + build,还要让用户在浏览器/终端**实际看过效果并明确通过**之后,才能追加 CHANGELOG 与创建 commit
- ✅ **CHANGELOG 写到对应版本文件**:根据当前开发的版本号,追加到 `docs/CHANGELOG-vX.X.md`,**不是** `docs/CHANGELOG.md` 主文件(详见上方「CHANGELOG 写哪个文件」一节)
- ✅ **CHANGELOG 与 commit 的顺序**:用户验收通过 → **先**追加 CHANGELOG 到对应版本文件,**再**创建 commit。两步必须都做(详见上方「验收后产物顺序」一节)

## 禁做

- ❌ 在没有 TASK 的情况下做大改动
- ❌ 引入云同步等超出 MVP 的功能
- ❌ **修改现有组件样式**(TimerCard / StatCard / QuoteCard / BottomNav 等)除非明确 TASK 允许
- ❌ 把所有 changelog 堆到 `docs/CHANGELOG.md`,新版本必须独立文件
- ❌ **未通过用户验收的内容禁止写入 CHANGELOG / 创建 commit / 写 TASK 文档**:方向不对或效果不好的改动只是过程产物,记到 `dev.log`(临时调试日志,不会被 git 跟踪)即可,绝不污染正式文档
- ❌ **跳过 CHANGELOG 直接 commit**:验收通过后必须先写 CHANGELOG(对应版本文件)再 commit;只有 CHANGELOG 没有 commit / 只有 commit 没有 CHANGELOG 都不算交付完成
- ❌ **同一 patch 反复推倒重来**:若一次改动被用户否定,在确认新方向前不要急着覆盖前一次的 CHANGELOG 条目 / 提交记录;先与用户对齐再动笔

---

*最后更新:2026-09-02 · AGENTS.md 新增「验收后产物顺序」一节(CHANGELOG → commit)*