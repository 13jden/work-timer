/**
 * Salary Timer — 后端请求封装单测（v3.2）
 *
 * 核心契约:**永不抛错**。任何网络问题都收敛成 { ok:false, status, data:null, error }。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { request } from './api';

describe('api.request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns parsed body on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, value: 42 }),
      }),
    );

    const res = await request<{ ok: boolean; value: number }>('/api/stats');

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true, value: 42 });
    expect(res.error).toBeNull();
  });

  it('sends JSON body with content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    });
    vi.stubGlobal('fetch', fetchMock);

    await request('/api/ping', { method: 'POST', body: { userId: 'u-1' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ userId: 'u-1' });
  });

  it('does not throw when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const res = await request('/api/ping');

    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.data).toBeNull();
    expect(res.error).toBe('ECONNREFUSED');
  });

  it('does not throw on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ ok: false, error: 'backend unavailable' }),
      }),
    );

    const res = await request<{ ok: boolean }>('/api/ping');

    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
    expect(res.data).toEqual({ ok: false, error: 'backend unavailable' });
    expect(res.error).toBe('HTTP 503');
  });

  it('does not throw when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<!doctype html><html>...</html>',
      }),
    );

    const res = await request('/api/ping');

    expect(res.ok).toBe(true);
    expect(res.data).toBeNull();
  });

  it('does not throw on an empty body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => '' }),
    );

    const res = await request('/api/ping');

    expect(res.ok).toBe(true);
    expect(res.data).toBeNull();
  });

  it('aborts and returns status 0 on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      ),
    );

    const res = await request('/api/ping', { timeoutMs: 10 });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.data).toBeNull();
  });
});
