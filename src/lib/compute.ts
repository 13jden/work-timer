/**
 * Salary Timer — Pure Computation Logic
 *
 * 所有计算逻辑在此模块,**无副作用**,无全局 state 依赖。
 * 所有依赖通过参数显式传入 —— 这是为了**可测试性**和**可移植性**。
 *
 * 调用方(store / hook / 组件)负责把 state 转成参数。
 */
import type {
  Config,
  DayOverrideEntry,
  DayOverrides,
  DayState,
  HolidayMap,
} from './types';
import { DEFAULT_MULTIPLIER } from './types';
import {
  formatDateKey,
  formatHMS,
  toMinutes,
} from './time';

// ── 兼容旧 v1 数据 ─────────────────────────────────────────
//
// 旧 storage 里 dayOverrides 是 'work' | 'rest' 字符串,
// 新版是 DayOverrideEntry 对象。这个归一化函数把任意输入
// 转换为合法 DayOverrideEntry,保证向后兼容(旧 v1 数据不丢)。
function normalizeEntry(raw: unknown): DayOverrideEntry | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    // 旧 v1: 'work' | 'rest'
    if (raw === 'work' || raw === 'rest') {
      return { type: raw, multiplier: DEFAULT_MULTIPLIER[raw] };
    }
    return null;
  }
  if (typeof raw === 'object' && 'type' in raw && 'multiplier' in raw) {
    const type = (raw as { type: string }).type;
    const multiplier = Number((raw as { multiplier: number }).multiplier);
    if (type === 'work' || type === 'paid_overtime' || type === 'leave' || type === 'rest') {
      return { type, multiplier: Number.isFinite(multiplier) ? multiplier : DEFAULT_MULTIPLIER[type] };
    }
  }
  return null;
}

/**
 * 取某天的 override entry(自动兼容旧 v1)
 */
export function getDayOverride(
  overrides: DayOverrides,
  key: string,
): DayOverrideEntry | null {
  return normalizeEntry((overrides as Record<string, unknown>)[key]);
}

// ── Work seconds per day ─────────────────────────────────────

/**
 * 一天的工作秒数 = (下班 - 上班) * 60
 * 不会出现负数,最低 0。
 */
export function workSeconds(config: Config): number {
  const start = toMinutes(config.startTime);
  const end = toMinutes(config.endTime);
  return Math.max(end - start, 0) * 60;
}

// ── Workdays in month ────────────────────────────────────────

/**
 * 某月有多少个工作日(只看 work / rest,不看倍率)
 *
 * "工作日"定义:有人上班的日(leave 也算工作日但 units=0,
 * 因为 leave 在日历上仍然标识为"应当工作"但当天没上班)
 *
 * 这里我们保留 workdaysInMonth 语义:
 *   - work → true
 *   - rest → false
 *   - leave → true(原本是工作日但请假)
 *   - paid_overtime → true(加班)
 */
export function workdaysInMonth(
  year: number,
  month: number,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (isWorkday(new Date(year, month, d), config, overrides, holidays)) {
      count++;
    }
  }
  return count;
}

/**
 * 月份总天数
 */
