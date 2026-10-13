# Changelog · Salary Timer v3.0

> **v3.0 独立 changelog 文件**。基线分支 `feat/v3.0-mobile`（自 v2.5-patch18）。
>
> 主题：**回归简单记账** —— 减法 + 叙事。三条原则：三秒记一笔 · 所见即账 · 钱要有故事。
>
> 历史变更见 [`docs/CHANGELOG.md`](./CHANGELOG.md) 索引。

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

## [v3.0] · 2026-10-13 · 取消钱包 · 总资产手动维护 (TASK-057 · 后端批次)

基线 v3.0-TASK-056。目标：移除多账户钱包对「只想记一笔」的摩擦，记账与资产解耦。本批完成**后端核心**(T-571/572/573/575/576)，UI 接入(资产计算器 Sheet / 调整历史 / 账户 UI 下线)留到后续批次。

### A · 资产计算器表达式 (T-572 · 后端)

- `src/lib/accounting/assetExpr.ts` 新增 `parseAssetExpression(input)`：
  - 纯数字 `13000` / `1,200,500` / `12500.50` → `mode: 'absolute'`,直接覆盖总额
  - 带符号 `+500` / `-200` / `12500+500-200` / `+1,200.5` → `mode: 'delta'`,累加/累减
  - 非法：空串 / 末尾运算符 / 多小数点 / 非数字字符 / 解析非有限数 → `null`
- `previewAsset(current, parsed)`：返回应用后的预览值
- `assetExpr.test.ts`：15 条单测(absolute 4 / delta 5 / 非法 6 / preview 4,含千分位、小数链、链式)

### B · 总资产状态 + 调整历史 (T-571/573)

- `src/lib/types.ts` 新增 `AssetsState { totalAssets, updatedAt }` + `AssetSnapshot { id, before, after, delta, note?, createdAt }`
- `accountStore.assets` 默认 `{ totalAssets: 0, updatedAt: 0 }`,`assetSnapshots` 数组
- `setTotalAssets(parsed, note?)`:
  - `absolute` 模式直接覆盖,`delta` 模式累加
  - 写入即追加一条 `AssetSnapshot`(环形裁剪 200 条,带备注可选)
  - 无变化(after === before)直接返回当前值,不写 snapshot
- `rollbackLastAsset()`:回滚到最后一次 snapshot 之前
- `migratedV3: false` 迁移标志预留(rehydrate 一次性迁移留到 UI 批次,本批仅加字段)

### C · 虚拟资产口径改写 (T-575)

- `calcVirtualAssets` 入参从 `accounts: Account[]` 改为 `totalAssets: number`
- `actualTotal` 不再来自 `Σ accounts[].balance`,改读用户手动维护的 `assets.totalAssets`
- `pendingAdjust` 字段**整体移除**(原"未归入账户的调整项"概念已无意义 —— 记录不再与资产对账)
- 四个池分解项(预付未消耗 / 已消耗未支付 / 已赚未到账 / 押金待退 / 押金待付)计算逻辑不变
- `virtual.test.ts` 全部 10 条用例按新口径重写基线(空数据 / 房租预付 / 工资已赚 / 多池合计 / 押金存池 etc)

### D · 记录 accountId 冻结 (T-576)

- `recordAffectsBalance()` 恒返回 `false`(函数签名保留以便回滚)
- `addRecord` 不再调 `updateAccount` 改余额 —— 记账与资产**完全解耦**
- `Account` 类型注释更新:数据保留为「只读存档」,新记录 `accountId=''` 即可
- `stats.test.ts` 1 条用例更新:旧"手动/认领动余额"断言改为恒 false

### E · 同步适配

- `src/components/Accounting/MinePage/MinePage.tsx`: `TotalAssetsCard` 改读 `assets.totalAssets`,移除 `pendingAdjust` 展示入口
- `src/lib/accounting/index.ts`: 导出 `parseAssetExpression` / `previewAsset` / `AssetExprResult`
- `src/store/pool-store.test.ts`: 3 处 `calcVirtualAssets` 调用同步从 `accounts` 改为 `totalAssets`
- `src/store/goals-store.test.ts`: 3 条 v2.4 「记账 → 余额联动」用例按新语义重写(余额不再被记账改变)
- `src/store/pool-store.test.ts`: 4 条 partial claim / 联动用例同步(余额期望从 `+700` 改为 `0`)
- `src/store/pool-store.test.ts`: 2 条日均金额用例改用 `daysInMonth(monthKey)` 动态计算,允许 9 月(30 天)/ 10 月(31 天)差异

### 不做的事

- ❌ 资产计算器 Sheet UI(留到下批,本批只有表达式解析纯函数)
- ❌ 调整历史弹层 UI(数据结构已备好,UI 后续)
- ❌ 账户 UI 下线(AccountRow / AddAccountModal / 拖拽归入 / 未归入红标移除)—— MinePage 暂保留 AccountRow 渲染
- ❌ `migratedV3` 一次性迁移逻辑(rehydrate 阶段留到下批)
- ❌ 删除 Account 存量数据(保留只读存档以便回滚)

### 验证

- ✅ `npm run typecheck` 通过(0 errors)
- ✅ `npm run test`:**458 / 458 通过**(本次新增 15 条 `assetExpr.test.ts`,修复 9 条 v2.4 旧测试以适配 T-576 语义)
- ✅ `npm run build` 成功(4.96s)
- ✅ 用户浏览器验收通过(2026-10-13)


