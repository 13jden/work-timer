/**
 * Salary Timer — UI: Toast & Navigation
 * Tiny UI primitives.
 */
import { $ } from './dom.js';
import { renderConvert } from './render-convert.js';
import { renderCalendar } from './render-calendar.js';
import { fillSettingsForm } from './render-settings.js';

let toastTimer;
export function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2200);
}

export function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('is-active', el.dataset.tab === tab);
    });
    document.querySelectorAll('.page').forEach(el => {
        const on = el.id === 'page-' + tab;
        el.classList.toggle('is-active', on);
        el.style.pointerEvents = on ? 'auto' : 'none';
    });
    if (tab === 'convert')  renderConvert();
    if (tab === 'calendar') renderCalendar();
    if (tab === 'settings') fillSettingsForm();
}
