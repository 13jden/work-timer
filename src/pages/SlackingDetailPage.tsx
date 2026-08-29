/**
 * SlackingDetailPage — 摸鱼详情页(v1.3 新增)
 *
 * 四区块:
 *   A · 仪表盘 2x2:总工时 / 午休扣除 / 摸鱼扣除 / 加班补偿
 *   B · 净工时 + 净时薪(深色卡)
 *   C · 摸鱼记录列表
 *   D · 公式说明
 */
import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useSlackingStore, todayKey } from '../store/slackingStore';
import { HOLIDAYS, SLACKING_LABEL_ICON, SLACKING_LABEL_TEXT } from '../lib/constants';
import {
  computeNetHours,
  todayEarned,
  effectiveHourlyRate,
  totalSegmentsMinutes,
  getEffectiveSegments,
} from '../lib/compute';
import { useNow } from '../hooks/useNow';
import type { SlackingLabel, SlackingSession } from '../lib/types';
import styles from './SlackingDetailPage.module.css';

function fmtHoursMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}m`;
}

interface Props {
  /** 返回回调 */
  onBack?: () => void;
}

export function SlackingDetailPage({ onBack }: Props) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const sessions = useSlackingStore((s) => s.sessions);
  const removeSession = useSlackingStore((s) => s.removeSession);

  const dateKey = todayKey(now);
  const todaySessions = sessions[dateKey] ?? [];

  // 净工时
  const net = useMemo(() => computeNetHours({
    date: now,
    config,
    overrides,
    holidays: HOLIDAYS,
    slackingSessions: todaySessions,
  }), [now, config, overrides, todaySessions]);

  const earned = useMemo(() => todayEarned(now, config, overrides, HOLIDAYS), [now, config, overrides]);
  const hourly = useMemo(() => effectiveHourlyRate(now, config, overrides, HOLIDAYS), [now, config, overrides]);

  const netHourly = net.netMinutes > 0 ? earned / (net.netMinutes / 60) : 0;

  // 加班补偿明细
  const [showCompPopup, setShowCompPopup] = useState(false);
  const entry = overrides[dateKey] ?? null;
  const isOvertime = entry?.type === 'paid_overtime';
  const overtimeMin = isOvertime ? net.grossMinutes : 0;
  const overtimeMul = entry?.multiplier ?? 1;
  const nightMin = net.nightShiftFlag ? (() => {
    const segs = getEffectiveSegments(config, entry);
    return totalSegmentsMinutes(segs) === 0
      ? 0
      : Math.round(net.nightBonus / 0.5);
  })() : 0;

  const [editTarget, setEditTarget] = useState<SlackingSession | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className={styles.page}>
      {onBack && (
        <button type="button" className={styles.back} onClick={onBack}>
          ← 返回
        </button>
      )}

      {/* ── Page head ── */}
      <div className={styles.head}>
        <div className={styles.eyebrow}>Net Work Hours</div>
        <h1 className={styles.title}>净工时详情</h1>
      </div>

      {/* ── A · 2x2 dashboard ── */}
      <div className={styles.dashboard}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>总工时</div>
          <div className={styles.cardValue}>{fmtHoursMin(net.grossMinutes)}</div>
        </div>
        <div className={`${styles.card} ${net.lunchMinutes > 0 ? styles.negative : ''}`}>
          <div className={styles.cardLabel}>午休扣除</div>
          <div className={styles.cardValue}>
            {net.lunchMinutes > 0 ? `−${fmtHoursMin(net.lunchMinutes)}` : '0h'}
          </div>
        </div>
        <div className={`${styles.card} ${net.slackingMinutes > 0 ? styles.negative : ''}`}>
          <div className={styles.cardLabel}>摸鱼扣除</div>
          <div className={styles.cardValue}>
            {net.slackingMinutes > 0 ? `−${fmtHoursMin(net.slackingMinutes)}` : '0h'}
          </div>
        </div>
        <div
          className={`${styles.card} ${styles.clickable} ${net.overtimeBonus + net.nightBonus > 0 ? styles.positive : ''}`}
          onClick={() => setShowCompPopup((v) => !v)}
        >
          <div className={styles.cardLabel}>加班补偿</div>
          <div className={styles.cardValue}>
            +{fmtHoursMin(net.overtimeBonus + net.nightBonus)}
          </div>
          {showCompPopup && (net.overtimeBonus + net.nightBonus > 0) && (
            <div className={styles.popup}>
              {overtimeMin > 0 && (
                <div className={styles.popupRow}>
                  <span>📈</span>
                  <span>加班 {overtimeMin} min × {overtimeMul}</span>
                </div>
              )}
              {nightMin > 0 && (
                <div className={styles.popupRow}>
                  <span>🌙</span>
                  <span>夜班 {nightMin}min × 0.5 身体补偿</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── B · summary bar ── */}
      <div className={styles.summary}>
        <div className={styles.sumItem}>
          <div className={styles.sumLabel}>净工时</div>
          <div className={styles.sumValue}>{fmtHoursMin(net.netMinutes)}</div>
        </div>
        <div className={styles.sumItem}>
          <div className={styles.sumLabel}>净时薪</div>
          <div className={styles.sumValue}>¥{netHourly.toFixed(2)}/h</div>
        </div>
      </div>

      {/* ── C · 记录列表 ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>今日摸鱼记录</div>
        {todaySessions.length === 0 ? (
          <div className={styles.empty}>暂无摸鱼记录</div>
        ) : (
          todaySessions.map((s) => {
            const dur = s.endTs !== null ? Math.floor((s.endTs - s.startTs) / 1000) : null;
            return (
              <div key={s.id} className={styles.record}>
                <span className={styles.recIcon}>
                  {SLACKING_LABEL_ICON[s.label]}
                </span>
                <div className={styles.recInfo}>
                  <div className={styles.recLabel}>
                    {s.label === 'other' && s.customLabel ? s.customLabel : SLACKING_LABEL_TEXT[s.label]}
                  </div>
                  <div className={styles.recTime}>
                    {new Date(s.startTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {s.endTs !== null
                      ? new Date(s.endTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                      : '进行中'}
                  </div>
                </div>
                <span className={styles.recDuration}>
                  {dur !== null ? fmtMMSS(dur) : '--:--'}
                </span>
                <div className={styles.recActions}>
                  <button
                    type="button"
                    className={styles.recBtn}
                    onClick={() => setEditTarget(s)}
                    aria-label="编辑"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={`${styles.recBtn} ${styles.recBtnDanger}`}
                    onClick={() => {
                      if (window.confirm('删除这条摸鱼记录?')) removeSession(s.id);
                    }}
                    aria-label="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
        <button type="button" className={styles.addBtn} onClick={() => setShowAdd(true)}>
          ＋ 添加记录
        </button>
      </div>

      {/* ── D · 公式说明 ── */}
      <div className={styles.formula}>
        净时薪 = 今日已赚 ÷ (总工时 − 摸鱼∪午休 + 加班补偿)
      </div>

      {/* ── 编辑 / 添加 sheet(占位实现,后续可拆为独立组件) ── */}
      {(editTarget || showAdd) && (
        <SlackingRecordSheet
          target={editTarget}
          dateKey={dateKey}
          onClose={() => {
            setEditTarget(null);
            setShowAdd(false);
          }}
        />
      )}

      <div className={styles.historyHint}>
        周/月汇总 · 下期开放
      </div>

      <div className={styles.footer}>
        当前基础时薪 ¥{hourly.toFixed(2)}/h · 累计今日已赚 ¥{earned.toFixed(2)}
      </div>
    </div>
  );
}

function fmtMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// inline SlackingRecordSheet(简化版:label + start/end time)
// ─────────────────────────────────────────────────────────────
function SlackingRecordSheet({
  target,
  dateKey,
  onClose,
}: {
  target: SlackingSession | null;
  dateKey: string;
  onClose: () => void;
}) {
  const [label, setLabel] = useState<SlackingLabel>(target?.label ?? 'slack');
  const [customLabel, setCustomLabel] = useState(target?.customLabel ?? '');
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
    if (target) {
      updateSession(target.id, { label, customLabel: label === 'other' ? customLabel : undefined, startTs, endTs });
    } else {
      addPast(dateKey, label, startTs, endTs, label === 'other' ? customLabel : undefined);
    }
    onClose();
  };

  return (
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} />
        <h3 className={styles.sheetTitle}>{target ? '编辑摸鱼记录' : '添加摸鱼记录'}</h3>

        <div className={styles.sheetLabel}>类型</div>
        <div className={styles.sheetLabelGroup}>
          {(['toilet', 'slack', 'meal', 'other'] as SlackingLabel[]).map((l) => (
            <button
              key={l}
              type="button"
              className={`${styles.sheetRadio} ${label === l ? styles.sheetRadioActive : ''}`}
              onClick={() => setLabel(l)}
            >
              <span className={styles.sheetRadioDot} />
              <span>{SLACKING_LABEL_ICON[l]} {SLACKING_LABEL_TEXT[l]}</span>
            </button>
          ))}
        </div>

        {label === 'other' && (
          <input
            type="text"
            className={styles.sheetInput}
            placeholder="自定义名称"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            maxLength={20}
          />
        )}

        <div className={styles.sheetLabel}>开始 / 结束</div>
        <div className={styles.sheetTimeRow}>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={styles.sheetInput} />
          <span className={styles.sheetDash}>–</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={styles.sheetInput} />
        </div>

        <div className={styles.sheetButtons}>
          <button type="button" className={styles.sheetSave} onClick={handleSave}>
            保存
          </button>
          <button type="button" className={styles.sheetCancel} onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseTimeToTs(dateKey: string, hhmm: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y!, m! - 1, d!, h ?? 0, mi ?? 0, 0).getTime();
}