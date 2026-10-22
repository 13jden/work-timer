# Changelog · Salary Timer v3.0

> **v3.0 独立 changelog 文件**。基线分支 `feat/v3.0-mobile`（自 v2.5-patch18）。
>
> 主题：**回归简单记账** —— 减法 + 叙事。三条原则：三秒记一笔 · 所见即账 · 钱要有故事。
>
> 历史变更见 [`docs/CHANGELOG.md`](./CHANGELOG.md) 索引。

---

## [v3.0] · 2026-10-22 · 支持 0 元记录 · 别人请客也能记 (TASK-062)

现实中有一类消费值得记下来，但金额是 0：别人请客、公司买单、霸王餐。
之前弹窗只接受 > 0 的金额，用户要么被迫填个假金额污染统计，要么干脆不记（丢失消费轨迹）。
本次放开 0 元记录。

### A · 金额校验放开 0

- `AddRecordModal`：`amount <= 0` 拦截 → 改为仅拦截「空输入 / 非数字 / 负数」
- 空输入仍然非法（必须真的输入 `0`，而不是什么都没填）
- 负数单独提示「金额不能为负数」，不再混在「请输入有效金额」里
- `QuickAddRecord`（快速记录）同步放开 0

### B · 0 元记录的语义

| 维度 | 行为 |
|---|---|
| 账户余额 | 不变（delta = 0） |
| 收支统计 | 计入笔数，对总额 / 占比贡献为 0 |
| 列表展示 | 显示 `¥0.00`，**不带正负号** |
| 分类聚合 | 归入对应分类，`total` 贡献 0，`count` + 1 |

- 存 0 元记录时不再产生 `-0`（负零会让列表渲染成 `-¥0`）

### C · 交互提示

- 弹窗内金额为 0 时，金额区下方显示灰色提示「¥0 记录 · 例如别人请客，不计入金额统计」

### D · 新增文件

- `src/components/Accounting/AddRecordModal/AddRecordModal.test.tsx`：0 元保存 / 余额不变 / 统计不变三个用例
- `docs/plans/tauri-migration/v3.0/TASK-062-v3.0-zero-amount-record.md`

### 附：APK 重打 + dev server 修复

- 重打 arm64 APK：`dist-android/SalaryTimer-3.0.0-arm64.apk`（11.71 MB，v2 + v3 签名）
  - 本次只编 arm64（`--target aarch64`），APK 内只含 `lib/arm64-v8a/`，无需 `aapt remove`
  - `public/downloads/manifest.json` 同步新 sha256 / 体积 / 日期
- `vite.config.ts` 的 `server.watch.ignored` 排除 `**/src-tauri/**`：Android/Gradle 构建会生成并锁住
  `problems-report.html` 等报告文件，Vite 监听时抛 EBUSY 会让 dev server 直接崩

### 验证

- `npm run typecheck` 通过
- `npm run test` 466 / 466 通过
- `npm run build` 成功
- arm64 APK 签名校验通过（v2 + v3），`resources.arsc` 对齐 OK

---

## [v3.0] · 2026-10-22 · 一程详情页手账化 + 钱包开关一致性修复 (TASK-061)

三个问题一起修：关闭钱包后资产卡仍显示「未分类」、一程详情页的记录只能看不能改（且「取消关联」保存不生效）、有照片的记录在详情页没有差异化展示。

### A · 关闭钱包后不再显示「未分类」

- `MinePage.tsx` → `TotalAssetsCard`：「未分类」来自 `pendingAdjust`（未归入账户的待调整项）
- 现在只在 `walletEnabled` 时渲染；`hasPending` / `hasBreakdown` 计算同步排除，避免出现空的容器
- 池相关的「未支付 / 待付 / 预付未消耗 / 已赚未到账 / 待退」不受影响，照常显示

### B · 一程详情页记录可编辑 + 修复「取消关联保存不生效」

