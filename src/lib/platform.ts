/**
 * Salary Timer — 运行环境判定 + API 基址解析（v3.2）
 *
 * ## 为什么需要这个文件
 *
 * 项目里有三处需要知道「当前是不是跑在原生 App 里」：
 * - `api.ts`  —— 决定请求打到哪里（相对路径 vs 绝对域名）
 * - `track.ts` —— 决定日活上报标记 app 还是 web
 * - `notice.ts` —— 决定要不要带版本号（App 端才比对更新）
 *
 * 以前每处各写一份 `window.__TAURI_INTERNALS__` 判断，容易漂移，
 * 所以收拢到这里，**只有这一处**认识 Tauri。
 *
 * ## API 基址（核心）
 *
 * | 运行环境 | origin | 请求地址 |
 * |---|---|---|
 * | Web（浏览器打开网站） | `https://persecond.work` | `/api/xxx`（同域，走 Caddy 反代） |
 * | 原生 App（Tauri WebView） | `tauri://localhost`（桌面）/ `http://tauri.localhost`（Android） | `https://persecond.work/api/xxx`（**必须绝对地址**） |
 *
 * 原生 App 里如果用相对路径 `/api/ping`，请求会打到 WebView 自己的
 * 虚拟域名上，**根本到不了线上后端**（WebView 内没有那个路由），
 * 表现为日活永远记不上、公告永远拉不到，而且不报错（被 `request()` 吞了）。
 *
 * 因此 API 基址在**编译期**就烤进 bundle（vite 的 `apiBasePlugin()`），
 * 运行时不再靠猜。
 */

/**
 * 生产站点域名。Caddy 的站点地址与它保持一致（见 Caddyfile / .env.example）。
 *
 * 兜底常量 —— 正常构建时 `__API_BASE__` 会由 vite 的 `apiBasePlugin()`
 * 烤进 bundle（可被 `VITE_API_BASE` 环境变量覆盖），这个常量只是
 * 「万一 define 没生效」的保险（例如在 vitest 里直接跑源码）。
 */
export const DEFAULT_API_BASE = 'https://persecond.work';

/**
 * 是否运行在 Tauri 原生壳里。
 *
 * 判据：Tauri v2 会在页面脚本执行前注入 `window.__TAURI_INTERNALS__`；
 * `window.__TAURI__` 是 v1 的老写法，一并兼容。
 *
 * **永不抛错**（隐私模式下访问 window 属性也可能被拦截）。
 */
export function isNativeShell(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
    return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
  } catch {
    return false;
  }
}

/** 基址解析的输入（抽出来是为了能纯函数单测） */
export interface ApiBaseInput {
  /** 编译期注入的环境变量 `VITE_API_BASE`（可能为空） */
  configured?: string | undefined;
  /** 是否开发模式（dev server，会走 Vite 的 /api 代理） */
  dev?: boolean;
  /** 是否跑在 Tauri 原生壳里 */
  native?: boolean;
  /** 编译期烤进去的 API 基址（vite define 注入的 `__API_BASE__`） */
  baked?: string | undefined;
}

/**
 * 纯函数：解析 API 基址。
 *
 * 优先级：
 * 1. `configured`（`VITE_API_BASE`）—— 显式覆盖，最高优先级
 * 2. 开发模式 → 空串（相对路径，走 Vite 的 `/api` 代理）
 *    本机后端 localhost:8800；`tauri dev` 时 WebView 加载的也是 Vite dev server，同样走代理
 * 3. 原生 App → 编译期烤进去的绝对地址（线上站点）
 * 4. Web 生产包 → 空串（同域相对路径，Caddy 反代到 api 容器）
 *
 * 返回值末尾不带斜杠，方便直接拼 `${base}/api/xxx`。
 */
export function resolveApiBase(input: ApiBaseInput): string {
  const clean = (s: string): string => s.trim().replace(/\/+$/, '');

  // 1. 显式覆盖优先
  if (typeof input.configured === 'string' && input.configured.trim()) {
    return clean(input.configured);
  }

  // 2. 开发模式：相对路径 + Vite 代理（tauri dev 同样适用）
  if (input.dev) return '';

  // 3. 原生 App 生产包：WebView 的 origin 不是线上站点，必须用绝对地址
  if (input.native) {
    if (typeof input.baked === 'string' && input.baked.trim()) return clean(input.baked);
    return DEFAULT_API_BASE;
  }

  // 4. Web 生产包：同域
  return '';
}

/**
 * 解析 API 基址（运行时入口）。
 *
 * **每次请求时求值**（不是模块加载时）—— 原生环境标识的注入时机
 * 在不同平台不完全一致，求值晚一点更稳。
 */
export function apiBase(): string {
  let configured: string | undefined;
  let dev = false;
  try {
    configured = import.meta.env.VITE_API_BASE;
    dev = Boolean(import.meta.env.DEV);
  } catch {
    /* ignore */
  }

  let baked: string | undefined;
  try {
    // 编译期常量（vite define 注入）；vitest 里跑源码时为 undefined → 走兜底常量
    baked = typeof __API_BASE__ === 'string' ? __API_BASE__ : undefined;
  } catch {
    baked = undefined;
  }

  return resolveApiBase({
    configured,
    dev,
    native: isNativeShell(),
    baked,
  });
}
