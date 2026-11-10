/**
 * Salary Timer — 设备标识 + 日活上报（v3.2）
 *
 * 目的:
 * - 每次 App 打开上报一次「活跃」，服务端按 (日期, 设备) 去重 → 日活统计
 * - 生成一个**稳定**的匿名设备 ID（只存在本地，不含任何个人信息）
 *
 * ## 设备 ID 的三级来源
 *
 * | 优先级 | 来源 | ID 前缀 | 稳定性 |
 * |---|---|---|---|
 * | 1 | 原生设备 ID（Tauri 注入 `window.__ST_DEVICE_ID__`） | `d-` | 最强（跨重装） |
 * | 2 | 安装 ID（localStorage） | `u-` | 同一安装周期内稳定 |
 * | 3 | 确定性指纹（localStorage 不可用时兜底） | `f-` | 同一浏览器配置稳定 |
 *
 * ### 为什么第 3 级要用「确定性指纹」而不是随机数
 *
 * 旧实现里 localStorage 不可用（隐私模式 / 用户禁用存储）时会
 * `Math.random()` 兜底 —— **每次请求都是新 ID**，
 * 于是同一个用户每次打开都算「新用户」，总用户数被严重虚高。
 *
 * 现在改成对「浏览器特征」做哈希：同一台设备同一套浏览器配置 → 同一个 ID，
 * 即使 localStorage 被禁也不会重复计数。哈希只在本机算，不外传原始特征。
 *
 * 约定:
 * - 每天只上报一次：成功后把当天日期写进 localStorage，次日再上报
 * - **任何网络问题都不报错**：后端没起、离线、超时、500 —— 全部静默吞掉，
 *   日活统计是「锦上添花」，绝不能影响主流程或打出未捕获异常。
 */
import { request } from './api';
import { isNativeShell } from './platform';

const DEVICE_ID_KEY = 'st_device_id';
/** 旧版本的 key，保留读取以兼容已上报过的用户 */
const LEGACY_ANON_ID_KEY = 'st_anon_id';
/** 原生设备 ID 的本地缓存（原生层拿到的更稳定，缓存避免每次过 JNI） */
const NATIVE_ID_KEY = 'st_native_device_id';
const LAST_PING_KEY = 'st_last_ping_day';

/** 原生层可注入的设备 ID（Tauri command / 插件设置） */
declare global {
  interface Window {
    __ST_DEVICE_ID__?: string;
  }
}

/** 今天日期 YYYY-MM-DD（本地时区） */
function todayKey(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** 32 位 FNV-1a 哈希 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    // h *= 16777619（用移位避免精度丢失）
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** 32 位 djb2 哈希（和 FNV 组合成 64 位，降低碰撞概率） */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/**
 * 浏览器特征指纹 —— 只在**本机**算哈希，原始特征不出本机。
 *
 * 刻意**不含**会随环境变化的字段：
 * - 不含 `timezoneOffset`（夏令时会让 ID 漂移）
 * - 屏幕用 `width * height`（面积，旋转屏幕不会变）而不是宽高分别取
 */
function fingerprintSource(): string {
  const parts: string[] = [];
  try {
    const nav = navigator;
    parts.push(nav.userAgent ?? '');
    parts.push(nav.language ?? '');
    parts.push(nav.platform ?? '');
    parts.push(String(nav.hardwareConcurrency ?? 0));
    parts.push(String(nav.maxTouchPoints ?? 0));
  } catch {
    /* ignore */
  }
  try {
    // 时区用 IANA 名（稳定），不用 offset（DST 会变）
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone ?? '');
  } catch {
    /* ignore */
  }
  try {
    const s = screen;
    // 面积而非宽高 —— 手机横竖屏旋转不会改变
    parts.push(`${s.width * s.height}x${s.colorDepth}`);
  } catch {
    /* ignore */
  }
  return parts.join('|');
}

/** 确定性指纹 ID：同一浏览器配置 → 同一个 ID */
export function getFingerprintId(): string {
  const src = fingerprintSource();
  const hex = `${fnv1a(src).toString(16).padStart(8, '0')}${djb2(src).toString(16).padStart(8, '0')}`;
  return `f-${hex}`;
}

/**
 * 稳定的设备 ID（用于日活去重 + 总用户数去重）。
 *
 * 三级降级，见文件头说明。**永不抛错**。
 */
