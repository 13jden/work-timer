/**
 * useDesktopScale — 桌面端整体等比缩放
 *
 * 原理：
 *   以「基准设计尺寸」为 1:1 参考，计算当前视口与基准的比例，
 *   取较小值作为缩放系数，保证内容始终完整显示在视口内。
 *
 *   fitScale = min(viewportWidth / baseWidth, viewportHeight / baseHeight)
 *   scale = max(fitScale, minScale)  ← 有最小值，缩太小就允许滚动
 *
 * 基准尺寸：1400 × 750（28:15，用户理想比例）
 * 最小缩放：0.75（再小就不清了，允许内容往下滚动）
 */
import { useEffect, useState } from 'react';

// 基准设计尺寸（28:15）
export const BASE_WIDTH = 1480;
export const BASE_HEIGHT = 820;

// 最小缩放比例
const MIN_SCALE = 0.65;

export function useDesktopScale(): number {
  const [scale, setScale] = useState(() => calcScale());

  useEffect(() => {
    const handler = () => setScale(calcScale());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return scale;
}

function calcScale(): number {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scaleX = vw / BASE_WIDTH;
  const scaleY = vh / BASE_HEIGHT;
  const fitScale = Math.min(scaleX, scaleY);
  // 不低于最小值，缩太小就允许往下滚
  return Math.max(fitScale, MIN_SCALE);
}
