/**
 * Salary Timer — API 基址解析单测（v3.2）
 *
 * 核心契约：**原生 App 必须用绝对地址**。
 * WebView 的 origin 不是线上站点，用相对路径的话请求根本到不了后端，
 * 而且不报错（被 request() 吞掉）—— 日活/公告会静默失效。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { resolveApiBase, isNativeShell, DEFAULT_API_BASE } from './platform';

describe('resolveApiBase', () => {
  it('uses a relative path on the web production build', () => {
    expect(resolveApiBase({ dev: false, native: false })).toBe('');
  });

  it('uses the baked absolute URL inside the native app', () => {
    expect(
      resolveApiBase({
        dev: false,
        native: true,
        baked: 'https://persecond.work',
      }),
    ).toBe('https://persecond.work');
  });

  it('falls back to the default domain when the baked value is missing', () => {
    expect(resolveApiBase({ dev: false, native: true })).toBe(DEFAULT_API_BASE);
  });

  it('uses a relative path in dev so the vite proxy handles it', () => {
    expect(resolveApiBase({ dev: true, native: true })).toBe('');
    expect(resolveApiBase({ dev: true, native: false })).toBe('');
  });

  it('lets VITE_API_BASE override everything', () => {
    expect(
      resolveApiBase({
        configured: 'https://api.example.com',
        dev: true,
        native: true,
        baked: 'https://persecond.work',
      }),
    ).toBe('https://api.example.com');
  });

  it('ignores a blank VITE_API_BASE', () => {
    expect(
      resolveApiBase({ configured: '   ', dev: false, native: true, baked: 'https://x.test' }),
    ).toBe('https://x.test');
  });

  it('strips trailing slashes so paths do not double up', () => {
    expect(resolveApiBase({ configured: 'https://api.example.com/' })).toBe(
      'https://api.example.com',
    );
    expect(resolveApiBase({ dev: false, native: true, baked: 'https://persecond.work//' })).toBe(
      'https://persecond.work',
    );
  });
});

describe('isNativeShell', () => {
  afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  });

  it('is false in a plain browser', () => {
    expect(isNativeShell()).toBe(false);
  });

  it('is true when tauri internals are injected', () => {
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    expect(isNativeShell()).toBe(true);
  });

  it('supports the tauri v1 global as well', () => {
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};
    expect(isNativeShell()).toBe(true);
  });
});
