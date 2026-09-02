/**
 * RecordsPanel — 桌面端右栏的「时间记录」列表（v1.3.4-patch4）
 *
 * 从 TimeTrackerDetailPage 抽出,供 DesktopRightPanel 使用。
 * - 订阅 slackingStore,显示今日 sessions
 * - 支持编辑/删除/添加(打开 inline sheet)
 * - 列表区可滚动;当前 page 不滚动整个右栏
 */
import { useState } from 'react';
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useSlackingStore, todayKey } from '../../store/slackingStore';
import { HOLIDAYS, SLACKING_LABEL_ICON, SLACKING_LABEL_TEXT } from '../../lib/constants';
import { effectiveHourlyRate } from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import type { TimeRecord, TimeRecordLabel } from '../../lib/types';
import { Pencil, X, Plus, Check, Moon, ArrowRight } from '@phosphor-icons/react';
import sharedStyles from '../DesktopRightPanel/DesktopRightPanel.module.css';
import sheetStyles from './TimeRecordSheet.module.css';

interface Props {
  /** 自定义标题(默认"时间记录") */
  title?: string;
}

/**
 * 收敛旧 label(toilet/meal → other)
 * v1.3.5:新增 'parttime' 支持
 */
function normalizeLabel(raw: string): { label: TimeRecordLabel; fallbackCustom?: string } {
  if (raw === 'slack' || raw === 'overtime' || raw === 'parttime' || raw === 'other') {
    return { label: raw };
  }
  const map: Record<string, string> = { toilet: '厕所', meal: '吃饭' };
  return { label: 'other', fallbackCustom: map[raw] };
}

function fmtMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseTimeToTs(dateKey: string, hhmm: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y!, m! - 1, d!, h ?? 0, mi ?? 0, 0).getTime();
}

