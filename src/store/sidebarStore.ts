/**
 * Sidebar Store — 桌面端左侧导航的展开/收起状态
 *
 * v1.3.4 新增：仅桌面端（≥1024px）使用。
 * - 持久化到 localStorage（key: salary_timer_sidebar_collapsed_v1）
 * - 提供 toggle / setCollapsed 方法
 */
import { useLocalStorageState } from '../hooks/useLocalStorageState';

const STORAGE_KEY = 'salary_timer_sidebar_collapsed_v1';

export function useSidebarCollapsed(): readonly [boolean, (next: boolean | ((p: boolean) => boolean)) => void] {
  return useLocalStorageState<boolean>(STORAGE_KEY, false);
}
