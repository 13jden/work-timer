/**
 * Salary Timer — Pure Computation Logic
 *
 * 所有计算逻辑在此模块,**无副作用**,无全局 state 依赖。
 * 所有依赖通过参数显式传入 —— 这是为了**可测试性**和**可移植性**。
 *
 * 调用方(store / hook / 组件)负责把 state 转成参数。
 *
 * ── v1.3 变更 ──
 * - 新增 WorkSegment / 跨天段 / 夜班加权 / 摸鱼扣除 / 净工时
 * - 新增 effectiveHourlyRate(加班倍率生效)
 * - 新增 SalaryMode 分发(monthly / hourly / daily)
 * - 现有函数(hourlyRate / perSecond / todayEarned / monthEarnedSoFar / dayState / workSeconds)
 *   内部使用 effectiveSegments 替换 startTime/endTime 单段。
 * - 函数签名保持向后兼容(只是内部走多段路径)。
 */
import type {
  Config,
  DayOverrideEntry,
  DayOverrides,
  DayState,
  HolidayMap,
  NetHoursBreakdown,
  SlackingSession,
  TimeRecordLabel,
  WorkSegment,
} from './types';
import { DEFAULT_MULTIPLIER } from './types';
import { isInNightWindow } from './time';
import {
  formatDateKey,
  formatHMS,
  toMinutes,
} from './time';
import { NIGHT_SHIFT_END_MIN, NIGHT_SHIFT_START_MIN } from './constants';

// ════════════════════════════════════════════════════════════
// 兼容旧 v1/v2 数据
// ════════════════════════════════════════════════════════════

/**
 * 把任意输入(旧 v1 字符串 / 缺字段 v3)归一化为合法 DayOverrideEntry
 *
 * 兼容:
 *  - v1: 'work' | 'rest'
 *  - v2: { type, multiplier }(无 segments / nightShift)
 *  - v3: 完整字段
 */
function normalizeEntry(raw: unknown): DayOverrideEntry | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    if (raw === 'work' || raw === 'rest') {
      return {
        type: raw,
        multiplier: DEFAULT_MULTIPLIER[raw],
        segments: null,
        nightShift: false,
      };
    }
    return null;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const type = obj.type as string;
    const multiplier = Number(obj.multiplier);
    if (!['work', 'paid_overtime', 'leave', 'rest', 'freelance'].includes(type)) return null;
    const safeMultiplier = Number.isFinite(multiplier) ? multiplier : DEFAULT_MULTIPLIER[type as keyof typeof DEFAULT_MULTIPLIER];
    // segments / nightShift 缺省时补 null / false
    const segments = Array.isArray(obj.segments)
      ? (obj.segments as WorkSegment[]).filter(
          (s) => s && typeof s.start === 'string' && typeof s.end === 'string',
        )
      : null;
    const nightShift = obj.nightShift === true;
    // v1.3.2:freelance 临时费率,缺省时 null
    const freelanceDailyRaw = obj.freelanceDaily;
    const freelanceHourlyRaw = obj.freelanceHourly;
    const freelanceDaily = typeof freelanceDailyRaw === 'number' && Number.isFinite(freelanceDailyRaw)
      ? freelanceDailyRaw
      : null;
    const freelanceHourly = typeof freelanceHourlyRaw === 'number' && Number.isFinite(freelanceHourlyRaw)
      ? freelanceHourlyRaw
      : null;
    return {
      type: type as DayOverrideEntry['type'],
      multiplier: safeMultiplier,
      segments,
      nightShift,
      freelanceDaily,
      freelanceHourly,
    };
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

// ════════════════════════════════════════════════════════════
// WorkSegment 工具集(v1.3 新增)
// ════════════════════════════════════════════════════════════

/**
 * 拆分跨天段(end < start)
 *
 * 例 22:00–06:00 → [{22:00, 24:00}, {00:00, 06:00}]
 * 例 09:00–18:00 → [{09:00, 18:00}] (原样)
 *
 * 时间用 "HH:MM" 表示,24:00 表示当天结束(便于 union 计算时统一成 0~1440 区间)。
 */
export function splitSegment(seg: WorkSegment): WorkSegment[] {
  const startMin = toMinutes(seg.start);
  const endMin = toMinutes(seg.end);
  if (endMin > startMin) return [seg];
  // 跨天:拆成 [start, 24:00) + [00:00, end)
  return [
    { start: seg.start, end: '24:00' },
    { start: '00:00', end: seg.end },
  ];
}

/**
 * 把段数组展开成标准分钟区间(startMin, endMin)对,均按 0~1440 表示。
 * 跨天段自动拆分。
 */
export function flattenSegments(segments: WorkSegment[]): Array<{ startMin: number; endMin: number }> {
  const out: Array<{ startMin: number; endMin: number }> = [];
  for (const seg of segments) {
    for (const s of splitSegment(seg)) {
      const startMin = toMinutes(s.start);
      // 24:00 → 1440
      const endMin = s.end === '24:00' ? 24 * 60 : toMinutes(s.end);
      if (endMin > startMin) out.push({ startMin, endMin });
    }
  }
  return out;
}

/**
 * 段合并(union 去重叠) — 返回新的段列表,均按标准区间
 */
export function unionSegments(segments: WorkSegment[]): WorkSegment[] {
  if (segments.length === 0) return [];
  const flat = flattenSegments(segments);
  flat.sort((a, b) => a.startMin - b.startMin);
  const merged: Array<{ startMin: number; endMin: number }> = [];
  for (const cur of flat) {
    const last = merged[merged.length - 1];
    if (last && cur.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, cur.endMin);
    } else {
      merged.push({ ...cur });
    }
  }
  // 还原为 HH:MM 字符串
  return merged.map((m) => ({
    start: minutesToHHMM(m.startMin),
    end: m.endMin === 24 * 60 ? '24:00' : minutesToHHMM(m.endMin),
  }));
}

