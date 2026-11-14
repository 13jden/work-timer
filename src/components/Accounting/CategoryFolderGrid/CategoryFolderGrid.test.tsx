/**
 * @fileoverview CategoryFolderGrid 测试（v3.2 TASK-071）
 *
 * 覆盖「自定义分类图片铺满分类框」：
 * - Folder 带 iconImageId 时，网格里的图标位渲染图片（不是线稿 svg）
 * - 图片以宽高 100% 铺满图标方块，圆角继承父容器 → 不需要背景色垫底
 * - 没有 iconImageId 的老分类不受影响，仍渲染线稿图标
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryFolderGrid } from './CategoryFolderGrid';
import { useAccountStore } from '../../../store/accountStore';
import type { Category, Folder } from '../../../lib/types';

const getImageMock = vi.fn<(id: string) => Promise<Blob | null>>();
vi.mock('../../../lib/imageStore', () => ({
  getImage: (id: string) => getImageMock(id),
  isImageDBSupported: () => true,
}));

const CATEGORY_CUSTOM: Category = {
  id: 'cat-custom',
  name: '咖啡',
  icon: 'box',
  iconImageId: 'img-custom',
  color: '#FF9B8E',
  type: 'expense',
  order: 0,
};

const CATEGORY_PLAIN: Category = {
  id: 'cat-plain',
  name: '餐饮',
  icon: 'food',
  color: '#60A5FA',
  type: 'expense',
  order: 1,
};

const folders: Folder[] = [
  { id: 'f1', categoryId: 'cat-custom', name: '咖啡', icon: 'box', iconImageId: 'img-custom', color: '#FF9B8E', order: 0 },
  { id: 'f2', categoryId: 'cat-plain', name: '餐饮', icon: 'food', color: '#60A5FA', order: 1 },
];

describe('CategoryFolderGrid · 自定义分类图片铺满分类框', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getImageMock.mockReset();
    getImageMock.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', writable: true });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true });
    }

    useAccountStore.setState({
      categories: [CATEGORY_CUSTOM, CATEGORY_PLAIN],
      folders,
      records: [],
    });

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = () =>
    act(() => {
      root.render(<CategoryFolderGrid monthKey="2026-11" activeId={null} />);
    });

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('带自定义图的分类渲染图片，且图片铺满图标方块', async () => {
    render();
    await flush();

    const imgs = host.querySelectorAll('img');
    expect(imgs).toHaveLength(1);

    const img = imgs[0] as HTMLImageElement;
    // 铺满：宽高各 100%，而不是固定 px
    expect(img.style.width).toBe('100%');
    expect(img.style.height).toBe('100%');
    expect(img.style.objectFit).toBe('cover');
    // 圆角继承父容器 → 图片的形状就是分类框的形状
    expect(img.style.borderRadius).toBe('inherit');
  });

  it('没有自定义图的分类仍渲染线稿图标', async () => {
    render();
    await flush();

    // 两个分类：一个是图片，一个是 svg 线稿
    expect(host.querySelectorAll('img')).toHaveLength(1);
    expect(host.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});
