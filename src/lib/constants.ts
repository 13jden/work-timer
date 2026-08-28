/**
 * Salary Timer — Static Constants
 *
 * 所有**常量**集中此处。
 * 注意:`theme` 字段已经从 DEFAULT_CONFIG 中移除,因为改用独立 themeStore。
 */

// ── Storage keys(必须保持兼容!)────────────────────────────────
export const STORAGE_KEY    = 'salary_timer_config_v1';
export const ITEMS_KEY      = 'salary_timer_items_v1';
export const OVERRIDES_KEY  = 'salary_timer_day_overrides_v1';
export const MONTHLY_KEY    = 'salary_timer_monthly_v1';
export const MONTHLY_PREFIX = 'salary_timer_m_';

/** 不同 storage key 的 zustand persist `partialize` 用的 selector 名字(保留以备兼容) */
export const THEME_KEY      = 'salary_timer_theme_v1';

// ── Default Config(不包含 theme;theme 由独立 store 管理) ─────
import type { Config } from './types';

export const DEFAULT_CONFIG: Config = {
  monthlySalary: 15000,
  startTime:     '09:00',
  endTime:       '18:00',
  coffeePrice:   15,
  restMode:      2,     // 0=无休, 1=单休, 2=双休
  theme:         'paper', // 保留在 Config 里是给 localStorage 旧数据兼容(themeStore 会覆盖)
};

// ── 静态数据 ────────────────────────────────────────────────

/** 休息模式文案 */
export const REST_MODE_LABELS: Record<0 | 1 | 2, string> = {
  0: '无休',
  1: '单休',
  2: '双休',
};

/** 主题定义 */
export interface ThemeMeta {
  id: 'paper' | 'obsidian' | 'gold';
  label: string;   // 中文名
  accent: string;  // 主色
  paper: string;   // 纸面色(传给 meta theme-color)
}

export const THEMES: Record<ThemeMeta['id'], ThemeMeta> = {
  paper:    { id: 'paper',    label: '柠檬黄',   accent: '#C8FF00', paper: '#F5F2EA' },
  obsidian: { id: 'obsidian', label: '靛蓝',     accent: '#7C6FF7', paper: '#131320' },
  gold:     { id: 'gold',     label: '香槟金',   accent: '#C9A84C', paper: '#FAF9F6' },
};

/** 初始 items(用户首次使用时的预设) */
export const DEFAULT_ITEMS = [
  { id: 'preset-coffee', name: '咖啡', price: 15,  icon: '☕', order: 0 },
  { id: 'preset-boba',   name: '奶茶', price: 22,  icon: '🧋', order: 1 },
  { id: 'preset-shoes',  name: '球鞋', price: 899, icon: '👟', order: 2 },
];

/** 每日批注 */
export const QUOTES: readonly string[] = [
  '下班不是奖励,是边界。',
  '你卖的不是时间,是生命的一段。',
  '每一秒都在为咖啡努力。',
  '打工人的浪漫,是看着钱进账。',
  '时间不会停下来等你想清楚。',
  '今天的你已经比昨天更贵了。',
  '自由不是不工作,是选着工作。',
];

/** 物品可选 emoji */
export const EMOJI_CHOICES: readonly string[] = [
  '☕','🧋','🍵','🥤','🍺','🍷','🥗','🍔',
  '🍕','🍣','🍰','🍩','🍫','🌮','🍜','🥑',
  '👟','👗','💄','💍','📱','💻','🎧','📚',
  '✈️','🚗','🏠','💼','🎮','🎬','🎵','⚽',
  '🌹','🐱','🐶','🌅','💰','📦','✨','🔥',
];

/** 2026 年法定节假日 */
export const HOLIDAYS: Record<string, string> = {
  '2026-01-01': '元旦',
  '2026-02-17': '春节',
  '2026-04-05': '清明',
  '2026-05-01': '劳动',
  '2026-06-19': '端午',
  '2026-09-25': '中秋',
  '2026-10-01': '国庆',
};