export function RecordsPanel({ title = '时间记录' }: Props) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const removeSession = useSlackingStore((s) => s.removeSession);

  const dateKey = todayKey(now);
  const getSessionsByDate = useSlackingStore((s) => s.getSessionsByDate);
  const todaySessions = getSessionsByDate(dateKey);
  const hourly = effectiveHourlyRate(now, config, overrides, HOLIDAYS);

  const nightSessionCount = todaySessions.filter((s) => s.nightShift).length;

  const [editTarget, setEditTarget] = useState<TimeRecord | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className={sharedStyles.recordsPanel}>
      <div className={sharedStyles.recordsHeader}>
        <span className={sharedStyles.recordsTitle}>
          {title}
          {nightSessionCount > 0 && (
            <span className={sheetStyles.nightBadge} title="夜班自动标记(22:00-06:00)">
              <Moon size={11} weight="regular" />
              {nightSessionCount}
            </span>
          )}
        </span>
        <span className={sharedStyles.recordsCount}>{todaySessions.length} 条</span>
      </div>

      {todaySessions.length === 0 ? (
        <div className={sharedStyles.recordsEmpty}>
          暂无记录 · 点下方添加
          <ArrowRight size={11} weight="bold" style={{ verticalAlign: -1, marginLeft: 4 }} />
        </div>
      ) : (
        <div className={sharedStyles.recordsList}>
          {todaySessions.map((s) => {
            const dur = s.endTs !== null ? Math.floor((s.endTs - s.startTs) / 1000) : null;
            const normalized = normalizeLabel(s.label);
            const durSecForEarn = dur !== null ? dur : Math.max(0, Math.floor((now.getTime() - s.startTs) / 1000));
            const sessionEarn = s.label === 'slack' ? hourly * (durSecForEarn / 3600) : 0;
            return (
              <div key={s.id} className={sharedStyles.recordItem}>
                <span className={sharedStyles.recIcon}>
                  {SLACKING_LABEL_ICON[s.label as keyof typeof SLACKING_LABEL_ICON] ?? SLACKING_LABEL_ICON.other}
                </span>
                <div className={sharedStyles.recInfo}>
                  <div className={sharedStyles.recLabel}>
                    {normalized.label === 'other' && (s.customLabel || normalized.fallbackCustom)
                      ? (s.customLabel || normalized.fallbackCustom)
                      : SLACKING_LABEL_TEXT[s.label as keyof typeof SLACKING_LABEL_TEXT] ?? s.label}
                    {s.nightShift && <span title="夜班自动标记">🌙</span>}
                  </div>
                  <div className={sharedStyles.recTime}>
                    {new Date(s.startTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {s.endTs !== null
                      ? new Date(s.endTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                      : '进行中'}
                  </div>
                </div>
                <div className={sharedStyles.recRight}>
                  <span className={sharedStyles.recDuration}>
                    {dur !== null ? fmtMMSS(dur) : '--:--'}
                  </span>
                  {s.label === 'slack' && (
                    <span className={sharedStyles.recEarn}>
                      +¥{sessionEarn.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className={sharedStyles.recActions}>
                  <button
                    type="button"
                    className={sharedStyles.recBtn}
                    onClick={() => setEditTarget(s)}
                    aria-label="编辑"
                  >
                    <Pencil size={12} weight="regular" />
                  </button>
                  <button
                    type="button"
                    className={`${sharedStyles.recBtn} ${sharedStyles.recBtnDanger}`}
                    onClick={() => {
                      if (window.confirm('删除这条记录?')) removeSession(s.id);
                    }}
                    aria-label="删除"
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className={sharedStyles.addRecordBtn} onClick={() => setShowAdd(true)}>
        <Plus size={14} weight="bold" />
        添加记录
      </button>

      {/* Edit / Add sheet */}
      {(editTarget || showAdd) && (
        <TimeRecordSheet
          target={editTarget}
          dateKey={dateKey}
          onClose={() => {
            setEditTarget(null);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TimeRecordSheet — 编辑/添加弹窗(右栏内联渲染)
// ─────────────────────────────────────────────────────────────
function TimeRecordSheet({
  target,
  dateKey,
  onClose,
}: {
  target: TimeRecord | null;
  dateKey: string;
  onClose: () => void;
}) {
  const initNormalized = target ? normalizeLabel(target.label) : { label: 'slack' as TimeRecordLabel };
  const [label, setLabel] = useState<TimeRecordLabel>(initNormalized.label);
  const [customLabel, setCustomLabel] = useState(
    target?.customLabel ?? initNormalized.fallbackCustom ?? '',
  );
  const [start, setStart] = useState(() => {
    if (target) return toTimeStr(new Date(target.startTs));
    return '10:00';
  });
  const [end, setEnd] = useState(() => {
    if (target && target.endTs !== null) return toTimeStr(new Date(target.endTs));
    return '10:30';
  });

  const addPast = useSlackingStore((s) => s.addPastSession);
  const updateSession = useSlackingStore((s) => s.updateSession);

  const handleSave = () => {
    const startTs = parseTimeToTs(dateKey, start);
    const endTs = parseTimeToTs(dateKey, end);
    const payloadCustom = label === 'other' ? customLabel : undefined;
    if (target) {
      updateSession(target.id, {
        label,
        customLabel: payloadCustom,
        startTs,
        endTs,
      });
    } else {
      addPast(dateKey, label, startTs, endTs, payloadCustom);
    }
    onClose();
  };

  return (
    <div className={sheetStyles.overlay} onClick={onClose}>
      <div className={sheetStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={sheetStyles.handle} />
        <h3 className={sheetStyles.title}>{target ? '编辑记录' : '添加记录'}</h3>

        <div className={sheetStyles.label}>模式</div>
        <div className={sheetStyles.segmented}>
          {(['slack', 'overtime', 'parttime', 'other'] as TimeRecordLabel[]).map((l) => (
            <button
              key={l}
              type="button"
              className={`${sheetStyles.segmentedChip} ${label === l ? sheetStyles.segmentedChipActive : ''}`}
              onClick={() => setLabel(l)}
            >
              {SLACKING_LABEL_ICON[l]} {SLACKING_LABEL_TEXT[l]}
            </button>
          ))}
        </div>

        {label === 'other' && (
          <input
            type="text"
            className={sheetStyles.input}
            placeholder="自定义名称"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            maxLength={20}
          />
        )}

        <div className={sheetStyles.label}>开始 / 结束</div>
        <div className={sheetStyles.timeRow}>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={sheetStyles.input} />
          <span className={sheetStyles.dash}>–</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={sheetStyles.input} />
        </div>

        <div className={sheetStyles.buttons}>
          <button type="button" className={sheetStyles.save} onClick={handleSave}>
            <Check size={14} weight="bold" />
            保存
          </button>
          <button type="button" className={sheetStyles.cancel} onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}