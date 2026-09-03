# v2.1 Roadmap · 视觉升级 + 统计日历

> 基线分支:`feat/v2.1-mobile`(自 `v2.0-mobile` @ cd2ed29,含 v1.3.5 修复 + 记账 Phase 1-2)。
> PRD 阶段参考:[v2.0 IMPLEMENTATION-PHASES](../v2.0/task-033-v2.0-accounting-prd/IMPLEMENTATION-PHASES.md)。

## 目标

v2.0 完成了记账 MVP(记录 + 分类)。v2.1 先做**视觉质感升级**(线稿图标系统替代 emoji),再推进 **Phase 3 统计 + 日历**。

## 任务拆分

| TASK ID | 标题 | 依赖 | 状态 |
|---|---|---|---|
| TASK-036 | 图标系统升级:记账模块 emoji → Phosphor thin/light 线稿 | - | ✅ 已完成 |
| TASK-037 | 移动端双主题框架(计时/记账)+ 上下滑切换 + 分类删除确认 | - | ✅ 已完成 |
| TASK-038 | (待定)Phase 3 统计页三视图 + 日历记账视图 | TASK-037 | 待规划 |

## 约束

- ✅ icon 字段继续存字符串(key),老数据 emoji 回退显示,localStorage 无缝兼容
- ✅ 共用组件优先:`IconByKey` 移动端 / 桌面端复用,后续物品交换模块同套接入
- ✅ 不动现有组件样式结构,仅图标渲染与 picker 网格
- ✅ 颜色走 currentColor / 显式 color prop,跟随三套主题

## 出口标准

- ✅ typecheck / test / build 全绿
- ✅ 记账页分类 / 文件夹 / 记录列表 / 添加弹窗全部线稿图标
- ✅ 老数据(emoji)正常回退显示
- ✅ 用户浏览器验收通过 → CHANGELOG-v2.1.md → 提交

---

*创建于 2026-09-03*
