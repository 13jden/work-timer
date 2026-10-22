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
