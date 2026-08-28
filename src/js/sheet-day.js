/**
 * Salary Timer — Sheets: Day Sheet (calendar day detail + toggle)
 * Tap a calendar day to open this sheet; toggle between workday / rest day.
 */
import { $, fmtMoney } from './dom.js';
import { state } from './state.js';
import { persistOverrides } from './storage.js';
import { isWorkday, dailySalary } from './compute.js';
import { renderCalendar } from './render-calendar.js';
import { renderToday } from './render-today.js';
import { toast, closeSheet } from './ui.js';

export function openDaySheet(key) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dowName = ['日','一','二','三','四','五','六'][date.getDay()];
    $('day-sheet-date').textContent = `${m}月${d}日 · 周${dowName}`;
    const workday = isWorkday(date);
    $('day-sheet-type').textContent = workday ? '工作日' : '休息日';
    const earn = workday ? dailySalary(y, m - 1) : 0;
    $('day-sheet-earn').textContent = fmtMoney(earn);

    const btn = $('day-toggle');
    btn.textContent = workday ? '切换为休息日' : '切换为工作日';

    state.daySheetKey = key;
    $('sheet-backdrop').classList.add('is-open');
    $('day-sheet').style.display  = 'block';
    $('item-sheet').style.display = 'none';
}

export function toggleDay() {
    if (!state.daySheetKey) return;
    const [y, m, d] = state.daySheetKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const currentlyWork = isWorkday(date);
    if (currentlyWork) {
        state.dayOverrides[state.daySheetKey] = 'rest';
        toast('已设为休息日');
    } else {
        state.dayOverrides[state.daySheetKey] = 'work';
        toast('已设为工作日');
    }
    persistOverrides();
    renderCalendar();
    renderToday();
    // Re-open sheet with updated data
    const newWork = isWorkday(new Date(y, m - 1, d));
    $('day-sheet-type').textContent = newWork ? '工作日' : '休息日';
    $('day-sheet-earn').textContent = newWork ? fmtMoney(dailySalary(y, m - 1)) : '¥0';
    $('day-toggle').textContent = newWork ? '切换为休息日' : '切换为工作日';
}

export function resetDay() {
    if (!state.daySheetKey) return;
    delete state.dayOverrides[state.daySheetKey];
    persistOverrides();
    renderCalendar();
    toast('已重置为系统判定');
    closeSheet();
}
