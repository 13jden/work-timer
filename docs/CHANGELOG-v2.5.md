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

## [v2.5-patch2] · 2026-09-05 · time→accounting 联动 + 多 bug 修复 (TASK-046)

基线 v2.5-patch1 (TASK-043)。本轮完成 TASK-046 完整功能 + 配套 bug 修复,同步 v2.5 独立 changelog。

### A · time → accounting 联动开关 (T-501-1 / T-501-3)

- 新增 `Config.salaryLinkageEnabled`(默认 `true`),允许用户关闭联动而不丢旧数据
- `MinePage` 顶部新增 `LinkageSection`:开关 + 「工资池」当前余额 + 联动 record 总数说明
- 关闭后:time 模式日历页已赚不再写入 accountStore;已存在联动记录保留,删除/编辑需手动处理

### B · 联动 record + 工资池幂等创建 (T-501)

- `accountStore.upsertSalaryLinkageForDate(dateKey, amount)`:
  - `amount > 0`:写入/更新一条 `linkageSource='salary-time-mode'`、`poolStatus='confirmed'`、`poolId=<工资池>` 的 income record
  - `amount === 0`:删除当天联动 record;不影响同日手动记账
  - id / createdAt 稳定,重复 upsert 只改 amount
- `accountStore.ensureSalaryPool()`:幂等创建「工资池」(name='工资池', type='equalize', direction='income', categoryId='cat-salary', noDailyVirtual=true),`pool-store.test.ts` 锁定幂等行为
- 新增 `AccountRecord.linkageSource: 'salary-time-mode' | undefined`,联动 record 标记

### C · 日历页同步 hook (T-501-2)

- `CalendarPage` 用 `useMemo` 算出「本月每日 earnedAmount」:已生成快照读 override、今日实时 `todayEarned`
- `useEffect` 对比 `prevMonthlyRef` 只对真正变化的 `dateKey` 调 `upsertSalaryLinkageForDate`,首帧跳过今日避免每秒回灌

### D · 批量取消 / 离开联动页面联动清理 (T-506)

- prev 里存在但当前 `monthlyEarnedMap` 中消失的 key → 视为 `amount=0` 调 upsert,触发联动 record 删除 / `cycle.transactions` 累减 / `cycle.totalAmount` 累减
- 用户从日历页切走、配置改回 0、假期回退都会触发同步清理

### E · 联动 record 不动账户余额 (T-505)

- `recordAffectsBalance` 新增守卫:`linkageSource === 'salary-time-mode'` 返回 `false`
- 联动走 income equalize 池的 `confirmed in` 路径,不绕过账户余额计算(否则会从 0 余额账户凭空扣钱)
- `PoolConfig.noDailyVirtual = true`(`工资池` 标志):跳过虚拟 record 计入,只追踪 `confirmed`/`claimed` records

### F · 收入池 (PoolSection) 展示口径修正 (T-505)

- 收入池卡片大数字:从总额 `pool.amount` 改为 `records 中 confirmed in 之和(已赚累计)`
- 「已到账」改为 `claimed records 之和`,差额 `remaining = 已赚 − 已到账` 与总资产 chip「已赚未到账」完全一致
- `noDailyVirtual` 池(日均联动池)不显示日均数字
- `formatAmount(displayTotal, true)` 正负号显式

### G · 总资产分解:联动 / 手动认领「已赚」作为虚拟计入 (T-501 + T-505)

- `calcVirtualAssets` 收入池分支改为 `earnedTotal - claimed`:
  - `earnedTotal` = 虚拟逐日 + 联动 / 手动 `confirmed` 收入 records
  - `noDailyVirtual` 池仅算 `confirmed` 部分,避免双重计数
- `virtual.test.ts` +1:联动 / 手动认领的收入 record 作为未到账计入 `earnedUnarrived` 与 `virtualTotal`
- `PoolSection` 卡片 `displayTotal = confirmed sum`,口径与总资产卡同源

### H · AccountingCalendar 收入/支出 分行 + 类型底色 (T-502)

- 单元格内显示拆两行 `+¥X`(收入)/ `−¥X`(支出),不再合并成净额
- 当天仅有收入 / 仅有支出时给底色带柔和类型 tint(`color-mix` 用 `--accent-deep` / `--danger` 调色),与「休息日粉底」「今天描边」共三档背景
- 单元格 `min-height: 52px → 62px`,`gap` 收紧,容纳两行

### I · 新分类自动建 folder (T-507)

- `addCategory` 现在同步创建 folder:之前要等 `CategoryFolderGrid` 挂载时 `ensureFoldersForCategories` 兜底,且兜底只对「已有 records」分类补;新分类立即可见
- 避免「新建分类 → 首页文件夹区不显示 → 需刷新」的同步时序问题

### J · mine 页「月度目标」单值,与首页结余共享 (T-507)

- `GoalsSection` 重写:由「存钱目标(多值)」改为「月度目标」单值卡片
- 数据源 `useMonthlyGoalStore.monthlyGoal`(与 time 模式月度收入目标同 store,会计侧展示为「结余目标」)
- 同步双向:`AccountingTopCard` 月度结余进度也读 `monthlyGoal`(原硬编码 12000,完全独立)
- 点卡片 / 编辑按钮弹小窗设置金额;保存即写 store,首页 + mine + 设置页三处联动
- `savingsGoals` / `addSavingsGoal` / `updateSavingsGoal` / `deleteSavingsGoal` 保留在 store 兼容 `goals-store.test.ts`,UI 不再引用

### 配套调整

- `AccountingCalendar.module.css` 单元格高度 +10px,内边距收紧
- 旧 `v2.5 T-507 ...` 注释格式对齐本轮改动(`-` → `──` 等不影响)

### 验证

- typecheck 0 错误、394 单测全过(virtual +1、pool-store +4、T-501 相关覆盖累计 +8)
- 用户浏览器验收通过(2026-09-05)

---

## [v2.5-patch3] · 2026-09-05 · 休息日 NetHoursDashboard 工时口径补漏

基线 v2.5-patch2 (TASK-046)。用户验收 v2.5-patch2 后发现休息日仍按工时模板算出非零工时,
本轮定位 root cause 并补漏。同步 v2.5 独立 changelog。

### A · computeNetHours 入口 isWorkday 短路 (T-508 patch)

- `compute.ts:computeNetHours` 入口新增守卫:
  `if (!isWorkday(date, config, overrides, holidays)) return { 全零 breakdown }`
- 与 `effectiveDailyRate` 同口径(`effectiveDailyRate` 早已对休息日 return 0),
  让所有下游(NetHoursDashboard / TimeTrackerDetailPage)的「总工时 / 摸鱼 / 加班 / 净工时」卡片在休息日全部归零
- `paid_overtime` / `leave` / `freelance` / `work` override 已经让 `isWorkday` 返回 true,不会被误伤
- `paid_overtime` 日仍按倍率计入加班(「加班日」语义保留)

### 配套

- `compute.test.ts` v1.3.3 patch6 加班 block fixture `dateKey` 2026-08-30(周日)→ 2026-08-31(周一),
  关联 `startTs/endTs` 同步调整。原 fixture 与 describe name「普通工作日」语义矛盾,本次一并修正

### 验证

- typecheck 0 错误、**394 单测全过**
- 用户浏览器验收通过(2026-09-05)

---

*创建于 2026-09-04*
