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
docs/ARCHITECTURE.md  ← 架构+计算公式
docs/CONVENTIONS.md   ← 代码规范
docs/CHANGELOG.md    ← 变更记录
docs/plans/README.md  ← 项目索引
```

## 开发流程(强制)

```
读 ROADMAP.md → 读 TASK-XXX.md → 改代码 → 更新 CHANGELOG → 提交
```

## 启动检查清单

- [ ] 读 `docs/plans/README.md`
- [ ] 读 `docs/plans/<project>/ROADMAP.md`
- [ ] 读 `docs/CHANGELOG.md` + `CONVENTIONS.md`
- [ ] 读 `docs/ARCHITECTURE.md`
- [ ] 读对应的 `TASK-XXX.md`
- [ ] **然后才开始动手**

## 必做

- ✅ 有 TASK 先读 TASK,没有就新建再动手
- ✅ 每次改动后追加到 `docs/CHANGELOG.md`
- ✅ 核心逻辑必须有单测(`src/lib/compute.ts`)

## 禁做

- ❌ 在没有 TASK 的情况下做大改动
- ❌ 引入云同步等超出 MVP 的功能

---

*最后更新:2026-08-28 · 阶段 1 完成*