/**
 * Salary Timer — Theme System
 * Applies theme via data-theme on <html>.
 */
import { THEMES } from './state.js';

export function applyTheme(themeId) {
    themeId = THEMES[themeId] ? themeId : 'paper';
    document.documentElement.setAttribute('data-theme', themeId);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        const colors = {
            paper:    '#F5F2EA',
            obsidian: '#131320',
            gold:     '#FAF9F6',
        };
        metaTheme.setAttribute('content', colors[themeId] || '#F5F2EA');
    }
}
