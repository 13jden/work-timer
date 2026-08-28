/**
 * Salary Timer — Storage Layer
 * Wraps localStorage with JSON parse/stringify.
 */
import { STORAGE_KEY, ITEMS_KEY, OVERRIDES_KEY, MONTHLY_KEY, state, DEFAULT_CONFIG, DEFAULT_ITEMS } from './state.js';

export function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (e) { return fallback; }
}

export function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) {}
}

export function persistConfig()    { saveJSON(STORAGE_KEY, state.config); }
export function persistItems()     { saveJSON(ITEMS_KEY, state.items); }
export function persistOverrides() { saveJSON(OVERRIDES_KEY, state.dayOverrides); }

// ── Init ───────────────────────────────────────────────────
export function initState() {
    state.config        = Object.assign({}, DEFAULT_CONFIG, loadJSON(STORAGE_KEY, {}));
    let items = loadJSON(ITEMS_KEY, null);
    if (!Array.isArray(items) || items.length === 0) {
        items = DEFAULT_ITEMS.slice();
        saveJSON(ITEMS_KEY, items);
    }
    state.items         = items;
    state.dayOverrides = loadJSON(OVERRIDES_KEY, {});
}
