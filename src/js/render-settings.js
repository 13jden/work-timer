/**
 * Salary Timer — Render: Settings Page
 * Fills the settings form, theme picker, and monthly history list.
 */
import { $ } from './dom.js';
import { state } from './state.js';
import { workdaysInMonth } from './compute.js';
import {
    loadMonthlyRecords,
    getMonthlyRecord,
} from './monthly.js';

export function fillSettingsForm() {
    $('set-monthly-salary').value = state.config.monthlySalary;
    $('set-start-time').value     = state.config.startTime;
    $('set-end-time').value       = state.config.endTime;
    $('set-lunch-break').value    = state.config.lunchBreak;
    $('set-coffee-price').value   = state.config.coffeePrice;
    $('set-rest-mode').value      = String(state.config.restMode != null ? state.config.restMode : 2);

    document.querySelectorAll('.theme-swatch').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.theme === state.config.theme);
    });

    refreshSettingsHints();
    refreshMonthlySummary();
    renderMonthlyHistory();
}

export function refreshSettingsHints() {
    const now = new Date();
    const wd = workdaysInMonth(now.getFullYear(), now.getMonth());
    const el = $('set-current-workdays');
    if (el) el.textContent = String(wd);
}

export function refreshMonthlySummary() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = now.getMonth();
    const record = getMonthlyRecord(yyyy, mm);
    const el = $('set-monthly-summary');
    if (!el) return;
    if (record) {
        el.textContent = `¥${Math.round(record.totalEarned).toLocaleString('en-US')} / ${record.workDays}天`;
    } else {
        const wd = workdaysInMonth(yyyy, mm);
        el.textContent = `${wd}天 · 记录中`;
    }
}

export function renderMonthlyHistory() {
    const records = loadMonthlyRecords();
    const listEl = $('monthly-history-list');
    const months = Object.keys(records)
        .map(Number)
        .sort((a, b) => b - a);

    if (months.length === 0) {
        listEl.innerHTML = `
            <div style="padding:16px;text-align:center;font-size:13px;color:var(--muted);">
                暂无月度记录<br>
                <span style="font-size:11px;">本月结束后自动生成</span>
            </div>`;
        return;
    }

    const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    listEl.innerHTML = months.map(k => {
        const r = records[k];
        return `
            <div class="settings-row" style="cursor:default;">
                <span class="label">${r.yyyy}年 ${monthNames[r.mm]}月</span>
                <span class="value">
                    <span style="font-family:var(--font-display);font-size:15px;font-weight:600;">¥${Math.round(r.totalEarned).toLocaleString('en-US')}</span>
                    <span style="font-size:11px;color:var(--muted);"> · ${r.workDays}天</span>
                    ${r.locked ? '<span style="font-size:10px;color:var(--accent-deep);margin-left:4px;">已锁定</span>' : '<span style="font-size:10px;color:var(--muted);margin-left:4px;">本月</span>'}
                </span>
            </div>`;
    }).join('');
}
