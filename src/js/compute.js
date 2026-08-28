/**
 * Salary Timer — Pure Computation Logic
 * All functions are pure / stateless wrt DOM. No side effects.
 */
import { state, HOLIDAYS } from './state.js';

// ── Time helpers ───────────────────────────────────────────
export function parseTime(str) {
    const [h, m] = str.split(':').map(Number);
    return { h, m };
}

export function toMinutes(str) {
    const { h, m } = parseTime(str);
    return h * 60 + m;
}

export function nowInMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

export function pad2(n) { return String(n).padStart(2, '0'); }

// ── Work seconds per day ───────────────────────────────────
export function workSeconds() {
    const start = toMinutes(state.config.startTime);
    const end   = toMinutes(state.config.endTime);
    return Math.max(end - start - state.config.lunchBreak * 60, 0) * 60;
}

// ── Workdays in month ──────────────────────────────────────
export function workdaysInMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        if (isWorkday(new Date(year, month, d))) count++;
    }
    return count;
}

export function daysInMonthCalc(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

export function isHoliday(date) {
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    return HOLIDAYS[key] || null;
}

export function isWorkday(date) {
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    if (state.dayOverrides[key] === 'work') return true;
    if (state.dayOverrides[key] === 'rest') return false;
    if (isHoliday(date)) return false;
    const dow = date.getDay();
    if (state.config.restMode === 0) return true;
    if (state.config.restMode === 1) return dow !== 0;
    return dow !== 0 && dow !== 6;
}

// ── Rates ──────────────────────────────────────────────────
export function dailySalary(year = new Date().getFullYear(), month = new Date().getMonth()) {
    const days = workdaysInMonth(year, month);
    return state.config.monthlySalary / Math.max(days, 1);
}

export function hourlyRate(year = new Date().getFullYear(), month = new Date().getMonth()) {
    return dailySalary(year, month) / Math.max(workSeconds() / 3600, 0.01);
}

export function perSecond(year = new Date().getFullYear(), month = new Date().getMonth()) {
    return hourlyRate(year, month) / 3600;
}

// ── Today earned ───────────────────────────────────────────
export function todayEarned() {
    const now = new Date();
    if (!isWorkday(now)) return 0;
    const startM = toMinutes(state.config.startTime);
    const endM   = toMinutes(state.config.endTime);
    const nowM   = now.getHours() * 60 + now.getSeconds() / 60;
    if (nowM <= startM) return 0;
    if (nowM >= endM) return dailySalary();

    let workedMin = nowM - startM;
    if (state.config.lunchRest && state.config.lunchBreak > 0) {
        const lunchStart = 12 * 60;
        const lunchEnd   = lunchStart + state.config.lunchBreak * 60;
        if (nowM > lunchEnd)         workedMin -= state.config.lunchBreak * 60;
        else if (nowM > lunchStart) workedMin -= (nowM - lunchStart);
    }
    return Math.max(perSecond() * workedMin * 60, 0);
}

// ── Day state (timer status) ────────────────────────────────
export function dayState() {
    const now = new Date();
    const startM = toMinutes(state.config.startTime);
    const endM   = toMinutes(state.config.endTime);
    const nowM   = now.getHours() * 60 + now.getSeconds() / 60;

    if (!isWorkday(now)) return { mode: 'rest' };
    if (nowM < startM) {
        const diff = startM - nowM;
        return formatHMS(diff * 60 * 1000, '等待开工', '距离上班还有');
    }
    if (nowM >= endM) {
        const total = Math.floor((endM - startM - state.config.lunchBreak * 60) * 60);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const display = pad2(h) + ':' + pad2(m) + ':' + '00';
        return { mode: 'done', display, label: '今日完成', status: '今日收工', totalSeconds: total };
    }
    const diff = (endM - nowM) * 60 * 1000;
    return formatHMS(diff, '工作计价中', '距离今天下班');
}

export function formatHMS(ms, status, label) {
    const total = Math.max(Math.floor(ms / 1000), 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return { mode: 'active', display: pad2(h) + ':' + pad2(m) + ':' + pad2(s), label, status };
}

// ── Month earned so far ────────────────────────────────────
export function monthEarnedSoFar(yyyy, mm) {
    const now = new Date();
    let earned = 0;
    const daily = dailySalary(yyyy, mm);
    for (let d = 1; d <= daysInMonthCalc(yyyy, mm); d++) {
        const date = new Date(yyyy, mm, d);
        if (date > now) break;
        if (isWorkday(date)) earned += daily;
    }
    return earned;
}

// ── Progress ────────────────────────────────────────────────
export function progressPct() {
    const now = new Date();
    const startM = toMinutes(state.config.startTime);
    const endM   = toMinutes(state.config.endTime);
    const nowM   = now.getHours() * 60 + now.getSeconds() / 60;
    if (!isWorkday(now)) return 0;
    if (nowM < startM) return 0;
    if (nowM >= endM) return 100;
    const totalWorkMins = Math.max(endM - startM - (state.config.lunchBreak || 0) * 60, 1);
    const workedMins    = Math.min(nowM - startM, totalWorkMins);
    return Math.min((workedMins / totalWorkMins) * 100, 100);
}
