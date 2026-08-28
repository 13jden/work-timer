/**
 * Salary Timer — Monthly Records
 * Handles monthly salary record generation, storage, and display.
 */
import { MONTHLY_KEY, state } from './state.js';
import { loadJSON, saveJSON } from './storage.js';
import {
    workdaysInMonth, dailySalary, workSeconds,
    monthEarnedSoFar, daysInMonthCalc, isWorkday,
} from './compute.js';

// ── Monthly records ────────────────────────────────────────
export function loadMonthlyRecords() {
    return loadJSON(MONTHLY_KEY, {});
}
export function persistMonthlyRecords(records) {
    saveJSON(MONTHLY_KEY, records);
}

export function monthKey(yyyy, mm) {
    return String(yyyy * 100 + mm);
}

export function getMonthlyRecord(yyyy, mm) {
    const records = loadMonthlyRecords();
    return records[monthKey(yyyy, mm)] || null;
}

export function generateMonthlyRecord(yyyy, mm) {
    const workDays = workdaysInMonth(yyyy, mm);
    const daily    = state.config.monthlySalary / Math.max(workDays, 1);
    const hours    = Math.max(workSeconds() / 3600, 0.01);
    const hourly   = daily / hours;
    const now      = new Date();
    const isCurrent = (yyyy === now.getFullYear() && mm === now.getMonth());
    return {
        yyyy, mm,
        salary: state.config.monthlySalary,
        workDays,
        dailyRate: daily,
        hourlyRate: hourly,
        totalEarned: isCurrent ? monthEarnedSoFar(yyyy, mm) : daily * workDays,
        locked: !isCurrent,
        generatedAt: new Date().toISOString(),
    };
}

export function saveMonthlyRecord(yyyy, mm, record) {
    const records = loadMonthlyRecords();
    records[monthKey(yyyy, mm)] = record;
    persistMonthlyRecords(records);
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
