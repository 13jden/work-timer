/**
 * useNow — 每秒(可配置)返回最新 Date。
 * 整个 App 只**应该有一个** useNow() 实例,各组件订阅同一个时间。
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}