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

## [v2.5-patch14] · 2026-09-07 · GenerateSheet 重新生成月度时摸鱼净工时快照丢失 (TASK-051)

基线 v2.5-patch6 (TASK-049)。用户验收 patch6 后发现:在已赚页面(CalendarPage)点击"生成记录"(GenerateSheet)时,
如果某些日期之前已保存了摸鱼记录,重新点击生成月度后,月统计图(FishPage 月视图 / StatsPage 月视图)的"净工时"会重置,
变成「工时 − 0」而不是「工时 − 摸鱼」。

### 根因

`handleGenerate`(GenerateSheet "确认生成"按钮)只调了 `monthlyStore.createSnapshot`(写入月度薪资快照),
**没有调用 `batchGenerateEarned` 把 `earnedNetMinutes` 快照写入 dayOverrides**。

导致:
- 用户之前用批量模式(DaySheet 单日生成)保存摸鱼记录 → `earnedNetMinutes` 写入了 override
- 之后用 GenerateSheet 重新生成月度 → `batchGenerateEarned` 没被调用 → `earnedNetMinutes` 丢失
- FishPage 月统计图走 `computeRangeStats` → 读不到 `earnedNetMinutes` → 重新算 `computeNetHours`(摸鱼=0) → **净工时变大**

### 修复

`CalendarPage.handleGenerate` 在创建月度快照前,也对当月所有**过去工作日**调用 `batchGenerateEarned`,
把 `earnedGenerated` / `earnedAmount` / `earnedNetMinutes` 快照写入 dayOverrides(只对过去日,今天及未来日跳过)。
这样 FishPage 月统计图能读到正确扣减摸鱼的净工时快照。

### 验证

- typecheck 0 错误、410 单测全过
- 本次无新增单测(`batchGenerateEarned` 已有充分覆盖;`handleGenerate` 属 React 组件内函数,需 browser 验收)

---

## [v2.5-patch6] · 2026-09-05 · account 模式三主题适配 (TASK-049)

基线 v2.5-patch5。用户反馈「account 模式切到 obsidian / gold 主题后,
原本 lemon yellow 上的浅色组件、墨黑大卡的光晕都失效/难看」(time 模式 SettingsPage
三主题适配干净,account 模式散落大量硬编码颜色回退)。

### A · tokens.css 补齐缺失 token (T-491)

- **`--paper-3` / `--paper-4`** —— 三主题都补全:
  - paper: `#f9f7f0` / `#fffdf6`(保留原 fallback 语义,不变)
  - obsidian: `#1C212C` / `#242B38`(深色面 elev 提升,等同 `--card` / `--card-hover`)
  - gold: `#FFFFFF` / `#FFFCF2`(更亮的白卡面)
- **`--ink-muted` / `--ink-soft`** —— 三主题补全(原 CSS 大量 `var(--ink-muted, #6B6B6B)` fallback)
- **`--income` / `--expense`** —— 三主题补全(记账红绿语义色,不再硬编码 `#C04A3A` / `#2D8F5B`)
- **`--ink-on-dark` / `--ink-on-dark-muted`** —— 新增「深色卡面正文」token,用于墨黑大卡、QuickAddRow 暗卡等场景,三主题都取一致的浅色

### B · 移除 Account 组件 CSS 硬编码回退 (T-492~495)

- 13 个 `Accounting/**.module.css` 文件批量替换 `var(--paper-3, #f9f7f0)` `var(--paper-2, #EDE9DD)` `var(--paper-4, #fffdf6)` `var(--ink-muted, #6B6B6B)` `var(--ink, #0F0F0F)` `var(--line-soft, #E7E2D1)` `var(--line, #D9D4C3)` `var(--accent-2, #9fcc00)` `var(--accent, #C8FF00)` `var(--accent-deep, #6c8a00)` `var(--danger, #e5484d)` `var(--paper, #fffdf6)` `var(--muted, #8B8B82)` `var(--ink-soft, #3A3A3A)` `var(--expense, #C04A3A)` `var(--income, #2D8F5B)` 为纯 token 引用
- 收尾遗留硬编码:
  - `var(--folder-color, #9CA3AF) 14%, white` → `var(--folder-color) 14%, var(--paper)`
  - `MinePage.goalEditClear` 的 `var(--accent, #c04a3a)` 误用 → `var(--danger)`
  - `TodayRecordsList.virtualTag` 的 `#FFF4E0` / `#A86A1F` → `color-mix(var(--accent))`
  - `RecordActionSheet.danger:hover` 的 `#fef2f2` → `color-mix(var(--danger) 8%, transparent)`
  - `QuickAddRecord` 全部 rgba(255,255,255,X) → `color-mix(var(--ink-on-dark) X%, transparent)`,`#F2F1EA` → `var(--ink-on-dark)`,`#FF6B6B` → `var(--danger)`,`#4ADE80` → `var(--income)`
  - `AccountingTopCard` `#FFFFFF` → `var(--ink-on-dark)`

### C · 墨黑大卡 obsidian 反转 (T-496)

