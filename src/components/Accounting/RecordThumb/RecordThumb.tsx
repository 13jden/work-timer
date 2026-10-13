/**
 * @fileoverview RecordThumb — 记录行内的图片缩略图（v3.0 TASK-056 T-565）
 *
 * 36px 圆角缩略图，点击触发预览。无图 / 加载失败 / 缺失时返回 null。
 * 复用 `useImage` hook 统一管理 ObjectURL 生命周期。
 */
import { useImage } from '../../../hooks/useImage';
import styles from './RecordThumb.module.css';

interface RecordThumbProps {
  imageId: string | undefined;
  size?: number;
  onPreview?: () => void;
}

export function RecordThumb({ imageId, size = 36, onPreview }: RecordThumbProps) {
  const { url, status } = useImage(imageId);

  if (!imageId) return null;
  if (status === 'loading') {
    return (
      <span
        className={styles.thumb}
        style={{ width: size, height: size, opacity: 0.3 }}
        aria-hidden
      />
    );
  }
  if (status !== 'ok' || !url) return null;

  return (
    <img
      className={styles.thumb}
      src={url}
      alt=""
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
        onPreview?.();
      }}
      role={onPreview ? 'button' : undefined}
    />
  );
}
