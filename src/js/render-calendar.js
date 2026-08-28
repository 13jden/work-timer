/**
 * Salary Timer — Render: Calendar Page
 * Renders the monthly calendar grid.
 */
import { $, fmtMoney, setFlipText } from './dom.js';
import { state } from './state.js';
import { dailySalary, isWorkday, todayEarned } from './compute.js';
import { getMonthlyRecord } from './monthly.js';

export function renderCalendar() {
    const now = new Date();
    state.calState.year  = state.calState.year  ?? now.getFullYear();
    state.calState.month = state.calState.month ?? now.getMonth();

    const year  = state.calState.year;
    const month = state.calState.month;
    const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow    = new Date(year, month, 1).getDay();

    $('cal-month').textContent = monthNames[month];
    $('cal-year').textContent  = year;

    let workdayCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        if (isWorkday(new Date(year, month, d))) workdayCount++;
    }

    const daily = dailySalary(year, month);
    const earnedToday = todayEarned();
    const viewingKey = (d) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    let monthEarned = 0;
    const record = getMonthlyRecord(year, month);

    if (record) {
        monthEarned = record.totalEarned;
    } else if (year === now.getFullYear() && month === now.getMonth()) {
        for (let d = 1; d < now.getDate(); d++) {
            if (isWorkday(new Date(year, month, d))) monthEarned += daily;
        }
        if (isWorkday(now)) monthEarned += earnedToday;
    } else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth())) {
        for (let d = 1; d <= daysInMonth; d++) {
            if (isWorkday(new Date(year, month, d))) monthEarned += daily;
        }
    }

    setFlipText($('cal-workdays'),      String(workdayCount));
    setFlipText($('cal-daily-avg'),     Math.round(daily).toLocaleString('en-US'));
    setFlipText($('cal-month-earned'),  Math.round(monthEarned).toLocaleString('en-US'));

    const daysEl = $('cal-days');
    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<div class="cal-day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const isToday = (year === now.getFullYear() && month === now.getMonth() && d === now.getDate());
        const isPast  = (year < now.getFullYear())
            || (year === now.getFullYear() && month < now.getMonth())
            || (year === now.getFullYear() && month === now.getMonth() && d < now.getDate());
        const workday = isWorkday(date);
        const k = viewingKey(d);
        const override = state.dayOverrides[k] ? ' override' : '';

        let cls = 'cal-day' + (workday ? '' : ' weekend') + (isToday ? ' today' : '') + override;
        let earnText = '';
        if (workday) {
            cls += ' has-earn';
            if (isToday) earnText = fmtMoney(earnedToday);
            else if (isPast) earnText = fmtMoney(daily);
        }

        html += `<div class="${cls}" data-date="${k}">
            <span class="day-num">${d}</span>
            ${earnText ? `<span class="earn">${earnText}</span>` : ''}
        </div>`;
    }
    daysEl.innerHTML = html;
}
