/**
 * Salary Timer — Render: Convert Page
 * Renders the item conversion list.
 */
import { $, escapeHtml, setFlipText } from './dom.js';
import { state } from './state.js';
import { hourlyRate } from './compute.js';

export function renderConvert() {
    const listEl = $('convert-list');
    const rate = hourlyRate();

    listEl.innerHTML = state.items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(item => {
            const hours = item.price / rate;
            const hoursText = formatHours(hours);
            return `
                <div class="convert-item" data-id="${item.id}">
                    <div class="convert-item-icon">${escapeHtml(item.icon)}</div>
                    <div class="convert-item-info">
                        <div class="convert-item-name">${escapeHtml(item.name)}</div>
                        <div class="convert-item-price">¥${item.price}</div>
                    </div>
                    <div class="convert-item-result">
                        <div class="convert-item-count">${hoursText}</div>
                        <div class="convert-item-unit">需要工作</div>
                    </div>
                    <div class="convert-item-delete">删除</div>
                </div>`;
        }).join('');
}

export function formatHours(h) {
    if (!isFinite(h) || h <= 0) return '0h';
    if (h >= 100) return Math.round(h).toLocaleString('en-US') + 'h';
    if (h >= 10)  return h.toFixed(1) + 'h';
    if (h >= 1)   return h.toFixed(2).replace(/\.?0+$/, '') + 'h';
    const mins = Math.max(1, Math.round(h * 60));
    return mins + 'min';
}
