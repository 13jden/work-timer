/**
 * Salary Timer — Render: Today Page
 * Updates the live timer hero section.
 */
import { $, fmtMoney, fmtMoneyFloat, setFlipText } from './dom.js';
import { state } from './state.js';
import { dayState, todayEarned, progressPct, hourlyRate, perSecond } from './compute.js';

export function renderToday() {
    const s = dayState();
    const earned = todayEarned();

    // Status text
    if (s.mode === 'rest') {
        $('work-status-text').textContent = '今日休息';
    } else if (s.mode === 'done') {
        $('work-status-text').textContent = '今日收工';
    } else if (s.mode === 'active') {
        $('work-status-text').textContent = s.status;
    }

    // Timer display
    const tEl = $('timer-display');
    if (s.mode === 'rest') {
        setFlipText(tEl, 'REST');
    } else {
        setFlipText(tEl, s.display);
    }

    $('timer-label').textContent = (s.mode === 'rest') ? '享受休息日' : (s.label || '');

    const pct = progressPct();
    setFlipText($('progress-percent'), Math.floor(pct) + '%');
    $('progress-fill').style.width = pct + '%';

    $('time-start').textContent = state.config.startTime;
    $('time-end').textContent   = state.config.endTime;

    if (s.mode === 'rest') {
        setFlipText($('today-earned'), '¥0.00');
    } else {
        setFlipText($('today-earned'), fmtMoney(earned));
    }

    $('hourly-rate').textContent = fmtMoney(hourlyRate()) + ' / 小时';
    $('per-second').textContent  = fmtMoneyFloat(perSecond(), 4) + ' / 秒';

    // Coffee count
    const cups = earned / state.config.coffeePrice;
    const cupsText = cups >= 1 ? cups.toFixed(1) + ' 杯' : Math.floor(cups * 100) + '%';
    setFlipText($('coffee-count'), cupsText);
    $('coffee-price-sub').textContent = '按 ¥' + state.config.coffeePrice + ' 算';

    // Date in topbar
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    $('today-date-suffix').textContent = `${m}.${d}`;
}
