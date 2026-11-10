/**
 * Salary Timer — 站点公开配置单测（v3.2）
 *
 * 契约：
 * - 拉取配置永不抛错（后端挂了 → 空配置）
 * - 链接归一化：补协议、拒绝 javascript: 之类
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchPublicConfig, normalizeGuideUrl } from './config';

/** 模拟后端返回（request() 读的是 res.text()） */
function mockConfig(config: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, config }),
  });
}

describe('fetchPublicConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty config and never throws when the backend is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const cfg = await fetchPublicConfig();
    expect(cfg.userGuideUrl).toBe('');
    expect(cfg.currentVersion).toBe('');
  });

  it('reads the guide url from the public endpoint', async () => {
    vi.stubGlobal('fetch', mockConfig({ userGuideUrl: 'https://example.com/guide' }));
    const cfg = await fetchPublicConfig();
    expect(cfg.userGuideUrl).toBe('https://example.com/guide');
  });

  it('trims whitespace and ignores non-string values', async () => {
    vi.stubGlobal(
      'fetch',
      mockConfig({ userGuideUrl: '  https://example.com/x  ', currentVersion: 123 }),
    );
    const cfg = await fetchPublicConfig();
    expect(cfg.userGuideUrl).toBe('https://example.com/x');
    expect(cfg.currentVersion).toBe('');
  });
});

describe('normalizeGuideUrl', () => {
  it('returns empty string for unconfigured values', () => {
    expect(normalizeGuideUrl('')).toBe('');
    expect(normalizeGuideUrl('   ')).toBe('');
  });

  it('keeps http/https urls untouched', () => {
    expect(normalizeGuideUrl('https://a.com/x')).toBe('https://a.com/x');
    expect(normalizeGuideUrl('http://a.com/x')).toBe('http://a.com/x');
  });

  it('adds the https protocol when missing', () => {
    expect(normalizeGuideUrl('a.com/x')).toBe('https://a.com/x');
    expect(normalizeGuideUrl('//a.com/x')).toBe('https://a.com/x');
  });

  it('rejects non-http protocols', () => {
    expect(normalizeGuideUrl('javascript:alert(1)')).toBe('');
    expect(normalizeGuideUrl('data:text/html,<h1>x</h1>')).toBe('');
  });
});
