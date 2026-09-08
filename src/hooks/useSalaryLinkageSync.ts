/**
 * useSalaryLinkageSync — time → accounting 联动 同步 hook（全局版）。
 *
 * 把「真实当月」每个工作日的 earnedAmount 同步到 accountStore 的「工资池」
 * 联动 record。挂载一次即覆盖 today / 日历 / 记账 所有页面 —— 任何
 * 页面打开时联动值都会随秒级时间实时更新,不再依赖「打开的是日历页」。
 *
 * —— v2.5 TASK-046 T-501 起内嵌于 CalendarPage；v2.5-patch12 提升为全局
 *     hook,挂载在 App.tsx 的 <SalaryLinkageSync /> 上,以解决：
 *       - 在 today / 记账模式下打开 → 日历页没挂,今日实时值漏同步
 *       - 在当前月打开 → 切到下个月 / 过去月日历 → 当月实时值漏同步
 *
 * 与 CalendarPage 内嵌版本的差异:
 *   1. 始终使用 real current month（`now.getFullYear()` / `now.getMonth()`）,
 *      而非 calendarStore 当前浏览月份 —— "打开任意页面都跟 CalendarPage 一样更新"
 *   2. 过去月份的快照在它们各自的当月早已落库,本 hook 不会回灌(只 upsert 真实当月)
 *
 * v2.5-patch15 T-532 扩展:
 *   - 新增 backfill 逻辑:启动时遍历 `recordedFromDate` → 真实当月 的所有月份,
 *     每个工作日用 effectiveDailyRate 计算并 upsert 联动 record。
 *   - 这样用户在 account 模式查看「联动累计」时,过去月份的工资池都能准确反映。
 *
 * 语义:
 *   - 联动开启 (config.salaryLinkageEnabled) 时,每秒(随 useNow)对比「真实当月」
 *     monthlyEarnedMap 与上帧;只在变化的 dateKey 上调用 upsertSalaryLinkageForDate。
 *   - 首帧跳过今日实时值(避免用户刚启动 1s 内就把 0 → 真实值回写),
 *     过去日期照常同步(一次性补齐)。
 *   - 取消/消失:把 prevMonthlyRef 里有但当前 map 没有的 key 视为 0,但仅在
 *     「key 仍属真实当月 + 仍是工作日」时执行 —— 切月 / 休息日不会误删联动
 *     record(v2.5-patch3 T-471 修复)。
 *   - 联动关闭时:只刷新 prevMonthlyRef,不写 store(避免禁用后仍消耗 setItem)。
 *
 * 注意:
 *   - 只订阅必要切片(useCalendarStore 仅取 dayOverrides / monthlyRestModes),
 *     不订阅 calendarStore.year/.month(因为本 hook 不关心浏览月份)。
 *   - 调用方应只在 App 顶层挂一次(<SalaryLinkageSync />),避免多处挂载
 *     导致 effect 竞态。
 */
import { useEffect, useMemo, useRef } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useMonthlyStore } from '../store/monthlyStore';
import { useAccountStore } from '../store/accountStore';
import { HOLIDAYS } from '../lib/constants';
import { daysInMonthCalc, effectiveDailyRate, isWorkday, todayEarned } from '../lib/compute';
import { formatDateKey } from '../lib/time';
import { useNow } from './useNow';

/**
 * 解析 'YYYY-MM-DD' 为 [y, mIdx(0-11), d]，非法返回 null。
 * 用本地时区(避免 'YYYY-MM-DD' 直接 Date 构造被当 UTC 导致月份偏移)。
 */
function parseLocalDateKey(key: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
}

/** 比较两个 YYYY-MM-DD 字符串(字符串排序即可) */
function cmpDateKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 给 'YYYY-MM' 月份 key + delta 月数,返回新 key(字符串运算,无 Date 构造) */
function shiftMonthKey(monthKey: string, delta: number): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const total = y * 12 + mo + delta;
  const ny = Math.floor(total / 12);
  const nmo = total - ny * 12;
  return `${ny}-${String(nmo + 1).padStart(2, '0')}`;
}

