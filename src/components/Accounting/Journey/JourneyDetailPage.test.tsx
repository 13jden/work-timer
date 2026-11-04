/**
 * @fileoverview JourneyDetailPage 记录区组件测试（v3.0 TASK-061）
 *
 * 覆盖 v3.0 TASK-061 的三个点：
 * 1. 记录按日期分组（日期章 + 当日小计）
 * 2. 有照片的记录渲染「拍立得」贴片，无照片的渲染分类圆标
 * 3. 点击记录行打开编辑弹窗（与统计页一致的行为）
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JourneyDetailPage } from './JourneyDetailPage';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord, Category, Journey } from '../../../lib/types';

const JOURNEY: Journey = {
  id: 'j1',
  title: '云南 7 日游',
  type: 'expense',
  note: '秋天的第一趟远行',
  createdAt: 0,
  updatedAt: 0,
};

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: '餐饮', icon: 'food', color: '#E5484D', type: 'expense', order: 0 },
  { id: 'cat-trans', name: '交通', icon: 'train', color: '#2D8F5B', type: 'expense', order: 1 },
];

const mkRecord = (
  id: string,
  dateKey: string,
  amount: number,
  note: string,
  imageId?: string,
): AccountRecord => ({
  id,
  journeyId: 'j1',
  dateKey,
  amount,
  type: 'expense',
  categoryId: 'cat-food',
  note,
  accountId: 'acc-1',
  createdAt: 0,
  updatedAt: 0,
  ...(imageId ? { imageId } : {}),
});

describe('JourneyDetailPage · 记录区', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
    useAccountStore.setState({
      journeys: [JOURNEY],
      categories: CATEGORIES,
      records: [
        // 10-21：有照片 + 无照片
        mkRecord('r1', '2026-10-21', -128, '野生菌火锅', 'img-1'),
        mkRecord('r2', '2026-10-21', -35, '烤乳扇'),
        // 10-20：只有一笔
        mkRecord('r3', '2026-10-20', -553, '高铁票', 'img-2'),
      ],
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
      root.render(<JourneyDetailPage journeyId="j1" onBack={() => {}} />);
    });

  it('按日期分组渲染日期章（10/21 与 10/20）', () => {
    render();
    const text = host.textContent ?? '';
    expect(text).toContain('10/21');
    expect(text).toContain('10/20');
    // 2026-10-21 是周三，2026-10-20 是周二
    expect(text).toContain('周三');
    expect(text).toContain('周二');
  });

  it('每组显示当日笔数与小计', () => {
    render();
    const text = host.textContent ?? '';
    // 10-21 两笔 = 163；10-20 一笔 = 553
    expect(text).toContain('2 笔');
    expect(text).toContain('1 笔');
    expect(text).toContain('-¥163');
    expect(text).toContain('-¥553');
  });

  it('有照片的记录渲染贴片按钮，无照片的不渲染', () => {
    render();
    const tiles = host.querySelectorAll('button[aria-label="查看照片大图"]');
    // r1 / r3 有图 → 2 个贴片
    expect(tiles.length).toBe(2);
  });

  it('点击记录行打开编辑弹窗并回填所属一程', () => {
    render();
    const entries = Array.from(host.querySelectorAll('[role="button"]')) as HTMLElement[];
    const target = entries.find((el) => (el.getAttribute('aria-label') ?? '').includes('野生菌火锅'));
    expect(target).toBeTruthy();

    act(() => {
      target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const text = host.textContent ?? '';
    expect(text).toContain('编辑记录');
    // 编辑弹窗里「旅游记录」chip 显示已关联的一程标题
    expect(text).toContain('云南 7 日游');
  });

  it('编辑弹窗里移除一程关联后点完成，记录的 journeyId 被清空', () => {
    render();
    const entries = Array.from(host.querySelectorAll('[role="button"]')) as HTMLElement[];
    const target = entries.find((el) => (el.getAttribute('aria-label') ?? '').includes('野生菌火锅'));
    act(() => {
      target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 点 chip 上的 ✕（aria-label="移除一程"）解除关联
    const removeBtn = host.querySelector('span[aria-label="移除一程"]') as HTMLElement;
    expect(removeBtn).toBeTruthy();
    act(() => {
      removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 点「完成」保存
    const doneBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '完成',
    ) as HTMLButtonElement;
    expect(doneBtn).toBeTruthy();
    act(() => {
      doneBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const record = useAccountStore.getState().records.find((r) => r.id === 'r1');
    expect(record?.journeyId).toBeUndefined();
  });

  it('一程被删除后不崩溃（hook 顺序守卫）', () => {
    render();
    act(() => {
      useAccountStore.setState({ journeys: [] });
    });
    expect(host.innerHTML).toBe('');
  });
});