/** 总分钟数(union 后) */
export function totalSegmentsMinutes(segments: WorkSegment[]): number {
  const merged = unionSegments(segments);
  let total = 0;
  for (const seg of merged) {
    const startMin = toMinutes(seg.start);
    const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
    total += endMin - startMin;
  }
  return total;
}

/** 段落在夜间窗口(22:00–06:00)的分钟数 */
export function nightShiftMinutes(segments: WorkSegment[]): number {
  const merged = unionSegments(segments);
  let total = 0;
  for (const seg of merged) {
    const startMin = toMinutes(seg.start);
    const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
    // 段拆成两段判断:start..min(end,1320) + max(start,0)..min(end,360)
    if (endMin > NIGHT_SHIFT_START_MIN) {
      total += Math.min(endMin, 24 * 60) - Math.max(startMin, NIGHT_SHIFT_START_MIN);
    }
    if (endMin > 0 && startMin < NIGHT_SHIFT_END_MIN) {
      total += Math.min(endMin, NIGHT_SHIFT_END_MIN) - Math.max(startMin, 0);
    }
  }
  return total;
}

/** 段落在午休窗口的分钟数 */
export function lunchOverlapMinutes(
  segments: WorkSegment[],
  lunchStart: string,
  lunchMinutes: number,
): number {
  const lunchStartMin = toMinutes(lunchStart);
  const lunchEndMin = lunchStartMin + lunchMinutes;
  const merged = unionSegments(segments);
  let total = 0;
  for (const seg of merged) {
    const startMin = toMinutes(seg.start);
    const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
    const overlapStart = Math.max(startMin, lunchStartMin);
    const overlapEnd = Math.min(endMin, lunchEndMin);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}

/** 取某日有效的多段工时 */
export function getEffectiveSegments(
  config: Config,
  override: DayOverrideEntry | null,
): WorkSegment[] {
  // 1) override.segments 非空 → 完全覆盖全局
  if (override && override.segments && override.segments.length > 0) {
    return override.segments;
  }
  // 2) 全局 config.segments 非空
  if (config.segments && config.segments.length > 0) {
    return config.segments;
  }
  // 3) fallback 单段
  return [{ start: config.startTime, end: config.endTime }];
}

// ════════════════════════════════════════════════════════════
// Workdays / Work units
// ════════════════════════════════════════════════════════════

/**
 * 一日工作总秒数(基于 effective segments,跨天段自动展开)
 *
 * 语义:
 * - 若 override.segments 或 config.segments 显式提供 → 用多段语义(支持跨天)
 * - 否则(单段 fallback):start >= end 时返回 0(避免误把"错误的单段时间"识别为跨天)
 */
export function workSeconds(config: Config, override: DayOverrideEntry | null = null): number {
  const segs = getEffectiveSegments(config, override);
  // 单段 fallback:保留旧行为
  if (segs.length === 1 && !config.segments && !override?.segments) {
    const seg = segs[0]!;
    const startMin = toMinutes(seg.start);
    const endMin = toMinutes(seg.end);
    return Math.max(endMin - startMin, 0) * 60;
  }
  return totalSegmentsMinutes(segs) * 60;
}

/**
 * 某月有多少个工作日
 *
 * 注意:freelance 类型视为工作日(isWorkday 返回 true),
 * 但 monthly 模式下 freelance 日的 dayUnits = 1(可以计薪)。
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

export function daysInMonthCalc(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function isHoliday(date: Date, holidays: HolidayMap): string | null {
  const key = formatDateKey(date);
  return holidays[key] ?? null;
}

/**
 * 该日期是否为工作日
 *
 * 优先级:
 *   1. override → 直接根据 type 判断
 *      - work / paid_overtime / freelance / leave → true
 *      - rest → false
 *   2. 节假日 → false
 *   3. restMode 判定
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
    return (
      entry.type === 'work' ||
      entry.type === 'paid_overtime' ||
      entry.type === 'leave' ||
      entry.type === 'freelance'
    );
  }
  if (isHoliday(date, holidays)) return false;

  // hourly/daily 模式没有 restMode 概念 → 所有非节假日都算工作日
  if (config.salaryMode === 'hourly' || config.salaryMode === 'daily') {
    return true;
  }

  const dow = date.getDay();
  switch (config.restMode) {
    case 0: return true;
    case 1: return dow !== 0;
    case 2: return dow !== 0 && dow !== 6;
  }
}

/**
 * 单日的"薪资单位"
 *
 * - override:直接用 multiplier
 * - 没 override:工作日 → 1;否则 0
 *
 * hourly/daily 模式下 freelance 日 multiplier=1(同 work)
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

// ════════════════════════════════════════════════════════════
// Rates
// ════════════════════════════════════════════════════════════

/**
 * 当日 effective dailyRate
 *
 * monthly 模式:月薪 / 月工作日 × multiplier(加班日 ×1.5)
 * hourly 模式:manualHourlyRate × segmentsHours × multiplier
 * daily 模式:manualDailyRate × multiplier
 *
 * 休息日 / 请假 → 0
 *
 * v1.3.2 增强:
 *   - type='freelance' 且 entry.freelanceHourly 存在 → 覆盖 manualHourlyRate
 *   - type='freelance' 且 entry.freelanceDaily 存在 → 覆盖 manualDailyRate
 *   - 优先级:override.freelanceHourly/Daily > config.manualHourlyRate/Daily
 */
export function effectiveDailyRate(
  date: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  if (!isWorkday(date, config, overrides, holidays)) return 0;
  const year = date.getFullYear();
  const month = date.getMonth();
  const entry = getDayOverride(overrides, formatDateKey(date));
  const multiplier = entry ? entry.multiplier : 1;

  // v1.3.2:freelance 日临时费率覆盖(月薪用户兼职场景)
  // 优先级:override.freelanceHourly > override.freelanceDaily > config.manualDailyRate(默认兜底)
  if (entry && entry.type === 'freelance') {
    if (entry.freelanceHourly != null && entry.freelanceHourly > 0) {
      const segs = getEffectiveSegments(config, entry);
      const hours = totalSegmentsMinutes(segs) / 60;
      return entry.freelanceHourly * hours * multiplier;
    }
    if (entry.freelanceDaily != null && entry.freelanceDaily > 0) {
      return entry.freelanceDaily * multiplier;
    }
    // fallback:freelance 用户未填,用 config.manualDailyRate(整额,简单可预测)
    return config.manualDailyRate * multiplier;
  }

  switch (config.salaryMode) {
    case 'monthly': {
      const workdays = workdaysInMonth(year, month, config, overrides, holidays);
      return (config.monthlySalary / Math.max(workdays, 1)) * multiplier;
    }
    case 'hourly': {
      const segs = getEffectiveSegments(config, entry);
      const hours = totalSegmentsMinutes(segs) / 60;
      return config.manualHourlyRate * hours * multiplier;
    }
    case 'daily': {
      return config.manualDailyRate * multiplier;
    }
  }
}

/**
 * 当日 effective 时薪(加班倍率生效)
 *
 * effectiveDailyRate / segmentsHours
 *
 * - 休息日返回 0
 * - 跨天段有效(基于 merged segments)
 */
export function effectiveHourlyRate(
  date: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  if (!isWorkday(date, config, overrides, holidays)) return 0;
  const entry = getDayOverride(overrides, formatDateKey(date));
  const segs = getEffectiveSegments(config, entry);
  const hours = Math.max(totalSegmentsMinutes(segs) / 60, 0.01);
  return effectiveDailyRate(date, config, overrides, holidays) / hours;
}

/**
 * dailySalary:旧 API(月度模型,保留兼容)
 *
 * 用 effectiveDailyRate(加班倍率不计入,这里 multiplier=1)
 * 调用方如需考虑倍率请用 effectiveDailyRate
 */
export function dailySalary(
  year: number,
  month: number,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  // 兼容:v2 调用方通常传 multiplier=1 的概念;这里返回"基础日均"
  const workdays = workdaysInMonth(year, month, config, overrides, holidays);
  if (config.salaryMode === 'monthly') {
    return config.monthlySalary / Math.max(workdays, 1);
  }
  if (config.salaryMode === 'hourly') {
    const segs = getEffectiveSegments(config, null);
    const hours = totalSegmentsMinutes(segs) / 60;
    return config.manualHourlyRate * hours;
  }
  return config.manualDailyRate;
}

/**
 * hourlyRate:旧 API(保留兼容,基于基础 dailySalary)
 *
 * 加倍率场景请用 effectiveHourlyRate
 */
export function hourlyRate(
  year: number,
  month: number,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  const daily = dailySalary(year, month, config, overrides, holidays);
  const segs = getEffectiveSegments(config, null);
  const hours = Math.max(totalSegmentsMinutes(segs) / 60, 0.01);
  return daily / hours;
}

/**
 * perSecond:旧 API(保留兼容)
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

// ════════════════════════════════════════════════════════════
// Today earned(支持多段 + 加班倍率)
// ════════════════════════════════════════════════════════════

/**
 * 截至 now 时刻,今日已赚多少
 *
 * 算法:
 *   - 非工作日 → 0
 *   - 上班前 → 0
 *   - 下班后 → effectiveDailyRate
 *   - 工作期间 → effectiveHourlyRate × 已工作秒数 / 3600
 *
 * 注意:跨天段有效,nowM 不在任意段内 → 视为下班后。
 */
export function todayEarned(
  now: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  if (!isWorkday(now, config, overrides, holidays)) return 0;

  const dateKey = formatDateKey(now);
  const entry = getDayOverride(overrides, dateKey);
  const segs = getEffectiveSegments(config, entry);
  const merged = unionSegments(segs);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  // 计算当日已经过了多少分钟(in merged segments 内)
  let elapsedMin = 0;
  for (const seg of merged) {
    const startMin = toMinutes(seg.start);
    const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
    if (nowMin >= startMin && nowMin < endMin) {
      // 当前在段内:已工作 = now - start
      elapsedMin = nowMin - startMin;
      break;
    } else if (nowMin >= endMin) {
      // 段已结束:累加整段
      elapsedMin += endMin - startMin;
    } else {
      // 段未开始:后面的段也不用看了
      break;
    }
  }

  // 处理跨天情况:凌晨 02:00 时,合并昨日跨天段(shift 到今日坐标系)
  // 简化处理:若 elapsedMin = 0 且 nowMin 小于第一段 start,继续看昨日
  if (elapsedMin === 0 && merged.length > 0) {
    const firstStartMin = toMinutes(merged[0]!.start);
    if (nowMin < firstStartMin) {
      // 当前时刻早于今日第一段;可能还在昨日的跨天段里
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yKey = formatDateKey(yesterday);
      const yEntry = getDayOverride(overrides, yKey);
      if (yEntry && yEntry.segments && yEntry.segments.length > 0) {
        for (const seg of yEntry.segments) {
          // 跨天段 splitSegment 后,后半段 [00:00, end) 归属今日
          for (const s of splitSegment(seg)) {
            const startMin = toMinutes(s.start);
            const endMin = s.end === '24:00' ? 24 * 60 : toMinutes(s.end);
            if (nowMin >= startMin && nowMin < endMin) {
              elapsedMin = nowMin - startMin;
              break;
            }
          }
          if (elapsedMin > 0) break;
        }
      }
    }
  }

  const dailyRate = effectiveDailyRate(now, config, overrides, holidays);
  if (elapsedMin <= 0) return 0;

  // hourly 模式:dailyRate / 7h × 已工作小时 = 实际时薪 × 已工作
  // 直接按 effectiveDailyRate 比例即可(因为 effectiveHourlyRate = effectiveDailyRate / totalHours)
  // 实际已赚 = (effectiveDailyRate / totalMinutes) × elapsedMin
  const totalMin = totalSegmentsMinutes(segs);
  if (totalMin <= 0) return 0;
  return Math.max((dailyRate / totalMin) * elapsedMin, 0);
}

// ════════════════════════════════════════════════════════════
// Day state(timer status,支持跨天)
// ════════════════════════════════════════════════════════════

/**
 * 当前时刻的天状态
 *
 * 跨天段处理:凌晨打开 App 时,合并昨日跨天段到今日坐标系。
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

  const dateKey = formatDateKey(now);
  const entry = getDayOverride(overrides, dateKey);
  const segs = getEffectiveSegments(config, entry);
  const merged = unionSegments(segs);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  // 跨天段昨日处理
  const allMerged = merged.slice();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yKey = formatDateKey(yesterday);
  const yEntry = getDayOverride(overrides, yKey);
  if (yEntry && yEntry.segments && yEntry.segments.length > 0) {
    for (const seg of yEntry.segments) {
      for (const s of splitSegment(seg)) {
        const startMin = toMinutes(s.start);
        const endMin = s.end === '24:00' ? 24 * 60 : toMinutes(s.end);
        if (startMin === 0 && endMin > 0) {
          // 今日 [00:00, end) 部分
          allMerged.push({ start: '00:00', end: s.end });
        }
      }
    }
  }
  // 再次 union 合并
  const finalMerged = unionSegments(allMerged);

  // 找当前所在段
  let currentStart: number | null = null;
  let currentEnd: number | null = null;
  for (const seg of finalMerged) {
    const startMin = toMinutes(seg.start);
    const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
    if (nowMin >= startMin && nowMin < endMin) {
      currentStart = startMin;
      currentEnd = endMin;
      break;
    }
  }

  // 还没到上班时间
  if (currentStart === null || currentEnd === null) {
    // 找今日最早一段
    const firstSeg = finalMerged[0];
    if (!firstSeg) {
      return { mode: 'rest' };
    }
    const firstStartMin = toMinutes(firstSeg.start);
    if (nowMin < firstStartMin) {
      const diff = (firstStartMin - nowMin) * 60 * 1000;
      return { ...formatHMS(diff, '等待开工', '距离上班还有'), mode: 'active' };
    }
    // 已过最后一段
    const lastSeg = finalMerged[finalMerged.length - 1]!;
    const lastEndMin = lastSeg.end === '24:00' ? 24 * 60 : toMinutes(lastSeg.end);
    const totalSec = Math.floor(totalSegmentsMinutes(finalMerged) * 60);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    void lastEndMin;
    return {
      mode: 'done',
      display: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`,
      label: '今日完成',
      status: '今日收工',
      totalSeconds: totalSec,
    };
  }

  // 在段内:active
  const diff = (currentEnd - nowMin) * 60 * 1000;
  return { ...formatHMS(diff, '工作计价中', '距离今天下班'), mode: 'active' };
}

// ════════════════════════════════════════════════════════════
// Month earned so far(支持多段 + 加班倍率)
// ════════════════════════════════════════════════════════════

/**
 * 当月累计已赚
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
  let earned = 0;

  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    if (date > now) break;
    const units = dayUnits(date, config, overrides, holidays);
    if (units === 0) continue;

    const dailyRate = effectiveDailyRate(date, config, overrides, holidays);
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isToday) {
      earned += todayEarned(now, config, overrides, holidays);
    } else {
      earned += dailyRate;
    }
  }
  return earned;
}

// ════════════════════════════════════════════════════════════
// Progress(基于 merged segments)
// ════════════════════════════════════════════════════════════

export function progressPct(
  now: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
): number {
  if (!isWorkday(now, config, overrides, holidays)) return 0;

  const dateKey = formatDateKey(now);
  const entry = getDayOverride(overrides, dateKey);
  const segs = getEffectiveSegments(config, entry);
  const totalWorkMin = Math.max(totalSegmentsMinutes(segs), 1);

  // 已工作分钟数(参考 todayEarned 的合并逻辑)
  let worked = 0;
  const merged = unionSegments(segs);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  for (const seg of merged) {
    const startMin = toMinutes(seg.start);
    const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
    if (nowMin >= startMin && nowMin < endMin) {
      worked += nowMin - startMin;
      break;
    } else if (nowMin >= endMin) {
      worked += endMin - startMin;
    } else {
      break;
    }
  }

  // 昨日跨天段
  if (worked === 0) {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yKey = formatDateKey(yesterday);
    const yEntry = getDayOverride(overrides, yKey);
    if (yEntry && yEntry.segments && yEntry.segments.length > 0) {
      for (const seg of yEntry.segments) {
        for (const s of splitSegment(seg)) {
          const startMin = toMinutes(s.start);
          const endMin = s.end === '24:00' ? 24 * 60 : toMinutes(s.end);
          if (nowMin >= startMin && nowMin < endMin) {
            worked += nowMin - startMin;
            break;
          }
        }
        if (worked > 0) break;
      }
    }
  }

  if (worked === 0 && merged[0] && toMinutes(merged[0].start) > 0 && nowMin < toMinutes(merged[0].start)) {
    return 0;
  }
  if (worked >= totalWorkMin) return 100;
  return Math.min((worked / totalWorkMin) * 100, 100);
}

/**
 * v1.3.4-patch1:截至 now 时刻,已工作多少分钟(基于 merged segments,跨天段自动处理)
 *
 * 算法要点:
 *   1. segs 优先从昨日跨天段 entry 读取(跨天班次跨日,班次的"前半段"属于昨日);
 *      否则回退到今日 entry / config 默认段。
 *   2. merged 是 unionSegments 后的段列表,跨天段会被 unionSegments 拆成 [{00:00, endDay), {startEve, 24:00)}]
 *   3. 跨天段识别:merged[0].start=00:00 且 merged[1].end=24:00 → 跨天班次
 *   4. 已工作 = 在 mergedAll(今日 merged ∪ 昨日跨天段后半段)中,now 落在某段内的部分
 *      - 跨天班次(now=12:00 等"中段")→ worked=0(班次未到/已收工,等价于今日还没开始)
 *      - 跨天班次(now 在某段内,如 02:00 在 [00:00, 06:00))→ worked=nowMin
 *      - 普通班次 → 标准累加(now 在某段内 → 当前段进度;前面段已收工)
 *
 * 边界:
 *   - 工时前 → 0
 *   - 工时段内 → nowMin - firstStartAfter(累加前面的整段)
 *   - 已收工 → totalSegmentsMinutes(segs)(封顶)
 *   - 跨天凌晨(22:00-06:00 跨天段,now=02:00)→ 2h = 120min
 */
function elapsedWorkedMinutes(
  now: Date,
  config: Config,
  overrides: DayOverrides,
): number {
  const dateKey = formatDateKey(now);
  const entry = getDayOverride(overrides, dateKey);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yKey = formatDateKey(yesterday);
  const yEntry = getDayOverride(overrides, yKey);

  // 跨天班次优先级:昨日跨天段 entry.segments > 今日 entry.segments > config fallback
  // 理由:用户设了 22:00-06:00 夜班班次,凌晨 02:00 仍在班次内,今日 default 段不应干扰
  const segs =
    yEntry && yEntry.segments && yEntry.segments.length > 0
      ? yEntry.segments
      : getEffectiveSegments(config, entry);

  const merged = unionSegments(segs);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  // 昨日跨天段 push(只取 split 后的 [00:00, end) 后半段)
  const yesterdaySegments: WorkSegment[] = [];
  if (yEntry && yEntry.segments && yEntry.segments.length > 0) {
    for (const seg of yEntry.segments) {
      for (const s of splitSegment(seg)) {
        if (toMinutes(s.start) === 0) {
          yesterdaySegments.push(s);
        }
      }
    }
  }
  const mergedAll = unionSegments([...merged, ...yesterdaySegments]);

  let worked = 0;

  // 跨天班次识别:merged[0] 从 00:00 开始 且 merged[1] 以 24:00 结束
  const hasCrossDay =
    merged.length >= 2 &&
    toMinutes(merged[0]!.start) === 0 &&
    merged[1]!.end === '24:00';

  if (hasCrossDay) {
    // 跨天班次:只在 now 落在某段内时才计 work(中段和刚收工都算 0)
    //   - 物理时间 02:00 在 [00:00, 06:00) 内 → worked = 120(今日凌晨段已工作 2h)
    //   - 物理时间 22:00 在 [22:00, 24:00) 内 → worked = 0(新一轮刚开始)
    //   - 物理时间 12:00 不在任何段内 → worked = 0(班次中段)
    //   - 物理时间 06:00 不在 [00:00, 06:00) 右开区间,也不在 [22:00, 24:00) → worked = 0
    for (const seg of mergedAll) {
      const startMin = toMinutes(seg.start);
      const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
      if (nowMin >= startMin && nowMin < endMin) {
        worked = nowMin - startMin;
        break;
      }
    }
  } else {
    // 普通多段 / 单段(可能含昨日跨天段后半段):标准遍历
    for (const seg of mergedAll) {
      const startMin = toMinutes(seg.start);
      const endMin = seg.end === '24:00' ? 24 * 60 : toMinutes(seg.end);
      if (nowMin >= startMin && nowMin < endMin) {
        // 当前在段内:已工作 = now - start
        worked += nowMin - startMin;
        break;
      } else if (nowMin >= endMin) {
        // 段已结束:累加整段
        worked += endMin - startMin;
      } else {
        // 段未开始:后面的段也不用看了
        break;
      }
    }
  }

  const gross = totalSegmentsMinutes(segs);
  return Math.min(worked, gross);
}

/**
 * v1.3.4-patch1:把一组 [startMin, endMin) 区间 clip 到 [startMin, endMax] 内的总分钟数
 *
 * 用于把"全天的摸鱼∪午休 union"裁剪到"已工作时间"窗口内,确保工时前不误扣。
 *
 * 算法:对每个区间求与 [startOffset, endMax] 的交集,合并后求总长。
 */
function clipIntervalsToElapsed(
  intervals: Array<{ startMin: number; endMin: number }>,
  startOffset: number,
  endMax: number,
): number {
  if (endMax <= startOffset || intervals.length === 0) return 0;
  const clipped: Array<{ startMin: number; endMin: number }> = [];
  for (const it of intervals) {
    const start = Math.max(it.startMin, startOffset);
    const end = Math.min(it.endMin, endMax);
    if (end > start) clipped.push({ startMin: start, endMin: end });
  }
  return intervalsUnionTotal(clipped);
}

// ════════════════════════════════════════════════════════════
// 净工时(v1.3 新增)
// ════════════════════════════════════════════════════════════

/**
 * 把摸鱼 sessions 转成 (startMin, endMin) 区间列表(基于 dateKey 0:00-24:00)
 *
 * v1.3.4-patch2:加 `nowTs` 参数,endTs===null 的进行中 session 按 nowTs 算落地结束时间。
 * 这让 `slackingElapsed`(dashboard "已发生摸鱼"卡片)能正确显示进行中摸鱼的实时分钟数。
 */
function sessionsToIntervals(
  sessions: SlackingSession[],
  nowTs: number = Date.now(),
): Array<{ startMin: number; endMin: number }> {
  const out: Array<{ startMin: number; endMin: number }> = [];
  for (const s of sessions) {
    // v1.3.3 patch3:仅摸鱼计入工作时间扣除
    //   - overtime(加班):是工作时间的一部分,不扣
    //   - other(其他):中性,不扣
    if (s.label !== 'slack') continue;
    const startDate = new Date(s.startTs);
    const endDate = s.endTs === null ? new Date(nowTs) : new Date(s.endTs);
    // 跨 00:00 截断(PRD 边界 #3)
    const dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const startMin = (Math.max(startDate.getTime(), dayStart.getTime()) - dayStart.getTime()) / 60000;
    const endMin = (Math.min(endDate.getTime(), dayEnd.getTime()) - dayStart.getTime()) / 60000;
    if (endMin > startMin) out.push({ startMin, endMin });
  }
  return out;
}

/**
 * 多段 union 总分钟数(给 sessions/lunch 等用)
 */
function intervalsUnionTotal(intervals: Array<{ startMin: number; endMin: number }>): number {
  if (intervals.length === 0) return 0;
  const sorted = intervals.slice().sort((a, b) => a.startMin - b.startMin);
  let total = 0;
  let curStart = sorted[0]!.startMin;
  let curEnd = sorted[0]!.endMin;
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    if (next.startMin <= curEnd) {
      curEnd = Math.max(curEnd, next.endMin);
    } else {
      total += curEnd - curStart;
      curStart = next.startMin;
      curEnd = next.endMin;
    }
  }
  total += curEnd - curStart;
  return total;
}

