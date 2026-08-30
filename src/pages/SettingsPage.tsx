/**
 * SettingsPage — 设置页(Mine)
 *
 * v1.3.1 重构:
 *   - 多段工时改为「模板库」(segmentTemplates)
 *   - 模板在「日历」页点击日期 → 自定义 → 勾选用
 *   - 引入 lucide-react 图标替换 emoji
 */
import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useThemeStore, THEME_LIST } from '../store/themeStore';
import { useMonthlyStore } from '../store/monthlyStore';
import { HOLIDAYS } from '../lib/constants';
import { workdaysInMonth } from '../lib/compute';
import { useNow } from '../hooks/useNow';
import type { Config, WorkSegment, SalaryMode, SegmentTemplate } from '../lib/types';
import type { ThemeMeta } from '../lib/constants';
import { SegmentedControl } from '../components/SegmentedControl';
import { SegmentsEditor } from '../components/SegmentsEditor';
import { Plus, Trash2, ChevronRight, Pencil, Check, X } from 'lucide-react';
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
    // v1.3.1
    segmentTemplates: SegmentTemplate[];
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
    segmentTemplates: config.segmentTemplates,
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
    JSON.stringify(draft.segmentTemplates) !== JSON.stringify(config.segmentTemplates) ||
    draft.lunchEnabled !== config.lunchEnabled ||
    draft.lunchStart !== config.lunchStart ||
    draft.lunchMinutes !== config.lunchMinutes
  ), [draft, config, currentTheme]);

  // 当月工作日预览(基于第一模板的 segments)
  const firstTemplate = draft.segmentTemplates[0];
  const fallbackSegments: WorkSegment[] = firstTemplate
    ? firstTemplate.segments
    : [{ start: draft.startTime, end: draft.endTime }];

  const workdays = useMemo(
    () => workdaysInMonth(
      now.getFullYear(), now.getMonth(),
      { ...config, restMode: draft.restMode, segments: fallbackSegments, salaryMode: draft.salaryMode } as Config,
      overrides, HOLIDAYS,
    ),
    [now, config, draft.restMode, draft.salaryMode, fallbackSegments, overrides],
  );

  const snapshots = useMemo(() => {
    const list = getAllSnapshots();
    return list.slice().sort((a, b) => b.key.localeCompare(a.key));
  }, [getAllSnapshots]);

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── 模板库 CRUD ──
  const updateTemplate = (id: string, patch: Partial<SegmentTemplate>) => {
    setDraft((d) => ({
      ...d,
      segmentTemplates: d.segmentTemplates.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    }));
  };

  const removeTemplate = (id: string) => {
    setDraft((d) => ({
      ...d,
      segmentTemplates: d.segmentTemplates.filter((t) => t.id !== id),
    }));
  };

  const addTemplate = () => {
    const newTpl: SegmentTemplate = {
      id: uuid(),
      label: `新模板 ${draft.segmentTemplates.length + 1}`,
      segments: [{ start: '09:00', end: '18:00' }],
    };
    setDraft((d) => ({
      ...d,
      segmentTemplates: [...d.segmentTemplates, newTpl],
    }));
  };

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
      segmentTemplates: draft.segmentTemplates,
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

      {/* ═══ 时间 · Hours(模板库) ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>
          时间 · Hours
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            fontWeight: 400,
            color: 'var(--muted-2)',
            textTransform: 'none',
            letterSpacing: 0,
            marginLeft: 8,
          }}>
            模板用于日历页勾选
          </span>
        </div>
        <div className={styles.card}>
          {draft.segmentTemplates.length === 0 ? (
            <div className={styles.historyEmpty}>
              暂无模板
              <span>点击下方添加你的第一个工时模板</span>
            </div>
          ) : (
            draft.segmentTemplates.map((tpl, idx) => (
              <TemplateEditor
                key={tpl.id}
                index={idx}
                template={tpl}
                onUpdate={(patch) => updateTemplate(tpl.id, patch)}
                onRemove={() => removeTemplate(tpl.id)}
                removable={draft.segmentTemplates.length > 1}
              />
            ))
          )}
          <button
            type="button"
            className={styles.templateAddBtn}
            onClick={addTemplate}
          >
            <Plus size={14} strokeWidth={2.5} />
            新增模板
          </button>
        </div>

        <div className={styles.card} style={{ marginTop: 10 }}>
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
                <ChevronRight size={14} strokeWidth={2} className={styles.chevron} />
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

      <div className={styles.footer}>v1.3.1 · 本地存储</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TemplateEditor — 单个模板的内联编辑器(v1.3.1 新增)
//   - 顶部:序号 + label(可编辑)+ 删除按钮
//   - 中部:SegmentsEditor(编辑 segments)
//   - 折叠/展开:整块卡片可折叠
// ─────────────────────────────────────────────────────────────

interface TemplateEditorProps {
  index: number;
  template: SegmentTemplate;
  onUpdate: (patch: Partial<SegmentTemplate>) => void;
  onRemove: () => void;
  removable: boolean;
}

function TemplateEditor({ index, template, onUpdate, onRemove, removable }: TemplateEditorProps) {
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(template.label);

  const commitLabel = () => {
    const trimmed = labelDraft.trim();
    if (trimmed.length > 0) {
      onUpdate({ label: trimmed });
    } else {
      setLabelDraft(template.label);
    }
    setEditing(false);
  };

  return (
    <div className={styles.templateCard}>
      <div className={styles.templateHeader}>
        <span className={styles.templateNum}>{index + 1}</span>
        {editing ? (
          <>
            <input
              type="text"
              className={styles.templateLabelInput}
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') {
                  setLabelDraft(template.label);
                  setEditing(false);
                }
              }}
              autoFocus
              maxLength={20}
            />
            <button
              type="button"
              className={styles.templateAction}
              onClick={commitLabel}
              aria-label="确认"
            >
              <Check size={14} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className={styles.templateAction}
              onClick={() => {
                setLabelDraft(template.label);
                setEditing(false);
              }}
              aria-label="取消"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <>
            <span
              className={styles.templateLabel}
              onDoubleClick={() => setEditing(true)}
              title="双击重命名"
            >
              {template.label}
            </span>
            <div className={styles.templateActions}>
              <button
                type="button"
                className={styles.templateAction}
                onClick={() => setEditing(true)}
                aria-label="重命名"
              >
                <Pencil size={12} strokeWidth={2.2} />
              </button>
              {removable && (
                <button
                  type="button"
                  className={`${styles.templateAction} ${styles.templateActionDanger}`}
                  onClick={onRemove}
                  aria-label="删除模板"
                >
                  <Trash2 size={12} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <div style={{ padding: '4px 14px 14px' }}>
        <SegmentsEditor
          segments={template.segments}
          onChange={(segs) => onUpdate({ segments: segs })}
          showTotal
        />
      </div>
    </div>
  );
}