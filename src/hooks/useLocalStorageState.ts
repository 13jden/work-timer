/**
 * useLocalStorageState — 通用 localStorage 同步 state hook
 *
 * 行为：
 * - SSR-safe（typeof window === 'undefined' 时不读 localStorage）
 * - parse 失败时 fallback 到 defaultValue
 * - 序列化失败时静默忽略（避免阻塞 UI）
 *
 * 用法：
 *   const [collapsed, setCollapsed] = useLocalStorageState('sidebar_v1', false);
 */
import { useEffect, useState } from 'react';

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / disabled
    }
  }, [key, value]);

  return [value, setValue];
}
