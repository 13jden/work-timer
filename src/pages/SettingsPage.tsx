/**
 * SettingsPage — 设置页(Mine)
 *
 * v1.3 扩展:
 *   - 薪资模式 segmented(按月/时/日结)
 *   - 多段工时 SegmentsEditor
 *   - 午休配置组
 *
 * 布局匹配 index.html:
 *   page-head (Preferences / 设置)
 *   薪资 · Salary   → segmented + 月薪/时薪/日薪 + 当月工作日
 *   时间 · Hours    → SegmentsEditor / 休息模式
 *   午休 · Lunch   → 启用/开始/时长
 *   换算 · Convert  → 咖啡默认单价
 *   主题 · Theme    → 配色圆点
 *   月度记录 · Salary History → 快照列表
 *   footer → v本地存储
 */
import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useThemeStore, THEME_LIST } from '../store/themeStore';
import { useMonthlyStore } from '../store/monthlyStore';
import { HOLIDAYS } from '../lib/constants';
import { workdaysInMonth } from '../lib/compute';
import { useNow } from '../hooks/useNow';
import type { Config, WorkSegment, SalaryMode } from '../lib/types';
import type { ThemeMeta } from '../lib/constants';
import { SegmentedControl } from '../components/SegmentedControl';
import { SegmentsEditor } from '../components/SegmentsEditor';
import styles from './SettingsPage.module.css';

const MONTH_NAMES_CN = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