/**
 * 计算当日净工时
 *
 * v1.3.4-patch1 改造:netMinutes 改为**实时累计**口径
 *
 * ```
 * effectiveGross = min(elapsedWorkedMinutes, grossMinutes)
 * effectiveSlack = min(slackUnionLunch, effectiveGross)   // 已发生的扣除不超已工作
 * netMinutes     = effectiveGross - effectiveSlack + overtimeBonus + nightBonus
 * ```
 *
 * 行为差异(vs 旧版本):
 *   - 工时前(now 早于第一段) → netMinutes = overtimeBonus + nightBonus(可能为 0)
 *   - 工时段内 → netMinutes 随时间线性增长
 *   - 收工后(now 晚于最后一段) → effectiveGross 封顶到 grossMinutes,后续不再增长
 *   - 跨天段(22:00-06:00 跨天,now=02:00)→ 已工作 = now - 0,正常累计
 *
 * 注意:slackingIntervals 只算已结束 session(进行中跳过),语义天然对齐"已发生的扣除"。
 * lunchOverlapMinutes 计算段与午休窗口的 union,**仍然需要 clip 到已工作时间**(避免工时前就扣 60min 午休)。
 */
export function computeNetHours(input: {
  date: Date;
  config: Config;
  overrides: DayOverrides;
  holidays: HolidayMap;
  slackingSessions: SlackingSession[];
}): NetHoursBreakdown {
  const { date, config, overrides, slackingSessions } = input;
  const now = date;
  void input.holidays; // 保留参数以备扩展,当前算法不需要

  const dateKey = formatDateKey(date);
  const entry = getDayOverride(overrides, dateKey);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yKey = formatDateKey(yesterday);
  const yEntry = getDayOverride(overrides, yKey);

  // 跨天班次优先级:昨日跨天段 entry.segments > 今日 entry.segments > config fallback
  // (与 elapsedWorkedMinutes 保持一致:用户设了 22:00-06:00 夜班班次,凌晨 02:00 仍在班次内,
  //  今日 default 段不应干扰"夜班加成 / gross" 等计算)
  const segs =
    yEntry && yEntry.segments && yEntry.segments.length > 0
      ? yEntry.segments
      : getEffectiveSegments(config, entry);

  const grossMinutes = totalSegmentsMinutes(segs);

  // v1.3.4-patch1:已工作分钟数(实时累计)
  const elapsedWorkedMin = elapsedWorkedMinutes(now, config, overrides);
  const merged = unionSegments(segs);

  // 摸鱼
  const slackingIntervals = sessionsToIntervals(slackingSessions, now.getTime());
  const slackingMinutes = intervalsUnionTotal(slackingIntervals);

  // 午休
  const lunchMinutes = config.lunchEnabled
    ? lunchOverlapMinutes(segs, config.lunchStart, config.lunchMinutes)
    : 0;

  // 摸鱼∪午休(去重叠)
  const unionIntervals = [...slackingIntervals];
  if (lunchMinutes > 0) {
    const ls = toMinutes(config.lunchStart);
    unionIntervals.push({ startMin: ls, endMin: ls + config.lunchMinutes });
  }
  const slackUnionLunch = intervalsUnionTotal(unionIntervals);

  // v1.3.4-patch1:净工时口径改造
  // effectiveGross = 已工作(封顶到 gross,单位:分钟)
  // mergeStart = merged segments 的最早起点(分钟,从 00:00 起算;跨天段可能从 0 开始)
  // 有效时间窗口 = [mergeStart, mergeStart + effectiveGross]
  // effectiveSlack = 把"全天摸鱼∪午休 union"clip 到该窗口内
  //   - 工时前(午休还没到):union 在窗口外 → 不预扣 ✓
  //   - 已过午休:union 与窗口求交 → 正常扣 ✓
  const effectiveGross = Math.min(elapsedWorkedMin, grossMinutes);
  const mergeStart = merged.length > 0 ? toMinutes(merged[0]!.start) : 0;
  const effectiveWindowEnd = mergeStart + effectiveGross;
  const effectiveSlack = clipIntervalsToElapsed(unionIntervals, mergeStart, effectiveWindowEnd);

  // 加班加成(v1.3.3 patch3 + patch5):
  //   - 夜班场景(夜班时刻或夜班段覆盖)→ 自动 ×0.5,**只算夜间段部分**(22:00-06:00),不污染日间
  //   - 用户手动设置 multiplier > 1 → 按 multiplier 算(任何时段,适用于整段 ×倍率)
  //   - 取两者较大值(用户手动倍率优先,但不压制夜班加成)
  //   - 用户手动添加的「加班」session 也计入加班加成(按 multiplier 倍率,见下)
  const isOvertimeDay = entry?.type === 'paid_overtime';
  const multiplier = entry?.multiplier ?? 1;
  const nowInNight = isInNightWindow(now);
  const segsForNight = getEffectiveSegments(config, entry);
  const hasNightSegment = nightShiftMinutes(segsForNight) > 0;
  // v1.3.3 patch5:只对夜间段部分加 ×0.5,日间段不加(避免日间加班日被错误加成整段 gross)
  const nightAutoBonus = isOvertimeDay && (nowInNight || hasNightSegment)
    ? nightShiftMinutes(segsForNight) * 0.5
    : 0;
  const manualBonus = isOvertimeDay && multiplier > 1 ? grossMinutes * (multiplier - 1) : 0;
  // v1.3.3 patch4 + patch6:用户手动添加的「加班」session 也计入加班加成
  //   - 按 multiplier × 1(日间部分)+ multiplier × 1.5(夜班 22:00–06:00 部分)
  //   - 加班日(paid_overtime):按 entry.multiplier
  //   - 普通工作日:按 multiplier = 1
  // 例如 session 20:00–23:30(2h 日间 + 1.5h 夜班),multiplier=1.5:
  //   = 120×1.5 + 90×1.5×1.5 = 180 + 202.5 = 382.5 min
  const split = overtimeSessionSplit(slackingSessions, now.getTime());
  const userOvertimeBonus =
    split.dayMin * (isOvertimeDay ? multiplier : 1) +
    split.nightMin * (isOvertimeDay ? multiplier : 1) * 1.5;
  const overtimeBonus = Math.max(nightAutoBonus, manualBonus) + userOvertimeBonus;

  // 夜班加权(v1.3.4-patch1)
  // - 夜班标志可能在今日 entry 或昨日跨天段 entry(跨天班次的前半段属于昨日)
  // - 夜班加成基数:看标志位来自哪个 entry,就用哪个 entry 的 segments 计算夜间段分钟数
  const nightShiftToday = entry?.nightShift === true;
  const nightShiftYesterday = yEntry?.nightShift === true;
  const nightShiftFlag = nightShiftToday || nightShiftYesterday;
  const segsForNightBonus = nightShiftToday
    ? segs
    : (nightShiftYesterday ? getEffectiveSegments(config, yEntry) : segs);
  const nightBonus = nightShiftFlag ? nightShiftMinutes(segsForNightBonus) * 0.5 : 0;

  // v1.3.4-patch1:净工时 = 已工作 - 已发生的扣除 + 加班加成 + 夜班补偿
  const netMinutes = effectiveGross - effectiveSlack + overtimeBonus + nightBonus;

  // ── v1.3.4-patch2:实时累计字段(dashboard 2×2 主用) ──
  // 全部按 now 实时算,进行中 session 也计入

  // grossElapsed = 已工作分钟数(封顶到 gross)
  // 逻辑:工时前 = 0,工时段内线性增长,收工后 = gross
  const grossElapsed = effectiveGross;

  // lunchElapsed = 已发生午休分钟数
  // 算法:lunch 段 [ls, le) clip 到 [mergeStart, mergeStart + effectiveGross]
  let lunchElapsed = 0;
  if (config.lunchEnabled) {
    const ls = toMinutes(config.lunchStart);
    const le = ls + config.lunchMinutes;
    const start = Math.max(ls, mergeStart);
    const end = Math.min(le, mergeStart + effectiveGross);
    if (end > start) lunchElapsed = end - start;
  }

  // slackingElapsed = 已发生摸鱼(只算工时段内已落地的摸鱼 session)
  // 算法:slackingIntervals clip 到 [mergeStart, mergeStart + effectiveGross]
  //   - 工时前:session 全部在窗口外 → 0
  //   - 摸鱼 session 进行中:已落地部分计入
  //   - 收工后:封顶到 session 总长
  // 注意:`slackingMinutes`(全天总数)用 sessionsToIntervals 不过滤 endTs;
  //   但 `slackingIntervals` 来自 sessionsToIntervals(只算已结束),
  //   所以进行中摸鱼此处**不**算 —— 但 liveMinutesByLabel 算的是含进行中的总长,
  //   两者不一致。dashboard 4 卡都用同一份"已发生"语义 → 这里 clip 后取的是
  //   "工时段内已落地的摸鱼分钟数",与 effectiveSlack(lunchUnion)对偶。
  const slackingElapsed = clipIntervalsToElapsed(
    slackingIntervals,
    mergeStart,
    mergeStart + effectiveGross,
  );

  // overtimeElapsed = 用户 overtime session 累计(含进行中 day + night)
  // 直接复用 overtimeSessionSplit(dayMin + nightMin,endTs===null 按 now 算)
  const otSplit = overtimeSessionSplit(slackingSessions, now.getTime());
  const overtimeElapsed = otSplit.dayMin + otSplit.nightMin;

  return {
    grossMinutes,
    lunchMinutes,
    slackingMinutes,
    slackUnionLunch,
    overtimeBonus,
    nightBonus,
    nightShiftFlag,
    netMinutes,
    // v1.3.4-patch2 新增
    grossElapsed,
    lunchElapsed,
    slackingElapsed,
    overtimeElapsed,
  };
}