参照 `TimerCard.module.css` 的 obsidian override 模式,为以下组件加 `:global([data-theme='obsidian'])` 反转,
保留「墨黑 hero 卡」视觉签名(不被 `--ink` 自动反转成亮卡):

- `AccountingTopCard.card` / `.status` / `.label` / `.shift` / `.range` / `.progress`
- `MinePage.totalCard` + `.totalAmount` / `.totalLabel` / `.virtualActual` / `.totalResetBtn` / `.accountMini` / `.accountName` / `.accountBalance`
- `QuickAddRow.quickCard`

### D · AccountingTopCard 光晕主题色 (T-498)

`.card::before` 的右上角径向光晕从硬编码 `rgba(200, 255, 0, 0.18)` 改为 `var(--accent-glow)`,
三主题自动切换:lemon lime / 曜石青 / 香槟金,完全对齐 `TimerCard` 同源实现。

### 验证

- typecheck 0 错误、408 单测全过(本次未新增业务单测,纯 CSS token 适配)

---

## [v2.5-infra1] · 2026-09-08 · 部署链路重构:CI 构建 dist + Caddy 自动 HTTPS

### A · Deploy:构建产物改由 CI 提供,服务器不再跑 npm ci / vite build

- 起因:Deploy 的 `Run entrypoint.sh` 卡满 **10m3s** 被 `appleboy/ssh-action` 默认 `command_timeout: 10m` 掐断,日志停在 `✓ 4737 modules transformed`。服务器上 `npm ci`(78s) + `vite build`(4737 modules + sourcemap + workbox precache)在 10 分钟窗口内跑不完
- `deploy.yml` 拆成四步:下载 CI 的 `dist` artifact → SSH 同步仓库并 `rm -rf dist` 清残留 → `appleboy/scp-action@v1` 上传 dist → SSH `docker compose up -d --build --force-recreate`
- 每步显式声明 `command_timeout`(5m / 10m / 10m),不再吃默认值;容器没起来时打印最后 40 行日志再退出;结尾追加证书日志过滤与本机 HTTPS 自检(非致命)
- `Dockerfile` 删掉 `node:22-alpine` 构建阶段,服务器不再需要 node/npm,镜像构建从 ~10min 降到秒级;本地手动构建前需自己先 `npm run build`
- `.dockerignore` 放行 `dist/`(原先被忽略,会让 `COPY dist` 直接失败),补 `dist-desktop/`

### B · HTTPS:nginx → Caddy(自动签发 + 自动续签)

