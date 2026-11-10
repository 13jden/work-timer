/**
 * Salary Timer — 打赏金额（v3.2）
 *
 * 打赏弹层里除了预设的「小红花 ¥2」「咖啡 ¥9.9」，
 * 还可以自己填金额和留言。
 *
 * 把校验逻辑抽到这个文件，是因为它需要被单测覆盖，
 * 而且**打赏金额的格式规则不应该只存在于组件的事件处理里**。
 *
 * 约定：
 * - 金额最多两位小数，最小 0.01，最多 99999.99
 * - 留言选填，最多 50 字（收据上放得下）
 */
import { request } from './api';

/** 打赏金额上限（元） */
export const DONATE_MAX_AMOUNT = 99999.99;
/** 留言长度上限 */
export const DONATE_MAX_NOTE_LEN = 50;

export interface TipOption {
  id: string;
  label: string;
  amount: string;
  note: string;
}

/** 预设打赏项 */
export const TIPS: TipOption[] = [
  { id: 'flower', label: '小红花', amount: '2', note: '一朵花的心意' },
  { id: 'coffee', label: '咖啡', amount: '9.9', note: '换一杯续命' },
];

/** 自定义打赏的 id */
export const CUSTOM_TIP_ID = 'custom';

export type DonateValidation =
  | { ok: true; amount: number; amountText: string; note: string }
  | { ok: false; error: string };

/**
 * 校验自定义打赏金额 + 留言（纯函数，便于单测）。
 *
 * 金额接受 `12`、`12.5`、`12.50`、`¥12` 这几种写法，
 * 但**不接受**负数、多个小数点、非数字、空串。
 */
export function validateDonation(amount: string, note = ''): DonateValidation {
  const raw = (amount ?? '').trim().replace(/^[¥￥]/, '').trim();
  if (!raw) {
    return { ok: false, error: '填个金额吧' };
  }

  // 只允许「数字 + 最多两位小数」
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { ok: false, error: '金额只能是数字，最多两位小数' };
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: '金额要大于 0' };
  }
  if (value > DONATE_MAX_AMOUNT) {
    return { ok: false, error: `金额最多 ${DONATE_MAX_AMOUNT} 元` };
  }

  const cleanNote = (note ?? '').trim().slice(0, DONATE_MAX_NOTE_LEN);
  return { ok: true, amount: value, amountText: formatAmount(value), note: cleanNote };
}

/**
 * 金额格式化：整数不带小数点，有小数则最多两位。
 * `12` → `12`，`12.5` → `12.5`，`12.50` → `12.5`
 *
 * 用 `toFixed(2)` 再去掉末尾的 0，而不是 `Math.round(v * 100) / 100` ——
 * 后者有浮点误差（`1.005 * 100` 实际是 `100.49999999999999`，会进位成 1）。
 */
export function formatAmount(value: number): string {
  const fixed = value.toFixed(2);
  return fixed.replace(/\.?0+$/, '');
}

/**
 * 上报一次打赏（可选）。
 *
 * 目前后端没有打赏接口，这个函数永远吞掉错误 —— 但接口形状先定好，
 * 等后端加上了直接接上就行，不影响前端。
 */
export async function reportDonation(
  amount: number,
  note: string,
  method: string,
): Promise<boolean> {
  try {
    const res = await request('/api/donate', {
      method: 'POST',
      body: { amount, note, method },
    });
    return res.ok && res.data !== null;
  } catch {
    return false;
  }
}

/**
 * 打赏收款跳转链接（来自后台「系统配置」）。
 *
 * - `alipayUrl` —— 支付宝个人收款码解码后的 https 链接，
 *   点一下可以直接唤起支付宝 App 付款。
 *
 * 这个字段是**可选**的：为空就不显示跳转按钮。
 */
export interface DonatePayUrls {
  alipayUrl: string;
}

/** 空配置 */
export const EMPTY_PAY_URLS: DonatePayUrls = { alipayUrl: '' };

/**
 * 拉取收款跳转链接。**永不抛错** —— 拿不到就返回空配置。
 *
 * 走 `/api/config`（后端公开配置接口，settings 表的白名单字段）。
 * 之所以不用静态 JSON 文件：收款链接会变（换码、换服务商），
 * 放后台就能随时改，不必重新部署前端。
 */
export async function fetchDonatePayUrls(): Promise<DonatePayUrls> {
  try {
    const res = await request<{ ok?: boolean; config?: Record<string, string> }>('/api/config');
    const config = res.ok ? res.data?.config : null;
    if (!config) return EMPTY_PAY_URLS;
    return {
      alipayUrl: (config.alipayPayUrl ?? '').trim(),
    };
  } catch {
    return EMPTY_PAY_URLS;
  }
}

/**
 * 判断当前是否在微信内置浏览器里。
 *
 * 微信内打开支付宝链接会被拦截，所以那种场景不能直接跳，
 * 得引导用户「复制到浏览器打开」。
 */
export function isWechatBrowser(): boolean {
  try {
    if (typeof navigator === 'undefined') return false;
    return /micromessenger/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}
