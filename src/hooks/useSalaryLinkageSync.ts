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
 * v2.5-patch15 T-532 修复:
 *   - 跨天守卫:删除循环里加 `if (cmpDateKey(key, todayKey) < 0) continue;`,
 *     防止跨午夜时昨日联动 record 被「取消已赚」语义错杀(昨日不在新 map
 *     里、但 prev 仍残留昨日键,会被原逻辑误判为「用户取消已赚」并删除)。
 *   - 仅此一行;月度 tick 写 record / upsert 接口 / 今日用户取消已赚的语义
 *     全部保留(key === todayKey 时守卫不生效)。
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
import { daysInMonthCalc, isWorkday, todayEarned } from '../lib/compute';
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
        // ── v2.5-patch15 T-532：跨天守卫 ──
        // 昨日及更早永不自动删除 —— 跨午夜时 prev 含昨天、当前 map 不含昨天
        // (昨天非 todayKey 且无用户快照,实时 tick 未写入),原逻辑会把它误判为
        // 「用户取消已赚」并删除,造成「8.1 23:59 有数据,8.2 00:00 消失」。
        // 用户取消今日已赚仍正常(key === todayKey 时守卫不生效,继续走同月 + 工作日判定)。
        if (cmpDateKey(key, todayKey) < 0) continue;
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
