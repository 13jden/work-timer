/**
 * Salary Timer — Event Wiring
 * Binds all DOM event listeners after DOMContentLoaded.
 */
import { $, escapeHtml } from './dom.js';
import { state } from './state.js';
import { persistConfig, persistItems } from './storage.js';
import { renderConvert } from './render-convert.js';
import { renderCalendar } from './render-calendar.js';
import { applyTheme } from './theme.js';
import { switchTab, toast } from './ui.js';
import {
    openItemSheet, saveItemFromSheet, deleteCurrentItem, closeSheet, buildEmojiGrid,
} from './sheet-item.js';
import {
    openDaySheet, toggleDay, resetDay,
} from './sheet-day.js';
import { submitSettings } from './settings.js';

export function bindEvents() {
    // Tab switching
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Open convert page from income card link
    $('open-convert').addEventListener('click', () => switchTab('convert'));
    $('open-convert').style.cursor = 'pointer';

    // Add item
    $('add-item-btn').addEventListener('click', () => openItemSheet(null));

    // Convert list: tap edit, swipe delete
    let touchStartX = null;
    let touchStartEl = null;
    $('convert-list').addEventListener('touchstart', (e) => {
        const item = e.target.closest('.convert-item');
        if (!item) return;
        touchStartX = e.touches[0].clientX;
        touchStartEl = item;
        document.querySelectorAll('.convert-item.is-swiped').forEach(el => {
            if (el !== item) el.classList.remove('is-swiped');
        });
    }, { passive: true });
    $('convert-list').addEventListener('touchmove', (e) => {
        if (!touchStartEl || touchStartX == null) return;
        const dx = e.touches[0].clientX - touchStartX;
        if (dx < -40) {
            touchStartEl.classList.add('is-swiped');
        } else if (dx > 40) {
            touchStartEl.classList.remove('is-swiped');
        }
    }, { passive: true });
    $('convert-list').addEventListener('click', (e) => {
        const del = e.target.closest('.convert-item-delete');
        if (del) {
            const item = del.closest('.convert-item');
            const id = item.dataset.id;
            state.items = state.items.filter(i => i.id !== id);
            state.items.forEach((it, idx) => it.order = idx);
            persistItems();
            renderConvert();
            toast('已删除');
            return;
        }
        const item = e.target.closest('.convert-item');
        if (!item) return;
        const it = state.items.find(i => i.id === item.dataset.id);
        if (it) openItemSheet(it);
    });

    // Calendar: tap day to open sheet
    $('cal-days').addEventListener('click', (e) => {
        const day = e.target.closest('.cal-day');
        if (!day || day.classList.contains('empty')) return;
        openDaySheet(day.dataset.date);
    });

    // Calendar month nav
    $('cal-prev').addEventListener('click', () => {
        if (state.calState.month === 0) { state.calState.month = 11; state.calState.year--; } else { state.calState.month--; }
        renderCalendar();
    });
    $('cal-next').addEventListener('click', () => {
        if (state.calState.month === 11) { state.calState.month = 0; state.calState.year++; } else { state.calState.month++; }
        renderCalendar();
    });

    // Sheet backdrop click to close
    $('sheet-backdrop').addEventListener('click', (e) => {
        if (e.target === $('sheet-backdrop')) closeSheet();
    });

    // Item sheet buttons
    $('item-cancel').addEventListener('click', closeSheet);
    $('item-save').addEventListener('click', saveItemFromSheet);
    $('item-delete').addEventListener('click', deleteCurrentItem);
    $('item-name').addEventListener('input', () => { /* live validate hook */ });

    // Day sheet buttons
    $('day-toggle').addEventListener('click', toggleDay);
    $('day-reset').addEventListener('click', resetDay);

    // Settings save
    $('save-btn').addEventListener('click', submitSettings);

    // Theme swatches
    document.querySelectorAll('.theme-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            const t = btn.dataset.theme;
            state.config.theme = t;
            persistConfig();
            applyTheme(t);
            document.querySelectorAll('.theme-swatch').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            toast('主题已切换 ✓');
        });
    });

    $('goto-quotes').addEventListener('click', () => {
        toast('批注每天自动轮换');
    });

    // Expose escapeHtml globally for legacy inline uses if any
    window.escapeHtml = escapeHtml;
}
