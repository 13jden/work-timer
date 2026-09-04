# Changelog · Salary Timer v2.5

> **v2.5 独立 changelog 文件**。基线分支 `feat/v2.5-mobile`（自 `v2.0-mobile` @ 5fad83f）。
>
> 历史变更见 [`docs/CHANGELOG.md`](./CHANGELOG.md) 索引。

---

## [v2.5] · 2026-09-04 · 导航手势体验修正 + 存池结算方式 (TASK-042)

### A · 主题切换手势（T-412 / T-415）

- 两侧统一**向下滑**切换到对面主题（原为一上一下），toggle 语义；上滑不再触发，避免与滚动回弹混淆
- 触发距离 70 → **120px**，手势更长不易误触；保留 flick 判定（≤350ms、纵向为主）

### B · 两侧页面一一对应（T-413）

- 记账侧底部菜单顺序调整为 `ACCT 快速记录 → CAL 记账日历 → STATS 日统计 → MINE 资产`
- 与计时侧按索引对应：TODAY↔快速记录、MONTH↔记账日历、FISH↔日统计、设置↔资产设置；在任一 tab 下滑切换后落在对面同位置页面

### C · 统计页默认「日」视图（T-411）

- 打开记账统计 tab 直接显示当日记录列表（原默认「月」）

### D · 分类拖动长按触发（T-414）

- 快速记录页分类文件夹 / 未分类记录拖拽 `TouchSensor` 激活延迟 180ms → **1000ms**（长按 1 秒），普通滚动与主题下滑手势不再误触发

### E · 记账侧页面标题（T-415）

- 新建共用组件 `PageTopbar`（复刻计时侧 TodayPage topbar 规格：小写眉标 + 英文短语 + 右侧信息 + 居中大标题），不动任何现有组件样式
- CAL「记账日历 · When money moves」（右侧当前月）↔ MONTH；STATS「日统计 · Where it all goes」（右侧今日日期）↔ FISH；MINE「资产设置 · What you own」（右侧账户数）↔ 设置

### F · 存池两种结算方式（T-416）

- `PoolConfig.settleMode`：
  - `prepay` 押金 · 先付（默认，存量兼容）：**建池即声明已付**，待退 = 押金金额 − 取出，总资产绿色「待退 +¥X」计入虚拟总额
  - `postpay` 先用后付：未付部分（押金金额 − 已存入）红色「待付 −¥X」与未分类/未支付同框（不扣虚拟总额）；已付部分同样计绿色待退
- 建池弹窗存池型新增结算方式选择；存池卡显示「存池 · 先用后付」标记
- `calcVirtualAssets` 新增 `depositRefundable / depositPending` 分解，单测 +4（含「建池即显示」回归例）

### G · 收入分类首页可见（T-417）

- 首页「分类文件夹」网格此前只渲染支出型文件夹，新建收入分类不显示；改为支出 + 收入全展示，月度统计按分类自身类型聚合
- 文件夹排序按全集处理；记录拖入文件夹增加同类型（支出/收入）校验，避免串类

### 其他

- `tauri.conf.json` 版本号 1.3.4 → 2.5.0（对齐实际版本）
- APK 打包验证：`SalaryTimer-2.5.0-arm64.apk`（aapt 精简 arm64 + zipalign + apksigner v2/v3 签名，`resources.arsc` 对齐）

### 验证

- typecheck 0 错误、374 单测全过（本次新增 4 条存池分解单测）、build 成功
- 用户浏览器 + APK 真机验收通过（2026-09-04）

---

## [v2.5-patch1] · 2026-09-04 · 均摊池资产口径修正 + UX 微调 (TASK-043 patch)

基线 v2.5 (TASK-042) 的小幅修复与体验修正,同步 v2.5 独立 changelog。

### A · Today 页 fish 跳转联动导航 (T-441)

- `App.tsx` 的 TodayPage `jumpToFish` 不再只 `setMobileOverlay('fish')`
- 同时 `setMode('accounting')` + `setTabIndex(2)`(会计侧 STATS tab 索引)+ 清掉当前 mobileOverlay
- 触发顺序:计时侧 Fish → 同步切到「记账侧 · STATS」,与 v2.5 对称手势后位置一一对应

### B · MinePage 总资产 虚拟 / 实际 标记位置对调 (T-442)

- 原:`主显示 = actualTotal`,breakdown 写 `实际 ¥virtualTotal`(语义颠倒)
- 现:`主显示 = virtualTotal`(顶部「虚拟」tag 已暗示),breakdown `实际 ¥actualTotal`(对齐 tag)
- 虚拟总额 = 实际 + 待退押金 − 待付消费;主显示即「你手里 + 押金 − 待付」,数字与可支配更贴近

### C · 均摊池资产口径修正 (T-443)

- `calcVirtualAssets` 一直正确:均摊消费只入 `unpaidConsumed`,不计入 `prepaidUnconsumed` / `virtualTotal`
- 问题在于没有回归测试覆盖,极易被改错。两组新单测锁定行为:
  - **`pool-store.test.ts`** 增量补充:建 equalize 池(1000/月)前 4 天每天插入逐日记录 → `actualTotal=10000`、`unpaidConsumed≈t×70`,总资产不变
  - **`virtual.test.ts`** +2 例:
    - 4 条 −70 逐日无认领 → `actualTotal=2000`、`unpaidConsumed=280`、`virtualTotal=2000`
    - 4 条 −70 逐日 + 1 条 −280 `claimed` → `actualTotal=720`、`unpaidConsumed=0`、`virtualTotal=720`

### D · 负数金额显式正负号 (T-444)

- `formatAmount(amount, signed = false)` 增加第二参数,启用时:
  - 正数 → `+¥X`(显示给用户看余额、账户、池内、结余,语义「这是结余多少」)
  - 零 → `¥0`
  - 负数 → `−¥X`(U+2212 数学负号,与 `+` 配对)
- 接入点位:
  - `AccountingTopCard` 本月结余 + `AccountRow` 余额 + `GoalsSection` 当前/目标 + `PoolSection` 池内余额 + `StatsPage` Dock 当前账户余额 + `MinePage` 总资产主显示 / breakdown
- 单词单测/计算均不变;仅影响显示文案,无数据迁移

### 验证

- typecheck 0 错误、376 单测全过(virtual +2、pool-store +1)
- 用户浏览器验收通过(2026-09-04)

---

*创建于 2026-09-04*
