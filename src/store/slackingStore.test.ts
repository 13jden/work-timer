import { describe, it, expect, beforeEach } from 'vitest';
import { useSlackingStore } from './slackingStore';

describe('slackingStore — updateSession', () => {
  beforeEach(() => {
    localStorage.clear();
    useSlackingStore.setState({ sessions: {}, currentSessionId: null });
  });

  it('updateSession 更新 label 后,sessions 对象引用变化(触发 Zustand 订阅)', () => {
    const id = useSlackingStore.getState().startSession('2026-08-30', 'slack');
    const sessionsBefore = useSlackingStore.getState().sessions;

    useSlackingStore.getState().updateSession(id, { label: 'overtime' });

    const sessionsAfter = useSlackingStore.getState().sessions;
    expect(sessionsAfter).not.toBe(sessionsBefore); // 新对象 → 触发订阅
    expect(sessionsAfter['2026-08-30']).not.toBe(sessionsBefore['2026-08-30']); // 数组也换了
  });

  it('updateSession 更新 startTs 后,目标对象是新引用且 nightShift 重算', () => {
    const id = useSlackingStore.getState().startSession('2026-08-30', 'slack');
    const before = useSlackingStore.getState().sessions['2026-08-30']!.find((s) => s.id === id)!;

    // 改到夜班窗口(22:00)
    const nightTs = new Date(before.dateKey + 'T22:00:00').getTime();
    useSlackingStore.getState().updateSession(id, { startTs: nightTs });

    const after = useSlackingStore.getState().sessions['2026-08-30']!.find((s) => s.id === id)!;
    expect(after.label).toBe('slack'); // label 未变
    expect(after.startTs).toBe(nightTs);
    expect(after.nightShift).toBe(true);
    expect(after).not.toBe(before); // 新引用
  });

  it('updateSession 更新 endTs 后,目标对象是新引用且 nightShift 重算', () => {
    const id = useSlackingStore.getState().startSession('2026-08-30', 'slack');
    // 结束时间设为同一日 23:30(夜班)
    const startTs = new Date('2026-08-30T20:00:00').getTime();
    const endTs = new Date('2026-08-30T23:30:00').getTime();
    useSlackingStore.getState().updateSession(id, { startTs, endTs });

    const after = useSlackingStore.getState().sessions['2026-08-30']!.find((s) => s.id === id)!;
    expect(after.endTs).toBe(endTs);
    expect(after.nightShift).toBe(true);
  });

  it('addPastSession 创建的记录同样可以被 updateSession 更新', () => {
    const startTs = new Date('2026-08-30T09:00:00').getTime();
    const endTs = new Date('2026-08-30T12:00:00').getTime();
    const id = useSlackingStore.getState().addPastSession('2026-08-30', 'slack', startTs, endTs);
    expect(id).not.toBe('');

    useSlackingStore.getState().updateSession(id, { label: 'overtime' });
    const after = useSlackingStore.getState().sessions['2026-08-30']!.find((s) => s.id === id)!;
    expect(after.label).toBe('overtime');
  });
});
