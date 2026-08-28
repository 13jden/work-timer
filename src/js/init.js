/**
 * Salary Timer — Bootstrap
 * Entry point: init state, bind events, apply theme, start tick intervals.
 */
import { state } from './state.js';
import { initState } from './storage.js';
import { applyTheme } from './theme.js';
import { renderToday } from './render-today.js';
import { renderConvert } from './render-convert.js';
import { renderCalendar } from './render-calendar.js';
import { fillSettingsForm } from './render-settings.js';
import {
    generateMonthlyRecord, getMonthlyRecord, saveMonthlyRecord,
    monthEarnedSoFar,
} from './monthly.js';
import { bindEvents } from './events.js';
import { buildEmojiGrid } from './sheet-item.js';
import { updateStatusClock, updateQuote } from './settings.js';

function bootstrap() {
    initState();
    bindEvents();
    buildEmojiGrid();
    updateQuote();
    updateStatusClock();
    applyTheme(state.config.theme);
    renderToday();
    renderConvert();
    fillSettingsForm();

    // Tick every second
    setInterval(() => {
        updateStatusClock();
        renderToday();
        const active = document.querySelector('.nav-item.is-active').dataset.tab;
        if (active === 'convert')  renderConvert();
        if (active === 'calendar') renderCalendar();
    }, 1000);

    // Calendar + monthly record auto-management (every minute)
    let _lastCheckedMonth = new Date().getMonth();
    setInterval(() => {
        const now = new Date();
        const currMonth = now.getMonth();

        if (state.calState.year === now.getFullYear() && state.calState.month === currMonth) {
            renderCalendar();
        }

        if (getMonthlyRecord(now.getFullYear(), currMonth) === null) {
            const record = generateMonthlyRecord(now.getFullYear(), currMonth);
            saveMonthlyRecord(now.getFullYear(), currMonth, record);
            // Re-render monthly UI
            import('./render-settings.js').then(m => {
                m.refreshMonthlySummary();
                m.renderMonthlyHistory();
            });
        }

        if (currMonth !== _lastCheckedMonth) {
            const prevMonth = _lastCheckedMonth;
            const prevYear = (currMonth === 0) ? now.getFullYear() - 1 : now.getFullYear();
            const rec = getMonthlyRecord(prevYear, prevMonth);
            if (rec && !rec.locked) {
                rec.locked = true;
                rec.totalEarned = monthEarnedSoFar(prevYear, prevMonth);
                saveMonthlyRecord(prevYear, prevMonth, rec);
                import('./render-settings.js').then(m => m.renderMonthlyHistory());
            }
            _lastCheckedMonth = currMonth;
        }
    }, 60 * 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
