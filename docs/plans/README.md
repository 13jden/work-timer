# Plans · 需求开发计划目录

> 本目录按**项目 / 需求类型**分组,每个子目录是一个独立的项目或大的需求方向。
> 进入新需求时,先新建子目录,再写 `ROADMAP.md` + `TASK-XXX.md`。

---

## 当前项目

| 目录 | 状态 | 说明 |
|---|---|---|
| [`tauri-migration/`](./tauri-migration/) | 🚧 进行中 | 从 HTML + Capacitor 重构为 Tauri + React 多端架构 |

---

## 目录模板(每个项目子目录)

```
plans/<project-name>/
├── README.md           ← 项目背景、目标、当前状态(可选)
├── ROADMAP.md          ← 阶段划分 + 时间线
└── TASK-XXX-*.md       ← 详细任务规格
```

---

## 新建项目的流程

1. 在 `plans/` 下新建子目录,命名用 kebab-case(如 `cloud-sync` / `multi-currency`)
2. 写一个 `ROADMAP.md`,划分阶段
3. 每个阶段写独立的 `TASK-XXX-*.md`
4. 完成时更新顶部"当前项目"表格的状态

---

## 已废弃 / 已完成的项目

完成后保留目录但加 `✅ 完成` 标记,不要删除 —— 作为历史记录。