**根因**：`AddRecordModal.handleSave` 构造 patch 时用的是条件展开

```ts
...(journeyId ? { journeyId } : {})   // journeyId 为空时整个键都不存在
```

而 `accountStore.updateRecord` 的合并语义是 `{ ...oldRecord, ...patch }` —— **不传键 = 不改动**。
所以点 ✕ 取消关联后，旧 `journeyId` 被原样保留。修复为编辑分支显式传键：

```ts
journeyId: journeyId || undefined,   // 显式 undefined = 解除关联
```

`handleSave` 与 `handleSaveAndAgain` 两处都改了。

- 详情页记录行现在可点击打开编辑弹窗，行为与统计页 `RecordRow` 一致
- 键盘可达：`role="button"` + `tabIndex=0` + Enter / Space
- 顺手修掉一个崩溃隐患：原代码在 `useImage` / `useMemo` 之前就 `if (!journey) return null`，一程被删除时 hook 数量骤减会触发 React 报错。现已把所有 hook 提到 early return 之前

### C · 详情页记录区改成「旅行手账」

沿用详情页已有的英雄封面 + 圆形邮戳这套「实体旅行物件」语言，而不是另起一套风格。

- **墨块日期章**（签名元素）：日期以实心墨块 + 轻微旋转呈现，右侧接一条手账点状虚线，尽头浮着当日笔数与小计
- **拍立得贴片**（有照片的记录）：白边 + 投影 + 轻微旋转的方形照片。照片是页面里唯一饱和的颜色块，自然成为视觉焦点
- **紧凑行**（无照片的记录）：左槽放弱化的分类圆标，与有图记录共用同一条 76px 竖向基线，栅格不跳

```
▌10/21 周三 ┈┈┈┈┈┈┈  2 笔  -¥163
 ┌──────┐  餐饮
 │ IMG  │  野生菌火锅          -¥128     ← 备注 15px，可换行
 └──────┘
  ●  餐饮  烤乳扇              -¥35      ← 备注 13px，单行省略
```

- 点照片 → 全屏放大（复用已有的 `ImagePreview`，`stopPropagation` 不会误触发编辑）
- 点记录其他位置 → 进编辑弹窗
- 分组逻辑抽成纯函数 `groupJourneyRecordsByDay` 放进 `src/lib/accounting/journey.ts`（配套 `journeyStampDate` / `journeyWeekday`），可直接单测

### D · 新增文件

- `src/components/Accounting/Journey/JourneyPhotoTile.tsx`：拍立得贴片组件
- `src/components/Accounting/Journey/JourneyDetailPage.test.tsx`
- `src/components/Accounting/MinePage/MinePage.test.tsx`
- `docs/plans/tauri-migration/v3.0/TASK-061-v3.0-journey-journal.md`

### 验证

- `npm run typecheck` 通过
- `npm run test` 463 / 463 通过
- `npm run build` 成功

---

## [v3.0] · 2026-10-21 · APK 打包链路修复 · 体积 73 MB → 11.71 MB

### 根因

`public/downloads/` 存放网站下载页用的 APK。Vite 会把 `public/` 原样复制进 `dist/`，而 Tauri 又把整个 `dist/` 压缩成 `tauri-codegen-assets` 并链进 Rust 二进制，导致旧 APK 被嵌进新 APK：

| 阶段 | 体积 |
|------|------|
| dist（含旧 APK） | 20.14 MB |
| .so (arm64) 嵌入旧 APK 后 | 18.45 MB |
| universal APK（4 架构叠加） | **73.06 MB** |

### 修法

- `package.json` 新增 `build:tauri` 脚本（`scripts/build-tauri.mjs`）：设 `TAURI_BUILD=1` 后调用 Vite build API，跨 Windows / POSIX 行为一致
- `vite.config.ts` 新增 `excludeDownloads` 插件：`TAURI_BUILD=1` 时构建结束删除 `dist/downloads/`，并关闭 sourcemap（约 2.4 MB `.map` 同样会被嵌入二进制）
- `tauri.conf.json` 的 `beforeBuildCommand` 改为 `npm run build:tauri`；`version` 升到 `3.0.0`
- 网站部署仍走 `npm run build`，`dist/downloads/` 保留，下载页不受影响