export function daysInMonthCalc(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * 该日期是否为法定节假日。返回节日名或 null。
 */
export function isHoliday(date: Date, holidays: HolidayMap): string | null {
  const key = formatDateKey(date);
  return holidays[key] ?? null;
}

/**
 * 该日期是否为工作日
 *
 * 优先级:
 *   1. 手动 override 覆盖所有
 *      - work / paid_overtime → true
 *      - leave → true(请假但本来是工作日)
 *      - rest → false
 *   2. 节假日 → false
 *   3. 根据 restMode 判断
 *      - 0(无休)→ 都是工作日
 *      - 1(单休)→ 周日休息
 *      - 2(双休)→ 周六、周日休息
 */
export function isWorkday(
  date: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): boolean {
  const key = formatDateKey(date);
  const entry = getDayOverride(overrides, key);
  if (entry) {
    return entry.type === 'work' || entry.type === 'paid_overtime' || entry.type === 'leave';
  }
  if (isHoliday(date, holidays)) return false;

  const dow = date.getDay();
  switch (config.restMode) {
    case 0: return true;
    case 1: return dow !== 0;
    case 2: return dow !== 0 && dow !== 6;
  }
}

/**
 * 单日的"薪资单位" —— 用于按天累加已赚
 *
 * - work: 1
 * - paid_overtime: multiplier(默认 1.5,可改)
 * - leave: 0
 * - rest: 0
 * - 没 override 且是工作日(weekday 非周末非节假日):1
 * - 没 override 且是周末/节假日:0
 *
 * 关键规则:
 *   - "日均"是用 workdaysInMonth 算的,所以 leave 不影响日均
 *   - 但"已赚"按 units 累加,所以 leave 日不贡献 +1
 *     (实际效果:leave 那天 dailyBase 会被扣掉,因为少了一个 unit)
 */
export function dayUnits(
  date: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  const key = formatDateKey(date);
  const entry = getDayOverride(overrides, key);
  if (entry) return entry.multiplier;
  return isWorkday(date, config, overrides, holidays) ? 1 : 0;
}

// ── Rates ───────────────────────────────────────────────────

/**
 * 日薪 = 月薪 / 当月工作日
 */
export function dailySalary(
  year: number,
  month: number,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  const days = workdaysInMonth(year, month, config, overrides, holidays);
  return config.monthlySalary / Math.max(days, 1);
}

/**
 * 时薪 = 日薪 / 工作小时数
 */
export function hourlyRate(
  year: number,
  month: number,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  const daily = dailySalary(year, month, config, overrides, holidays);
  const hours = Math.max(workSeconds(config) / 3600, 0.01);
  return daily / hours;
}

/**
 * 秒薪 = 时薪 / 3600
 */
export function perSecond(
  year: number,
  month: number,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  return hourlyRate(year, month, config, overrides, holidays) / 3600;
}

// ── Today earned ─────────────────────────────────────────────

/**
 * 截至 now 时刻,今天已赚多少
 *
 * 规则:
 *   - 非工作日 → 0
 *   - 上班前 → 0
 *   - 下班后 → 当天 dailySalary × units
 *   - 工作期间 → (perSecond × units) × 已工作秒数
 */
export function todayEarned(
  now: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  if (!isWorkday(now, config, overrides, holidays)) return 0;

  const startM = toMinutes(config.startTime);
  const endM = toMinutes(config.endTime);
  const nowM = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  const year = now.getFullYear();
  const month = now.getMonth();
  const daily = dailySalary(year, month, config, overrides, holidays);
  const rate = perSecond(year, month, config, overrides, holidays);
  const units = dayUnits(now, config, overrides, holidays);

  if (nowM <= startM) return 0;
  if (nowM >= endM) return daily * units;

  const workedMin = nowM - startM;
  return Math.max(rate * units * workedMin * 60, 0);
}

// ── Day state(timer status) ─────────────────────────────────

/**
 * 当前时刻的天状态 —— 决定 Timer Card 显示什么
 *
 * - rest: 休息日
 * - done: 已收工(now >= endTime)
 * - active: 工作期间(显示倒计时)
 */
export function dayState(
  now: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): DayState {
  if (!isWorkday(now, config, overrides, holidays)) {
    return { mode: 'rest' };
  }

  const startM = toMinutes(config.startTime);
  const endM = toMinutes(config.endTime);
  const nowM = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  if (nowM < startM) {
    const diff = startM - nowM;
    return {
      ...formatHMS(diff * 60 * 1000, '等待开工', '距离上班还有'),
      mode: 'active',
    };
  }

  if (nowM >= endM) {
    const total = Math.floor((endM - startM) * 60);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return {
      mode: 'done',
      display: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`,
      label: '今日完成',
      status: '今日收工',
      totalSeconds: total,
    };
  }

  const diff = (endM - nowM) * 60 * 1000;
  return {
    ...formatHMS(diff, '工作计价中', '距离今天下班'),
    mode: 'active',
  };
}

// ── Month earned so far ─────────────────────────────────────

/**
 * 当月截至 now 已累计赚多少
 *
 * 算法:
 *   - dailyBase = 月薪 / 工作日
 *   - 遍历当月每一天(date ≤ now):
 *     - 未来日期:break
 *     - 过去的日期:earned += dailyBase × units
 *     - 今天:earned += dailyBase × units × workedRatio
 *
 * 这样:
 *   - 加班日:units=1.5 → 那一天已赚 = dailyBase × 1.5
 *   - 请假日:units=0 → 那天不贡献(等同扣 dailyBase)
 *   - 休息日:units=0 → 同上
 */
export function monthEarnedSoFar(
  year: number,
  month: number,
  now: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  const days = daysInMonthCalc(year, month);
  const dailyBase = dailySalary(year, month, config, overrides, holidays);
  let earned = 0;

  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    if (date > now) break;
    const units = dayUnits(date, config, overrides, holidays);
    if (units === 0) continue;

    // 同一天(date 比较只看年月日)
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isToday) {
      const startM = toMinutes(config.startTime);
      const endM = toMinutes(config.endTime);
      const nowM = now.getHours() * 60 + now.getMinutes();
      if (nowM <= startM) continue;
      const workedRatio = nowM >= endM ? 1 : (nowM - startM) / Math.max(endM - startM, 1);
      earned += dailyBase * units * workedRatio;
    } else {
      earned += dailyBase * units;
    }
  }
  return earned;
}

// ── Progress ────────────────────────────────────────────────

/**
 * 工作进度百分比 (0-100)
 *
 * 规则:
 *   - 非工作日 → 0
 *   - 上班前 → 0
 *   - 下班后 → 100
 *   - 工作期间 → (worked / totalWork) * 100,夹紧到 [0, 100]
 */
export function progressPct(
  now: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  if (!isWorkday(now, config, overrides, holidays)) return 0;

  const startM = toMinutes(config.startTime);
  const endM = toMinutes(config.endTime);
  const nowM = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  if (nowM < startM) return 0;
  if (nowM >= endM) return 100;

  const totalWorkMins = Math.max(endM - startM, 1);
  const workedMins = Math.min(nowM - startM, totalWorkMins);
  return Math.min((workedMins / totalWorkMins) * 100, 100);
}