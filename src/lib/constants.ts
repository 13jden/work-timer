/**
 * Salary Timer — Static Constants
 *
 * 所有**常量**集中此处。
 * 注意:`theme` 字段已经从 DEFAULT_CONFIG 中移除,因为改用独立 themeStore。
 *
 * v1.3 扩展:
 *   - STORAGE_KEY_V3 / OVERRIDES_KEY_V3
 *   - SLACKING_KEY(摸鱼记录)
 *   - DEFAULT_CONFIG 扩展(v3 字段)
 *   - SLACKING_LABELS
 *   - 夜班窗口常量
 */

import type { Config } from './types';

// ── Storage keys(必须保持兼容!)────────────────────────────────
// v1 keys:旧版数据
export const STORAGE_KEY    = 'salary_timer_config_v1';
export const ITEMS_KEY      = 'salary_timer_items_v1';
export const OVERRIDES_KEY  = 'salary_timer_day_overrides_v1';
export const MONTHLY_KEY    = 'salary_timer_monthly_v1';
// v2 keys:阶段 1 升级后使用
export const STORAGE_KEY_V2 = 'salary_timer_config_v2';
export const OVERRIDES_KEY_V2 = 'salary_timer_day_overrides_v2';
export const SNAPSHOTS_KEY  = 'salary_timer_monthly_snapshots_v1';
// v3 keys:v1.3 升级后使用
export const STORAGE_KEY_V3 = 'salary_timer_config_v3';
export const OVERRIDES_KEY_V3 = 'salary_timer_day_overrides_v3';
export const SLACKING_KEY   = 'salary_timer_slacking_sessions_v1';

export const MONTHLY_PREFIX = 'salary_timer_m_';

/** 不同 storage key 的 zustand persist `partialize` 用的 selector 名字(保留以备兼容) */
export const THEME_KEY      = 'salary_timer_theme_v1';

// ── Default Config ──────────────────────────────────────────
//
// 注意:DEFAULT_CONFIG 在 v2 → v3 升级时新增 6 个字段。
//   - 加载老 v2/v1 数据时,store 初始化会补默认值,保证向后兼容。

export const DEFAULT_CONFIG: Config = {
  monthlySalary: 15000,
  startTime:     '09:00',
  endTime:       '18:00',
  coffeePrice:   15,
  restMode:      2,     // 0=无休, 1=单休, 2=双休
  theme:         'paper',
  recordedFromDate: '',

  // ── v1.3 新增字段默认值 ──
  salaryMode:      'monthly',
  manualHourlyRate: 100,
  manualDailyRate:  800,
  segments:        null,    // null = 使用 startTime/endTime 单段
  segmentTemplates: [        // v1.3.1 新增:默认 1 个 09:00-18:00 模板
    {
      id: 'tpl-default',
      label: '默认工时',
      segments: [{ start: '09:00', end: '18:00' }],
    },
  ],
  lunchEnabled:    false,
  lunchStart:      '12:00',
  lunchMinutes:    60,
};

// ── 静态数据 ────────────────────────────────────────────────

/** 休息模式文案 */
export const REST_MODE_LABELS: Record<0 | 1 | 2, string> = {
  0: '无休',
  1: '单休',
  2: '双休',
};

/**
 * 工作日类型下拉选项
 * 显示顺序就是 select 里的顺序
 */
export const DAY_TYPE_OPTIONS: Array<{
  value: 'work' | 'paid_overtime' | 'leave' | 'rest' | 'freelance';
  label: string;
  defaultMultiplier: number;
}> = [
  { value: 'work',           label: '工作日',     defaultMultiplier: 1   },
  { value: 'paid_overtime',  label: '加班(有偿)', defaultMultiplier: 1.5 },
  { value: 'freelance',      label: '自由/兼职',  defaultMultiplier: 1   },
  { value: 'leave',          label: '请假(无薪)', defaultMultiplier: 0   },
  { value: 'rest',           label: '休息日',     defaultMultiplier: 0   },
];

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

// ── v1.3 新增常量 ──────────────────────────────────────────

/**
 * 夜班窗口(固定 22:00–06:00,不可配置)
 * 分钟数:start=22*60=1320, end=6*60=360
 *
 * 跨天识别:段落在 [1320, 1440) ∪ [0, 360) 范围的分钟数 = nightMinutes。
 */
export const NIGHT_SHIFT_START_MIN = 22 * 60;
export const NIGHT_SHIFT_END_MIN = 6 * 60;

/** 摸鱼标签文案 */
export const SLACKING_LABEL_TEXT: Record<'toilet' | 'slack' | 'meal' | 'other', string> = {
  toilet: '厕所',
  slack: '摸鱼',
  meal: '吃饭',
  other: '其他',
};

/** 摸鱼标签 emoji */
export const SLACKING_LABEL_ICON: Record<'toilet' | 'slack' | 'meal' | 'other', string> = {
  toilet: '🚻',
  slack: '🐟',
  meal: '🍚',
  other: '✨',
};

/** SegmentsEditor 段数上限 */
export const SEGMENTS_MAX = 10;
