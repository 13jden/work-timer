/**
 * TimeTrackerDetailPage — 时间记录详情页
 *
 * v1.3.3 重命名自 SlackingDetailPage。
 *
 * 关键变化:
 *   - 模式选择器 segmented:「摸鱼」「加班」「其他」(默认「摸鱼」)
 *   - 标签跟随 segmented 切换(写回 session.label)
 *   - 夜班自动标记 badge:从 session.nightShift 字段读取
 *   - 旧 toilet/meal 标签仍可在详情页编辑,保存时自动转 other
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
  slackingEarn,
  overtimeSessionSplit,
} from '../lib/compute';
import { useNow } from '../hooks/useNow';
import type { TimeRecord, TimeRecordLabel } from '../lib/types';
import { ArrowLeft, ChartLineUp, Moon, Pencil, X, Plus, Check } from '@phosphor-icons/react';
import styles from './SlackingDetailPage.module.css';

function fmtHoursMin(min: number): string {
  // v1.3.4-patch1 修复:netMinutes/grossMinutes 等字段是浮点数(由 elapsedWorkedMin × 比例产生),
  //   直接 Math.floor(min/60) + Math.round(min%60) 在 [239.5, 240) 范围会算出 h=3, m=60,
  //   显示成 "3h60m" 这种不可能的时间。先 round 到整数再拆,杜绝 m=60 的情况。
  const totalMin = Math.round(min);
  const h = Math.floor(totalMin / 60);
  const m = totalMin - h * 60; // 等价 totalMin % 60,但输入已是整数,不会出现 60
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}m`;
}

interface Props {
  /** 返回回调 */
  onBack?: () => void;
}

/**
 * v1.3.3:把任意旧 label 收敛到 TimeRecordLabel
 * - toilet/meal → 'other' + 用 original label 作为 customLabel 默认值
 * v1.3.5:新增 'parttime' 支持
 */
function normalizeLabel(raw: string): { label: TimeRecordLabel; fallbackCustom?: string } {
  if (raw === 'slack' || raw === 'overtime' || raw === 'parttime' || raw === 'other') {
    return { label: raw };
  }
  // 旧 toilet/meal 转 other
  const map: Record<string, string> = { toilet: '厕所', meal: '吃饭' };
  return { label: 'other', fallbackCustom: map[raw] };
}

