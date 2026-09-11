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
 * v2.5-patch19 T-540 首次启用期 backfill:
 *   - 「首次打开日期」(config.recordedFromDate) 语义扩展为「数据完整链锚点」,
 *     滚动向前:
 *       - 初始:首次打开时 = todayKey,只在 persisted 为空时写入(沿用 v2.5-patch17)
 *       - 每次 tick:遍历 [recordedFromDate, todayKey),对每个**工作日**检查
 *         「time mode record(dayOverrides.earnedGenerated/earnedAmount) +
 *          account mode record(linkageSource='salary-time-mode')」,
 *         缺哪个补哪个(都补)
 *       - **确认次数兜底(本轮新增)**:锚点不在「首次 didBackfill」就立即滚动,
 *         而是用 confirmCountRef 累计 didBackfill=true 的次数,
 *         **达到 3 次连续确认** 才允许 recordedFromDate := todayKey。
 *         纯休息日区间 didBacklift=false 不递增,自然跨多天的稳定性更稳。
 *         - 例:工作日 9-11 / 9-12 / 9-13 → mount(1)→ tick(2)→ tick(3)
 *           才滚动,中间穿插纯休息日 tick 不计入
 *         - 滚动后 confirmCountRef 重置为 0,下次重新累计
 *         - **仅当区间内处理了至少一个工作日**时才累计;纯休息日区间(如
 *           周五 → 周六,中间只跨周末)不动锚点 —— 作为「跨天切换 / 休息日」
 *           场景的兜底
 *       - 处理了工作日(无论是否真补了 record,只要进入 isWorkday 分支就算)
 *         后才计入累计次数;累计达 3 次才滚动,下次 tick 走早返回
 *   - 设计目的:
 *       - TASK-053 立场保留:不擅自给「recordedFromDate 之前」(即用户启用 App
 *         之前)的工作日补 record
 *       - 但启用后:即使中间几天没打开 App,backfill 窗口会随用户每日使用滚动
 *         到 today,正常场景下永远只补「最近一段 gap」,不会因一次大跨度 gap
 *         触发整段历史回灌
 *   - 性能:单次 effect 内完成整段回灌(React 批量重渲),workday < 100 时无感;
 *     常规「无 gap」场景 recordedFromDate === todayKey 走早返回。
 *
 * 语义:
 *   - 联动开启 (config.salaryLinkageEnabled) 时,每秒(随 useNow)对比「真实当月」
 *     monthlyEarnedMap 与上帧;只在变化的 dateKey 上调用 upsertSalaryLinkageForDate。
 *   - 首帧跳过今日实时值(避免用户刚启动 1s 内就把 0 → 真实值回写),
 *     过去日期照常同步(一次性补齐)。
 *   - 取消/消失:把 prevMonthlyRef 里有但当前 map 没有的 key 视为 0,但仅在
 *     「key 仍属真实当月 + 仍是工作日」时执行 —— 切月 / 休息日不会误删联动
 *     record(v2.5-patch3 T-471 修复)。
 *   - 联动关闭时:只刷新 prevMonthlyRef,不写 store(避免禁用后仍消耗 setItem);
 *     同时 backfill effect 也跳过(用户在设置页关掉联动后,补齐动作也停)。
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
import { formatDateKey, parseDateKey } from '../lib/time';
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
  //
  // v2.5-patch17 T-536：同时记录「该 key 的值是否来自已生成快照」(generatedKeys)。
  // 用来在下方删除循环里区分「用户主动取消已赚」vs「日期自然跨过今天」——
  // 两者都会导致 key 从 map 里消失,但只有前者应该删除记账联动 record。
  const { map: monthlyEarnedMap, generatedKeys } = useMemo(() => {
    const todayKey = formatDateKey(now);
    const map: Record<string, number> = {};
    const generated = new Set<string>();
    const days = daysInMonthCalc(y, m);
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d);
      const key = formatDateKey(date);
      const isWork = isWorkday(date, effectiveConfig, dayOverrides, HOLIDAYS);
      if (!isWork) continue;
      const ov = dayOverrides[key];
      if (ov?.earnedGenerated && ov.earnedAmount != null) {
        map[key] = ov.earnedAmount;
        generated.add(key);
      } else if (key === todayKey) {
        const cfg = { ...effectiveConfig, monthlySalary: effectiveSalary };
        map[key] = todayEarned(now, cfg, dayOverrides, HOLIDAYS);
      }
    }
    return { map, generatedKeys: generated };
    // effectiveConfig 因 `{ ...config, restMode }` 每次渲染都新建对象,会触发
    // useMemo 重算;但 map 输出在 restMode 未变时仍稳定,effect 里 prev[key]
    // ! == value 守卫会过滤掉无效 upsert —— 性能可以接受。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, dayOverrides, effectiveConfig, effectiveSalary]);

  // 仅在 monthlyEarnedMap 真正变化的 dateKey 上调用 upsert;过去日期与今日
  // 首帧都立即同步一次 —— 打开 App 就应该看到今日记录,不必等下一秒变化。
  // (首帧仍会被下面的 `prev[key] !== value` 覆盖:prev 初始为空对象,
  //  所以第一次一定会写入,之后每秒只在金额真正变化时才 upsert,不会重复新增。)
  // 取消 / 消失:把 prev 里有但当前 map 里消失的 key 视为 0,
  // 仅当「key 仍属真实当月 + 仍是工作日」时执行 —— 避免切月 / 休息日误删联动。
  const prevMonthlyRef = useRef<Record<string, number>>({});
  // v2.5-patch17 T-536：记录上一帧「哪些 key 是已生成快照」。
  // 用来区分下面删除循环里两种不同的「key 从 map 消失」:
  //   - 曾是已生成快照,现在不再生成(用户主动点了「取消已赚」)→ 必须删除联动 record
  //   - 从未生成快照,只是「今日实时值」随日期跨过午夜消失(T-532 场景)→ 不删除
  const prevGeneratedKeysRef = useRef<Set<string>>(new Set());
  // v2.5-patch19 T-540 confirmCount：backfill 连续确认次数,达到 3 次才滚动 anchor。
  // 纯休息日区间 didBackfill=false 不递增,跨多天的稳定性兜底。
  const confirmCountRef = useRef(0);
  useEffect(() => {
    if (!config.salaryLinkageEnabled) {
      prevMonthlyRef.current = monthlyEarnedMap;
      prevGeneratedKeysRef.current = generatedKeys;
      return;
    }
    const upsert = useAccountStore.getState().upsertSalaryLinkageForDate;
    const prev = prevMonthlyRef.current;
    const prevGenerated = prevGeneratedKeysRef.current;
    const isFirst = Object.keys(prev).length === 0;
    const todayKey = formatDateKey(now);
    // 新增 / 改值(含首帧的今日实时值 —— 打开 App 就应该立即同步今日记录)
    for (const [key, value] of Object.entries(monthlyEarnedMap)) {
      if (prev[key] !== value) upsert(key, value);
    }
    // 取消 / 消失
    if (!isFirst) {
      for (const key of Object.keys(prev)) {
        if (key in monthlyEarnedMap) continue;
        // ── v2.5-patch17 T-536：用户主动取消已赚 → 无条件删除联动 record ──
        // 上一帧 key 是「已生成快照」(prevGenerated 里有),这一帧却不在 map 里,
        // 说明用户点了「取消已赚」(dayOverrides[key].earnedGenerated 被清空)。
        // 这跟 T-532 的自然跨午夜消失是两回事,不受下面的跨天守卫限制 ——
        // 过去日期取消已赚,联动 record 也必须同步删掉。
        if (prevGenerated.has(key)) {
          upsert(key, 0);
          continue;
        }
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
    prevGeneratedKeysRef.current = generatedKeys;
  }, [monthlyEarnedMap, generatedKeys, config.salaryLinkageEnabled, now, dayOverrides, effectiveConfig, y, m]);

  // ═══════════════════════════════════════════════════════════════
  // v2.5-patch19 T-540 首次启用期 backfill —— 滚动锚点
  // ═══════════════════════════════════════════════════════════════
  //
  // [recordedFromDate, todayKey) 区间内,工作日缺哪个 record 就补哪个:
  //   - time mode:dayOverrides[key].earnedGenerated=true + earnedAmount=有效日薪
  //   - account mode:linkageSource='salary-time-mode' 的 income record(upsert 幂等)
  // 全部补完后 recordedFromDate := todayKey,下次 tick 早返回 0 工作量。
  //
  // 依赖只放 now + 联动开关。其它字段(monthlySalary / restMode / dayOverrides / ...)
  // 通过 getState() 在 effect 内读取,避免无关重渲。
  //
  // 注意 dep 顺序:此 effect 在 monthly useEffect **之后** 声明,
  // React 按声明顺序跑 effect → backfill 在 monthly 写完今日 record 之后跑,
  // 才能正确读到「今日有数据」并推动锚点滚动。
  useEffect(() => {
    if (!config.salaryLinkageEnabled) return;

    const anchor = useConfigStore.getState().recordedFromDate;
    const todayKey = formatDateKey(now);
    if (!anchor) return;
    // anchor 已经对齐今天(常规「连续使用」场景)→ 早返回
    if (anchor >= todayKey) return;

    const calendarState = useCalendarStore.getState();
    const dayOverrides = calendarState.dayOverrides;
    const monthlyRestModes = calendarState.monthlyRestModes;
    const configState = useConfigStore.getState();
    const snapshots = useMonthlyStore.getState().snapshots;

    const start = parseDateKey(anchor);
    const end = parseDateKey(todayKey);
    if (!start || !end) return;

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    // didBackfill：区间内是否处理了至少一个工作日；只有它为 true 时累计 confirmCount。
    // 纯休息日区间(如周末)didBacklift=false 不递增,作跨天/休息日兜底。
    let didBackfill = false;

    // [anchor, todayKey) 区间逐日扫描,只处理工作日
    while (cursor.getTime() < last.getTime()) {
      const cursorKey = formatDateKey(cursor);
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const effectiveRestMode = monthlyRestModes[monthKey] ?? configState.restMode;
      const effectiveConfig = { ...configState, restMode: effectiveRestMode };
      const effectiveSalary = snapshots[monthKey]?.salary ?? configState.monthlySalary;
      const cfg = { ...effectiveConfig, monthlySalary: effectiveSalary };

      if (isWorkday(cursor, effectiveConfig, dayOverrides, HOLIDAYS)) {
        didBackfill = true;
        const ov = dayOverrides[cursorKey];
        const hasTimeModeRecord = !!(ov?.earnedGenerated && ov.earnedAmount != null);
        let amount: number;
        if (!hasTimeModeRecord) {
          // time mode 缺失 → 写入 dayOverrides 快照 + 后续补 account record
          amount = effectiveDailyRate(cursor, cfg, dayOverrides, HOLIDAYS);
          const baseEntry = ov ?? {
            type: 'work' as const,
            multiplier: 1,
            segments: null,
            nightShift: false,
          };
          useCalendarStore.getState().setDayOverride(cursorKey, {
            ...baseEntry,
            earnedGenerated: true,
            earnedAmount: amount,
          });
        } else {
          amount = ov!.earnedAmount!;
        }
        // account mode 写入:upsert 幂等,缺则新建 / 在则更新 amount
        useAccountStore.getState().upsertSalaryLinkageForDate(cursorKey, amount);
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    // 仅当 didBackfill=true 时累加 confirmCount;
    // 达到 3 次连续确认才滚动锚点到 todayKey —— 跨天/异常情况稳定性兜底。
    // 纯休息日区间 didBacklift=false 不递增,自然跨多天的稳定性更稳。
    // 滚动后重置 confirmCountRef,下次重新累计。
    if (didBackfill) {
      confirmCountRef.current += 1;
    }
    if (didBackfill && confirmCountRef.current >= 3) {
      useConfigStore.setState({ recordedFromDate: todayKey });
      confirmCountRef.current = 0;
    }
  }, [now, config.salaryLinkageEnabled]);
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
