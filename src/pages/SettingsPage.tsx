/**
 * SettingsPage — 设置页(Mine)
 *
 * v1.3.5 重构:
 *   - 删除旧的 SegmentTemplate（多时段）系统
 *   - 改用 WorkTemplate（单时段）作为工时模板
 *   - 工时模板编辑用弹窗形式
 *   - 自定义排班入口保留，供后续日历编辑页使用
 */
import { useEffect, useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useThemeStore, THEME_LIST } from '../store/themeStore';
import { useMonthlyStore } from '../store/monthlyStore';
import { useMonthlyGoalStore } from '../store/monthlyGoalStore';
import { HOLIDAYS, TEMPLATE_COLORS } from '../lib/constants';
import { workdaysInMonth, daysInMonthCalc } from '../lib/compute';
import { formatDateKey } from '../lib/time';
import { useNow } from '../hooks/useNow';
import type { Config, WorkSegment, SalaryMode, WorkTemplate } from '../lib/types';
import type { ThemeMeta } from '../lib/constants';
import { SegmentedControl } from '../components/SegmentedControl';
import { TemplateEditor } from '../components/TemplateEditor';
import {
  CaretRight,
  X,
  CaretDown,
  Gear,
  Coffee,
  Palette,
  ClockCounterClockwise,
  Target,
} from '@phosphor-icons/react';
import styles from './SettingsPage.module.css';

const MONTH_NAMES_CN = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

