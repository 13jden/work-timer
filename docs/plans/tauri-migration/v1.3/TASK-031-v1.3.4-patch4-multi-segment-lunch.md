# TASK-031 · v1.3.4-patch4 多段工时 + 午餐在间隙 的净工时 / 午休扣除 BUG 修复

> **状态**:⏳ 进行中
> **依赖**:v1.3.4-patch3(`feat/v1.3.4-patch3-right-panel`)
> **估时**:0.3 天
> **对应版本**:v1.3.4-patch4

## 目标

修复 `computeNetHours` 在**多段工时 + 午餐落在工时间隙**场景下,**净工时 / 午休扣除 / 摸鱼扣除**三项被错误计算的 BUG。

### 用户反馈原文

> 就是,调整默认时间以后,对应的时间记录的,总工时,没变。应该都实时更新,而且,如果现在过了午休时间,也应该把午休加进去 还有就是,(默认的配置修改),要检查今天的工时对应,然后更新时薪

### 根因

`computeNetHours` 用 **一个连续窗口** `[mergeStart, mergeStart + effectiveGross]` clip 摸鱼∪午餐 union:

```ts
const effectiveGross = Math.min(elapsedWorkedMin, grossMinutes);
const mergeStart = merged.length > 0 ? toMinutes(merged[0]!.start) : 0;
const effectiveWindowEnd = mergeStart + effectiveGross;
const effectiveSlack = clipIntervalsToElapsed(unionIntervals, mergeStart, effectiveWindowEnd);
```

但多段工时下,`elapsedWorkedMin` 跨越**间隙**(例如 12:00–14:00 午餐时间):

| 输入 | `elapsedWorkedMin` | 实际分布 | `mergeStart + effectiveGross` |
|---|---|---|---|
| `[{09-12}, {14-18}]` + `now=16:00` | 5h | `[09-12] 全部 + [14-16]` | `[09:00, 14:00]` = **5h 跨间隙** ❌ |

旧算法把整段 5h 当作连续区间 → 间隙 `[12:00, 14:00]` 内的午餐被错误 clip 进窗口,误扣。

`lunchElapsed` / `slackingElapsed` 也用同样公式,错算。

## 失败场景对照

| # | 工时 | 午餐 | now | 旧 `lunchElapsed` | 期望 | 状态 |
|---|---|---|---|---|---|---|
| 1 | 单段 `09-18` | `12-13` | 14:00 | 60 | 60 | ✅ |
| 2 | 多段 `09-12, 14-18` | `12-13` (间隙) | 16:00 | **60** | **0** | 🐛 |
| 3 | 多段 `09-12, 14-18` | `13-14` (间隙) | 15:30 | **30** | **0** | 🐛 |
| 4 | 多段 `09-12, 13-18` | `12-13` (间隙) | 17:00 | **60** | **0** | 🐛 |
| 5 | 多段 `09-12, 13-18` | `11:30-12:30` (与上午重叠 30min) | 17:00 | **60** | **30** | 🐛 |

场景 2-5 都是"多段 + 午餐跨越间隙"的不同变体,旧算法一律错算。

## 修复方案

**按每个 merged 段独立 clip**,自然跳过段间间隙:

```ts
/**
 * v1.3.4-patch4:在每个 merged 段内 clip 区间,返回总分钟数
 *
 * 替代旧的 [mergeStart, mergeStart + effectiveGross] 单窗口算法,
 * 解决多段工时下"elapsedWorkedMin 跨越间隙,误把间隙内的午餐/摸鱼当作扣除"。
 *
 * 算法:
 *   - 遍历每个 merged 段 [segStart, segEnd)
 *   - 该段窗口 = [segStart, min(segEnd, nowMin)]   // 段尾或 now,取较小
 *   - 区间 clip 到该窗口,累加
 *   - 段间间隙不会被 clip 命中,午餐/摸鱼自然不计入
 */
function clipIntervalsPerSegment(
  intervals: Array<{ startMin: number; endMin: number }>,
  merged: WorkSegment[],
  nowMin: number,
): number {
  let total = 0;
  for (const seg of merged) {
    const startMin = toMinutes(seg.start);
    const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
    const segEnd = Math.min(endMin, nowMin);
    if (segEnd > startMin) {
      total += clipIntervalsToElapsed(intervals, startMin, segEnd);
    }
  }
  return total;
}
```

替换三处调用:
1. `effectiveSlack` —— 用 unionIntervals
2. `lunchElapsed` —— 把 [ls, le) 包成单元素数组
3. `slackingElapsed` —— 用 slackingIntervals

## 修复后预期

| 场景 | `grossElapsed` | `lunchElapsed` | `effectiveSlack` | `netMinutes` |
|---|---|---|---|---|
| 单段 + 过了午休 | 5h | **1h** | 1h | 4h ✓ |
| 多段 + 午餐在间隙 + 过了下午 | 5h | **0** | 0 | 5h ✓ |
| 多段 + 午餐与上午段重叠 30min | 7h | **30min** | 30min | 6.5h ✓ |

