/**
 * useNotices — 公告 / 更新队列（v3.2）
 *
 * 职责：
 * - App 打开时拉一次公告（静默，失败无感）
 * - 维护一个队列，逐条展示
 * - 提供 `checkNow()` 供设置页「检查更新」按钮手动触发
 *
 * 任何网络失败都只是「没有公告」，绝不抛错、绝不弹错误。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNotices, type Notice } from '../lib/notice';

export interface UseNoticesResult {
  /** 当前要展示的公告（null = 没有） */
  current: Notice | null;
  /** 关闭当前公告 */
  dismiss: () => void;
  /** 手动检查更新（设置页按钮） */
  checkNow: () => Promise<Notice[]>;
  /** 手动检查是否正在进行 */
  checking: boolean;
}

export function useNotices(): UseNoticesResult {
  const [queue, setQueue] = useState<Notice[]>([]);
  const [checking, setChecking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // App 打开时静默拉一次
  useEffect(() => {
    let cancelled = false;
    void fetchNotices().then((list) => {
      if (!cancelled && mounted.current && list.length) setQueue(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 设置页「检查更新」按钮通过自定义事件把结果广播过来
  useEffect(() => {
    const onManual = (e: Event) => {
      const detail = (e as CustomEvent<{ notices?: Notice[] }>).detail;
      const list = detail?.notices ?? [];
      if (!mounted.current || !list.length) return;
      setQueue((q) => {
        const known = new Set(q.map((n) => n.id));
        const fresh = list.filter((n) => !known.has(n.id));
        return [...fresh, ...q];
      });
    };
    window.addEventListener('st:notices', onManual);
    return () => window.removeEventListener('st:notices', onManual);
  }, []);

  const dismiss = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  /**
   * 手动检查：忽略「今天已提示」的本地去重，
   * 所以用户每次点都能重新看到待更新的内容。
   */
  const checkNow = useCallback(async (): Promise<Notice[]> => {
    setChecking(true);
    try {
      const list = await fetchNotices(true);
      if (mounted.current) {
        // 手动检查时，把新拉到的公告插到队列最前面
        setQueue((q) => {
          const known = new Set(q.map((n) => n.id));
          const fresh = list.filter((n) => !known.has(n.id));
          return [...fresh, ...q];
        });
      }
      return list;
    } catch {
      return [];
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, []);

  return {
    current: queue[0] ?? null,
    dismiss,
    checkNow,
    checking,
  };
}