function uuid(): string {
  return 'tpl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function SettingsPage() {
  const config = useConfigStore();
  const setConfig = useConfigStore((s) => s.setConfig);
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const getAllSnapshots = useMonthlyStore((s) => s.getAllSnapshots);
  // v1.3.4-patch2:桌面端侧栏月度收入进度的目标编辑入口
  const monthlyGoal = useMonthlyGoalStore((s) => s.monthlyGoal);
  const setMonthlyGoal = useMonthlyGoalStore((s) => s.setGoal);
  const now = useNow(60_000);

  // ── 本地草稿 ─────────────────────────────────────────────
  type Draft = {
    monthlySalary: number;
    startTime: string;
    endTime: string;
    coffeePrice: number;
    restMode: 0 | 1 | 2 | 'custom';
    theme: ThemeMeta['id'];
    salaryMode: SalaryMode;
    manualHourlyRate: number;
    manualDailyRate: number;
    lunchEnabled: boolean;
    lunchStart: string;
    lunchMinutes: number;
    monthlyGoal: number | null;
    customRestSchedule: Config['customRestSchedule'];
    workTemplates: WorkTemplate[];
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
    lunchEnabled: config.lunchEnabled,
    lunchStart: config.lunchStart,
    lunchMinutes: config.lunchMinutes,
    monthlyGoal,
    customRestSchedule: config.customRestSchedule ?? null,
    workTemplates: config.workTemplates ?? [],
  }));

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [restCalendarOpen, setRestCalendarOpen] = useState(false);
  const [restCalendarMonth, setRestCalendarMonth] = useState(() => new Date());
  // v1.3.5:第一个模板就是默认/全局工时。跟随 workTemplates[0] 重新计算,
  // 用户增删模板后仍指向有效 id（且不会被「继承全局」这种哑选项污染）。
  const firstTemplateId = draft.workTemplates[0]?.id ?? '';
  const [restTemplateId, setRestTemplateId] = useState<string>(firstTemplateId);

  // workTemplates[0] 切换（新建/删除首个）时把选中 id 同步过去
  useEffect(() => {
    if (!draft.workTemplates.some((t) => t.id === restTemplateId)) {
      setRestTemplateId(firstTemplateId);
    }
  }, [draft.workTemplates, restTemplateId, firstTemplateId]);

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
    draft.lunchEnabled !== config.lunchEnabled ||
    draft.lunchStart !== config.lunchStart ||
    draft.lunchMinutes !== config.lunchMinutes ||
    draft.monthlyGoal !== monthlyGoal
    || JSON.stringify(draft.customRestSchedule) !== JSON.stringify(config.customRestSchedule ?? null)
    || JSON.stringify(draft.workTemplates) !== JSON.stringify(config.workTemplates ?? [])
  ), [draft, config, currentTheme, monthlyGoal]);

  // 当月工作日预览（使用 workTemplates）
  const firstTemplate = draft.workTemplates[0];
  const fallbackSegments: WorkSegment[] = firstTemplate
    ? [firstTemplate.workSegment]
    : [{ start: draft.startTime, end: draft.endTime }];

  // v1.3.5:workdays 必须跟随 draft.customRestSchedule 重算,否则「完成」后当月工作日不更新。
  // 原因:用户在日历编辑弹窗里改了 customRestSchedule 但没点「保存配置」,需要 workdays
  //       响应 draft 的变化才能让用户立即看到新计数。
  const workdays = useMemo(
    () => workdaysInMonth(
      now.getFullYear(), now.getMonth(),
      {
        ...config,
        restMode: draft.restMode,
        segments: fallbackSegments,
        salaryMode: draft.salaryMode,
        customRestSchedule: draft.customRestSchedule,
      } as Config,
      overrides,
      HOLIDAYS,
    ),
    [now, config, draft.restMode, draft.salaryMode, fallbackSegments, draft.customRestSchedule, overrides],
  );

  const snapshots = useMemo(() => {
    const list = getAllSnapshots();
    return list.slice().sort((a, b) => b.key.localeCompare(a.key));
  }, [getAllSnapshots]);

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const restCalendarDays = daysInMonthCalc(restCalendarMonth.getFullYear(), restCalendarMonth.getMonth());
  const restCalendarOffset = new Date(restCalendarMonth.getFullYear(), restCalendarMonth.getMonth(), 1).getDay();

  /**
   * v1.3.5:已标记 N 天统计 ——「完成」后就会并入当月工作日
   *  - markedTotal:customRestSchedule 全部日期数
   *  - markedThisMonth:当前月视图里的日期数
   */
  const markedTotal = useMemo(
    () => Object.keys(draft.customRestSchedule?.workDays ?? {}).length,
    [draft.customRestSchedule],
  );

  const markedThisMonth = useMemo(() => {
    const y = restCalendarMonth.getFullYear();
    const m = String(restCalendarMonth.getMonth() + 1).padStart(2, '0');
    return Object.keys(draft.customRestSchedule?.workDays ?? {})
      .filter((key) => key.startsWith(`${y}-${m}`)).length;
  }, [draft.customRestSchedule, restCalendarMonth]);

  function applyRestTemplate(date: Date) {
    const key = formatDateKey(date);
    // 防御:workTemplates 为空时(restore 失败/全删)跳过写入,避免存 [''] 脏数据
    if (!restTemplateId) return;
    setDraft((current) => {
      const schedule = current.customRestSchedule ?? { workDays: {}, updatedAt: Date.now() };
      const currentIds = schedule.workDays[key] ?? [];
      const ids = currentIds.includes(restTemplateId)
        ? currentIds.filter((id) => id !== restTemplateId)
        : [...currentIds, restTemplateId];
      const workDays = { ...schedule.workDays };
      if (ids.length === 0) delete workDays[key];
      else workDays[key] = ids;
      return { ...current, customRestSchedule: { workDays, updatedAt: Date.now() } };
    });
  }

  // ── 工时模板 CRUD (WorkTemplate - v1.3.5) ──
  const updateWorkTemplate = (id: string, patch: Partial<WorkTemplate>) => {
    setDraft((d) => ({
      ...d,
      workTemplates: (d.workTemplates ?? []).map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    }));
  };

  const removeWorkTemplate = (id: string) => {
    setDraft((d) => ({
      ...d,
      workTemplates: (d.workTemplates ?? []).filter((t) => t.id !== id),
    }));
  };

  const addWorkTemplate = () => {
    const newTpl: WorkTemplate = {
      id: uuid(),
      name: `模板 ${(draft.workTemplates ?? []).length + 1}`,
      workSegment: { start: '09:00', end: '18:00' },
      color: TEMPLATE_COLORS[(draft.workTemplates ?? []).length % TEMPLATE_COLORS.length]!,
    };
    setDraft((d) => ({
      ...d,
      workTemplates: [...(d.workTemplates ?? []), newTpl],
    }));
  };

  const handleSave = () => {
    // 默认工时模板与全局默认工时一致:
    // - 使用第一个 workTemplate 的 workSegment
    // - startTime / endTime 与 segments 同步
    const firstTpl = draft.workTemplates[0];
    const nextStartTime = firstTpl?.workSegment.start ?? draft.startTime;
    const nextEndTime = firstTpl?.workSegment.end ?? draft.endTime;
    const globalSegments: WorkSegment[] = firstTpl
      ? [firstTpl.workSegment]
      : [{ start: draft.startTime, end: draft.endTime }];

    setConfig({
      monthlySalary: draft.monthlySalary,
      startTime: nextStartTime,
      endTime: nextEndTime,
      coffeePrice: draft.coffeePrice,
      restMode: draft.restMode,
      salaryMode: draft.salaryMode,
      manualHourlyRate: draft.manualHourlyRate,
      manualDailyRate: draft.manualDailyRate,
      segments: globalSegments,
      lunchEnabled: draft.lunchEnabled,
      lunchStart: draft.lunchStart,
      lunchMinutes: draft.lunchMinutes,
      customRestSchedule: draft.customRestSchedule,
      workTemplates: draft.workTemplates,
    });
    if (draft.theme !== currentTheme) {
      setTheme(draft.theme);
    }
    // v1.3.4-patch2:月度目标独立 store,值 null 也允许(清除目标)
    if (draft.monthlyGoal !== monthlyGoal) {
      setMonthlyGoal(draft.monthlyGoal);
    }
    const el = document.querySelector<HTMLElement>('.' + styles.saveBtn);
    if (el) {
      el.textContent = '已保存 ✓';
      window.setTimeout(() => {
        if (el && el.textContent !== '保存配置') el.textContent = '保存配置';
      }, 1200);
    }
  };

  // ── 「高级」抽屉已配置项统计 ──
  const configuredCount = useMemo(() => {
    let n = 0;
    if (draft.workTemplates.length > 1) n++;
    if (draft.lunchEnabled) n++;
    if (draft.coffeePrice !== 15) n++;
    if (draft.theme !== 'paper') n++;
    if (snapshots.length > 0) n++;
    return n;
  }, [draft, snapshots]);

  // 模板预览摘要(用于主页面 工作时间 卡)
  const previewLabel = firstTemplate?.name ?? '默认';
  const previewTime = `${fallbackSegments[0]?.start ?? '09:00'}–${fallbackSegments[0]?.end ?? '18:00'}`;

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
              <span className={styles.mutedNum}>{workdays}</span>
              <span className={styles.suffix}>天</span>
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 休息模式 · Rest Mode ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>休息模式 · Rest</div>
        <div className={styles.card}>
          {draft.salaryMode === 'monthly' ? (
            <>
              <div className={styles.row}>
                <span className={styles.label}>每周休息</span>
                <span className={styles.value}>
                <select
                  className={styles.select}
                  value={draft.restMode}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'custom') {
                      setDraft((d) => ({
                        ...d,
                        restMode: 'custom',
                        customRestSchedule: d.customRestSchedule ?? { workDays: {}, updatedAt: Date.now() },
                      }));
                      setRestCalendarOpen(true);
                    } else {
                      setDraft((d) => ({ ...d, restMode: Number(value) as 0 | 1 | 2 }));
                    }
                  }}
                >
                  <option value={0}>无休</option>
                  <option value={1}>单休</option>
                  <option value={2}>双休</option>
                  <option value="custom">自定义排班</option>
                </select>
                <CaretRight size={14} weight="bold" className={styles.chevron} />
                </span>
              </div>
              {draft.restMode === 'custom' && (
                <button type="button" className={styles.templateModalBtn} onClick={() => setRestCalendarOpen(true)}>
                  <Palette size={13} weight="regular" />
                  编辑自定义排班
                </button>
              )}
            </>
          ) : (
            <div className={styles.disabledHintRow}>
              非月薪模式,休息由日历页当日类型决定
            </div>
          )}
        </div>
      </div>

      {/* ═══ 工作时间 · Hours(纯摘要,无操作入口) ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>工作时间 · Hours</div>
        <div className={styles.card}>
          <div className={styles.hoursCard}>
            <div className={styles.hoursLeft}>
              <div className={styles.hoursEyebrow}>
                <span className={styles.hoursDot} />
                {previewLabel}
              </div>
              <div className={styles.hoursTime}>{previewTime}</div>
            </div>
            {draft.workTemplates.length > 1 && (
              <span className={styles.hoursTemplateCount}>
                +{draft.workTemplates.length - 1} 个模板
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 高级抽屉入口 ═══ */}
      <div className={styles.group}>
        <button
          type="button"
          className={styles.advancedToggle}
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
        >
          <Gear size={14} weight="regular" />
          <span className={styles.advancedToggleLabel}>高级</span>
          {configuredCount > 0 && (
            <span className={styles.advancedBadge}>已配置 {configuredCount}</span>
          )}
          <CaretDown
            size={14}
            weight="bold"
            className={`${styles.advancedChevron} ${advancedOpen ? styles.advancedChevronOpen : ''}`}
          />
        </button>

        <div className={`${styles.advancedPanel} ${advancedOpen ? styles.advancedPanelOpen : ''}`}>
          <div className={styles.advancedPanelInner}>

            {/* ── 月度目标 · Monthly Goal(v1.3.4-patch2:桌面端侧栏底部进度条的目标编辑入口) ── */}
            <div className={styles.subGroup}>
              <div className={styles.subGroupEyebrow}>
                <Target size={11} weight="regular" style={{ verticalAlign: -1, marginRight: 4 }} />
                月度目标 · Monthly Goal
              </div>
              <div className={styles.card}>
                <div className={styles.row}>
                  <span className={styles.label}>月度目标</span>
                  <span className={styles.value}>
                    <span className={styles.prefix}>¥</span>
                    <input
                      type="number"
                      className={styles.input}
                      value={draft.monthlyGoal ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setDraft((d) => ({ ...d, monthlyGoal: null }));
                        } else {
                          const n = Number(raw);
                          setDraft((d) => ({ ...d, monthlyGoal: Number.isFinite(n) && n >= 0 ? n : d.monthlyGoal }));
                        }
                      }}
                      min={0}
                      placeholder="未设置"
                    />
                    {draft.monthlyGoal !== null && (
                      <button
                        type="button"
                        className={styles.clearBtn}
                        onClick={() => setDraft((d) => ({ ...d, monthlyGoal: null }))}
                        aria-label="清除目标"
                        title="清除目标"
                      >
                        <X size={12} weight="bold" />
                      </button>
                    )}
                  </span>
                </div>
                <div className={styles.historyEmpty} style={{ padding: '10px 16px' }}>
                  桌面端侧栏底部显示「已赚 / 目标」进度条
                  <span>未设置时显示引导 chip,点击即可回到此处设置</span>
                </div>
              </div>
            </div>

            {/* ── 工时模板 (WorkTemplate - v1.3.5) ── */}
            <div className={styles.subGroup}>
              <div className={styles.subGroupEyebrow}>工时模板 · Templates</div>
              <div className={styles.card}>
                <TemplateEditor
                  templates={draft.workTemplates ?? []}
                  onUpdate={updateWorkTemplate}
                  onRemove={removeWorkTemplate}
                  onAdd={addWorkTemplate}
                />
              </div>
            </div>

            {/* ─ 午休 ─ */}
            <div className={styles.subGroup}>
              <div className={styles.subGroupEyebrow}>午休 · Lunch</div>
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
                          className={styles.timeInput}
                          value={draft.lunchStart}
                          onChange={(e) => setDraft((d) => ({ ...d, lunchStart: e.target.value }))}
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
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val) && val >= 0) {
                              setDraft((d) => ({ ...d, lunchMinutes: val }));
                            }
                          }}
                          min={0}
                          step={1}
                          style={{ width: 70 }}
                        />
                        <span className={styles.suffix}>分钟</span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ─ 兼职入口说明 ── */}
            <div className={styles.subGroup}>
              <div className={styles.subGroupEyebrow}>兼职 · Freelance</div>
              <div className={styles.card}>
                <div className={styles.historyEmpty} style={{ padding: '14px 16px' }}>
                  周末/临时兼职在「日历」页配置
                  <span>点击日期 → 类型选「自由/兼职」→ 填写临时费率与工时</span>
                </div>
              </div>
            </div>

            {/* ─ 换算 · Convert ─ */}
            <div className={styles.subGroup}>
              <div className={styles.subGroupEyebrow}>
                <Coffee size={11} weight="regular" style={{ verticalAlign: -1, marginRight: 4 }} />
                换算 · Convert
              </div>
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

            {/* ─ 主题 ─ */}
            <div className={styles.subGroup}>
              <div className={styles.subGroupEyebrow}>
                <Palette size={11} weight="regular" style={{ verticalAlign: -1, marginRight: 4 }} />
                主题 · Theme
              </div>
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

            {/* ─ 月度记录 ─ */}
            <div className={styles.subGroup}>
              <div className={styles.subGroupEyebrow}>
                <ClockCounterClockwise size={11} weight="regular" style={{ verticalAlign: -1, marginRight: 4 }} />
                月度记录 · History
              </div>
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

          </div>
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

      <div className={styles.footer}>v2.5 · 本地存储</div>

      {restCalendarOpen && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setRestCalendarOpen(false)} />
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>自定义排班</div>
              <div className={styles.modalHint}>先选工时模板，再点日期添加/移除该模板的标记。同一日期可叠加多个模板。</div>
              <button type="button" className={styles.modalClose} onClick={() => setRestCalendarOpen(false)} aria-label="关闭">
                <X size={16} weight="bold" />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.restTemplateList}>
                {draft.workTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={restTemplateId === template.id ? styles.restTemplateActive : ''}
                    onClick={() => setRestTemplateId(template.id)}
                  >
                    <span className={styles.templateColorDot} style={{ backgroundColor: template.color }} />
                    {template.name} · {template.workSegment.start}–{template.workSegment.end}
                    {template.id === firstTemplateId && (
                      <span className={styles.restTemplateDefaultTag}>默认</span>
                    )}
                  </button>
                ))}
              </div>

              {/* v1.3.5:已标记 N 天 —— 整个 customRestSchedule 跨月汇总 */}
              <div className={styles.markedSummary}>
                全局已标记
                <strong>{markedTotal}</strong>
                天 · {restCalendarMonth.getFullYear()}年{restCalendarMonth.getMonth() + 1}月 当月{' '}
                <strong>{markedThisMonth}</strong> 天
              </div>
              <div className={styles.restCalendarNav}>
                <button type="button" onClick={() => setRestCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>‹</button>
                <strong>{restCalendarMonth.getFullYear()}年{restCalendarMonth.getMonth() + 1}月</strong>
                <button type="button" onClick={() => setRestCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>›</button>
              </div>
              <div className={styles.restWeekdays}>{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}</div>
              <div className={styles.restCalendarGrid}>
                {Array.from({ length: restCalendarOffset }).map((_, index) => <span key={`empty-${index}`} />)}
                {Array.from({ length: restCalendarDays }, (_, index) => {
                  const date = new Date(restCalendarMonth.getFullYear(), restCalendarMonth.getMonth(), index + 1);
                  const ids = draft.customRestSchedule?.workDays[formatDateKey(date)] ?? [];
                  const appliedTemplates = ids
                    .map((id) => draft.workTemplates.find((t) => t.id === id))
                    .filter((t): t is WorkTemplate => Boolean(t));
                  const active = ids.length > 0;
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`${styles.restDay} ${active ? styles.restDayActive : ''}`}
                      onClick={() => applyRestTemplate(date)}
                    >
                      <span className={styles.restDayNum}>{index + 1}</span>
                      {appliedTemplates.length > 0 && (
                        <span className={styles.restDayDots}>
                          {appliedTemplates.slice(0, 4).map((tpl) => (
                            <span
                              key={tpl.id}
                              className={styles.restDayDot}
                              style={{ backgroundColor: tpl.color }}
                            />
                          ))}
                          {appliedTemplates.length > 4 && (
                            <span className={styles.restDayDotMore}>+{appliedTemplates.length - 4}</span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className={styles.restCalendarNote}>已排日期是工作日；未排日期为休息日。多个模板可追加到同一天。</p>
            </div>
            <div className={styles.modalFooter}><button type="button" className={styles.modalDoneBtn} onClick={() => setRestCalendarOpen(false)}>完成</button></div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TemplateEditor — 单个模板的内联编辑器(在「自定义模板」弹窗中渲染)
// ─────────────────────────────────────────────────────────────