## 改动清单

### A · `src/lib/compute.ts`

#### A1 · 新增 helper `clipIntervalsPerSegment`

- 在 `clipIntervalsToElapsed` 旁边新增
- 注释标注 v1.3.4-patch4 修复根因

#### A2 · `computeNetHours` 三处替换

```diff
- const effectiveWindowEnd = mergeStart + effectiveGross;
- const effectiveSlack = clipIntervalsToElapsed(unionIntervals, mergeStart, effectiveWindowEnd);
+ const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
+ const effectiveSlack = clipIntervalsPerSegment(unionIntervals, merged, nowMin);

- let lunchElapsed = 0;
- if (config.lunchEnabled) {
-   const ls = toMinutes(config.lunchStart);
-   const le = ls + config.lunchMinutes;
-   const start = Math.max(ls, mergeStart);
-   const end = Math.min(le, mergeStart + effectiveGross);
-   if (end > start) lunchElapsed = end - start;
- }
+ let lunchElapsed = 0;
+ if (config.lunchEnabled) {
+   const ls = toMinutes(config.lunchStart);
+   const le = ls + config.lunchMinutes;
+   lunchElapsed = clipIntervalsPerSegment([{ startMin: ls, endMin: le }], merged, nowMin);
+ }

- const slackingElapsed = clipIntervalsToElapsed(
-   slackingIntervals,
-   mergeStart,
-   mergeStart + effectiveGross,
- );
+ const slackingElapsed = clipIntervalsPerSegment(slackingIntervals, merged, nowMin);
```

#### A3 · 删除未用变量

- `mergeStart` 不再被使用 → 删除(保留 `merged` 用于循环)

### B · `src/lib/compute.test.ts`

在 `computeNetHours · v1.3.4-patch2 实时累计` describe 块后追加 5 个 case:

1. **多段 `09-12, 14-18` + 午餐 `12-13` + now=16:00** → `lunchElapsed=0`, `effectiveSlack=0`, `netMinutes=300`
2. **多段 `09-12, 14-18` + 午餐 `13-14` + now=15:30** → `lunchElapsed=0`, `netMinutes=270`
3. **多段 `09-12, 13-18` + 午餐 `12-13` + now=17:00** → `lunchElapsed=0`, `netMinutes=420`
4. **多段 `09-12, 13-18` + 午餐 `11:30-12:30` + now=17:00** → `lunchElapsed=30`, `netMinutes=390`
5. **单段 `09-18` + 午餐 `12-13` + now=14:00(回归)** → `lunchElapsed=60`, `netMinutes=240`(确保单段行为不破坏)

### C · `src/lib/compute.test.ts` 已存在用例验证

- v1.3.4-patch2 实时累计的 9 个 case 必须全部仍然通过(单段场景)
- v1.3.3-patch5 加班日 + 段含日间 + 夜班:行为不变
- v1.3.4-patch1 跨天班次:行为不变(merged 仍按 0–1440 表示,nowMin 在段内时与旧逻辑等价)

## 约束

- ✅ 零修改组件样式 / 逻辑(TimerCard / StatCard / QuoteCard / TimeTrackerWidget / TimeTrackerDetailPage)
- ✅ 函数签名不变 `computeNetHours(input)`
- ✅ 所有现有测试必须通过(回归保护)
- ✅ 新增 5 个 case 覆盖多段 + 午餐各种位置

## 验证

### 自动化

- [ ] `npm run typecheck` 0 errors
- [ ] `npm run test` 全通过(原 221 + 新增 ≥ 5 = 226)
- [ ] `npm run build` 成功

### 手工验收(等用户在浏览器)

- [ ] **单段 + 启用午餐**:11:00 / 12:30 / 14:00 三个时刻查看 TimeTrackerDetailPage,午休扣除分别 0 / 30min / 1h,净工时同步
- [ ] **多段 + 午餐在间隙**:改为 [09-12, 14-18] 模板 + 午餐 12:00-13:00,在 14:30 / 16:00 / 17:00 查看,午休扣除都应该是 0
- [ ] **多段 + 午餐与上午段重叠**:午餐改 11:30-12:30 + 多段,17:00 查看,午休扣除 30min,净工时 = 7h - 30min = 6.5h
- [ ] **改 startTime 立即生效**:设置页改 startTime 从 09:00 → 09:30,详情页总工时从 5h → 4.5h
- [ ] **改 monthlySalary 立即生效**:设置页改月薪 10000 → 15000,详情页底部 "当前基础时薪 ¥XX/h" 立即更新

## 出口

1. 写 `docs/CHANGELOG-v1.3.md` v1.3.4-patch4 段
2. 更新 `docs/CHANGELOG.md` 索引表加 v1.3.4-patch4 行
3. 更新 AGENTS.md 末行版本号
4. 提交:`fix(compute): 多段工时 + 午餐在间隙时净工时/午休扣除错误`

---

*最后更新:2026-08-31 · v1.3.4-patch4 启动*