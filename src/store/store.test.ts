/**
 * Salary Timer — Store Unit Tests
 *
 * 覆盖每个 store 的核心 action + 持久化路径。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useConfigStore } from './configStore';
import { useItemsStore } from './itemsStore';
import { useCalendarStore } from './calendarStore';
import { useThemeStore, bootstrapTheme, THEME_LIST } from './themeStore';
import { DEFAULT_CONFIG, OVERRIDES_KEY_V3, ITEMS_KEY, STORAGE_KEY_V3 } from '../lib/constants';

const STORAGE_PREFIX = 'salary_timer_';

describe('configStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfigStore.setState({ ...DEFAULT_CONFIG });
  });

  it('has defaults on init', () => {
    const s = useConfigStore.getState();
    expect(s.monthlySalary).toBe(15000);
    expect(s.restMode).toBe(2);
    expect(s.coffeePrice).toBe(15);
  });

  it('setConfig merges patch', () => {
    useConfigStore.getState().setConfig({ monthlySalary: 20000, startTime: '10:00' });
    const s = useConfigStore.getState();
    expect(s.monthlySalary).toBe(20000);
    expect(s.startTime).toBe('10:00');
    expect(s.endTime).toBe('18:00'); // 未改的保持
  });

  it('reset returns to defaults', () => {
    useConfigStore.getState().setConfig({ monthlySalary: 1 });
    useConfigStore.getState().reset();
    expect(useConfigStore.getState().monthlySalary).toBe(15000);
  });

  it('persists to localStorage with key salary_timer_config_v3', () => {
    useConfigStore.getState().setConfig({ monthlySalary: 99999 });
    const raw = localStorage.getItem(STORAGE_KEY_V3);
    expect(raw).toBeTruthy();
    expect(raw).toContain('99999');
  });

  it('recordedFromDate is non-empty string after init', () => {
    // 用今天的 ISO 格式覆盖默认值
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    useConfigStore.setState({ recordedFromDate: todayStr });
    const s = useConfigStore.getState();
    expect(typeof s.recordedFromDate).toBe('string');
    expect(s.recordedFromDate.length).toBeGreaterThan(0);
  });
});

describe('itemsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useItemsStore.setState({ items: [] });
  });

  it('add generates id and order', () => {
    useItemsStore.getState().add({ name: '测试', price: 10, icon: '🍕' });
    const items = useItemsStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0]?.id).toBeTruthy();
    expect(items[0]?.order).toBe(0);
  });

  it('add increments order', () => {
    const store = useItemsStore.getState();
    store.add({ name: 'A', price: 1, icon: '🍕' });
    store.add({ name: 'B', price: 2, icon: '🍕' });
    store.add({ name: 'C', price: 3, icon: '🍕' });
    const items = useItemsStore.getState().items;
    expect(items.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('update modifies by id', () => {
    useItemsStore.getState().items = [{ id: 'x', name: '原', price: 10, icon: '🍕', order: 0 }];
    useItemsStore.getState().update('x', { price: 99 });
    expect(useItemsStore.getState().items[0]?.price).toBe(99);
  });

  it('remove drops by id', () => {
    useItemsStore.getState().add({ name: 'A', price: 1, icon: '🍕' });
    const id = useItemsStore.getState().items[0]!.id;
    useItemsStore.getState().remove(id);
    expect(useItemsStore.getState().items).toHaveLength(0);
  });

  it('persists to localStorage with key salary_timer_items_v1', () => {
    useItemsStore.getState().add({ name: 'X', price: 1, icon: '🍕' });
    expect(localStorage.getItem(ITEMS_KEY)).toBeTruthy();
  });
});

describe('calendarStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useCalendarStore.setState({ dayOverrides: {} });
  });

  it('initializes year/month to today', () => {
    const s = useCalendarStore.getState();
    const now = new Date();
    expect(s.year).toBe(now.getFullYear());
    expect(s.month).toBe(now.getMonth());
  });

  it('nextMonth overflows to next year', () => {
    useCalendarStore.setState({ year: 2026, month: 11 });
    useCalendarStore.getState().nextMonth();
    expect(useCalendarStore.getState()).toMatchObject({ year: 2027, month: 0 });
  });

  it('prevMonth underflows to prev year', () => {
    useCalendarStore.setState({ year: 2026, month: 0 });
    useCalendarStore.getState().prevMonth();
    expect(useCalendarStore.getState()).toMatchObject({ year: 2025, month: 11 });
  });

  it('toggleDay sets override as entry object', () => {
    useCalendarStore.getState().toggleDay('2026-08-31', 'rest');
    const entry = useCalendarStore.getState().dayOverrides['2026-08-31']!;
    expect(entry.type).toBe('rest');
    expect(entry.multiplier).toBe(0);
  });

  it('toggleDay converts work string to entry', () => {
    useCalendarStore.getState().toggleDay('2026-08-31', 'work');
    const entry = useCalendarStore.getState().dayOverrides['2026-08-31']!;
    expect(entry.type).toBe('work');
    expect(entry.multiplier).toBe(1);
  });

  it('clearOverride removes override', () => {
    useCalendarStore.setState({ dayOverrides: { '2026-08-31': { type: 'rest', multiplier: 0 , segments: null, nightShift: false } } });
    useCalendarStore.getState().clearOverride('2026-08-31');
    expect(useCalendarStore.getState().dayOverrides['2026-08-31']).toBeUndefined();
  });

  it('persists to localStorage v3', () => {
    useCalendarStore.getState().toggleDay('2026-08-31', 'work');
    expect(localStorage.getItem(OVERRIDES_KEY_V3)).toBeTruthy();
  });

  it('setDayOverride with null removes entry', () => {
    useCalendarStore.setState({ dayOverrides: { '2026-08-31': { type: 'work', multiplier: 1 , segments: null, nightShift: false } } });
    useCalendarStore.getState().setDayOverride('2026-08-31', null);
    expect(useCalendarStore.getState().dayOverrides['2026-08-31']).toBeUndefined();
  });

  it('setDayOverride with entry sets it', () => {
    useCalendarStore.getState().setDayOverride('2026-08-28', { type: 'paid_overtime', multiplier: 2 , segments: null, nightShift: false });
    const entry = useCalendarStore.getState().dayOverrides['2026-08-28']!;
    expect(entry.type).toBe('paid_overtime');
    expect(entry.multiplier).toBe(2);
  });
});

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    useThemeStore.setState({ theme: 'paper' });
  });

  it('setTheme updates state and DOM', () => {
    useThemeStore.getState().setTheme('obsidian');
    expect(useThemeStore.getState().theme).toBe('obsidian');
    expect(document.documentElement.getAttribute('data-theme')).toBe('obsidian');
  });

  it('setTheme persists to separate storage key', () => {
    useThemeStore.getState().setTheme('gold');
    expect(localStorage.getItem(STORAGE_PREFIX + 'theme_v1')).toBe('gold');
  });

  it('bootstrapTheme applies DOM-side based on localStorage', () => {
    localStorage.setItem(STORAGE_PREFIX + 'theme_v1', 'obsidian');
    bootstrapTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('obsidian');
    expect(useThemeStore.getState().theme).toBe('obsidian');
  });

  it('THEME_LIST has 3 entries', () => {
    expect(THEME_LIST).toHaveLength(3);
    expect(THEME_LIST.map((t) => t.id)).toEqual(['paper', 'obsidian', 'gold']);
  });
});