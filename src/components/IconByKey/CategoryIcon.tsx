/**
 * @fileoverview CategoryIcon — 分类图标的统一渲染层（v3.2 TASK-070）
 *
 * 在 `IconByKey` 之上包一层，处理「自定义图片」：
 * - 有 `imageId` → 读 IndexedDB 里的图片，渲染图片
 * - 没有 / 读不到 → 回落渲染 `IconByKey`（老分类零影响）
 *
 * 两种图片模式：
 * - `fill`（默认）—— 图片铺满父容器。父容器自带尺寸和圆角，
 *   图片用 `border-radius: inherit` 跟随，于是「图片直接占满分类框」。
 *   这条路径下背景色不再需要（图片把它整个盖住）。
 * - `fill=false` —— 按 `size` 渲染成小方块，用于没有固定尺寸的容器
 *   （比如行内文字流里的分类标签）。
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
  /** 图标尺寸(px)，默认 18。仅线稿图标与 fill=false 模式生效 */
  size?: number;
  /** 字重（仅 Phosphor 图标生效） */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  /** 颜色（仅 Phosphor 图标生效；图片不受影响） */
  color?: string;
  /**
   * 图片是否铺满父容器。
   * 父容器需要有确定尺寸和圆角（图标方块天然满足）。
   */
  fill?: boolean;
  /** fill=false 时图片的圆角，默认 50%（圆形） */
  radius?: string;
  className?: string;
}

export function CategoryIcon({
  icon,
  imageId,
  size = 18,
  weight = 'regular',
  color,
  fill = true,
  radius = '50%',
  className,
}: CategoryIconProps) {
  const { url, status } = useImage(imageId ?? undefined);

  // 图片加载中或读不到 → 回落线稿图标。
  // 读不到时回落比留空白好：分类在网格里的位置不能因为图丢了就塌掉。
  if (!url) {
    return <IconByKey icon={icon} size={size} weight={weight} color={color} className={className} />;
  }

  if (fill) {
    // 铺满父容器：宽高各 100%，圆角继承父容器 → 图标方块的形状就是图片的形状。
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 'inherit',
          display: 'block',
          flexShrink: 0,
        }}
        data-image-status={status}
      />
    );
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
        objectFit: 'cover',
        borderRadius: radius,
        display: 'block',
        flexShrink: 0,
      }}
      data-image-status={status}
    />
  );
}