修复后 dist = 1.21 MB，.so (arm64) = 9.19 MB，arm64 APK = **11.71 MB**。

### 其他

- `public/download/index.html` + `public/downloads/manifest.json` 同步到 v3.0.0（版本号 / 日期 / sha256 / 体积）
- `docs/ANDROID-APK-PACKAGING.md` 补上 `build:tauri` 强制说明与体积排查条目

### 验证

- `npm run build` 成功
- `npm run build:tauri` 成功，`dist/` 体积 ≈ 1.2 MB
- arm64 APK 签名校验通过（v2 + v3）

---

## [v3.0] · 2026-10-16 · 取消钱包·总资产直接改 (TASK-057)

钱包（账户体系）从「记账入口筛选工具」降级为「可关闭的展示层开关」。关闭钱包仅影响总资产卡的账户行显示，不影响底层数据逻辑。

### A · 展示层双形态（数据逻辑不变）

- **关闭钱包**：总资产卡始终显示「总资产」大数字 + 虚拟分解 chip（已赚未到账、预付未消耗、待退），不过钱包筛选；AccountRow 账户行不渲染
- **开启钱包**：总资产卡显示「总资产」+ 虚拟分解 chip + AccountRow 账户行

### B · 总资产卡交互

- ⚙ 按钮 → `WalletSwitchSheet` 切换钱包开 / 关
- 开启钱包时：点击账户小卡 → `AccountDetailPage` 每账户详情页
- 关闭钱包时：账户行不渲染，无详情入口

### C · 新增组件

- `src/components/Accounting/MinePage/WalletSwitchSheet.tsx`：钱包开关 Sheet（TASK-057）
- `src/components/Accounting/MinePage/AccountDetailPage.tsx`：账户详情页（TASK-057）
- `src/components/Accounting/MinePage/AccountDetailPage.module.css`

### 验证

- `npm run typecheck` 通过
- `npm run test -- src/lib/accounting/stats.test.ts` 24 tests 全绿

---

## [v3.0] · 2026-10-13 · 统计页列表优先 (TASK-055)

基线 v2.5-patch18。现状：统计页月 / 年视图默认柱状图 + 分类排行，用户想翻一翻这个月的账反而被图表挡住。本轮把「列表」扶正为默认视图，图表降级为可切换模式。

### A · 月 / 年视图默认改为「列表」

- 新增列表 / 统计切换器（`SegmentedControl`），汇总条下方右对齐；月 / 年视图显示，日视图隐藏（日永远列表）
- 默认「列表」；状态仅记忆在本次会话，不持久化
- 视图切换（日 / 月 / 年）保持当前模式

### B · 列表模式

- **月视图**：按天分组（天头：日期 + 星期 + 当日支 / 收小计）+ 当日记录行；天头 `position: sticky` 吸顶
- **年视图**：按月分组（月头：月份 + 当月支 / 收小计 + 折叠箭头）+ 月内按天分组；默认展开最近 2 个月，其余折叠（折叠态只渲染月头，零开销）
- 月 / 年切换时复用同一分组列表组件

### C · 记录行抽取共用

- `src/components/Accounting/RecordRow/` 新建，从 `StatsPage` 内嵌的 `DayRecordRow` 抽出独立组件
- 三种模式（日列表 / 月列表 / 年列表）+ 日视图共用同一份 `RecordRow`（点击编辑、池标记、拖拽行为不变）

### D · 「账本头条」汇总卡片

