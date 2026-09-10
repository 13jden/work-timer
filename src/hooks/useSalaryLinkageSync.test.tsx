/**
 * @fileoverview time → accounting 工资联动同步回归测试。
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SalaryLinkageSync } from './useSalaryLinkageSync';
import { DEFAULT_CONFIG } from '../lib/constants';
import { useAccountStore } from '../store/accountStore';
import { useCalendarStore } from '../store/calendarStore';
import { useConfigStore } from '../store/configStore';
import { useMonthlyStore } from '../store/monthlyStore';

describe('SalaryLinkageSync', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 31, 20, 0, 0)); // 周一，下班后金额已定格
    localStorage.clear();
    useAccountStore.getState().reset();
    useConfigStore.setState({ ...DEFAULT_CONFIG, salaryLinkageEnabled: true });
    useCalendarStore.setState({ year: 2026, month: 7, dayOverrides: {}, monthlyRestModes: {} });
    useMonthlyStore.setState({ snapshots: {} });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it('首次挂载后也会自动写入已定格的今日记录', async () => {
    await act(async () => {
      root.render(<SalaryLinkageSync />);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const linkage = useAccountStore.getState().records.find(
      (record) => record.linkageSource === 'salary-time-mode' && record.dateKey === '2026-08-31',
    );
    expect(linkage?.amount).toBeGreaterThan(0);
  });
});
