/**
 * Salary Timer — 后端请求封装（v3.2）
 *
 * 目标:**任何网络问题都不许抛错**。
 *
 * 后端不可达、请求超时、返回非 2xx、返回非法 JSON —— 全部收敛成
 * `{ ok: false, status, data: null }`,调用方不需要写 try/catch,
 * 也不会产生 unhandled rejection。
 *
 * 后台统计是「锦上添花」的功能,不能因为它挂了影响主流程。
 */

import { apiBase } from './platform';

export interface ApiResult<T> {
  /** 请求是否成功拿到预期的 2xx 响应 */
  ok: boolean;
  /** HTTP 状态码;网络错误/超时时为 0 */
  status: number;
  /** 解析后的响应体;失败或非 JSON 时为 null */
  data: T | null;
  /** 失败原因(仅用于调试,不展示给用户) */
  error: string | null;
}

const DEFAULT_TIMEOUT_MS = 6000;

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * 发起一次后端请求,永不抛错。
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const init: RequestInit = {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      signal: controller.signal,
    };
    if (body !== undefined) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const res = await fetch(`${apiBase()}${path}`, init);

    // 非 2xx 也要尝试读 body(后端错误信息在 body 里),但读不出来不影响结果
    const data = await parseJson<T>(res);

    if (!res.ok) {
      return { ok: false, status: res.status, data, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, data: null, error };
  } finally {
    clearTimeout(timer);
  }
}

/** body 可能是 JSON,也可能是空或纯文本;解析失败返回 null 而不是抛错 */
async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export { apiBase };