/**
 * 净时薪(¥/小时)
 *
 * netHourly = todayEarned / (netMinutes / 60)
 */
export function netHourlyRate(
  now: Date,
  config: Config,
  overrides: DayOverrides,
  holidays: HolidayMap,
  slackingSessions: SlackingSession[],
): number {
  const { netMinutes } = computeNetHours({
    date: now,
    config,
    overrides,
    holidays,
    slackingSessions,
  });
  const earned = todayEarned(now, config, overrides, holidays);
  if (netMinutes <= 0) return 0;
  return earned / (netMinutes / 60);
}

// ════════════════════════════════════════════════════════════
// v1.3.3 · 摸鱼薪资(按 effectiveHourlyRate × 摸鱼时长)
// ════════════════════════════════════════════════════════════

/**
 * 单个 session 的摸鱼分钟数(进行中按 now - startTs 计算)
 */
function sessionMinutes(session: SlackingSession, nowTs: number): number {
  const end = session.endTs ?? nowTs;
  const dur = Math.max(0, end - session.startTs);
  return dur / 60000;
}

/**
 * 摸鱼总薪资 = 时薪 × 总摸鱼分钟数 / 60
 *
 * - 仅 label='slack' 计入(加班是收入,其他是中性)
 * - 进行中的 session 按 now 实时累加
 * - 时薪由调用方提供(避免循环依赖)
 */
