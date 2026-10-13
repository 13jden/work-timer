import { useEffect } from 'react';
import { useImage } from '../../../hooks/useImage';
import styles from './ImagePreview.module.css';

interface ImagePreviewProps {
  imageId: string | null;
  onClose: () => void;
}

/**
 * 全屏图片预览（v3.0 TASK-056 T-566）
 * - 黑色蒙层 + 图片居中（保持原比例）
 * - 点击蒙层关闭
 * - ESC 关闭
 * - 滚动锁定背景
 * - 加载中显示极简「…」；缺失显示「图片不存在」
 */
export function ImagePreview({ imageId, onClose }: ImagePreviewProps) {
  const { url, status } = useImage(imageId);

  // 锁定背景滚动 + ESC 关闭
  useEffect(() => {
    if (!imageId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [imageId, onClose]);

  if (!imageId) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.closeBtn} onClick={onClose} aria-label="关闭">✕</div>
      {status === 'loading' && <div className={styles.hint}>…</div>}
      {status === 'missing' && <div className={styles.hint}>图片不存在</div>}
      {status === 'ok' && url && (
        <img
          src={url}
          alt=""
          className={styles.image}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