- 顶部：日 / 月 / 年 segmented 满宽（页面级控件）
- 卡片内：期间标签（mono）左 + 范围（mono）右 → 支出 / 收入双块大数字（display 衬线 + 红 / 绿符号 + 环比）→ 列表 / 统计 toggle（仅月 / 年）
- 左侧 2px 极淡 ink-2 竖条作锚点
- 无虚线 / 撕开孔线 / 序号等花边装饰

### E · 纯函数 + 单测

- `src/lib/accounting/stats.ts` 新增 `groupByDay` / `groupByMonth` 两个纯函数（按日期降序、组内按 `createdAt` 降序、空组不出现在结果中）
- `groupByDay` / `groupByMonth` 单测覆盖：空数组、单日 / 单月、单日多笔、跨月、跨年、含 claimed 池记录

### F · 交互保持

- 列表模式点击记录行：打开编辑弹窗（不变）
- 列表模式拖拽归入账户：保留（TASK-057 才移除账户体系）
- 统计模式点柱子下钻后：自动切回「列表」模式对应期
- 支出 / 收入切换：列表模式展示全部记录（金额自带正负色），仅分类排行按类型过滤

### 不做的事

- ❌ 列表虚拟滚动（数据量未到，月 / 年折叠已够用）
- ❌ 搜索 / 筛选（v3.1 backlog）
- ❌ 账户体系改动（留给 TASK-057）
- ❌ 修改 `TimerCard` / `StatCard` / `QuoteCard` / `BottomNav` 等稳定组件样式

### 验证

- `npm run typecheck` 通过
- 单测全过（`groupByDay` / `groupByMonth` 新增覆盖）
- `npm run build` 成功
- 用户浏览器验收通过（2026-10-13）

---

## [v3.0] · 2026-10-13 · 记录附图：本地图片 (TASK-056)

基线 v3.0-TASK-055。记账单条记录可关联一张图片（小票 / 截图 / 现场照）。图片全部本地存储，延续「不上云、不注册、不联网」原则；主数据在 localStorage（配额约 5MB），图片走 IndexedDB 避免撑爆。

### A · 图片存储层（IndexedDB）

- `lib/imageStore.ts` 新建：IndexedDB 封装（`salary_timer_images` 库，`imageId → Blob`），单例 db 句柄
- 全部 API 静默降级：无 `indexedDB`（测试 / 隐私模式）→ put/get/delete/has 返回 `false` / `null` / 静默 noop；IO 失败吞掉不抛
- 失败不阻塞记账主流程
- 单测覆盖降级分支（`src/lib/imageStore.test.ts`）

### B · 压缩管线

- `lib/imageCompress.ts` 新建：`compressImage(file, maxEdge=1280, quality=0.8)` → 缩放 + JPEG 重编码
- 用 `createImageBitmap` 解码（不支持时降级 `Image + ObjectURL`）
- 原图本就不大（≤1280px 且 ≤300KB）→ 跳过重压缩直接透传
- HEIC / 浏览器无法解码 → 抛 `ImageCompressError('UNSUPPORTED_FORMAT')` 提示「该图片格式暂不支持」
- `genImageId()`：与现有 `genId('rec')` 一致的 `img-<ts>-<rand>` 风格

### C · `useImage` hook

- `src/hooks/useImage.ts` 新建：`useImage(imageId)` → `{ url, status: 'idle' | 'loading' | 'ok' | 'missing' }`
- 挂载时 `getImage` → `URL.createObjectURL`，imageId 变化或组件卸载时 `revokeObjectURL` 避免内存泄漏
- 缺失 / 不支持时返回 `status='missing'`，UI 兜底渲染空

### D · 记录数据扩展 + 级联清理

- `AccountRecord.imageId?: string`（`src/lib/types.ts`）
- `addRecord` / `updateRecord` / `deleteRecord` / `deleteRecordCascade` 支持 imageId 读写
- 换图 / 删图时自动检测孤儿 imageId 并从 IndexedDB 清理（`lib/accounting/images.ts` 纯函数 + 10 条单测）
- 编辑模式：换图不需手动调清理；删图走原 deleteRecord 流程