export function slackingEarn(
  sessions: SlackingSession[],
  hourlyRate: number,
  nowTs: number = Date.now(),
): number {
  if (hourlyRate <= 0) return 0;
  let totalMin = 0;
  for (const s of sessions) {
    if (s.label !== 'slack') continue;
    totalMin += sessionMinutes(s, nowTs);
  }
  return (hourlyRate * totalMin) / 60;
}

/**
 * v1.3.3 patch4:用户手动添加的「加班」记录总分钟数
 *
 * - 仅 label='overtime' 计入
 * - 进行中的 session 按 now 实时累加
 * - 用于详情页「加班」卡片显示,与系统级 overtimeBonus(paid_overtime 类型)区分
 */
export function overtimeMinutes(
  sessions: SlackingSession[],
  nowTs: number = Date.now(),
): number {
  let total = 0;
  for (const s of sessions) {
    if (s.label !== 'overtime') continue;
    total += sessionMinutes(s, nowTs);
  }
  return total;
}

/**
 * v1.3.3 patch6:加班 session 的「日间 / 夜班」分钟拆分
 *
 *  - 日间部分(dayMin):按 multiplier 计入(任何时段)
 *  - 夜班部分(nightMin):按 multiplier × 1.5 计入(夜班 22:00–06:00 自动加成)
 *
 * 例如 session 20:00–23:30(3.5h):
 *   - dayMin = 120(20:00–22:00)
 *   - nightMin = 90(22:00–23:30)
 *   - overtime 贡献 = dayMin × multiplier + nightMin × multiplier × 1.5
 *
 * 跨 00:00 的 session 会按"日界线"拆分(前半段在昨日,后半段在今日)。
 *
 * 进行中 session 按 now 实时计算。
 */
