/**
 * DesktopRightPanel — 桌面端三栏布局的右栏（v1.3.4-patch5）
 *
 * - today    → ConvertPanel(等价换算) + RecordsPanel(时间记录)
 * - calendar → 内联 DaySheet(从 App.tsx 接收 pickedDate)
 *
 * 右栏作为 grid 1fr 单元,宽度 = ContentArea 的 1/3(自动随 Sidebar 收起/展开)。
 * 内部 overflow-y: auto,所以右侧 panel 独立滚动,不带动主区。
 */
import { useMemo, useState } from 'react';
import { DaySheet } from '../DaySheet';
import { RecordsPanel } from '../RecordsPanel/RecordsPanel';
import { ConvertPanel } from '../ConvertPanel';
import { GenerateSheet } from '../GenerateSheet';
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useMonthlyStore } from '../../store/monthlyStore';
import { HOLIDAYS } from '../../lib/constants';
import { dailySalary, isWorkday, batchGenerateEarned } from '../../lib/compute';
import { formatDateKey } from '../../lib/time';
import { Gear } from '@phosphor-icons/react';
import type { DesktopTabId } from '../DesktopSidebar';
import styles from './DesktopRightPanel.module.css';

interface DesktopRightPanelProps {
  page: DesktopTabId;
  /** 日历页选中的日期(calendar tab 才用) */
  pickedDate: Date | null;
  /** 日历页关闭选中 */
  onClosePickedDate: () => void;
  /** 跳转日历页(可选,保留扩展) */
  onNavigateToCalendar?: (dateKey: string) => void;
  /** 打开设置抽屉 */
  onOpenSettings?: () => void;
}

export function DesktopRightPanel({
  page,
  pickedDate,
  onClosePickedDate,
  onOpenSettings,
}: DesktopRightPanelProps) {
  // ── today tab:Convert(等价换算) + Records(时间记录) ──
  if (page === 'today') {
    return (
      <aside className={styles.panel}>
        {/* 右上角设置按钮 */}
        {onOpenSettings && (
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={onOpenSettings}
            title="设置"
            aria-label="设置"
          >
            <Gear size={18} weight="regular" />
          </button>
        )}

        {/* 等价换算 */}
        <div className={styles.convertWrap}>
          <ConvertPanel mode="compact" />
        </div>

        {/* 时间记录 */}
        <RecordsPanel title="时间记录" />
      </aside>
    );
  }

  // ── calendar tab:内联 DaySheet ──
  return (
    <aside className={styles.panel}>
      <CalendarRightContent
        pickedDate={pickedDate}
        onClosePickedDate={onClosePickedDate}
        onOpenSettings={onOpenSettings}
      />
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// CalendarRightContent — 日历 tab 的右栏内容(基于 pickedDate 渲染 DaySheet)
// ─────────────────────────────────────────────────────────────
function CalendarRightContent({
  pickedDate,
  onClosePickedDate,
  onOpenSettings,
}: {
  pickedDate: Date | null;
  onClosePickedDate: () => void;
  onOpenSettings?: () => void;
}) {
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const setDayOverride = useCalendarStore((s) => s.setDayOverride);
  const clearOverride = useCalendarStore((s) => s.clearOverride);
  const year = useCalendarStore((s) => s.year);
  const month = useCalendarStore((s) => s.month);
  const setConfig = useConfigStore((s) => s.setConfig);
  const snapshots = useMonthlyStore((s) => s.snapshots);
  const createSnapshot = useMonthlyStore((s) => s.createSnapshot);

  const [genOpen, setGenOpen] = useState(false);

  const currentKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const snapshot = snapshots[currentKey];

  const dateKey = pickedDate ? formatDateKey(pickedDate) : '';
  const entry = dateKey ? (overrides[dateKey] ?? null) : null;
  const isWork = pickedDate ? isWorkday(pickedDate, config, overrides, HOLIDAYS) : false;
  const daily = useMemo(() => {
    if (!pickedDate) return 0;
    return dailySalary(pickedDate.getFullYear(), pickedDate.getMonth(), config, overrides, HOLIDAYS);
  }, [pickedDate, config, overrides]);

  function handleGenerate(salary: number) {
    setConfig({ ...config, monthlySalary: salary });
    createSnapshot(year, month, salary, config, overrides, HOLIDAYS);
  }

  // 单日生成已赚
  function generateSingleEarned() {
    if (!pickedDate) return;
    // 用 store 最新值（避免闭包旧值）
    const latestOverrides = useCalendarStore.getState().dayOverrides;
    const next = batchGenerateEarned([pickedDate], config, latestOverrides, HOLIDAYS, false);
    const keys = new Set([...Object.keys(latestOverrides), ...Object.keys(next)]);
    keys.forEach((key) => setDayOverride(key, next[key] ?? null));
  }

  // 单日取消已赚
  function cancelSingleEarned() {
    if (!pickedDate) return;
    const latestOverrides = useCalendarStore.getState().dayOverrides;
    const next = batchGenerateEarned([pickedDate], config, latestOverrides, HOLIDAYS, true);
    const keys = new Set([...Object.keys(latestOverrides), ...Object.keys(next)]);
    keys.forEach((key) => setDayOverride(key, next[key] ?? null));
  }

  const now = new Date();
  const isPastDate = pickedDate
    ? pickedDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : false;

  if (!pickedDate) {
    return (
      <>
        {/* 右上角设置按钮 */}
        {onOpenSettings && (
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={onOpenSettings}
            title="设置"
            aria-label="设置"
          >
            <Gear size={18} weight="regular" />
          </button>
        )}

        <div className={styles.daySheetEmpty}>
          <span>← 点击日历日期</span>
          <span>在右侧编辑设置</span>
        </div>

        {genOpen && (
          <GenerateSheet
            open={genOpen}
            year={year}
            month={month}
            config={config}
            defaultSalary={snapshot?.salary ?? config.monthlySalary}
            overrides={overrides}
            holidays={HOLIDAYS}
            onClose={() => setGenOpen(false)}
            onConfirm={handleGenerate}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* 右上角设置按钮 */}
      {onOpenSettings && (
        <button
          type="button"
          className={styles.settingsBtn}
          onClick={onOpenSettings}
          title="设置"
          aria-label="设置"
        >
          <Gear size={18} weight="regular" />
        </button>
      )}

      <div className={styles.daySheetWrap}>
        <DaySheet
          inline
          open={true}
          date={pickedDate}
          isWork={isWork}
          dailyEarning={daily}
          currentEntry={entry}
          salaryMode={config.salaryMode}
          segmentTemplates={config.segmentTemplates}
          onClose={onClosePickedDate}
          onSave={(key, entry) => setDayOverride(key, entry)}
          onReset={(key) => clearOverride(key)}
          isPast={isPastDate}
          onGenerateEarned={generateSingleEarned}
          onCancelEarned={cancelSingleEarned}
        />
      </div>

      {genOpen && (
        <GenerateSheet
          open={genOpen}
          year={year}
          month={month}
          config={config}
          defaultSalary={snapshot?.salary ?? config.monthlySalary}
          overrides={overrides}
          holidays={HOLIDAYS}
          onClose={() => setGenOpen(false)}
          onConfirm={handleGenerate}
        />
      )}
    </>
  );
}