### E · UI 接入

- **新增 `RecordThumb`**：36px 圆角缩略图（点击 stopPropagation 触发预览，不打开编辑）
- **新增 `ImagePreview`**：全屏黑色蒙层（rgba 0.92）+ 图片居中 + ESC / 点遮罩关闭 + 锁定背景滚动
- `RecordRow`（共用记录行）：有图时在「备注右侧、金额左侧」插入缩略图
- `TodayRecordsList` / `DayDetailSheet` / `GroupedRecordList`（月 / 年视图）：列表行同步接入缩略图 + 预览
- `AddRecordModal`：
  - 备注行右侧加图片按钮（虚线小方块 🖼，压缩中显示 `…`）
  - 选中后改为 40px 缩略图 + 右上角黑色 ✕ 移除按钮
  - 编辑模式直接渲染原图（useImage hook），移除走 `removeExisting` 标志
  - 取消弹窗 → pendingBlob 未入库，无副作用
  - 分类区改成 4 列 × 2.5 行（200px 限高）内部可滚动，按用户「分类选择只占 2.5 行、可上下滑动」要求

### F · 失败 / 边界

- 无 IndexedDB 环境：put 失败 → 提示「图片保存失败，请重试」，不写入 record
- HEIC 等格式：弹窗内显示「该图片格式暂不支持」
- 取消弹窗不触发 IndexedDB 写入
- 删 / 换孤儿图片在后台静默执行，不阻塞 UI

### 不做的事

- ❌ 多图（一条记录一张，控制存储与 UI 复杂度）
- ❌ 图片编辑 / 滤镜 / 捏合缩放预览
- ❌ 独立「相册」页（删图级联即可，见 PRD §09 Q3）
- ❌ 图片云端同步（与「本地优先」原则冲突）

### 验证

- `npm run typecheck` 通过
- 单测 436/438 通过（+16 新增：`imageStore.test.ts` 6 条 + `images.test.ts` 10 条；2 个 v2.3 池测试为基线遗留失败，与本次无关）
- `npm run build` 成功
- 用户浏览器验收通过（2026-10-13）

---

## [v3.0] · 2026-10-20 · 一程 · 旅游记录全功能交付 (TASK-059 Phase 3)

基线 v3.0-TASK-058。前置已落地：`e09e9bc` Phase 1（数据层 + 瀑布流骨架）、`8b7e1c8` Phase 2（MINE 入口调整 + 关联其他 + 页面重设计）。本次完成 Phase 3 全部剩余工作,并把 UI 文案统一改为「旅游记录」（用户要求:不解释太复杂、不提兼职）。

### A · 封面图管线（沿用 TASK-056 图片库）

- `JourneyDetailPage` 英雄封面点按 → 原生 `<input type="file">` → `compressImage` 压缩 + `genImageId` 配 ID + `putImage` 入 `salary_timer_images` 库
- 用 `useImage` hook 加载，`URL.createObjectURL` 在组件卸载 / imageId 变化时自动 `revokeObjectURL`,避免内存泄漏
- 处理失败（HEIC / IO 错误）静默吞错,input value 重置允许重选同一张
- 渐变占位卡（支出暖橙 / 收入绿）保留,未设封面时显示 `AirplaneTilt` 大图标 + 「设置封面」提示

### B · JourneySelector 抽出（独立全屏 sheet）

- `src/components/Accounting/Journey/JourneySelector.tsx` + `JourneySelector.module.css` 新建
- 被 `AddRecordModal` 的「旅游记录」chip 调用,按当前类型过滤 + `updatedAt` 降序
- 空态：飞机图标 + 「还没有旅游记录」+ 跳转指引「去「我的 → 旅游记录」新建一段」
- 行内点击 `stopPropagation` 防止冒泡穿透到外层 `AddRecordModal` overlay（修复「选完直接退回主页」)

