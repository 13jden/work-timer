# Changelog · Salary Timer v2.3

> **v2.3 独立 changelog 文件**。基线分支 `feat/v2.3-mobile`(自 `feat/v2.2-mobile`)。
>
> 历史变更见 [`docs/CHANGELOG.md`](./CHANGELOG.md) 索引。

---

## [v2.3] · 2026-09-04 · 池机制(TASK-039)

### A · 池机制数据模型（定稿版，经两轮用户反馈重设计）

- **核心模型**:建池**不预生成任何记录**;均摊消费记录在「那一天到来时」逐日生成(每天一条真实消费记录);认领 = 实际付款记录关联池并打 `claimed` 标记(预付性质,不计入消费统计),与每日均摊记录相互独立(删付款不回滚均摊)
- **`PoolConfig` 扩展**:`dateRange`(完整日期范围,可跨月)、`dailyAmount`(用户自填日均)、`cycleMode`、`categoryId`(均摊记录挂载分类)
- **`PoolCycle` 扩展**:`paidAmount`(已认领总额)
- **`AccountRecord.poolStatus` 三态**:`virtual`(旧存量兼容)/ `claimed`(均摊认领付款,不计消费统计)/ `confirmed`(存池型存入/取出,正常计入)

### B · pool.ts 纯函数层(29 单测)

- 周期日期构建:`buildCycleDateKeys` / `buildDateRangeKeys`(完整日期范围与当月交集)/ `eachMonthInRange`(跨月拆分)
- 周期草稿(只生成元数据不生成记录)、到期生成计划 `planDailyRecords`(只生成 ≤ 今天且未生成)
- 状态派生 `deriveCycleStatus`(已认领额 + 是否到期)、存池余额 `depositBalance`、认领进度 `equalizeProgress`

### C · store 池业务 actions(10 集成测试)

- `createPoolWithCycles`:均摊型按日期范围跨自然月拆周期;建池立即同步
- `syncPoolCycles`:到期逐日生成真实消费记录(精确金额分配、尾差补末日、幂等不重生)+ 跨月补周期 + 逾期扫描;应用启动时调用
- `claimToPool`:均摊型打 `claimed` 标记 + 认领额累计;存池型追加已确认交易
- `deleteRecord` 三类回滚:付款记录→认领额回退(不动均摊);存池交易→移除;每日均摊→交易保留防重生
- `deletePool`:连带删除池的全部记录并回退账户余额
- 消费统计过滤:`visibleRecords` 排除 `virtual` + `claimed`;6 处 UI 聚合(今日流水/分类文件夹/分类详情/未分类区等)统一接入

### D · MINE tab 池管理页(替换占位页)

- **PoolPage**:均摊池卡片(进度条 + 状态徽标:进行中/已确认/已逾期)、存池卡片(余额)、删除连带清理
- **AddPoolModal 建池弹窗**:均摊/存池切换;**日历点选日期范围**(`DateRangePicker` 内联月历,可跨月,第一次点起点第二次点终点);日均/总额二选一实时联动推导;挂载分类选择

### E · 记账弹窗池关联(认领入口)

- `AddRecordModal` 新增「池关联(认领)」下拉(支出→全部池,收入→仅存池型);保存后自动认领;已认领记录展示「预付 · 不计入消费统计」

### F · 统计页

- 新增「含虚拟池预扣」开关(接 `includeVirtualPool`)

### 验证

- typecheck 0 错误、339 单测全过、build 成功
- 用户浏览器验收通过(2026-09-04)

---

*创建于 2026-09-04*
