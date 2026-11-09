/**
 * Salary Timer — 后端埋点（v3.2）
 *
 * 用途:
 * - 每次 App 打开时上报一次「活跃」，服务端按 (日期, 设备) 去重 → 日活统计
 * - 生成一个本地匿名 ID（只存在 localStorage，不含任何个人信息）
 *
 * 约定:
 * - 每天只上报一次：成功后把当天日期写进 localStorage，次日再上报
 * - 上报失败静默忽略（离线 / 后端不可用都不影响主流程）
 */

const USER_ID_KEY = 'st_anon_id';
const LAST_PING_KEY = 'st_last_ping_day';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** 今天日期 YYYY-MM-DD（本地时区） */
function todayKey(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** 本地匿名 ID（首次生成后固定） */
export function getAnonId(): string {
  try {
    const existing = localStorage.getItem(USER_ID_KEY);
    if (existing) return existing;
    const id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(USER_ID_KEY, id);
    return id;
  } catch {
    // localStorage 不可用（隐私模式）→ 用一次性 ID，不影响主流程
    return `u-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** 今天是否已经上报过 */
function alreadyPingedToday(): boolean {
  try {
    return localStorage.getItem(LAST_PING_KEY) === todayKey();
  } catch {
    return false;
  }
}

function markPinged(): void {
  try {
    localStorage.setItem(LAST_PING_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

/**
 * 每日活跃上报（幂等：同一天重复调用只会真正发一次请求）
 */
export async function pingDailyActivity(): Promise<boolean> {
  if (alreadyPingedToday()) return false;
  try {
    const res = await fetch(`${API_BASE}/api/ping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: getAnonId() }),
    });
    if (!res.ok) return false;
    markPinged();
    return true;
  } catch {
    return false;
  }
}
