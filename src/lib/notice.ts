/**
 * Salary Timer — 公告 / 更新（v3.2）
 *
 * 规则（与后端 `/api/notice` 一致）：
 *
 * | 类型 | Web 端 | App 端 |
 * |---|---|---|
 * | announcement 公告 | 看过一次就不再提示 | 看过一次就不再提示 |
 * | update 更新 | 看过一次就不再提示 | 比对版本号，未升级时**每天**提示一次 |
 *
 * 本地状态（localStorage）：
 * - `st_seen_notices`   已看过的公告 id 列表（公告 + Web 端更新共用）
 * - `st_update_prompt`  每个更新 id 最后一次提示的日期（App 端按天去重）
 *
 * 所有网络请求都走 `request()`，**永不抛错** —— 后端挂了只是没有公告而已。
 */
import { request } from './api';
import { isNativeShell } from './platform';

export type NoticeType = 'announcement' | 'update';

export interface Notice {
  id: number;
  type: NoticeType;
  title: string;
  body: string;
  version: string | null;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

const SEEN_KEY = 'st_seen_notices';
const UPDATE_PROMPT_KEY = 'st_update_prompt';

/** 编译期注入的 App 版本号（来自 src-tauri/tauri.conf.json） */
declare const __APP_VERSION__: string;

function builtVersion(): string {
  try {
    return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * 是否运行在 Tauri 原生壳里
 *
 * 实现见 `./platform` —— 全项目只有那一处认识 Tauri。
 */
export function isNativeApp(): boolean {
  return isNativeShell();
}

/** 客户端当前版本号（Web 端返回 null） */
export function currentVersion(): string | null {
  return isNativeApp() ? builtVersion() : null;
}

// ── 本地状态 ──────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式下写不进去，忽略 */
  }
}

/** 已看过的公告 id */
export function getSeenIds(): number[] {
  const list = readJson<number[]>(SEEN_KEY, []);
  return Array.isArray(list) ? list.filter((n) => Number.isInteger(n)) : [];
}

/** 标记为已看过 */
export function markSeen(id: number): void {
  const list = getSeenIds();
  if (!list.includes(id)) {
    list.push(id);
    writeJson(SEEN_KEY, list);
  }
}

/** 更新提示的最后日期表：{ [noticeId]: 'YYYY-MM-DD' } */
function getPromptDays(): Record<string, string> {
  const map = readJson<Record<string, string>>(UPDATE_PROMPT_KEY, {});
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 记录：某条更新今天已经提示过 */
export function markPromptedToday(id: number): void {
  const map = getPromptDays();
  map[String(id)] = todayKey();
  writeJson(UPDATE_PROMPT_KEY, map);
}

/** 该条更新今天是否已经提示过（App 端每天只提示一次） */
export function promptedToday(id: number): boolean {
  return getPromptDays()[String(id)] === todayKey();
}

// ── 版本比较 ──────────────────────────────────────────────

/**
 * 语义化版本比较：a > b 返回正数，a < b 返回负数，相等返回 0
 * 非标准版本号（"3.1" / "3.1.0-beta"）也能比较。
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/).filter(Boolean);
  const pb = b.split(/[.\-+]/).filter(Boolean);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    const va = Number.isFinite(na) ? na : 0;
    const vb = Number.isFinite(nb) ? nb : 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

// ── 拉取 ──────────────────────────────────────────────────

/**
 * 拉取需要展示的公告 / 更新。
 *
 * 后端已经按「版本 + 已读列表」过滤过一次，这里再做一次本地过滤兜底：
 * - 公告 / Web 端更新：本地已看过 → 跳过
 * - App 端更新：本地今天已提示过 → 跳过
 *
 * 永不抛错；网络失败返回空数组。
 */
export async function fetchNotices(manual = false): Promise<Notice[]> {
  const version = currentVersion();
  const seen = getSeenIds();

  const params = new URLSearchParams();
  if (version) params.set('currentVersion', version);
  // 手动检查时**不传 seen**：用户主动点「检查更新」就是想再看一遍，
  // 后端如果按 seen 过滤掉就永远拿不到内容了。
  if (!manual && seen.length) params.set('seen', seen.join(','));
  // 手动检查时忽略「今天已提示」的本地去重，让用户每次都能看到
  if (manual) params.set('force', 'true');

  const res = await request<{ ok?: boolean; notices?: Notice[] }>(
    `/api/notice?${params.toString()}`,
  );

  if (!res.ok || !res.data || res.data.ok !== true) return [];

  const list = Array.isArray(res.data.notices) ? res.data.notices : [];

  return list.filter((n) => {
    if (!n || typeof n.id !== 'number') return false;

    // 手动检查：忽略「已看过」限制
    if (manual) {
      if (n.type === 'update' && version !== null && n.version) {
        // App 端仍要比对版本 —— 已经是最新的没必要提示
        if (compareVersions(n.version, version) <= 0) return false;
      }
      return true;
    }

    if (n.type === 'announcement') {
      // 公告：看过一次就不再展示
      return !seen.includes(n.id);
    }

    // update 类型
    if (version === null) {
      // Web 端：等同公告，看过就不展示
      return !seen.includes(n.id);
    }

    // App 端：版本必须比当前新
    if (n.version && compareVersions(n.version, version) <= 0) return false;

    // 每天只提示一次
    if (promptedToday(n.id)) return false;

    return true;
  });
}

/** 关闭公告时调用：公告 / Web 更新记为已读；App 更新只记「今天提示过」 */
export function markDismissed(notice: Notice): void {
  const version = currentVersion();
  if (notice.type === 'announcement' || version === null) {
    markSeen(notice.id);
  } else {
    markPromptedToday(notice.id);
  }
}

/** 手动检查更新时，是否有可展示的内容 */
export function hasPendingUpdate(notices: Notice[]): boolean {
  return notices.some((n) => n.type === 'update');
}
