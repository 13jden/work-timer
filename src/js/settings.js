/**
 * Salary Timer — Settings Submit + Status Clock + Daily Quote
 */
import { $ } from './dom.js';
import { state } from './state.js';
import { persistConfig } from './storage.js';
import { toMinutes, workdaysInMonth } from './compute.js';
import {
    generateMonthlyRecord, getMonthlyRecord, saveMonthlyRecord,
} from './monthly.js';
import { renderToday } from './render-today.js';
import { renderConvert } from './render-convert.js';
import { renderCalendar } from './render-calendar.js';
import {
    refreshSettingsHints, refreshMonthlySummary, renderMonthlyHistory,
} from './render-settings.js';
import { toast } from './ui.js';

export function submitSettings() {
    const salary    = parseFloat($('set-monthly-salary').value);
    const startTime = $('set-start-time').value;
    const endTime   = $('set-end-time').value;
    const lunch     = parseFloat($('set-lunch-break').value) || 0;
    const coffee    = parseFloat($('set-coffee-price').value);
    const restMode  = parseInt($('set-rest-mode').value, 10) || 2;

    if (isNaN(salary) || salary <= 0) { toast('请输入有效月薪'); return; }
    if (!startTime || !endTime || startTime >= endTime) { toast('上班时间必须早于下班时间'); return; }
    const workMins = toMinutes(endTime) - toMinutes(startTime);
    if (lunch * 60 >= workMins) { toast('午休过长'); return; }
    if (isNaN(coffee) || coffee <= 0) { toast('请输入咖啡单价'); return; }

    state.config = {
        ...state.config,
        monthlySalary: salary,
        startTime, endTime,
        lunchBreak: lunch,
        coffeePrice: coffee,
        restMode,
        lunchRest: true,
    };
    persistConfig();

    // If current month already has a record, update it to reflect new salary
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = now.getMonth();
    const record = getMonthlyRecord(yyyy, mm);
    if (record && !record.locked) {
        const updated = generateMonthlyRecord(yyyy, mm);
        saveMonthlyRecord(yyyy, mm, updated);
    }

    renderToday();
    renderConvert();
    renderCalendar();
    refreshSettingsHints();
    refreshMonthlySummary();
    renderMonthlyHistory();
    toast('已保存 ✓');
}

// ── Status bar clock ──────────────────────────────────────
export function updateStatusClock() {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    $('status-time').textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
}

// ── Daily quote ────────────────────────────────────────────
import { QUOTES } from './state.js';

export function updateQuote() {
    const today = new Date();
    const quote = QUOTES[today.getDate() % QUOTES.length];
    $('daily-quote').textContent = quote;
    const d = $('daily-quote-desktop');
    if (d) d.textContent = quote;
}