export function useSalaryLinkageSync(): void {
  // 每秒拿一次最新 Date —— 与 TodayPage 同样的 1s 节奏,符合"实时已赚"诉求。
  const now = useNow(1000);

  // 完整 config(configStore 没有 selector 切片,这里取整对象等同于订阅它)
  const config = useConfigStore();
  // 只订阅会用到的两个切片 —— 不订阅 year/month(那是 CalendarPage 浏览态)
  const dayOverrides = useCalendarStore((s) => s.dayOverrides);
  const monthlyRestModes = useCalendarStore((s) => s.monthlyRestModes);
  const snapshots = useMonthlyStore((s) => s.snapshots);

  // 真实当月的「月度休息模式覆盖」 —— 与 CalendarPage 同口径
  const y = now.getFullYear();
  const m = now.getMonth();
  const currentMonthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
  const effectiveRestMode = monthlyRestModes[currentMonthKey] ?? config.restMode;
  const effectiveConfig = { ...config, restMode: effectiveRestMode };

  // 当月月度快照 / 有效月薪(快照存在则用快照月薪;否则用 config.monthlySalary)
  const snapshot = currentMonthKey in snapshots ? snapshots[currentMonthKey] ?? null : null;
  const effectiveSalary = snapshot?.salary ?? config.monthlySalary;

  // 计算「真实当月」每个工作日的 earnedAmount:
  //   - 已生成的快照:读 dayOverrides[key].earnedAmount(快照不受后续配置影响)
  //   - 今日实时:todayEarned(每秒随 useNow 同步)
  const monthlyEarnedMap = useMemo(() => {
    const todayKey = formatDateKey(now);
    const map: Record<string, number> = {};
    const days = daysInMonthCalc(y, m);
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d);
      const key = formatDateKey(date);
      const isWork = isWorkday(date, effectiveConfig, dayOverrides, HOLIDAYS);
      if (!isWork) continue;
      const ov = dayOverrides[key];
      if (ov?.earnedGenerated && ov.earnedAmount != null) {
        map[key] = ov.earnedAmount;
      } else if (key === todayKey) {
        const cfg = { ...effectiveConfig, monthlySalary: effectiveSalary };
        map[key] = todayEarned(now, cfg, dayOverrides, HOLIDAYS);
      }
    }
    return map;
    // effectiveConfig 因 `{ ...config, restMode }` 每次渲染都新建对象,会触发
    // useMemo 重算;但 map 输出在 restMode 未变时仍稳定,effect 里 prev[key]
    // ! == value 守卫会过滤掉无效 upsert —— 性能可以接受。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, dayOverrides, effectiveConfig, effectiveSalary]);

  // 仅在 monthlyEarnedMap 真正变化的 dateKey 上调用 upsert;
  // 首帧跳过今日实时值(避免每秒回灌),过去日期照常一次性同步。
  // 取消 / 消失:把 prev 里有但当前 map 里消失的 key 视为 0,
  // 仅当「key 仍属真实当月 + 仍是工作日」时执行 —— 避免切月 / 休息日误删联动。
  const prevMonthlyRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!config.salaryLinkageEnabled) {
      prevMonthlyRef.current = monthlyEarnedMap;
      return;
    }
    const upsert = useAccountStore.getState().upsertSalaryLinkageForDate;
    const prev = prevMonthlyRef.current;
    const isFirst = Object.keys(prev).length === 0;
    const todayKey = formatDateKey(now);
    // 新增 / 改值
    for (const [key, value] of Object.entries(monthlyEarnedMap)) {
      if (isFirst && key === todayKey) continue; // 首帧跳过今日(避免 0→真实值回灌)
      if (prev[key] !== value) upsert(key, value);
    }
    // 取消 / 消失
    if (!isFirst) {
      for (const key of Object.keys(prev)) {
        if (key in monthlyEarnedMap) continue;
        const parsed = parseLocalDateKey(key);
        if (!parsed) continue;
        const [py, pm, pd] = parsed;
        if (py !== y || pm !== m) continue; // 不是真实当月 → 跨期查看,不动
        const date = new Date(py, pm, pd);
        if (!isWorkday(date, effectiveConfig, dayOverrides, HOLIDAYS)) continue; // 非工作日预期
        upsert(key, 0);
      }
    }
    prevMonthlyRef.current = monthlyEarnedMap;
  }, [monthlyEarnedMap, config.salaryLinkageEnabled, now, dayOverrides, effectiveConfig, y, m]);

  // ── v2.5-patch15 T-532：联动回灌 ─────────────────────────
  // 启动时(以及 recordedFromDate / monthlyRestModes / monthlySalary / snapshots /
  // currentMonthKey 变化时)遍历 recordedFromDate → 当前月 的所有月份,
  // 为过去月份的每个工作日 upsert 联动 record,让 accountStore 持久化的
  // 「联动累计」反映所有历史。
  //
  // 范围:
  //   - 起:recordedFromDate 所在月(无则从今天所在月起)
  //   - 止:当前月的前一个月(当前月由月度 tick 接管)
  //
  // 算法:
  //   - 取该月快照月薪(无则用 config.monthlySalary)
  //   - 取该月 monthlyRestMode 覆盖(无则用 config.restMode)
  //   - 逐日遍历:isWorkday && key < todayKey 的工作日 → upsert(effectiveDailyRate)
  //   - skip today(让月度 tick 实时处理)
  //
  // 幂等:upsertSalaryLinkageForDate 已实现幂等,重复调只更新 amount;
  // 用户「取消已赚」时已由 upsert(key, 0) 自动删除,无需特殊处理。
  //
  // 不依赖 now(每秒变化),只在以下条件变化时重跑:
  //   salaryLinkageEnabled / recordedFromDate / currentMonthKey(跨午夜) /
  //   monthlyRestModes / snapshots / config.restMode / config.monthlySalary
  // 这样 effect 不会每秒重渲浪费 CPU,backfillDoneRef 仅作为防御性兜底。
  const backfillDoneRef = useRef<string | null>(null);
  const todayKey = formatDateKey(now);
  useEffect(() => {
    if (!config.salaryLinkageEnabled) return;
    const todayMonthKey = currentMonthKey;
    const fromMonthKey = config.recordedFromDate
      ? config.recordedFromDate.slice(0, 7) // YYYY-MM-DD → YYYY-MM
      : todayMonthKey;
    // 当前月由 tick 处理,只回灌过去月
    const lastBackfillMonthKey = shiftMonthKey(todayMonthKey, -1);
    if (!lastBackfillMonthKey) return;
    // 防御性:如果 fromMonthKey 解析失败,直接放弃本次回灌
    if (!/^\d{4}-\d{2}$/.test(fromMonthKey)) return;
    const signature = [
      fromMonthKey,
      lastBackfillMonthKey,
      config.recordedFromDate,
      config.monthlySalary,
      config.restMode,
      todayKey,
    ].join('|');
    if (backfillDoneRef.current === signature) return;
    if (cmpDateKey(fromMonthKey, lastBackfillMonthKey) > 0) {
      // 起点在未来,无过去月可回灌
      backfillDoneRef.current = signature;
      return;
    }
    const upsert = useAccountStore.getState().upsertSalaryLinkageForDate;

    // 迭代月份 [from, lastBackfill]
    let cursorMonthKey: string | null = fromMonthKey;
    let guard = 0;
    while (cursorMonthKey && cmpDateKey(cursorMonthKey, lastBackfillMonthKey) <= 0) {
      guard += 1;
      if (guard > 240) break; // 20 年上限,防死循环
      const m2 = /^(\d{4})-(\d{2})$/.exec(cursorMonthKey);
      if (!m2) break;
      const yy = Number(m2[1]);
      const mm = Number(m2[2]) - 1;
      // 该月有效配置 = monthlyRestMode 覆盖 + 该月快照月薪
      const monthOverride = monthlyRestModes[cursorMonthKey] ?? config.restMode;
      const monthConfig = { ...config, restMode: monthOverride };
      const monthSnapshot = cursorMonthKey in snapshots
        ? snapshots[cursorMonthKey]
        : null;
      const monthSalary = monthSnapshot?.salary ?? config.monthlySalary;
      const cfgWithSnapshot = { ...monthConfig, monthlySalary: monthSalary };
      const days = daysInMonthCalc(yy, mm);
      for (let d = 1; d <= days; d++) {
        const date = new Date(yy, mm, d);
        const key = formatDateKey(date);
        // 仅回灌「已过去的日期」(key < todayKey),让今天及未来留给月度 tick
        if (cmpDateKey(key, todayKey) >= 0) continue;
        if (!isWorkday(date, cfgWithSnapshot, dayOverrides, HOLIDAYS)) continue;
        const amount = effectiveDailyRate(date, cfgWithSnapshot, dayOverrides, HOLIDAYS);
        if (amount > 0) upsert(key, amount);
      }
      cursorMonthKey = shiftMonthKey(cursorMonthKey, 1);
    }

    backfillDoneRef.current = signature;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.salaryLinkageEnabled,
    config.recordedFromDate,
    config.restMode,
    config.monthlySalary,
    currentMonthKey,
    monthlyRestModes,
    snapshots,
    dayOverrides,
    todayKey,
  ]);
}

/**
 * SalaryLinkageSync — 在 App.tsx 顶层挂载一次,无 UI。
 * 这样 useSalaryLinkageSync 的 1s 重算只触发自身重渲(无 DOM),
 * 不会带动 App.tsx 整体或各业务页面重建。
 */
export function SalaryLinkageSync(): null {
  useSalaryLinkageSync();
  return null;
}
