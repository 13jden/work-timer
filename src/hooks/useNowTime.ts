/**
 * useNowTime — 当前时刻字符串 "HH:MM",每分钟更新。
 * 用于 StatusBar 显示系统时间。
 */
import { useEffect, useState } from 'react';

export function useNowTime(): string {
  const [time, setTime] = useState<string>(() => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    };
    tick();
    // 对齐到下一个整分钟
    const msToNextMin = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    const timeoutId = setTimeout(() => {
      tick();
      const intervalId = setInterval(tick, 60_000);
      // store interval on closure: cleanup via outer ref
      cleanupRef = () => clearInterval(intervalId);
    }, msToNextMin);

    return () => {
      clearTimeout(timeoutId);
      cleanupRef?.();
    };
  }, []);

  return time;
}

let cleanupRef: (() => void) | null = null;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}