/**
 * @fileoverview CategoryIcon — 分类图标的统一渲染层（v3.2 TASK-070）
 *
 * 在 `IconByKey` 之上包一层，处理「自定义图片」：
 * - 有 `imageId` → 读 IndexedDB 里的图片，渲染圆形裁切的 `<img>`
 * - 没有 / 读不到 → 回落渲染 `IconByKey`（老分类零影响）
 *
 * 为什么单独建组件而不是给 `IconByKey` 加 imageId 参数：
 * `IconByKey` 的职责是「icon key → Phosphor 线稿图标」，
 * 把图片读取塞进去会让它同时承担两种完全不同的渲染路径。
 * 包一层更干净 —— 分类相关的渲染点改用 `CategoryIcon`，
 * 其他用到 `IconByKey` 的地方（存钱目标、换算页等）不受影响。
 */
import { useImage } from '../../hooks/useImage';
import { IconByKey } from './IconByKey';

export interface CategoryIconProps {
  /** Phosphor icon key（或旧 emoji 字符） */
  icon: string;
  /** 自定义图片的 IndexedDB imageId */
  imageId?: string | null;
  /** 图标尺寸(px)，默认 18 */
  size?: number;
  /** 字重（仅 Phosphor 图标生效） */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  /** 颜色（仅 Phosphor 图标生效；图片不受影响） */
  color?: string;
  className?: string;
}

export function CategoryIcon({
  icon,
  imageId,
  size = 18,
  weight = 'regular',
  color,
  className,
}: CategoryIconProps) {
  const { url, status } = useImage(imageId ?? undefined);

  // 图片加载中或读不到 → 回落线稿图标。
  // 读不到时回落比留空白好：分类在网格里的位置不能因为图丢了就塌掉。
  if (!url) {
    return <IconByKey icon={icon} size={size} weight={weight} color={color} className={className} />;
  }

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
      }}
      data-image-status={status}
    />
  );
}
