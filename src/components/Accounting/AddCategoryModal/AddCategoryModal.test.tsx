/**
 * @fileoverview AddCategoryModal 测试（v3.2 TASK-071）
 *
 * 覆盖 v3.2 TASK-071 的三个行为约定：
 * 1. 「自定义」按钮贴在「图标」标签右侧（不再是独立字段块）
 * 2. 不向用户解释压缩过程（没有「会压缩」这类提示文案）
 * 3. 选了自定义图片后不再需要背景色 —— 颜色选择整块隐藏，
 *    且图片直接铺满分类框（不需要背景色垫底）
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddCategoryModal } from './AddCategoryModal';
import { useAccountStore } from '../../../store/accountStore';

// ── 图片相关模块 mock ─────────────────────────────────────
// jsdom 没有 canvas / IndexedDB / createObjectURL，
// 这里 mock 掉压缩与存储，让测试只关心 UI 行为。
vi.mock('../../../lib/imageCompress', () => ({
  compressImage: vi.fn(async () => ({
    blob: new Blob(['fake'], { type: 'image/jpeg' }),
    width: 100,
    height: 100,
    passthrough: false,
  })),
  genImageId: () => 'img-test-1',
  ImageCompressError: class extends Error {},
}));

vi.mock('../../../lib/imageStore', () => ({
  putImage: vi.fn(async () => true),
  isImageDBSupported: () => true,
}));

describe('AddCategoryModal · 自定义分类图片', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();

    // jsdom 没有 URL.createObjectURL / revokeObjectURL
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

  const render = () =>
    act(() => {
      root.render(<AddCategoryModal open onClose={() => {}} />);
    });

  /** 触发自定义按钮的 file input change */
  const pickFile = async (fileName = 'pic.jpg') => {
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake-image-bytes'], fileName, { type: 'image/jpeg' });
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file], writable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });
  };

  it('「自定义」按钮和「图标」标签在同一行', () => {
    render();

    const pickBtn = host.querySelector('button[class*=customPickBtn]') as HTMLButtonElement;
    expect(pickBtn).toBeTruthy();
    expect(pickBtn.textContent).toContain('自定义');

    // 两者必须同属一个容器（标签行），而不是各自独立的字段
    const labelRow = pickBtn.closest('div[class*=fieldLabelRow]');
    expect(labelRow).toBeTruthy();
    expect(labelRow?.querySelector('label')?.textContent).toBe('图标');

    // 「自定义」不再是独立字段块 —— 不该再有「自定义图片」标题
    const labels = [...host.querySelectorAll('label')].map((l) => l.textContent);
    expect(labels).toContain('图标');
    expect(labels).not.toContain('自定义图片');
  });

  it('不向用户解释压缩过程', () => {
    render();
    const text = host.textContent ?? '';
    expect(text).not.toContain('压缩');
    expect(text).not.toContain('256px');
  });

  it('选了自定义图片后隐藏颜色选择', async () => {
    render();

    // 选图之前：颜色选择可见
    expect(host.textContent).toContain('颜色');

    await pickFile();

    // 选图之后：颜色整块隐藏（图片会铺满分类框，不需要背景色）
    expect(host.textContent).not.toContain('颜色');
    expect(host.querySelector('button[class*=colorChip]')).toBeNull();
  });

  it('选了自定义图片后，图片铺满分类框（不依赖背景色）', async () => {
    render();
    await pickFile();

    const previewImg = host.querySelector('img[class*=previewImg]') as HTMLImageElement;
    expect(previewImg).toBeTruthy();
    // 预览框没有背景色（自定义图片时不再传 background）
    const previewFolder = previewImg.closest('div[class*=previewFolder]') as HTMLElement;
    expect(previewFolder.style.background).toBe('');
  });

  it('移除自定义图片后颜色选择回来', async () => {
    render();
    await pickFile();
    expect(host.textContent).not.toContain('颜色');

    const removeBtn = host.querySelector('button[class*=customRemoveBtn]') as HTMLButtonElement;
    expect(removeBtn).toBeTruthy();
    act(() => removeBtn.click());

    expect(host.textContent).toContain('颜色');
  });

  /** 填名称 —— 保存前必须填，否则会被「请输入分类名称」拦下 */
  const fillName = (value = '咖啡') => {
    const input = host.querySelector('input[type="text"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('保存时把图片写进分类与文件夹', async () => {
    render();
    await pickFile();
    fillName('咖啡');

    const saveBtn = host.querySelector('button[class*=submitBtn]') as HTMLButtonElement;
    await act(async () => {
      saveBtn.click();
      await Promise.resolve();
    });

    const state = useAccountStore.getState();
    // reset() 会恢复默认分类，所以按名称找新建的那个
    const created = state.categories.find((c) => c.name === '咖啡');
    expect(created).toBeTruthy();
    expect(created?.iconImageId).toBe('img-test-1');
    // Folder 必须同步，否则首页分类网格显示不出自定义图
    const folder = state.folders.find((f) => f.categoryId === created?.id);
    expect(folder).toBeTruthy();
    expect(folder?.iconImageId).toBe('img-test-1');
  });

  it('没选自定义图片时不写 iconImageId', () => {
    render();
    fillName('奶茶');

    const saveBtn = host.querySelector('button[class*=submitBtn]') as HTMLButtonElement;
    act(() => saveBtn.click());

    const state = useAccountStore.getState();
    const created = state.categories.find((c) => c.name === '奶茶');
    expect(created).toBeTruthy();
    expect(created?.iconImageId).toBeUndefined();
  });
});