export function overtimeSessionSplit(
  sessions: SlackingSession[],
  nowTs: number = Date.now(),
): { dayMin: number; nightMin: number; totalMin: number } {
  let dayMin = 0;
  let nightMin = 0;
  for (const s of sessions) {
    if (s.label !== 'overtime') continue;
    const end = s.endTs ?? nowTs;
    if (end <= s.startTs) continue;
    const split = splitSessionDayNight(s.startTs, end);
    dayMin += split.day;
    nightMin += split.night;
  }
  return { dayMin, nightMin, totalMin: dayMin + nightMin };
}

/**
 * 计算单个 [startTs, endTs) 区间内的日间 / 夜班分钟拆分
 *
 * 夜班窗口:22:00–06:00(每日 local time)
 * 跨 00:00 时按日界线切两段分别统计。
 */
function splitSessionDayNight(
  startTs: number,
  endTs: number,
): { day: number; night: number } {
  let day = 0;
  let night = 0;
  let cur = startTs;
  while (cur < endTs) {
    const curDate = new Date(cur);
    const dayStart = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate()).getTime();
    const dayEnd = dayStart + 24 * 3600 * 1000;
    const segEnd = Math.min(endTs, dayEnd);
    const startMin = (cur - dayStart) / 60000;
    const endMin = (segEnd - dayStart) / 60000;
    const overlap = nightOverlap(startMin, endMin);
    night += overlap;
    day += endMin - startMin - overlap;
    cur = segEnd;
  }
  return { day, night };
}

