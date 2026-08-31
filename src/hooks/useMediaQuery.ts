/**
 * useMediaQuery — 响应式断点 hook
 */
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/**
 * 桌面端判断：宽高比 ≥ 3/2（宽:高 ≥ 1.5）
 *
 * 不再用 min-width 1024px，因为：
 * - 手机横屏可能 > 1024px 宽，但整体仍是手机体验
 * - 桌面窗口缩窄后 < 1024px，但仍是桌面体验
 *
 * 阈值参考：
 * - 手机竖屏 390×844   → 宽高比 0.46  → 移动端 ✅
 * - 手机横屏 844×390   → 宽高比 2.16 ≥ 1.5 → 桌面端（横屏当桌面用）
 * - iPad 竖屏 768×1024 → 宽高比 0.75  → 移动端 ✅
 * - iPad 横屏 1024×768 → 宽高比 1.33 < 1.5 → 移动端 ✅
 * - 桌面 1280×720      → 宽高比 1.78 ≥ 1.5 → 桌面端 ✅
 * - 窄桌面窗口 600×900 → 宽高比 0.67  → 移动端 ✅
 */
export const useIsDesktop = () => useMediaQuery('(min-aspect-ratio: 3/2)');