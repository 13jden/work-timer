/**
 * Salary Timer — 公告 / 更新核心逻辑单测（v3.2）
 *
 * 契约：
 * - 公告：看过一次就不再展示（Web / App 一致）
 * - 更新：Web 端等同公告；App 端要比对版本号，未升级时每天可提示一次
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  compareVersions,
  getSeenIds,
  markSeen,
  markDismissed,
  markPromptedToday,
  promptedToday,
  fetchNotices,
  type Notice,
} from './notice';

function mkNotice(over: Partial<Notice> = {}): Notice {
  return {
    id: 1,
    type: 'announcement',
    title: '标题',
    body: '正文',
    version: null,
    published: true,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/** 模拟后端返回（request() 读的是 res.text()） */
function mockNotices(list: Notice[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, notices: list }),
  });
}

describe('compareVersions', () => {
  it('compares numerically, not lexically', () => {
    expect(compareVersions('3.10.0', '3.9.0')).toBeGreaterThan(0);
    expect(compareVersions('3.2.0', '3.10.0')).toBeLessThan(0);
    expect(compareVersions('3.1.0', '3.1.0')).toBe(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareVersions('3.1', '3.1.0')).toBe(0);
    expect(compareVersions('3.1.1', '3.1')).toBeGreaterThan(0);
  });
});

describe('seen / prompted tracking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marks an id as seen exactly once', () => {
    markSeen(7);
    markSeen(7);
    expect(getSeenIds()).toEqual([7]);
  });

  it('tracks prompt day per update id', () => {
    expect(promptedToday(3)).toBe(false);
    markPromptedToday(3);
    expect(promptedToday(3)).toBe(true);
    expect(promptedToday(4)).toBe(false);
  });

  it('an announcement dismissal marks it seen', () => {
    markDismissed(mkNotice({ id: 11, type: 'announcement' }));
    expect(getSeenIds()).toContain(11);
  });
});

describe('fetchNotices', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty list and never throws when the backend is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    const list = await fetchNotices();
    expect(list).toEqual([]);
  });

  it('filters out announcements the user has already seen', async () => {
    markSeen(1);
    const fetchMock = mockNotices([
      mkNotice({ id: 1, type: 'announcement' }),
      mkNotice({ id: 2, type: 'announcement' }),
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchNotices();
    expect(list.map((n) => n.id)).toEqual([2]);
  });

  it('passes the seen list to the backend', async () => {
    markSeen(5);
    markSeen(6);
    const fetchMock = mockNotices([]);
    vi.stubGlobal('fetch', fetchMock);

    await fetchNotices();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('seen=5%2C6');
  });

  it('does not send currentVersion on web (no tauri runtime)', async () => {
    const fetchMock = mockNotices([]);
    vi.stubGlobal('fetch', fetchMock);

    await fetchNotices();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain('currentVersion');
  });

  it('a manual check ignores the seen list so the user can review it again', async () => {
    markSeen(1);
    const fetchMock = mockNotices([mkNotice({ id: 1, type: 'announcement' })]);
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchNotices(true);

    // 后端不能再按 seen 过滤 —— 否则手动检查永远看不到东西
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain('seen=');
    expect(url).toContain('force=true');
    expect(list.map((n) => n.id)).toEqual([1]);
  });

  it('a manual check still returns nothing when the backend is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const list = await fetchNotices(true);
    expect(list).toEqual([]);
  });
});
