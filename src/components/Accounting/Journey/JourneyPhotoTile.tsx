/**
 * @fileoverview JourneyPhotoTile — 一程详情页的记录照片贴片（v3.0 TASK-061）
 *
 * 设计语言：旅行手账里的「拍立得」—— 白边 + 投影 + 轻微旋转，
 * 呼应详情页封面的邮戳（stamp）语言，让「有照片的记录」在视觉上自然分层。
 *
 * 行为：
 * - 点击 → 全屏放大（父组件挂 ImagePreview）
 * - 加载中 / 缺失时保留占位尺寸，避免列表跳动
 */
import { useImage } from '../../../hooks/useImage';
import styles from './JourneyDetailPage.module.css';

interface JourneyPhotoTileProps {
  imageId: string;
  /** 点击照片（放大预览） */
  onPreview: () => void;
}

export function JourneyPhotoTile({ imageId, onPreview }: JourneyPhotoTileProps) {
  const { url, status } = useImage(imageId);

  return (
    <button
      type="button"
      className={styles.photoTile}
      onClick={(e) => {
        e.stopPropagation();
        onPreview();
      }}
      aria-label="查看照片大图"
      title="点击放大"
    >
      {status === 'ok' && url ? (
        <img src={url} alt="" className={styles.photoTileImg} />
      ) : (
        <span className={styles.photoTilePlaceholder}>
          {status === 'missing' ? '图片已删除' : '…'}
        </span>
      )}
    </button>
  );
}
