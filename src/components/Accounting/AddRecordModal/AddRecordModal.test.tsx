/**
 * @fileoverview AddRecordModal 0 元记录测试（v3.0 TASK-062）
 *
 * 场景：别人请客 —— 有消费但没花钱，金额记 0。
 * 覆盖：
 * 1. 未输入金额时「完成」不可点
 * 2. 输入 0 后可以保存，生成 amount = 0 的记录
 * 3. 0 元记录不改变账户余额，也不影响收支统计
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AddRecordModal } from './AddRecordModal';
import { useAccountStore } from '../../../store/accountStore';
import { sumRecords, visibleRecords } from '../../../lib/accounting/stats';

describe('AddRecordModal · 0 元记录（v3.0 TASK-062）', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useAccountStore.getState().reset();
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
      root.render(<AddRecordModal open onClose={() => {}} />);
    });

  const findBtn = (text: string) =>
    Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    ) as HTMLButtonElement | undefined;

  it('未输入金额时「完成」不可点', () => {
    render();
    const done = findBtn('完成');
    expect(done).toBeTruthy();
    expect(done!.disabled).toBe(true);
  });

  it('按 0 后可以保存，生成 amount = 0 的记录', () => {
    render();

    act(() => {
      findBtn('0')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const done = findBtn('完成');
    expect(done!.disabled).toBe(false);
    // 0 元提示
    expect(host.textContent ?? '').toContain('¥0 记录');

    act(() => {
      done!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const records = useAccountStore.getState().records;
    expect(records).toHaveLength(1);
    expect(records[0]!.amount).toBe(0);
    expect(records[0]!.type).toBe('expense');
  });

  it('0 元记录不改变余额，也不计入收支统计', () => {
    const before = useAccountStore.getState().accounts.map((a) => ({ id: a.id, balance: a.balance }));
    render();

    act(() => {
      findBtn('0')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      findBtn('完成')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const after = useAccountStore.getState().accounts.map((a) => ({ id: a.id, balance: a.balance }));
    expect(after).toEqual(before);

    const summary = sumRecords(visibleRecords(useAccountStore.getState().records));
    expect(summary.income).toBe(0);
    expect(summary.expense).toBe(0);
    expect(summary.net).toBe(0);
  });
});
