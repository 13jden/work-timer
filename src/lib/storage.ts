/**
 * Salary Timer — Storage Layer
 *
 * localStorage 的 JSON 封装。**纯函数**,无副作用。
 * 之所以不直接用 zustand/middleware 的 persist:这份代码可能被服务端或测试调用,
 * 抽出来更便于单独测试和复用。
 */

/** 从 localStorage 读 JSON,失败 / 不存在返回 fallback */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 把 JSON 写入 localStorage,失败静默 */
export function saveJSON<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded / privacy mode 等情况,静默
  }
}

/** 删除 key */
export function removeJSON(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}