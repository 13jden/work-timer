/**
 * Salary Timer — 意见反馈单测（v3.2）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateFeedback,
  submitFeedback,
  FEEDBACK_MAX_LEN,
  FEEDBACK_MAX_CONTACT_LEN,
} from './feedback';

function mockFetch(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(payload),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('feedback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('validateFeedback', () => {
    it('accepts normal input and trims whitespace', () => {
      const res = validateFeedback({ content: '  计时页数字跳动太快  ', contact: ' a@b.com ' });
      expect(res).toEqual({ ok: true, content: '计时页数字跳动太快', contact: 'a@b.com' });
    });

    it('rejects empty content', () => {
      const res = validateFeedback({ content: '   ' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBeTruthy();
    });

    it('rejects content over the limit', () => {
      const res = validateFeedback({ content: 'x'.repeat(FEEDBACK_MAX_LEN + 1) });
      expect(res.ok).toBe(false);
    });

    it('accepts content exactly at the limit', () => {
      const res = validateFeedback({ content: 'x'.repeat(FEEDBACK_MAX_LEN) });
      expect(res.ok).toBe(true);
    });

    it('truncates an overlong contact instead of failing', () => {
      const res = validateFeedback({
        content: 'ok',
        contact: 'c'.repeat(FEEDBACK_MAX_CONTACT_LEN + 50),
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.contact).toHaveLength(FEEDBACK_MAX_CONTACT_LEN);
    });

    it('treats missing contact as empty string', () => {
      const res = validateFeedback({ content: 'ok' });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.contact).toBe('');
    });
  });

  describe('submitFeedback', () => {
    it('posts content and returns the new id', async () => {
      const fetchMock = mockFetch({ ok: true, feedback: { id: 42 } });

      const res = await submitFeedback({ content: '很好用', contact: 'a@b.com' });

      expect(res).toEqual({ ok: true, id: 42 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/feedback');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body as string);
      expect(body.content).toBe('很好用');
      expect(body.contact).toBe('a@b.com');
      expect(body.platform).toBe('web');
      expect(typeof body.userId).toBe('string');
    });

    it('does not send when content is empty', async () => {
      const fetchMock = mockFetch({ ok: true });

      const res = await submitFeedback({ content: '  ' });

      expect(res.ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('surfaces a friendly message when the server rate-limits', async () => {
      mockFetch(
        { ok: false, error: 'too many submissions, please slow down' },
        { ok: false, status: 429 },
      );

      const res = await submitFeedback({ content: 'ok' });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain('频繁');
    });

    it('reports a network failure without throwing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      const res = await submitFeedback({ content: 'ok' });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBeTruthy();
    });

    it('reports a server error without throwing', async () => {
      mockFetch({ ok: false, error: 'boom' }, { ok: false, status: 500 });

      const res = await submitFeedback({ content: 'ok' });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBeTruthy();
    });
  });
});
