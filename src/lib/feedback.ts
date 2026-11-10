/**
 * Salary Timer — 意见反馈（v3.2）
 *
 * 用户在「我的 → 更多 → 意见反馈」提交的原话，存到后端，
 * 在管理后台「社区 → 反馈」里逐条查看、流转处理状态。
 *
 * ## 为什么单独一个 lib
 *
 * 校验规则（长度上限、空白处理）要能被单测覆盖，
 * 不能埋在组件的事件处理里。所以拆成纯函数 + 提交函数。
 *
 * ## 约定
 *
 * - **永不抛错**：`request()` 已经收敛了网络异常，这里再兜一层，
 *   组件只管看返回值。
 * - 联系方式是**选填**的 —— 不想留邮箱也能提反馈。
 * - 设备 ID 只是用来关联同一设备的多次反馈，不含个人信息。
 */
import { request } from './api';
import { getDeviceId, getPlatform } from './track';

/** 后端单条反馈内容上限（与后端 FEEDBACK_MAX_LEN 保持一致） */
export const FEEDBACK_MAX_LEN = 2000;
/** 联系方式长度上限（与后端 FEEDBACK_MAX_CONTACT_LEN 保持一致） */
export const FEEDBACK_MAX_CONTACT_LEN = 120;

export interface FeedbackInput {
  /** 反馈正文 */
  content: string;
  /** 联系方式（选填） */
  contact?: string;
}

export type FeedbackValidation =
  | { ok: true; content: string; contact: string }
  | { ok: false; error: string };

/**
 * 校验并归一化反馈输入（纯函数，便于单测）。
 *
 * 规则：
 * - 正文去掉首尾空白后不能为空
 * - 正文不超过 `FEEDBACK_MAX_LEN`
 * - 联系方式超过 `FEEDBACK_MAX_CONTACT_LEN` 时**截断**而不是报错 ——
 *   联系方式填错了不该让用户重写一遍正文
 */
export function validateFeedback(input: FeedbackInput): FeedbackValidation {
  const content = (input.content ?? '').trim();
  if (!content) {
    return { ok: false, error: '说点什么再寄出吧' };
  }
  if (content.length > FEEDBACK_MAX_LEN) {
    return { ok: false, error: `内容太长了，控制在 ${FEEDBACK_MAX_LEN} 字以内` };
  }

  const contact = (input.contact ?? '').trim().slice(0, FEEDBACK_MAX_CONTACT_LEN);
  return { ok: true, content, contact };
}

export type FeedbackSubmitResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

/**
 * 提交反馈。
 *
 * 成功返回 `{ ok: true, id }`；失败返回 `{ ok: false, error }`（**永不抛错**）。
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackSubmitResult> {
  const validated = validateFeedback(input);
  if (!validated.ok) return { ok: false, error: validated.error };

  const res = await request<{ ok?: boolean; feedback?: { id?: number } }>('/api/feedback', {
    method: 'POST',
    body: {
      content: validated.content,
      contact: validated.contact,
      platform: getPlatform(),
      userId: getDeviceId(),
    },
  });

  if (!res.ok || !res.data || res.data.ok !== true) {
    // 后端返回了具体的错误信息就用它，否则给一句人话
    const serverError =
      res.data && typeof (res.data as { error?: unknown }).error === 'string'
        ? (res.data as { error: string }).error
        : '';
    return { ok: false, error: translateError(serverError, res.status) };
  }

  const id = res.data.feedback?.id;
  return { ok: true, id: typeof id === 'number' ? id : 0 };
}

/**
 * 把后端错误码翻译成用户能看懂的话。
 *
 * 后端返回的是英文（`content is required` / `too many submissions...`），
 * 直接甩给用户看没有意义。
 */
function translateError(serverError: string, status: number): string {
  if (serverError.includes('too many')) {
    return '提交太频繁了，歇一会儿再试';
  }
  if (serverError.includes('content too long')) {
    return `内容太长了，控制在 ${FEEDBACK_MAX_LEN} 字以内`;
  }
  if (status === 0) {
    return '网络不太顺，稍后再试一次';
  }
  if (status >= 500) {
    return '服务开小差了，稍后再试';
  }
  return '提交没成功，稍后再试';
}
