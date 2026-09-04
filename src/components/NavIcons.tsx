/**
 * NavIcons — 4 个主导航 Tab 的 SVG 图标
 *
 * 22×22 viewBox · 1.7 描边 · 圆润 round 端帽
 * 当前色(currentColor)驱动配色,与主题色统一
 */
import type { ReactNode } from 'react';

const COMMON = {
  width: 16,
  height: 16,
  viewBox: '0 0 22 22',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const NavIcons: Record<string, ReactNode> = {
  today: (
    <svg {...COMMON}>
      <circle cx="11" cy="11" r="9" />
      <path d="M11 6v5l3 2" />
    </svg>
  ),
  accounting: (
    <svg {...COMMON}>
      <path d="M5 4.5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" />
      <path d="M8 8h6M8 11.5h6M8 15h3" />
    </svg>
  ),
  convert: (
    <svg {...COMMON}>
      <path d="M4 7h14M4 7l3-3M4 7l3 3" />
      <path d="M18 15H4M18 15l-3-3M18 15l-3 3" />
    </svg>
  ),
  calendar: (
    <svg {...COMMON}>
      <rect x="3" y="5" width="16" height="14" rx="2" />
      <path d="M3 9h16M7 3v4M15 3v4" />
    </svg>
  ),
  fish: (
    <svg {...COMMON}>
      <path d="M3 11c3-5 10-6 16-1-6 5-13 4-16-1Z" />
      <path d="M5 8 3 5M5 14l-2 3M17 9l2-2" />
      <circle cx="14" cy="10" r=".8" fill="currentColor" stroke="none" />
    </svg>
  ),
  settings: (
    <svg {...COMMON}>
      <circle cx="11" cy="11" r="3" />
      <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.9 4.9l1.4 1.4M15.7 15.7l1.4 1.4M4.9 17.1l1.4-1.4M15.7 6.3l1.4-1.4" />
    </svg>
  ),
  // v2.1 TASK-037:记账主题占位 tab 图标
  'acct-stats': (
    <svg {...COMMON}>
      <path d="M4 18h14" />
      <path d="M7 18v-6M11 18V6M15 18v-9" />
    </svg>
  ),
  'acct-cal': (
    <svg {...COMMON}>
      <rect x="3" y="5" width="16" height="14" rx="2" />
      <path d="M3 9h16M7 3v4M15 3v4" />
      <path d="M8 13h6M11 13v4M9.5 14.5c0-1 1-1.5 1.5-1.5s1.5.5 1.5 1.5" />
    </svg>
  ),
  'acct-mine': (
    <svg {...COMMON}>
      <circle cx="11" cy="8" r="3.5" />
      <path d="M4.5 18c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" />
    </svg>
  ),
};
