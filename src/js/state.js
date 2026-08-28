/**
 * Salary Timer — Core State & Constants
 * All runtime data lives here; other modules import from here.
 */

// ── Storage keys ───────────────────────────────────────────
export const STORAGE_KEY    = 'salary_timer_config_v1';
export const ITEMS_KEY      = 'salary_timer_items_v1';
export const OVERRIDES_KEY  = 'salary_timer_day_overrides_v1';
export const MONTHLY_KEY    = 'salary_timer_monthly_v1';
export const MONTHLY_PREFIX = 'salary_timer_m_';

// ── Default config ─────────────────────────────────────────
export const DEFAULT_CONFIG = {
    monthlySalary: 15000,
    startTime:     '09:00',
    endTime:       '18:00',
    lunchBreak:    1,
    coffeePrice:   15,
    restMode:      2,     // 0=无休, 1=单休, 2=双休
    lunchRest:     true,
    theme:         'paper',
};

// ── Static data ────────────────────────────────────────────
export const REST_MODE_LABELS = { 0: '无休', 1: '单休', 2: '双休' };

export const THEMES = {
    paper:    { label: '柠檬黄',   accent: '#C8FF00' },
    obsidian: { label: '靛蓝',     accent: '#7C6FF7' },
    gold:     { label: '香槟金',   accent: '#C9A84C' },
};

export const DEFAULT_ITEMS = [
    { id: 'preset-coffee', name: '咖啡', price: 15,  icon: '☕', order: 0 },
    { id: 'preset-boba',   name: '奶茶', price: 22,  icon: '🧋', order: 1 },
    { id: 'preset-shoes',  name: '球鞋', price: 899, icon: '👟', order: 2 },
];

export const QUOTES = [
    '下班不是奖励，是边界。',
    '你卖的不是时间，是生命的一段。',
    '每一秒都在为咖啡努力。',
    '打工人的浪漫，是看着钱进账。',
    '时间不会停下来等你想清楚。',
    '今天的你已经比昨天更贵了。',
    '自由不是不工作，是选着工作。',
];

export const EMOJI_CHOICES = [
    '☕','🧋','🍵','🥤','🍺','🍷','🥗','🍔',
    '🍕','🍣','🍰','🍩','🍫','🌮','🍜','🥑',
    '👟','👗','💄','💍','📱','💻','🎧','📚',
    '✈️','🚗','🏠','💼','🎮','🎬','🎵','⚽',
    '🌹','🐱','🐶','🌅','💰','📦','✨','🔥',
];

export const HOLIDAYS = {
    '2026-01-01': '元旦',
    '2026-02-17': '春节',
    '2026-04-05': '清明',
    '2026-05-01': '劳动',
    '2026-06-19': '端午',
    '2026-09-25': '中秋',
    '2026-10-01': '国庆',
};

// ── Runtime state (mutable, shared across modules) ──────────
export const state = {
    config:        null,   // set by initState()
    items:         null,
    dayOverrides:  null,
    calState:      { year: null, month: null },
    editingItemId: null,
    selectedIcon:  '📦',
    daySheetKey:   null,
};
