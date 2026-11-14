/**
 * @fileoverview CategoryIcon 测试（v3.2 TASK-071）
 *
 * 覆盖两种图片模式：
 * - `fill`（默认）—— 图片铺满父容器（宽高 100%，圆角继承），
 *   这样「自定义图片直接占满分类框」，不需要背景色垫底
 * - `fill=false` —— 按 size 渲染成小方块（用于没有固定尺寸的容器）
 *
 * 以及回落行为：没有图片 / 图片读不到 → 渲染线稿图标。
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryIcon } from './CategoryIcon';

// mock 图片存储：直接返回一个可控的 blob
const getImageMock = vi.fn<(id: string) => Promise<Blob | null>>();
vi.mock('../../lib/imageStore', () => ({
  getImage: (id: string) => getImageMock(id),
  isImageDBSupported: () => true,
}));

describe('CategoryIcon · 自定义图片渲染', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getImageMock.mockReset();
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', writable: true });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true });
    }
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = (node: React.ReactElement) =>
    act(() => {
      root.render(node);
    });

  /** 等图片异步加载完 */
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('有图片时铺满父容器（宽高 100%，圆角继承）', async () => {
    getImageMock.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    render(
      <div style={{ width: 36, height: 36, borderRadius: '7px', overflow: 'hidden' }}>
        <CategoryIcon icon="food" imageId="img-1" />
      </div>,
    );
    await flush();

    const img = host.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.style.width).toBe('100%');
    expect(img.style.height).toBe('100%');
    expect(img.style.objectFit).toBe('cover');
    // 圆角继承 → 父容器的形状就是图片的形状
    expect(img.style.borderRadius).toBe('inherit');
  });

  it('fill=false 时按 size 渲染成小方块', async () => {
    getImageMock.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    render(<CategoryIcon icon="food" imageId="img-1" size={13} fill={false} radius="4px" />);
    await flush();

    const img = host.querySelector('img') as HTMLImageElement;
    expect(img.style.width).toBe('13px');
    expect(img.style.height).toBe('13px');
    expect(img.style.borderRadius).toBe('4px');
  });

  it('没有 imageId 时渲染线稿图标（不渲染 img）', () => {
    render(<CategoryIcon icon="food" />);
    // 回落的是 Phosphor 线稿图标（svg），不是图片
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('svg')).toBeTruthy();
  });

  it('图片读不到时回落线稿图标（不留空白）', async () => {
    getImageMock.mockResolvedValue(null);
    render(<CategoryIcon icon="food" imageId="img-missing" />);
    await flush();

    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('svg')).toBeTruthy();
  });
});
