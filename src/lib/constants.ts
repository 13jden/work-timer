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
  customRestSchedule: null,
  // v1.3.5 新增字段默认值
  workTemplates:   [        // 默认初始化 1 个常规班模板
    {
      id: 'tpl-default',
      name: '常规班',
      color: '#4ADE80',
      workSegment: { start: '09:00', end: '18:00' },
    },
  ],
  // ── v2.5-patch4 N-481：time → accounting 联动默认关 ──
  // 用户反馈「首页记账关联存款记录」功能取消。开关保留(store action / 类型不变)，
  // 默认关闭；用户未来想恢复可在设置页手动开启。
  // 关闭后:time 模式日历页已赚不再写入 accountStore;
  // 已存在的联动记录依然保留,删除 / 编辑需要手动处理。
  salaryLinkageEnabled: false,
};

// ── 静态数据 ────────────────────────────────────────────────

/** 休息模式文案 */
export const REST_MODE_LABELS: Record<0 | 1 | 2 | 'custom', string> = {
  0: '无休',
  1: '单休',
  2: '双休',
  custom: '自定义排班',
};

/**
 * 工作日类型下拉选项
 *
 * v1.3.3:
 *  - 「加班(有偿)」→「加班」(去掉"有偿"二字,允许倍率 = 0 表示无偿加班)
 *  - freelance 类型:hourly/daily 模式专用;monthly 模式下用作"周末临时兼职"
 *  - 「工作日」在 monthly 模式下作为基础选项;hourly/daily 模式隐藏
 *  - 「休息日」强制倍率 0(见 DEFAULT_MULTIPLIER)
 * 显示顺序就是 select 里的顺序
 */
export const DAY_TYPE_OPTIONS: Array<{
  value: 'work' | 'paid_overtime' | 'leave' | 'rest' | 'freelance';
  label: string;
  defaultMultiplier: number;
}> = [
  { value: 'work',           label: '工作日',    defaultMultiplier: 1   },
  { value: 'paid_overtime',  label: '加班',      defaultMultiplier: 1   }, // v1.3.3 patch3:加班加成默认关闭,仅夜班场景自动 ×1.5
  { value: 'freelance',      label: '自由/兼职', defaultMultiplier: 1   },
  { value: 'leave',          label: '请假',      defaultMultiplier: 0   },
  { value: 'rest',           label: '休息日',    defaultMultiplier: 0   },
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
  obsidian: { id: 'obsidian', label: '曜石青',   accent: '#2DD4BF', paper: '#101318' },
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

/**
 * 时间记录标签文案(v1.3.3 重命名, v1.3.5 新增 parttime)
 * - slack:摸鱼(开小差)
 * - overtime:加班
 * - parttime:兼职(v1.3.5 新增)
 * - other:其他(customLabel)
 *
 * 注意:旧 toilet/meal 已合并到 other,通过 customLabel 区分
 * (常量中保留 keys 字面量,运行时旧数据由 store 端做迁移)
 */
export const SLACKING_LABEL_TEXT: Record<'slack' | 'overtime' | 'parttime' | 'other', string> = {
  slack: '摸鱼',
  overtime: '加班',
  parttime: '兼职',
  other: '其他',
};

/** 时间记录标签 emoji(v1.3.3 重命名, v1.3.5 新增 parttime) */
export const SLACKING_LABEL_ICON: Record<'slack' | 'overtime' | 'parttime' | 'other', string> = {
  slack: '🐟',
  overtime: '⚡',
  parttime: '🎯',
  other: '✨',
};

/** SegmentsEditor 段数上限 */
export const SEGMENTS_MAX = 10;

/**
 * v1.3.5 工作日模板颜色池（4 色循环）
 * 
 * 按顺序分配给新建模板：
 *   - 模板 1 → #4ADE80 (绿)
 *   - 模板 2 → #FBBF24 (黄)
 *   - 模板 3 → #60A5FA (蓝)
 *   - 模板 4 → #A78BFA (紫)
 *   - 模板 5 → colors[4 % 4] = #4ADE80 (循环)
 */
export const TEMPLATE_COLORS = ['#4ADE80', '#FBBF24', '#60A5FA', '#A78BFA'];

// ── v2.0 Accounting ─────────────────────────────────────────

/** 记账 storage key v1 */
export const ACCOUNTING_KEY = 'salary_timer_accounting_v1';

// 账户类型颜色
export const ACCOUNT_TYPE_COLORS: Record<'alipay' | 'wechat' | 'card' | 'cash', string> = {
  alipay: '#1677FF',
  wechat: '#07C160',
  card: '#2D2D2D',
  cash: '#8B8F84',
};

/**
 * 默认支出分类
 * v2.1 TASK-036:icon 改为 IconByKey 的 key(线稿图标);老数据 emoji 由渲染层回退兼容
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'cat-food', name: '餐饮', icon: 'food', color: '#FF9B8E' },
  { id: 'cat-transport', name: '交通', icon: 'bus', color: '#60A5FA' },
  { id: 'cat-shopping', name: '购物', icon: 'bag', color: '#F472B6' },
  { id: 'cat-entertainment', name: '娱乐', icon: 'game', color: '#A78BFA' },
  { id: 'cat-housing', name: '住房', icon: 'home', color: '#34D399' },
  { id: 'cat-utilities', name: '水电', icon: 'bulb', color: '#FBBF24' },
  { id: 'cat-medical', name: '医疗', icon: 'pill', color: '#F87171' },
  { id: 'cat-education', name: '教育', icon: 'book', color: '#38BDF8' },
  { id: 'cat-other', name: '其他', icon: 'box', color: '#9CA3AF' },
];

/** 默认收入分类 */
export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'cat-salary', name: '工资', icon: 'wallet', color: '#34D399' },
  { id: 'cat-bonus', name: '奖金', icon: 'gift', color: '#FBBF24' },
  { id: 'cat-investment', name: '投资', icon: 'trend', color: '#60A5FA' },
  { id: 'cat-parttime', name: '兼职', icon: 'handcoins', color: '#A78BFA' },
  { id: 'cat-gift', name: '红包', icon: 'envelope', color: '#F472B6' },
  { id: 'cat-refund', name: '退款', icon: 'coins', color: '#9CA3AF' },
  { id: 'cat-other-income', name: '其他', icon: 'sparkle', color: '#6B7280' },
];

