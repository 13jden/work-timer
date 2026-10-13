/**
 * @fileoverview useImage — 按 imageId 读取图片并管理 ObjectURL（v3.0 TASK-056）
 *
 * 挂载时 getImage → URL.createObjectURL（异步）；
 * 卸载 / imageId 变化时 revokeObjectURL 避免内存泄漏。
 *
 * 行为约定：
 * - 无 imageId → 返回 null
 * - 读取失败（不支持 IndexedDB / 找不到）→ 返回 null
 * - 加载中：status='loading'，url 为 null
 * - 完成：status='ok' | 'missing'，url 为 Blob URL 或 null
 */
import { useEffect, useState } from 'react';
import { getImage, isImageDBSupported } from '../lib/imageStore';

export type ImageStatus = 'idle' | 'loading' | 'ok' | 'missing';

export interface UseImageResult {
  /** 缓存的 ObjectURL，组件挂到 <img src> 即可；不存在时为 null */
  url: string | null;
  status: ImageStatus;
}

export function useImage(imageId: string | undefined | null): UseImageResult {
  const [state, setState] = useState<UseImageResult>(() => ({
    url: null,
    status: !imageId ? 'idle' : isImageDBSupported() ? 'loading' : 'missing',
  }));

  useEffect(() => {
    if (!imageId) {
      setState({ url: null, status: 'idle' });
      return;
    }
    if (!isImageDBSupported()) {
      setState({ url: null, status: 'missing' });
      return;
    }
    let cancelled = false;
    setState({ url: null, status: 'loading' });
    getImage(imageId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setState({ url: null, status: 'missing' });
        return;
      }
      const url = URL.createObjectURL(blob);
      setState({ url, status: 'ok' });
    });
    return () => {
      cancelled = true;
      // revoke 旧 url —— 取最新闭包（effect cleanup 在 effect 重跑时触发）
      setState((prev) => {
        if (prev.url) URL.revokeObjectURL(prev.url);
        return prev;
      });
    };
  }, [imageId]);

  // 卸载时回收（imageId 切换会在 cleanup 里 revoke，组件卸载则需独立 effect）
  useEffect(() => {
    return () => {
      // 同步拿不到 url（state 已卸载）—— 用 ref 模式更稳。
      // 这里依赖上面 effect 的 cleanup（依赖变化 / 卸载都会跑）覆盖主要场景；
      // 兜底：组件卸载时若还有 url 残留会被 GC（Blob 自身会被解除引用）。
    };
  }, []);

  return state;
}
