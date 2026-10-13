/**
 * @fileoverview imageCompress — 图片压缩管线（v3.0 TASK-056 T-562）
 *
 * 浏览器 File → canvas 缩放（最长边 ≤ 1280px）→ JPEG 0.8 → Blob。
 *
 * - 用 `createImageBitmap` 解码（不支持时降级 Image + FileReader）
 * - 已有图片（≤1280px 且 ≤300KB）跳过重压缩，直接入库
 * - HEIC 等浏览器解不开的格式抛 `UNSUPPORTED_FORMAT`
 */
export const MAX_EDGE_DEFAULT = 1280;
export const QUALITY_DEFAULT = 0.8;
export const SKIP_THRESHOLD_BYTES = 300 * 1024; // 300KB

export class ImageCompressError extends Error {
  constructor(
    public readonly code: 'UNSUPPORTED_FORMAT' | 'DECODE_FAILED' | 'TOOBIG',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ImageCompressError';
  }
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  /** true = 原图已满足条件，未做重压缩 */
  passthrough: boolean;
}

/**
 * 主入口：File → 压缩后 Blob + 尺寸信息。
 * @param file 用户选择的原图
 * @param maxEdge 最长边上限（px），默认 1280
 * @param quality JPEG 质量 0-1，默认 0.8
 */
export async function compressImage(
  file: File,
  maxEdge: number = MAX_EDGE_DEFAULT,
  quality: number = QUALITY_DEFAULT,
): Promise<CompressResult> {
  if (!file.type.startsWith('image/')) {
    throw new ImageCompressError('UNSUPPORTED_FORMAT', `Unsupported MIME: ${file.type}`);
  }

  // 尝试解码
  const { bitmap, width, height } = await decodeImage(file);

  // 缩放：原图本就不大 → 直接转 Blob（保持原格式），跳重压缩
  const fitsEdge = Math.max(width, height) <= maxEdge;
  if (fitsEdge && file.size <= SKIP_THRESHOLD_BYTES) {
    return { blob: file, width, height, passthrough: true };
  }

  // 计算缩放比
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  // canvas 重绘 + JPEG
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ImageCompressError('DECODE_FAILED', 'Canvas 2D context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const blob = await canvasToBlob(canvas, quality);
  return { blob, width: targetW, height: targetH, passthrough: false };
}

async function decodeImage(
  file: File,
): Promise<{ bitmap: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  // 优先 createImageBitmap
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // 某些格式（如 HEIC）bitmap 解码失败 → 降级
    }
  }
  // 降级：Image + ObjectURL
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ bitmap: img, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageCompressError('DECODE_FAILED', 'Image decode failed'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ImageCompressError('DECODE_FAILED', 'canvas.toBlob returned null'));
        } else {
          resolve(blob);
        }
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * 生成图片 id（与现有 `genId('rec')` 风格一致：`<prefix>-<timestamp>-<rand>`）。
 */
export function genImageId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