### C · AddRecordModal 接入「旅游记录」chip

- `fieldLabel`: 「所属一程」→「旅游记录」
- chip 样式：选中态为 `ink` 反色 ✕ 移除按钮；未选时是 dashed 边框「+ 添加」按钮
- 类型切换时联动校验：若已挂 chip 与新 type 不匹配 → 自动清空
- 与钱包开关解耦：钱包关闭时也展示此 chip（归类路径不依赖钱包）

### D · RecordRow 行尾显示关联旅游记录 chip（沿用钱包标签同位置）

- 改动文件: `src/components/Accounting/RecordRow/RecordRow.tsx` + `RecordRow.module.css`
- 逻辑: `journeys.find(j => j.id === record.journeyId)` 命中时 → 行尾显示 `AirplaneTilt(11px fill) + 行程名`
- chip 样式: `accent` 22% 半透底色 + ink 色文字 + mono 字体 + 圆角 999px + `max-width:110px` 截断
- 不受钱包开关影响（始终展示）
- 适用范围: StatsPage 日 / 月 / 年列表视图（三视图共用同一 RecordRow）

### E · UI 文本「一程」→「旅游记录」全量改名

| 文件 | 旧 | 新 |
|---|---|---|
| `JourneySection` | "我的一程" / "JOURNEY" 邮戳 / "把一次旅行、一次兼职记成一程" | "旅游记录" / "TRIP" / "把一次旅行记成一段记录" |
| `JourneyListPage` | "我的一程" / "还没有一程" / "把一次旅行、一次兼职…串成一个有故事的小册" / "开始第一程" | "旅游记录" / "还没有旅游记录" / "把一次旅行…串成一个有故事的小册" / "开始第一段" |
| `JourneyDetailPage` | header「一程」/ CTA「给这一程记一笔」 | header「旅游记录」/ CTA「给这段记一笔」 |
| `JourneyEditModal` | "新建/编辑一程" / "删除一程" | "新建/编辑旅游记录" / "删除" |
| `JourneySelector` | "关联一程" / "还没有收入/支出程" / "「我的 → 我的一程」" / 副标"收入程/支出程" | "选择旅游记录" / "还没有旅游记录" / "「…→ 旅游记录」" / 副标"收入/支出" |
| `JourneyRecordPicker` | 「本程已关联」/ 「其他程已关联」/ 「未归入任何程」/ tag 本/他/未挂 / fallback "另一程" | 「已关联到这里」/ 「已关联到其他」/ 「未归入」/ tag 当前/其他/未归 / fallback "另一段" |
| `AddRecordModal` | 「所属一程」/ 移除按钮 aria / "关联" | 「旅游记录」/ 移除按钮 aria / "添加" |

> 用户特别说明:「不加什么兼职、不在页面里解释太复杂」。已在 `JourneySection` / `JourneyListPage` 空态里删除「一次兼职」字样；选择器与详情页不再出现 "收入/支出程" 措辞。

### F · 配套修复

- `JourneyRecordPicker` 的 `grouped` 计算: 之前一次替换意外把 `j` 的查找 + `push` 弄丢；本次补回 + 改名
- `JourneySection` / `JourneyDetailPage` / `JourneyListPage` 三页 eyebrow、标题、CTA、空态文案统一更新
- `Journey/index.ts` 加一行 re-export
- `RecurringCard` 顺手清理一处 "一程" 残留字

### 不做的事

- ❌ 一程预算（「这趟预算 5000」→ v3.1+ 与月度预算一起评估）
- ❌ 批量多选记录挂程（先走单条编辑挂程 + 「关联其他」勾选）
- ❌ 一程分享 / 导出海报

### 验证

- `npm run typecheck` 通过
- `npm run test` 447 / 447 通过
- `npm run build` 成功
- 用户浏览器验收通过（2026-10-20）