export function getDeviceId(): string {
  // 1. 原生设备 ID（Tauri 注入）
  try {
    const native = typeof window !== 'undefined' ? window.__ST_DEVICE_ID__ : undefined;
    if (typeof native === 'string' && native.trim()) return `d-${native.trim()}`;
  } catch {
    /* ignore */
  }

  // 2. 安装 ID（localStorage）
  try {
    const existing =
      localStorage.getItem(DEVICE_ID_KEY) ?? localStorage.getItem(LEGACY_ANON_ID_KEY);
    if (existing) {
      if (!localStorage.getItem(DEVICE_ID_KEY)) {
        localStorage.setItem(DEVICE_ID_KEY, existing);
      }
      return existing;
    }
    const id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    // 兼容：老 key 也写一份，老版本代码读得到
    try {
      localStorage.setItem(LEGACY_ANON_ID_KEY, id);
    } catch {
      /* ignore */
    }
    return id;
  } catch {
    // 3. localStorage 不可用（隐私模式 / 禁用存储）→ 确定性指纹兜底
    return getFingerprintId();
  }
}

/**
 * 尝试从原生层拿设备 ID。
 *
 * 原生侧注册了 `get_device_id` 命令时（Android 的 `Settings.Secure.ANDROID_ID`）
 * 就能拿到跨重装稳定的设备 ID；没注册就返回 null，前端退回安装 ID。
 *
 * 用 `window.__TAURI_INTERNALS__.invoke` 而不是 `import { invoke } from '@tauri-apps/api'`
 * —— 后者会拖一个 npm 依赖进 Web 端 bundle，纯 Web 端用不上。
 *
 * **永不抛错**，超时也不会卡住主流程。
 */
export async function fetchNativeDeviceId(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;
    const internals = (window as unknown as {
      __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> };
    }).__TAURI_INTERNALS__;
    const invoke = internals?.invoke;
    if (typeof invoke !== 'function') return null;

    const raw = await Promise.race([
      invoke('get_device_id'),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);

    if (raw && typeof raw === 'object' && 'device_id' in raw) {
      const id = (raw as { device_id?: unknown }).device_id;
      if (typeof id === 'string' && id.trim()) return `d-${id.trim()}`;
    }
    if (typeof raw === 'string' && raw.trim()) return `d-${raw.trim()}`;
    return null;
  } catch {
    // 原生命令没注册 / 调用失败 → 用安装 ID
    return null;
  }
}

/**
 * 最终用于上报的设备 ID（异步版）。
 *
 * 优先用原生设备 ID（最稳定），拿不到就用同步版的安装 ID / 指纹。
 */
export async function resolveDeviceId(): Promise<string> {
  const native = await fetchNativeDeviceId();
  if (native) {
    // 缓存下来，避免每次都过 JNI
    try {
      localStorage.setItem(NATIVE_ID_KEY, native);
    } catch {
      /* ignore */
    }
    return native;
  }
  try {
    const cached = localStorage.getItem(NATIVE_ID_KEY);
    if (cached) return cached;
  } catch {
    /* ignore */
  }
  return getDeviceId();
}

/** @deprecated 用 `getDeviceId()` 代替（保留别名，兼容既有调用与测试） */
export function getAnonId(): string {
  return getDeviceId();
}

/**
 * 平台标识：app / web。
 *
 * 用于后台区分「原生 App 用户」和「网页用户」。
 */
export function getPlatform(): 'app' | 'web' {
  return isNativeShell() ? 'app' : 'web';
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
 *
 * 返回是否**成功记上**了今天。任何失败都返回 false 且不抛错。
 */
export async function pingDailyActivity(): Promise<boolean> {
  if (alreadyPingedToday()) return false;

  // 设备 ID：优先原生（Android ANDROID_ID），拿不到退回安装 ID / 指纹
  const deviceId = await resolveDeviceId();

  const res = await request('/api/ping', {
    method: 'POST',
    body: { userId: deviceId, platform: getPlatform() },
  });

  // 只有服务端明确回 ok 才算记上；网络不通/500 都不打标，
  // 下次打开 App 还会再试一次（当天第一次成功后才算完成）。
  if (!res.ok || !res.data || (res.data as { ok?: boolean }).ok !== true) {
    return false;
  }

  markPinged();
  return true;
}