export function TimeTrackerDetailPage({ onBack }: Props) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const getSessionsByDate = useSlackingStore((s) => s.getSessionsByDate);
  const removeSession = useSlackingStore((s) => s.removeSession);

  const dateKey = todayKey(now);
  const todaySessions = getSessionsByDate(dateKey);

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

  // v1.3.3:摸鱼总薪资(按 effectiveHourlyRate × 摸鱼时长,进行中实时)
  const slackingTotal = useMemo(
    () => slackingEarn(todaySessions, hourly, now.getTime()),
    [todaySessions, hourly, now],
  );

  // 加班补偿明细
  const [showCompPopup, setShowCompPopup] = useState(false);
  const entry = overrides[dateKey] ?? null;
  const overtimeMul = entry?.multiplier ?? 1;
  // v1.3.3 patch4:加班卡片分钟数 = 用户手动添加的「加班」session 总分钟数
  // v1.3.3 patch6:拆分为 dayMin / nightMin,popup 显示「日间 × multiplier + 夜班 × multiplier × 1.5」
  // v1.3.4-patch2:dashboard 4 卡「加班」显示 net.overtimeElapsed(用户 session 累计,含进行中),
  //   popup 拆分明细复用 userOvertimeDayMin/NightMin
  const otSplit = useMemo(
    () => overtimeSessionSplit(todaySessions, now.getTime()),
    [todaySessions, now],
  );
  const userOvertimeDayMin = Math.round(otSplit.dayMin);
  const userOvertimeNightMin = Math.round(otSplit.nightMin);

  // v1.3.3:夜班 session 数(用于 badge)
  const nightSessionCount = todaySessions.filter((s) => s.nightShift).length;

  const [editTarget, setEditTarget] = useState<TimeRecord | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month'>('day');

  return (
    <div className={styles.page}>
      {onBack && (
        <button type="button" className={styles.back} onClick={onBack}>
          <ArrowLeft size={14} weight="bold" />
          返回
        </button>
      )}

      {/* ── 日/周/月 tab(占满一行的 segmented control) ── */}
      <div className={styles.segmentedWrapper}>
        <div className={styles.segmented}>
          <button
            type="button"
            className={`${styles.segmentedChip} ${activeTab === 'day' ? styles.segmentedChipActive : ''}`}
            onClick={() => setActiveTab('day')}
          >
            日
          </button>
          <button
            type="button"
            className={`${styles.segmentedChip} ${activeTab === 'week' ? styles.segmentedChipActive : ''}`}
            onClick={() => setActiveTab('week')}
          >
            周
          </button>
          <button
            type="button"
            className={`${styles.segmentedChip} ${activeTab === 'month' ? styles.segmentedChipActive : ''}`}
            onClick={() => setActiveTab('month')}
          >
            月
          </button>
        </div>
      </div>

      {activeTab === 'day' && (
        <>
          {/* ── A · 2x2 dashboard · v1.3.4-patch2 实时累计 ── */}
          <div className={styles.dashboard}>
            <div className={styles.card}>
              {/* v1.3.4-patch4:总工时实时累计(grossElapsed),与净工时同节奏
                  用户语义:"10:00 已工作 1h,总工时 1h;净工时=总工时+加班-午休-摸鱼 一样实时"
                  即 4 卡全部实时:已工作 / 已发生午休 / 已发生摸鱼 / 已发生加班,
                  净工时 = grossElapsed - 已发生摸鱼∪午休 + 加班 + 夜班(实时扣除) */}
              <div className={styles.cardLabel}>总工时</div>
              <div className={styles.cardValue}>{fmtHoursMin(net.grossElapsed)}</div>
            </div>
            <div className={`${styles.card} ${net.lunchElapsed > 0 ? styles.positive : ''}`}>
              <div className={styles.cardLabel}>午休扣除</div>
              <div className={styles.cardValue}>
                {net.lunchElapsed > 0 ? `−${fmtHoursMin(net.lunchElapsed)}` : '0h'}
              </div>
            </div>
            <div className={`${styles.card} ${net.slackingElapsed > 0 ? styles.positive : ''}`}>
              <div className={styles.cardLabel}>摸鱼扣除</div>
              <div className={styles.cardValue}>
                {net.slackingElapsed > 0 ? `−${fmtHoursMin(net.slackingElapsed)}` : '0h'}
              </div>
            </div>
            <div
              className={`${styles.card} ${styles.clickable} ${net.overtimeElapsed > 0 ? styles.negative : ''}`}
              onClick={() => setShowCompPopup((v) => !v)}
            >
              <div className={styles.cardLabel}>加班</div>
              <div className={styles.cardValue}>
                +{fmtHoursMin(net.overtimeElapsed)}
              </div>
              {showCompPopup && net.overtimeElapsed > 0 && (userOvertimeDayMin + userOvertimeNightMin > 0) && (
                <div className={styles.popup}>
                  {userOvertimeDayMin > 0 && (
                    <div className={styles.popupRow}>
                      <ChartLineUp size={14} weight="bold" />
                      <span>加班(日){fmtHoursMin(userOvertimeDayMin)} × {overtimeMul}</span>
                    </div>
                  )}
                  {userOvertimeNightMin > 0 && (
                    <div className={styles.popupRow}>
                      <Moon size={14} weight="regular" />
                      <span>加班(夜){fmtHoursMin(userOvertimeNightMin)} × {overtimeMul} × 1.5</span>
                    </div>
                  )}
                  {userOvertimeDayMin > 0 && userOvertimeNightMin > 0 && (
                    <div className={`${styles.popupRow} ${styles.popupRowTotal}`}>
                      <span>= {fmtHoursMin(userOvertimeDayMin)} + {fmtHoursMin(userOvertimeNightMin)} × 1.5</span>
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

          {/* ── B2 · 摸鱼薪资(按 effectiveHourlyRate × 摸鱼时长) ── */}
          <div className={styles.slackingEarn}>
            <div className={styles.slackingEarnLeft}>
              <div className={styles.slackingEarnLabel}>摸鱼总薪资</div>
              <div className={styles.slackingEarnHint}>
                按 ¥{hourly.toFixed(2)}/h × 摸鱼时长
              </div>
            </div>
            <div className={`${styles.slackingEarnValue} ${slackingTotal > 0 ? styles.slackingEarnRunning : ''}`}>
              {slackingTotal > 0 ? `+¥${slackingTotal.toFixed(2)}` : '¥0.00'}
            </div>
          </div>

          {/* ── C · 记录列表 ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              今日记录
              {nightSessionCount > 0 && (
                <span className={styles.nightBadge} title="夜班自动标记(22:00-06:00)">
                  <Moon size={11} weight="regular" />
                  夜班 {nightSessionCount}
                </span>
              )}
            </div>
            {todaySessions.length === 0 ? (
              <div className={styles.empty}>暂无记录</div>
            ) : (
              todaySessions.map((s) => {
                const dur = s.endTs !== null ? Math.floor((s.endTs - s.startTs) / 1000) : null;
                const normalized = normalizeLabel(s.label);
                // v1.3.3 patch2:仅摸鱼 session 显示对应的摸鱼薪资(进行中按 now 实时计算)
                const durSecForEarn = dur !== null ? dur : Math.max(0, Math.floor((now.getTime() - s.startTs) / 1000));
                const sessionEarn = s.label === 'slack'
                  ? hourly * (durSecForEarn / 3600)
                  : 0;
                return (
                  <div key={s.id} className={styles.record}>
                    <span className={styles.recIcon}>
                      {SLACKING_LABEL_ICON[s.label as keyof typeof SLACKING_LABEL_ICON] ?? SLACKING_LABEL_ICON.other}
                    </span>
                    <div className={styles.recInfo}>
                      <div className={styles.recLabel}>
                        {normalized.label === 'other' && (s.customLabel || normalized.fallbackCustom)
                          ? (s.customLabel || normalized.fallbackCustom)
                          : SLACKING_LABEL_TEXT[s.label as keyof typeof SLACKING_LABEL_TEXT] ?? s.label}
                        {s.nightShift && (
                          <span className={styles.nightDot} title="夜班自动标记"> 🌙</span>
                        )}
                      </div>
                      <div className={styles.recTime}>
                        {new Date(s.startTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {s.endTs !== null
                          ? new Date(s.endTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                          : '进行中'}
                      </div>
                    </div>
                    <div className={styles.recRight}>
                      <span className={styles.recDuration}>
                        {dur !== null ? fmtMMSS(dur) : '--:--'}
                      </span>
                      {s.label === 'slack' && (
                        <span className={styles.recEarn}>
                          +¥{sessionEarn.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className={styles.recActions}>
                      <button
                        type="button"
                        className={styles.recBtn}
                        onClick={() => setEditTarget(s)}
                        aria-label="编辑"
                      >
                        <Pencil size={12} weight="regular" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.recBtn} ${styles.recBtnDanger}`}
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
              })
            )}
            <button type="button" className={styles.addBtn} onClick={() => setShowAdd(true)}>
              <Plus size={14} weight="bold" />
              添加记录
            </button>
          </div>

          {/* ── D · 公式说明 ── */}
          <div className={styles.formula}>
            净时薪 = 今日已赚 ÷ (总工时 − 时间记录∪午休 + 加班补偿)
          </div>

          <div className={styles.footer}>
            当前基础时薪 ¥{hourly.toFixed(2)}/h · 累计今日已赚 ¥{earned.toFixed(2)}
          </div>
        </>
      )}

      {activeTab === 'week' && (
        <div className={styles.comingSoon}>周统计 · 下期开放</div>
      )}

      {activeTab === 'month' && (
        <div className={styles.comingSoon}>月统计 · 下期开放</div>
      )}

      {/* ── 编辑 / 添加 sheet(占位实现,后续可拆为独立组件) ── */}
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

function fmtMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// inline TimeRecordSheet(v1.3.3:segmented「摸鱼/加班/其他」)
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
    try {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败';
      alert(msg);
    }
  };

  return (
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} />
        <h3 className={styles.sheetTitle}>{target ? '编辑记录' : '添加记录'}</h3>

        <div className={styles.sheetLabel}>模式</div>
        <div className={styles.sheetSegmented}>
          {(['slack', 'overtime', 'parttime', 'other'] as TimeRecordLabel[]).map((l) => (
            <button
              key={l}
              type="button"
              className={`${styles.sheetSegmentedChip} ${label === l ? styles.sheetSegmentedChipActive : ''}`}
              onClick={() => setLabel(l)}
            >
              {SLACKING_LABEL_ICON[l]} {SLACKING_LABEL_TEXT[l]}
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
            <Check size={14} weight="bold" />
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
