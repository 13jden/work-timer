/**
 * @fileoverview MinePage 资产卡测试（v3.0 TASK-061）
 *
 * 覆盖 v3.0 TASK-061 修复点：
 * 关闭钱包后，MINE 页资产卡片不再展示「未分类」（未归入账户的待调整项）。
 * 原因：没有钱包就没有账户归类概念，该金额对用户无意义。
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MinePage } from './MinePage';
import { useAccountStore } from '../../../store/accountStore';
import { useConfigStore } from '../../../store/configStore';
import { useMonthlyGoalStore } from '../../../store/monthlyGoalStore';
import type { AccountRecord } from '../../../lib/types';

const mkRecord = (id: string, amount: number, accountId: string): AccountRecord => ({
  id,
  dateKey: '2026-10-21',
  amount,
  type: 'expense',
  categoryId: 'cat-food',
  accountId,
  createdAt: 0,
  updatedAt: 0,
});

describe('MinePage · 资产卡「未分类」', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
    useConfigStore.getState().reset();
    // accountId 指向不存在的账户 → pendingAdjust ≠ 0（「未分类」来源）
    useAccountStore.setState({
      accounts: [],
      records: [mkRecord('r1', -100, 'acc-missing')],
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
      root.render(<MinePage />);
    });

  it('开启钱包时展示「未分类」', () => {
    useConfigStore.setState({ walletEnabled: true });
    render();
    expect(host.textContent ?? '').toContain('未分类');
  });

  it('关闭钱包时不展示「未分类」', () => {
    useConfigStore.setState({ walletEnabled: false });
    render();
    expect(host.textContent ?? '').not.toContain('未分类');
  });
});

/**
 * v3.1 TASK-064：MINE 页布局重排
 * - 结余目标 / 隐藏计时模式 下放到页面底部两行设置
 * - 底部并排两个入口卡（一程 / 定期账）
 */
describe('MinePage · 布局重排（TASK-064）', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
    useConfigStore.getState().reset();
    useMonthlyGoalStore.getState().reset();
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
      root.render(<MinePage />);
    });

  it('底部并排展示「一程」「定期账」两个入口卡', () => {
    render();
    expect(host.querySelector('[aria-label="打开一程"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="打开定期账"]')).not.toBeNull();
  });

  it('页面底部直接展示「结余目标」「隐藏计时模式」两行设置', () => {
    render();
    const text = host.textContent ?? '';
    expect(text).toContain('月度结余目标');
    expect(text).toContain('隐藏计时模式');
    // 不再有独立的大号 GOAL 卡
    expect(text).not.toContain('GOAL');
  });

  it('⚙ 弹层只保留钱包模式，不再重复这两项设置', () => {
    render();
    const countOf = (s: string, needle: string) => s.split(needle).length - 1;
    // 页面上各出现一次
    expect(countOf(host.textContent ?? '', '月度结余目标')).toBe(1);
    expect(countOf(host.textContent ?? '', '隐藏计时模式')).toBe(1);

    const gear = host.querySelector('button[aria-label="钱包设置"]') as HTMLButtonElement;
    expect(gear).not.toBeNull();
    act(() => {
      gear.click();
    });
    const text = host.textContent ?? '';
    expect(text).toContain('钱包模式');
    // 打开弹层后没有多出重复项
    expect(countOf(text, '月度结余目标')).toBe(1);
    expect(countOf(text, '隐藏计时模式')).toBe(1);
  });

  it('页面上的结余目标可保存', () => {
    render();
    const adjust = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '调整',
    ) as HTMLButtonElement;
    expect(adjust).toBeDefined();
    act(() => {
      adjust.click();
    });
    const input = host.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, '8888');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '保存',
    ) as HTMLButtonElement;
    act(() => {
      save.click();
    });
    expect(useMonthlyGoalStore.getState().monthlyGoal).toBe(8888);
  });
});
