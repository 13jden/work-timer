/**
 * Salary Timer — 日活上报单测（v3.2）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAnonId, pingDailyActivity } from './track';

const USER_ID_KEY = 'st_anon_id';
const LAST_PING_KEY = 'st_last_ping_day';

function todayKey(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

describe('track', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getAnonId', () => {
    it('generates an id on first call', () => {
      const id = getAnonId();
      expect(id).toMatch(/^u-/);
      expect(localStorage.getItem(USER_ID_KEY)).toBe(id);
    });

    it('returns the same id on subsequent calls', () => {
      const a = getAnonId();
      const b = getAnonId();
      expect(a).toBe(b);
    });
  });

  describe('pingDailyActivity', () => {
    it('posts once and marks the day', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      const sent = await pingDailyActivity();

      expect(sent).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/ping');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string).userId).toMatch(/^u-/);
      expect(localStorage.getItem(LAST_PING_KEY)).toBe(todayKey());
    });

    it('does not post again on the same day', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      await pingDailyActivity();
      const second = await pingDailyActivity();

      expect(second).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not mark the day when the request fails', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal('fetch', fetchMock);

      const sent = await pingDailyActivity();

      expect(sent).toBe(false);
      expect(localStorage.getItem(LAST_PING_KEY)).toBeNull();
    });

    it('swallows network errors', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
      vi.stubGlobal('fetch', fetchMock);

      const sent = await pingDailyActivity();

      expect(sent).toBe(false);
      expect(localStorage.getItem(LAST_PING_KEY)).toBeNull();
    });

    it('posts again when the stored day is a previous day', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      localStorage.setItem(LAST_PING_KEY, '2000-01-01');

      const sent = await pingDailyActivity();

      expect(sent).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