- 动因:Service Worker 只在安全上下文注册,`http://IP:8080` 下 TASK-052 接入的 PWA 完全不生效
- 新增 `Caddyfile`:站点根 `/srv`、`encode zstd gzip`、SPA `try_files {path} /index.html` + `file_server`
- 缓存策略等价迁移自 `nginx.conf`,并修掉一个 PWA 致命 bug:原 `location ~* \.(js|css|...)$` 把 `/sw.js` 也套上 `expires 1y` + `immutable`,新版本永远推不到客户端。现改为 `/sw.js` 与 `/manifest.webmanifest` 走 `no-cache, no-store, must-revalidate`,带 hash 的静态资源才 1y immutable(用 `not path /sw.js` 排除)
- 站点地址与证书模式用占位符默认值:`{$SITE_ADDRESS::443}` / `{$TLS_ARG:internal}`,变量未设置**或为空**都正确回落到自签模式
- `docker-compose.yml`:端口 `8080:80` → `80:80` + `443:443`;新增 `caddy_data:/data`、`caddy_config:/config` 两个命名卷持久化证书(`--force-recreate` 不丢证书,避免反复申请撞 Let's Encrypt 每域名每周 50 张限制);healthcheck 改探容器内 admin API `http://localhost:2019/config/`,不依赖域名与证书模式
- 新增 `.env.example`:域名模式(`SITE_DOMAIN` + `ACME_EMAIL`)与自签模式两套写法及前置条件;`.gitignore` 忽略 `.env` / `.env.local`;`.dockerignore` 忽略 `.env*` 与已停用的 `nginx.conf`
- `nginx.conf` 标注停用但保留,作为回退参考
- deploy 脚本硬校验:`.env` 设了 `SITE_DOMAIN` 却没 `ACME_EMAIL` 直接失败退出(否则 Caddy 会给真域名签自签证书)

### 待办 / 前置条件

- 云安全组需放行 **80 与 443**(原先只开 8080,该映射已删除);域名模式下 80 不开则 ACME HTTP-01 验证过不去
- 要正式证书:域名 A 记录解析到服务器公网 IP + 在服务器项目目录建 `.env`;国内服务器还需备案
- 自签模式浏览器会提示不安全,SW / PWA 安装不保证可用
- 2026-09-08 11:24 那次 Deploy 的 SSH 握手被 reset(`connection reset by peer`)尚未定位,需先恢复服务器连通性

### 验证

- `deploy.yml` / `docker-compose.yml` 经 js-yaml 解析通过;compose 结构核对:ports `80:80`+`443:443`、两个命名卷、healthcheck 指向 2019
- Caddyfile 用 caddy v2.11.4 实跑 `validate` + `adapt`:自签模式与域名模式均 `Valid configuration`;env 未设置 / 设为空字符串都正确回落 `:443` + `internal`;域名模式 TLS automation 为 ACME(Let's Encrypt 主 + ZeroSSL 兜底)且 `automatic_https` 默认开启 80→443
- 编译后路由顺序 `vars(root)` → `headers(/sw.js,/manifest.webmanifest)` → `headers(html)` → `headers(静态资源, not /sw.js)` → `rewrite(try_files)` → `encode+file_server`;`header` 先于 `rewrite` 执行,匹配的是原始请求路径,符合预期
- 本机无 Docker,镜像构建与真实证书签发待首次 Deploy 实跑验证

---

## [v2.5-infra2] · 2026-09-08 · HTTPS 跑通:persecond.work + TLS-ALPN-01,与宿主机 OpenResty 共存

### 背景与排查

- 部署后访问 `http://persecond.work` 出现阿里云建站产品(云·速成美站类)的初始化向导,响应头 `Server: openresty`:该产品自带 OpenResty 抢占宿主机 **80 端口**并 301 到 https,导致我们容器 `docker compose up` 因端口冲突起不来;443 无人监听,站点整体不可达
- 实测:persecond.work A 记录 → `47.104.228.220`(正确);80 被 OpenResty 占用;443 / 8080 公网不通;22 正常;`www.` / `app.` 子域无解析

### 方案:不抢 80,只占 443

- `docker-compose.yml` ports 从 `80:80 + 443:443` 改为**只发布 `443:443`**,避开端口冲突;OpenResty 的 301 顺带替我们完成 http→https 跳转
- `Caddyfile` 证书验证改为 **TLS-ALPN-01**(`tls { issuer acme { disable_http_challenge } }`),不再依赖 80 端口;站点地址默认 `persecond.work`,可用服务器 `.env` 的 `SITE_DOMAIN` 覆盖
- 移除自签双模式与 ACME 邮箱变量(已有备案域名,不再需要);`.env.example` 简化为只保留 `SITE_DOMAIN` 与前置条件说明
- `deploy.yml`:部署前打印站点域名、DNS 解析结果、与本机公网 IP 的一致性告警;部署后新增 **runner 侧公网验证步骤**(最多 15 次 × 10s 重试),失败时按「安全组 443 → DNS → acme 日志」顺序给排查提示,成功则打印首页响应头、`/sw.js` 缓存头与 http 跳转

### 前置条件

- 阿里云安全组放行 **443**(TLS-ALPN-01 验证与浏览器访问都走它);80 保持被 OpenResty 占用即可
- 将来退订阿里云建站产品后,可把 ports 加回 `80:80` 让 Caddy 自己做跳转(见 `.env.example` 注释)

### 验证

- caddy v2.11.4 `validate` 通过;`adapt` 输出确认 `subjects: ["persecond.work"]`、`issuers: [{module: acme, challenges: {http: {disabled: true}}}]`、`listen: [":443"]`
- `deploy.yml` / `docker-compose.yml` 经 js-yaml 解析通过
- 真实签发与公网可达性由新增的 Verify 步骤在 Deploy 中自动判定

---

## [v2.5-infra3] · 2026-09-08 · 夺回 80/443:部署自动停掉建站产品容器

### 背景

- https 返回 502 且 `Server: openresty`、证书受信任 → 443 也被占;服务器 `ss -lntp` 显示 80/443 的监听者是 **docker-proxy**,宿主机无 openresty 进程、无相关 systemd 服务 → 阿里云建站产品以**容器**形式运行,平台内删不掉
- 该容器与我们的端口发布互斥,https 流量到不了 Caddy(502 来自它坏掉的后端)

### 改动

- `deploy.yml` 在 `docker compose up` 之前新增端口回收:遍历运行中容器,凡发布 80/443 且非 `work-timer` 者,先 `docker update --restart=no` 再 `docker stop`,防止它复活再抢
- `docker-compose.yml` 恢复发布 `80:80 + 443:443`(80 供 Caddy 308 跳转与 HTTP-01 验证);同时补回被旧版文件覆盖丢失的 `environment.SITE_ADDRESS`、`caddy_data/caddy_config` 证书卷与 2019 健康检查
- `Caddyfile` 去掉 `disable_http_challenge`,HTTP-01 与 TLS-ALPN-01 两种验证都可用
- 部署日志改用 `docker ps -a` 全量列表,便于确认端口归属

### 验证

- caddy v2.11.4 `validate` 通过;`docker-compose.yml` / `deploy.yml` 经 js-yaml 解析通过;`.gitignore` 确认无 NUL 字节
- 真实效果待 Deploy:预期日志出现「停止占用 80/443 的容器: <建站容器名>」,随后 Verify 步骤打出 `HTTPS OK`

---

*创建于 2026-09-04*
