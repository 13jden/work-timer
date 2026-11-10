/**
 * Salary Timer — 站点公开配置（v3.2）
 *
 * 后台「系统配置」里填的站点级配置，客户端通过 `/api/config` 拉取。
 * 目前只用得到 `userGuideUrl`（「我的 → 更多 → 使用指南」）。
 *
 * 约定：**永不抛错**。后端挂了 / 没配 / 网络不通，
 * 一律退化成「没有指南链接」，由调用方展示兜底文案。
 */
import { request } from './api';

export interface PublicConfig {
  /** 使用指南链接（后台配置项 userGuideUrl） */
  userGuideUrl: string;
  /** 当前发布版本号 */
  currentVersion: string;
  /** 页脚文案 */
  footerText: string;
}

const EMPTY: PublicConfig = {
  userGuideUrl: '',
  currentVersion: '',
  footerText: '',
};

/** 拉取站点公开配置；失败返回全空的默认配置 */
export async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await request<{ ok?: boolean; config?: Partial<PublicConfig> }>('/api/config');
  if (!res.ok || !res.data || res.data.ok !== true) return { ...EMPTY };

  const raw = res.data.config ?? {};
  return {
    userGuideUrl: typeof raw.userGuideUrl === 'string' ? raw.userGuideUrl.trim() : '',
    currentVersion: typeof raw.currentVersion === 'string' ? raw.currentVersion.trim() : '',
    footerText: typeof raw.footerText === 'string' ? raw.footerText.trim() : '',
  };
}

/**
 * 归一化使用指南链接。
 *
 * - 空串 → 空串（未配置）
 * - `example.com/guide` → `https://example.com/guide`（补全协议）
 * - `//example.com/x` → `https://example.com/x`
 *
 * 只允许 http/https：带其他 scheme（`javascript:` / `data:` 等）的
 * 一律判定为无效，返回空串。
 */
export function normalizeGuideUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return '';

  // 显式 scheme：只放行 http / https
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (schemeMatch) {
    const scheme = schemeMatch[1]!.toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') return '';
    return url;
  }

  // 协议相对 URL
  if (url.startsWith('//')) return `https:${url}`;

  // 裸域名 / 路径
  return `https://${url}`;
}
