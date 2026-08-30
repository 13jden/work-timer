/**
 * Salary Timer — Slacking Store
 *
 * 摸鱼会话存储(v1.3 新增)。
 *
 * 数据结构:
 *   sessions: Record<dateKey, SlackingSession[]>
 *   currentSessionId: 进行中 session id(全局同时只能一段)
 *
 * 持久化:slacking_timer_slacking_sessions_v1
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SLACKING_KEY } from '../lib/constants';
import { loadJSON } from '../lib/storage';
import { detectNightShift, isInNightWindow } from '../lib/time';
import type { SlackingSession, SlackingSessions, SlackingLabel } from '../lib/types';

// ── Store 形状 ──────────────────────────────────────────────
interface SlackingState {
  sessions: SlackingSessions;
  currentSessionId: string | null;

  // Actions
  startSession: (dateKey: string, label: SlackingLabel, customLabel?: string) => string;
  stopCurrentSession: () => void;
  addPastSession: (
    dateKey: string,
    label: SlackingLabel,
    startTs: number,
    endTs: number,
    customLabel?: string,
  ) => string;
  updateSession: (id: string, patch: Partial<Pick<SlackingSession, 'label' | 'customLabel' | 'startTs' | 'endTs'>>) => void;
  removeSession: (id: string) => void;

  // Selectors(纯函数,通过 getState 调用)
  getSessionsByDate: (dateKey: string) => SlackingSession[];
  getCurrentSession: () => SlackingSession | null;
  getTodaySlackingMinutes: (dateKey: string) => number;
}

function uuid(): string {
  return 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const initialSessions: SlackingSessions = (() => {
  const stored = loadJSON<SlackingSessions | null>(SLACKING_KEY, null);
  return stored ?? {};
})();

// ── Store 实现 ──────────────────────────────────────────────
export const useSlackingStore = create<SlackingState>()(
  persist(
    (set, get) => ({
      sessions: initialSessions,
      currentSessionId: null,

      startSession: (dateKey, label, customLabel) => {
        const id = uuid();
        const startTs = Date.now();
        const session: SlackingSession = {
          id,
          dateKey,
          label,
          customLabel,
          startTs,
          endTs: null,
          // v1.3.3:开始时按 startTs 预标记夜班(结束时不更新——避免边界场景)
          nightShift: isInNightWindow(new Date(startTs)),
        };
        const dayList = get().sessions[dateKey] ?? [];
        set({
          sessions: {
            ...get().sessions,
            [dateKey]: [...dayList, session],
          },
          currentSessionId: id,
        });
        return id;
      },

      stopCurrentSession: () => {
        const id = get().currentSessionId;
        if (!id) return;
        const now = Date.now();
        const sessions = { ...get().sessions };
        let shouldDrop = false;
        for (const k of Object.keys(sessions)) {
          const list = sessions[k];
          if (!list) continue;
          // 找到当前进行中的 session
          const target = list.find((s) => s.id === id && s.endTs === null);
          if (!target) continue;
          // v1.3.3:< 1 分钟不记录(避免误触)
          const durMs = now - target.startTs;
          if (durMs < 60_000) {
            shouldDrop = true;
            sessions[k] = list.filter((s) => s.id !== id);
          } else {
            sessions[k] = list.map((s) =>
              s.id === id ? { ...s, endTs: now } : s,
            );
          }
        }
        set({ sessions, currentSessionId: null });
        void shouldDrop; // dropped session 已经从 list 中移除
      },

      addPastSession: (dateKey, label, startTs, endTs, customLabel) => {
        // v1.3.3:< 1 分钟不记录(避免误触)
        if (endTs - startTs < 60_000) return '';
        const id = uuid();
        const session: SlackingSession = {
          id,
          dateKey,
          label,
          customLabel,
          startTs,
          endTs,
          nightShift: detectNightShift(startTs, endTs),
        };
        const dayList = get().sessions[dateKey] ?? [];
        set({
          sessions: {
            ...get().sessions,
            [dateKey]: [...dayList, session],
          },
        });
        return id;
      },

      updateSession: (id, patch) => {
        const sessions = { ...get().sessions };
        for (const k of Object.keys(sessions)) {
          const list = sessions[k];
          if (!list) continue;
          sessions[k] = list.map((s) => {
            if (s.id !== id) return s;
            const merged = { ...s, ...patch };
            // v1.3.3:若 patch 含 startTs/endTs,重算夜班标记
            if (patch.startTs !== undefined || patch.endTs !== undefined) {
              const start = patch.startTs ?? s.startTs;
              const end = patch.endTs ?? s.endTs ?? s.startTs;
              merged.nightShift = detectNightShift(start, end);
            }
            return merged;
          });
        }
        set({ sessions });
      },

      removeSession: (id) => {
        const sessions = { ...get().sessions };
        for (const k of Object.keys(sessions)) {
          const list = sessions[k];
          if (!list) continue;
          sessions[k] = list.filter((s) => s.id !== id);
        }
        // 若是当前正在进行的,清空 currentSessionId
        if (get().currentSessionId === id) {
          set({ sessions, currentSessionId: null });
        } else {
          set({ sessions });
        }
      },

      // Selectors(实现成方法,通过 getState 调用)
      getSessionsByDate: (dateKey) => get().sessions[dateKey] ?? [],
      getCurrentSession: () => {
        const id = get().currentSessionId;
        if (!id) return null;
        for (const list of Object.values(get().sessions)) {
          if (!list) continue;
          const found = list.find((s) => s.id === id);
          if (found) return found;
        }
        return null;
      },
      getTodaySlackingMinutes: (dateKey) => {
        const list = get().sessions[dateKey] ?? [];
        let total = 0;
        for (const s of list) {
          if (s.endTs === null) continue;
          const startDate = new Date(s.startTs);
          const endDate = new Date(s.endTs);
          const dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
          const startMin = (Math.max(startDate.getTime(), dayStart.getTime()) - dayStart.getTime()) / 60000;
          const endMin = (Math.min(endDate.getTime(), dayEnd.getTime()) - dayStart.getTime()) / 60000;
          if (endMin > startMin) total += endMin - startMin;
        }
        return Math.round(total);
      },
    }),
    {
      name: SLACKING_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** 工具:获取当前日期 key YYYY-MM-DD */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}