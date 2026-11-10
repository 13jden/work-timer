/**
 * Salary Timer — 设备 ID / 日活上报单测（v3.2）
 *
 * 核心契约：
 * 1. 后端不可达时**不报错、不打标**，当天下次打开还会重试
 * 2. 设备 ID 要**稳定**（同一天多次上报同一个 ID）
 * 3. localStorage 不可用时**不能每次都换 ID**（否则总用户数虚高）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAnonId,
  getDeviceId,
  getFingerprintId,
  getPlatform,
  pingDailyActivity,
  resolveDeviceId,
  fetchNativeDeviceId,
} from './track';

const DEVICE_ID_KEY = 'st_device_id';
const LEGACY_ANON_ID_KEY = 'st_anon_id';
const LAST_PING_KEY = 'st_last_ping_day';

function todayKey(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** 模拟后端在线并返回 ok */
function backendOnline() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, isNewUser: true }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** 模拟后端没启动 / 网络不通 */
function backendOffline() {
  const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('track', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as { __ST_DEVICE_ID__?: string }).__ST_DEVICE_ID__;
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getDeviceId', () => {
    it('generates an id on first call', () => {
      const id = getDeviceId();
      expect(id).toMatch(/^u-/);
      expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(id);
    });

    it('returns the same id on subsequent calls', () => {
      const a = getDeviceId();
      const b = getDeviceId();
      expect(a).toBe(b);
    });

    it('migrates the legacy anon id without changing it', () => {
      localStorage.setItem(LEGACY_ANON_ID_KEY, 'u-legacy-abc');
      const id = getDeviceId();
      expect(id).toBe('u-legacy-abc');
      expect(localStorage.getItem(DEVICE_ID_KEY)).toBe('u-legacy-abc');
    });

    it('prefers the native device id when present', () => {
      (window as unknown as { __ST_DEVICE_ID__?: string }).__ST_DEVICE_ID__ = 'abc123';
      const id = getDeviceId();
      expect(id).toBe('d-abc123');
      // 原生 ID 优先，不写 localStorage
      expect(localStorage.getItem(DEVICE_ID_KEY)).toBeNull();
    });

    it('falls back to a stable fingerprint when localStorage is unavailable', () => {
      // 让 localStorage 读写全部抛异常（模拟隐私模式 / 禁用存储）
      const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const a = getDeviceId();
      const b = getDeviceId();

      expect(a).toMatch(/^f-/);
      // 关键：不能每次都换 ID，否则同一个用户会被算成多个新用户
      expect(a).toBe(b);

      getSpy.mockRestore();
      setSpy.mockRestore();
    });
  });

  describe('getFingerprintId', () => {
    it('is deterministic for the same browser environment', () => {
      expect(getFingerprintId()).toBe(getFingerprintId());
      expect(getFingerprintId()).toMatch(/^f-[0-9a-f]{16}$/);
    });

    it('does not leak the raw fingerprint features', () => {
      // 指纹里不该出现 UA 原文
      expect(getFingerprintId()).not.toContain('Mozilla');
    });
  });

  describe('getPlatform', () => {
    it('is web by default', () => {
      expect(getPlatform()).toBe('web');
    });

    it('is app inside the tauri shell', () => {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
      expect(getPlatform()).toBe('app');
    });
  });

  describe('resolveDeviceId', () => {
    it('uses the native device id when the native command succeeds', async () => {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
        invoke: vi.fn().mockResolvedValue({ device_id: 'native-xyz' }),
      };

      const id = await resolveDeviceId();
      expect(id).toBe('d-native-xyz');
      // 缓存下来
      expect(localStorage.getItem('st_native_device_id')).toBe('d-native-xyz');
    });

    it('falls back to the install id when there is no native layer', async () => {
      const id = await resolveDeviceId();
      expect(id).toMatch(/^u-/);
    });

    it('falls back when the native command throws', async () => {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
        invoke: vi.fn().mockRejectedValue(new Error('command not found')),
      };

      const id = await resolveDeviceId();
      expect(id).toMatch(/^u-/);
    });

    it('never throws when the native layer is broken', async () => {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
        invoke: 'not a function' as unknown as () => Promise<unknown>,
      };
      await expect(fetchNativeDeviceId()).resolves.toBeNull();
    });
  });

  describe('pingDailyActivity', () => {
    it('posts once and marks the day when the backend is up', async () => {
      const fetchMock = backendOnline();

      const sent = await pingDailyActivity();

      expect(sent).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/ping');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body as string);
      expect(body.userId).toMatch(/^u-/);
      expect(body.platform).toBe('web');
      expect(localStorage.getItem(LAST_PING_KEY)).toBe(todayKey());
    });

    it('sends the same device id on repeated days', async () => {
      const fetchMock = backendOnline();

      await pingDailyActivity();
      localStorage.setItem(LAST_PING_KEY, '2000-01-01');
      await pingDailyActivity();

      const bodies = fetchMock.mock.calls.map(
        (c) => JSON.parse((c as [string, RequestInit])[1].body as string),
      );
      expect(bodies[0].userId).toBe(bodies[1].userId);
    });

    it('does not post again on the same day', async () => {
      const fetchMock = backendOnline();

      await pingDailyActivity();
      const second = await pingDailyActivity();

      expect(second).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not throw and does not mark the day when the backend is down', async () => {
      backendOffline();

      const sent = await pingDailyActivity();

      expect(sent).toBe(false);
      expect(localStorage.getItem(LAST_PING_KEY)).toBeNull();
    });

    it('does not mark the day when the backend returns 503', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          text: async () => JSON.stringify({ ok: false, error: 'backend unavailable' }),
        }),
      );

      const sent = await pingDailyActivity();

      expect(sent).toBe(false);
      expect(localStorage.getItem(LAST_PING_KEY)).toBeNull();
    });

    it('does not mark the day when the response body is not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' }),
      );

      const sent = await pingDailyActivity();

      expect(sent).toBe(false);
      expect(localStorage.getItem(LAST_PING_KEY)).toBeNull();
    });

    it('retries later the same day when the backend was down', async () => {
      const fetchMock = backendOffline();
      await pingDailyActivity();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // 后端恢复
      backendOnline();
      const sent = await pingDailyActivity();
      expect(sent).toBe(true);
      expect(localStorage.getItem(LAST_PING_KEY)).toBe(todayKey());
    });

    it('posts again when the stored day is a previous day', async () => {
      const fetchMock = backendOnline();
      localStorage.setItem(LAST_PING_KEY, '2000-01-01');

      const sent = await pingDailyActivity();
      expect(sent).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAnonId', () => {
    it('is an alias of getDeviceId', () => {
      expect(getAnonId()).toBe(getDeviceId());
    });
  });
});