/** [startMin, endMin) 在夜班窗口 [1320, 1440) ∪ [0, 360) 内的分钟数 */
function nightOverlap(startMin: number, endMin: number): number {
  const a = Math.max(startMin, NIGHT_SHIFT_START_MIN);
  const b = Math.min(endMin, 24 * 60);
  const c = Math.max(startMin, 0);
  const d = Math.min(endMin, NIGHT_SHIFT_END_MIN);
  let total = 0;
  if (b > a) total += b - a;
  if (d > c) total += d - c;
  return total;
}

/**
 * 今日已结束的摸鱼时长(分钟,不含进行中),与已有 getTodaySlackingMinutes 一致
 */
export function totalSlackingMinutes(
  sessions: SlackingSession[],
  label: TimeRecordLabel = 'slack',
): number {
  let total = 0;
  for (const s of sessions) {
    if (s.endTs === null) continue;
    if (s.label !== label) continue;
    const startDate = new Date(s.startTs);
    const endDate = new Date(s.endTs);
    const dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const startMin = (Math.max(startDate.getTime(), dayStart.getTime()) - dayStart.getTime()) / 60000;
    const endMin = (Math.min(endDate.getTime(), dayEnd.getTime()) - dayStart.getTime()) / 60000;
    if (endMin > startMin) total += endMin - startMin;
  }
  return Math.round(total);
}

/**
 * v1.3.4-patch2:某 label session 的"实时累计"分钟数(含进行中)
 *
 * 区别于 `totalSlackingMinutes`(只算已结束):本函数对 `endTs === null` 的 session
 * 按 `nowTs` 实时累加,用于 dashboard 2×2 的"摸鱼 / 加班"卡片显示。
 *
 * 注意:不做日界线裁剪,假设调用方传进来的 sessions 已经是当天的;
 * 跨日的 session 在 computeNetHours 阶段已被 sessionsToIntervals 隐式处理过。
 */
export function liveMinutesByLabel(
  sessions: SlackingSession[],
  label: TimeRecordLabel,
  nowTs: number,
): number {
  let total = 0;
  for (const s of sessions) {
    if (s.label !== label) continue;
    const end = s.endTs ?? nowTs;
    const dur = Math.max(0, end - s.startTs);
    total += dur / 60000;
  }
  return total;
}

// ════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════

/** 分钟数 → "HH:MM" */
function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