export function SettingsPage() {
  const config = useConfigStore();
  const setConfig = useConfigStore((s) => s.setConfig);
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const getAllSnapshots = useMonthlyStore((s) => s.getAllSnapshots);
  const now = useNow(60_000);

  // ── 本地草稿 ─────────────────────────────────────────────
  type Draft = {
    monthlySalary: number;
    startTime: string;
    endTime: string;
    coffeePrice: number;
    restMode: 0 | 1 | 2;
    theme: ThemeMeta['id'];
    // v1.3
    salaryMode: SalaryMode;
    manualHourlyRate: number;
    manualDailyRate: number;
    segments: WorkSegment[] | null;
    lunchEnabled: boolean;
    lunchStart: string;
    lunchMinutes: number;
  };

  const [draft, setDraft] = useState<Draft>(() => ({
    monthlySalary: config.monthlySalary,
    startTime: config.startTime,
    endTime: config.endTime,
    coffeePrice: config.coffeePrice,
    restMode: config.restMode,
    theme: currentTheme,
    salaryMode: config.salaryMode,
    manualHourlyRate: config.manualHourlyRate,
    manualDailyRate: config.manualDailyRate,
    segments: config.segments,
    lunchEnabled: config.lunchEnabled,
    lunchStart: config.lunchStart,
    lunchMinutes: config.lunchMinutes,
  }));

  const isDirty = useMemo<boolean>(() => (
    draft.monthlySalary !== config.monthlySalary ||
    draft.startTime !== config.startTime ||
    draft.endTime !== config.endTime ||
    draft.coffeePrice !== config.coffeePrice ||
    draft.restMode !== config.restMode ||
    draft.theme !== currentTheme ||
    draft.salaryMode !== config.salaryMode ||
    draft.manualHourlyRate !== config.manualHourlyRate ||
    draft.manualDailyRate !== config.manualDailyRate ||
    JSON.stringify(draft.segments) !== JSON.stringify(config.segments) ||
    draft.lunchEnabled !== config.lunchEnabled ||
    draft.lunchStart !== config.lunchStart ||
    draft.lunchMinutes !== config.lunchMinutes
  ), [draft, config, currentTheme]);

  // 当月工作日预览
  const workdays = useMemo(
    () => workdaysInMonth(
      now.getFullYear(), now.getMonth(),
      { ...config, restMode: draft.restMode, segments: draft.segments, salaryMode: draft.salaryMode } as Config,
      overrides, HOLIDAYS,
    ),
    [now, config, draft.restMode, draft.segments, draft.salaryMode, overrides],
  );

  const snapshots = useMemo(() => {
    const list = getAllSnapshots();
    return list.slice().sort((a, b) => b.key.localeCompare(a.key));
  }, [getAllSnapshots]);

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 当前 SegmentsEditor 的值(null = 单段 fallback)
  const editorSegments = draft.segments ?? [{ start: draft.startTime, end: draft.endTime }];

  const handleSave = () => {
    setConfig({
      monthlySalary: draft.monthlySalary,
      startTime: draft.startTime,
      endTime: draft.endTime,
      coffeePrice: draft.coffeePrice,
      restMode: draft.restMode,
      salaryMode: draft.salaryMode,
      manualHourlyRate: draft.manualHourlyRate,
      manualDailyRate: draft.manualDailyRate,
      segments: draft.segments,
      lunchEnabled: draft.lunchEnabled,
      lunchStart: draft.lunchStart,
      lunchMinutes: draft.lunchMinutes,
    });
    if (draft.theme !== currentTheme) {
      setTheme(draft.theme);
    }
    const el = document.querySelector<HTMLElement>('.' + styles.saveBtn);
    if (el) {
      el.textContent = '已保存 ✓';
      window.setTimeout(() => {
        if (el && el.textContent !== '保存配置') el.textContent = '保存配置';
      }, 1200);
    }
  };

  return (
    <div className={styles.wrap}>

      {/* ═══ page-head ═══ */}
      <div className={styles.pageHead}>
        <div className={styles.eyebrow}>Preferences</div>
        <h2 className={styles.pageTitle}>设置</h2>
      </div>

      {/* ═══ 薪资 · Salary ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>薪资 · Salary</div>
        <div className={styles.card}>
          {/* Segmented salary mode */}
          <div style={{ padding: '10px 14px 6px' }}>
            <SegmentedControl
              options={[
                { value: 'monthly', label: '按月结' },
                { value: 'hourly', label: '按时结' },
                { value: 'daily', label: '按日结' },
              ]}
              value={draft.salaryMode}
              onChange={(v) => setDraft((d) => ({ ...d, salaryMode: v as SalaryMode }))}
            />
          </div>

          {draft.salaryMode === 'monthly' && (
            <div className={styles.row}>
              <span className={styles.label}>月薪</span>
              <span className={styles.value}>
                <span className={styles.prefix}>¥</span>
                <input
                  type="number"
                  className={styles.input}
                  value={draft.monthlySalary}
                  onChange={(e) => setDraft((d) => ({ ...d, monthlySalary: Number(e.target.value) || 0 }))}
                  min={0}
                />
              </span>
            </div>
          )}

          {draft.salaryMode === 'hourly' && (
            <div className={styles.row}>
              <span className={styles.label}>时薪</span>
              <span className={styles.value}>
                <span className={styles.prefix}>¥</span>
                <input
                  type="number"
                  className={styles.input}
                  value={draft.manualHourlyRate}
                  onChange={(e) => setDraft((d) => ({ ...d, manualHourlyRate: Number(e.target.value) || 0 }))}
                  min={0}
                />
              </span>
            </div>
          )}

          {draft.salaryMode === 'daily' && (
            <div className={styles.row}>
              <span className={styles.label}>日薪</span>
              <span className={styles.value}>
                <span className={styles.prefix}>¥</span>
                <input
                  type="number"
                  className={styles.input}
                  value={draft.manualDailyRate}
                  onChange={(e) => setDraft((d) => ({ ...d, manualDailyRate: Number(e.target.value) || 0 }))}
                  min={0}
                />
              </span>
            </div>
          )}

          <div className={styles.row}>
            <span className={styles.label}>当月工作日</span>
            <span className={styles.value}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontSize: 13 }}>
                {workdays}
              </span>
              <span className={styles.suffix}>天</span>
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 时间 · Hours ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>时间 · Hours</div>
        <div className={styles.card}>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ font: '400 13px var(--font-sans)', color: 'var(--ink)', marginBottom: 8 }}>
              多段工时
            </div>
            <SegmentsEditor
              segments={editorSegments}
              onChange={(segs) => {
                // null = 和 startTime/endTime 一致(单段),非 null = 自定义
                const isSingle = segs.length === 1
                  && segs[0]!.start === '09:00'
                  && segs[0]!.end === '18:00';
                setDraft((d) => ({
                  ...d,
                  segments: isSingle ? null : segs,
                  startTime: segs[0]!.start,
                  endTime: segs[0]!.end,
                }));
              }}
              showTotal
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>休息模式</span>
            {draft.salaryMode === 'monthly' ? (
              <span className={styles.value}>
                <select
                  className={styles.select}
                  value={draft.restMode}
                  onChange={(e) => setDraft((d) => ({ ...d, restMode: Number(e.target.value) as 0 | 1 | 2 }))}
                >
                  <option value={0}>无休</option>
                  <option value={1}>单休</option>
                  <option value={2}>双休</option>
                </select>
                <span className={styles.chevron}>›</span>
              </span>
            ) : (
              <span className={styles.value} style={{ color: 'var(--muted-2)', fontSize: 12 }}>
                disabled · 到日历页勾选当日
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 午休 · Lunch ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>午休 · Lunch Break</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>启用午休</span>
            <button
              type="button"
              className={`${styles.toggle} ${draft.lunchEnabled ? styles.toggleOn : ''}`}
              onClick={() => setDraft((d) => ({ ...d, lunchEnabled: !d.lunchEnabled }))}
              aria-label="启用午休"
            />
          </div>
          {draft.lunchEnabled && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>午休开始</span>
                <span className={styles.value}>
                  <input
                    type="time"
                    className={styles.input}
                    value={draft.lunchStart}
                    onChange={(e) => setDraft((d) => ({ ...d, lunchStart: e.target.value }))}
                    style={{ width: 90, textAlign: 'right', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 4px' }}
                  />
                </span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>午休时长</span>
                <span className={styles.value}>
                  <input
                    type="number"
                    className={styles.input}
                    value={draft.lunchMinutes}
                    onChange={(e) => setDraft((d) => ({ ...d, lunchMinutes: Math.max(15, Math.min(240, Number(e.target.value) || 60)) }))}
                    min={15}
                    max={240}
                    step={15}
                    style={{ width: 70 }}
                  />
                  <span className={styles.suffix}>分钟</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ 换算 · Convert ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>换算 · Convert</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>咖啡默认单价</span>
            <span className={styles.value}>
              <span className={styles.prefix}>¥</span>
              <input
                type="number"
                className={styles.input}
                value={draft.coffeePrice}
                onChange={(e) => setDraft((d) => ({ ...d, coffeePrice: Number(e.target.value) || 0 }))}
                min={0}
              />
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 主题 · Theme ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>主题 · Theme</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>配色方案</span>
            <span className={styles.value} style={{ gap: 10 }}>
              {THEME_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.label}
                  className={`${styles.swatch} ${draft.theme === t.id ? styles.swatchActive : ''}`}
                  style={{ background: t.accent }}
                  onClick={() => setDraft((d) => ({ ...d, theme: t.id }))}
                />
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 月度记录 · Salary History ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>月度记录 · Salary History</div>
        <div className={styles.card}>
          {snapshots.length === 0 ? (
            <div className={styles.historyEmpty}>
              暂无月度记录
              <span>到「Month」页点击「已赚」卡片生成</span>
            </div>
          ) : (
            snapshots.map((s) => {
              const parts = s.key.split('-');
              const y = Number(parts[0] ?? now.getFullYear());
              const mRaw = Number(parts[1] ?? (now.getMonth() + 1));
              const m = isNaN(mRaw) ? (now.getMonth() + 1) : mRaw;
              const isCurrent = s.key === currentMonthKey;
              return (
                <div key={s.key} className={styles.row}>
                  <span className={styles.label}>
                    {y}年 {MONTH_NAMES_CN[(m - 1 + 12) % 12]}
                  </span>
                  <span className={styles.value}>
                    <span className={styles.historyAmount}>
                      ¥{Math.round(s.salary / Math.max(s.workDays, 1) * s.workDays).toLocaleString('en-US')}
                    </span>
                    <span className={styles.historyDays}>· {s.workDays}天</span>
                    {isCurrent ? (
                      <span className={styles.historyBadgeCurrent}>本月</span>
                    ) : (
                      <span className={styles.historyBadgeLocked}>已锁定</span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ 保存配置按钮 ═══ */}
      <button
        type="button"
        className={`${styles.saveBtn} ${isDirty ? styles.saveBtnDirty : ''}`}
        onClick={handleSave}
        disabled={!isDirty}
      >
        保存配置
      </button>

      <div className={styles.footer}>v1.3 · 本地存储</div>
    </div>
  );
}
