# TASK-042 · 导航与手势体验修正（v2.5）

> 分支：`feat/v2.5-mobile`（基于 `v2.0-mobile` @ 5fad83f）
> 状态：已完成（2026-09-04 浏览器 + APK 真机验收通过，CHANGELOG-v2.5 已写，已提交）
> 提出：2026-09-04 用户反馈
> 编号说明：原误编 TASK-041，与既有 `TASK-041-polish-and-release.md` 冲突，顺延为 042

## 背景

v2.1 双主题（计时 / 记账）上线后，用户在实际使用中提出 4 项导航与手势体验问题。

## 子任务

| ID | 标题 | 内容 |
|---|---|---|
| T-411 | 统计页默认「日」视图 | `StatsPage` 初始 `view` 由 `'month'` 改为 `'day'`，打开即看当日记录列表 |
| T-412 | 主题切换统一为向下滑 | `App.handleTouchEnd` 原逻辑 dy>0→记账 / dy<0→计时（一上一下）；改为**两侧都向下滑切换到对面主题**（toggle），保留 flick 判定（≤350ms、位移≥120px、纵向为主，见 T-415） |
| T-413 | 两侧页面一一对应 | 按索引对应：today↔快速记录、month↔记账日历、fish↔日统计、设置↔资产设置。记账侧底部菜单顺序调整为 `[ACCT 快速记录, CAL 记账日历, STATS 日统计, MINE 资产]`；`renderAcctPage` 映射同步调整（1→日历、2→统计） |
| T-414 | 分类拖动改长按触发 | `AccountingPage` DndContext 的 `TouchSensor` activationConstraint `delay: 180 → 1000`（长按 1 秒才激活分类/记录拖拽），避免与页面滚动、主题下滑手势冲突 |
| T-415 | 下滑手势加长 + 记账页标题 | ① 主题切换下滑触发距离 `70 → 120`px，更长不易误触；② 新建共用组件 `PageTopbar`（复刻计时侧 TodayPage topbar 规格：eyebrow + 英文短语 + 右侧信息 + 居中大标题），记账侧三页加标题并与计时侧位置对应：CAL「记账日历 · When money moves」↔ MONTH、STATS「日统计 · Where it all goes」↔ FISH、MINE「资产设置 · What you own」↔ 设置 |
| T-416 | 存池两种结算方式 | `PoolConfig.settleMode`：`prepay` 押金先付（默认，存量兼容）→ **建池即声明已付**，待退 = 押金金额 − 取出（不依赖认领记录），总资产绿色「待退 +¥X」计入虚拟总额；`postpay` 先用后付 → 未付部分（金额 − 已存入）红色「待付 −¥X」与未分类同框（不扣虚拟总额），已付部分同样计绿色待退。建池弹窗存池型加结算方式选择；存池卡显示「先用后付」标记；`calcVirtualAssets` 新增 `depositRefundable / depositPending` 分解，单测 +4（含「建池即显示」回归例） |
| T-417 | 收入分类首页可见 | 首页「分类文件夹」网格此前只渲染支出型文件夹，新建的收入分类被过滤不显示。改为支出+收入文件夹全展示（月度统计按各分类自身类型聚合）；文件夹排序按全集处理；记录拖入文件夹增加同类型（支出/收入）校验，避免串类 |

## 验收标准

1. 打开记账主题统计 tab，默认显示「日」视图
2. 在计时侧向下滑 → 记账；在记账侧向下滑 → 计时
3. 在 month（日历）tab 下滑切到记账侧，落在记账日历；各索引位置一一对应
4. 快速记录页分类文件夹 / 未分类记录拖拽需长按约 1 秒才可拖动，普通滚动不误触发

## 验证

- typecheck + 单测 + build 全绿（2026-09-04）
- APK 真机验收（打包流程见 `docs/ANDROID-APK-PACKAGING.md`，对应 TASK-041 T-506/T-508）
- 用户验收通过后 → 写 `docs/CHANGELOG-v2.5.md` → commit → 合并 `v2.0-mobile`