/** 记账 emoji 选项(已废弃,保留供老数据回退参考;新 picker 用 ACCOUNTING_ICON_GROUPS) */
export const ACCOUNTING_EMOJI_CHOICES: readonly string[] = [
  '🍜','🧋','🍕','🍔','🥗','🍱','🍰','☕',
  '🚌','🚗','🚕','⛽','🅿️','✈️','🚄',
  '🛒','👗','💄','🎮','🎬','🎵','⚽','🎯',
  '🏠','💡','💧','📱','💻','📚','🎓',
  '💰','💵','🏦','💳','🧧','🎁','📈',
  '💊','🏥','🚑','💪','🧘',
  '🐱','🐶','🌍','✈️','🗺️','🏖️',
  '📦','🎁','🛍️','💼','🎒','⌚','👓',
  '☂️','🧥','👟','🧢','🎒','👶','🎈',
];

/** 存钱目标 emoji 选项 */
export const SAVINGS_GOAL_EMOJI_CHOICES: readonly string[] = [
  '🏠','🚗','✈️','💍','💎','🎮','📱','💻',
  '🎓','🏖️','🎯','🎁','🧧','💰','🏦','📈',
  '🎯','⚡','🌟','🎉','🚀','💪','🏆','🎖️',
];

/** 记账记录排序方式 */
export type RecordSortBy = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
export const RECORD_SORT_OPTIONS: Record<RecordSortBy, { label: string; value: RecordSortBy }> = {
  date_desc: { label: '最新在前', value: 'date_desc' },
  date_asc: { label: '最早在前', value: 'date_asc' },
  amount_desc: { label: '金额从大到小', value: 'amount_desc' },
  amount_asc: { label: '金额从小到大', value: 'amount_asc' },
};
