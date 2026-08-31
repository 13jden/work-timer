/**
 * ConvertPanel — 等价换算面板（v1.3.4）
 *
 * 从 `ConvertPage.tsx` 抽取出来的核心列表组件：
 * - 移动端：ConvertPage 直接渲染此组件（带 page-head / 添加按钮）
 * - 桌面端：右栏 ConvertPanel 渲染此组件（带「查看全部」链接）
 *
 * Props：
 * - `mode`: 'full' = 移动端整页（含顶部胶囊 / 添加按钮）
 *           'compact' = 桌面端右栏（仅 Top 5 + 「查看全部」链接）
 *
 * 状态与 store 直接挂钩：useItemsStore + configStore + calendarStore
 * 渲染公式：effectiveHourlyRate（加班倍率生效）
 */
import { useMemo, useState } from 'react';
import { useConfigStore } from '../../store/configStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useItemsStore } from '../../store/itemsStore';
import { HOLIDAYS } from '../../lib/constants';
import { effectiveHourlyRate, getDayOverride } from '../../lib/compute';
import { useNow } from '../../hooks/useNow';
import { ItemSheet } from '../ItemSheet';
import { formatDateKey } from '../../lib/time';
import type { Item } from '../../lib/types';
import { Lightning, Target, Plus } from '@phosphor-icons/react';
import sharedStyles from '../../pages/ConvertPage.module.css';
import styles from './ConvertPanel.module.css';

type Mode = 'full' | 'compact';

interface ConvertPanelProps {
  mode: Mode;
  /** 'full' 模式下显示「查看全部」链接（桌面端右栏不需要） */
  showAllLink?: boolean;
  /** 桌面端右栏点击「查看全部」时跳回整页（保留接口备用） */
  onShowAll?: () => void;
}

function formatHours(h: number): string {
  if (!isFinite(h) || h <= 0) return '0h';
  if (h >= 100) return Math.round(h).toLocaleString('en-US') + 'h';
  if (h >= 10) return h.toFixed(1) + 'h';
  if (h >= 1) return h.toFixed(2).replace(/\.?0+$/, '') + 'h';
  const mins = Math.max(1, Math.round(h * 60));
  return mins + 'min';
}

export function ConvertPanel({ mode, showAllLink, onShowAll }: ConvertPanelProps) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const items = useItemsStore((s) => s.items);
  const addItem = useItemsStore((s) => s.add);
  const updateItem = useItemsStore((s) => s.update);
  const removeItem = useItemsStore((s) => s.remove);

  const dateKey = formatDateKey(now);
  const entry = getDayOverride(overrides, dateKey);
  const isOvertime = entry?.type === 'paid_overtime';

  const rate = useMemo(
    () => effectiveHourlyRate(now, config, overrides, HOLIDAYS),
    [now, config, overrides],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.order - b.order),
    [items],
  );

  const visibleItems = mode === 'compact' ? sortedItems.slice(0, 5) : sortedItems;
  const hasMore = mode === 'compact' && sortedItems.length > 5;

  const capsuleText = isOvertime
    ? `加班日 · ¥${rate.toFixed(2)}/h`
    : config.salaryMode === 'hourly'
    ? `自由模式 · ¥${config.manualHourlyRate}/h`
    : config.salaryMode === 'daily'
    ? `自由模式 · ¥${config.manualDailyRate}/天`
    : null;

  function openAdd() {
    setEditingItem(null);
    setSheetOpen(true);
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setSheetOpen(true);
  }

  function handleSave(data: { name: string; price: number; icon: string }) {
    if (editingItem) updateItem(editingItem.id, data);
    else addItem(data);
  }

  function handleDelete() {
    if (editingItem) removeItem(editingItem.id);
  }

  return (
    <>
      {/* 顶部胶囊（full 模式显示） */}
      {mode === 'full' && capsuleText && (
        <div className={sharedStyles.capsule}>
          {isOvertime
            ? <Lightning size={12} weight="duotone" />
            : <Target size={12} weight="bold" />}
          {capsuleText}
        </div>
      )}

      {/* compact 模式标题（桌面端右栏） */}
      {mode === 'compact' && (
        <div className={styles.header}>
          <h3 className={styles.title}>等价换算</h3>
          <p className={styles.desc}>按当前时薪，工时可换算成：</p>
        </div>
      )}

      {/* 列表 */}
      <div className={mode === 'full' ? sharedStyles.list : styles.list}>
        {visibleItems.map((item) => {
          const hours = rate > 0 ? item.price / rate : 0;
          if (mode === 'full') {
            return (
              <div
                key={item.id}
                className={sharedStyles.item}
                onClick={() => openEdit(item)}
                role="button"
              >
                <div className={sharedStyles.icon}>{item.icon}</div>
                <div className={sharedStyles.info}>
                  <div className={sharedStyles.name}>{item.name}</div>
                  <div className={sharedStyles.price}>¥{item.price}</div>
                </div>
                <div className={sharedStyles.result}>
                  <div className={sharedStyles.count}>{formatHours(hours)}</div>
                  <div className={sharedStyles.unit}>需要工作</div>
                </div>
              </div>
            );
          }
          // compact 行
          return (
            <div key={item.id} className={styles.item}>
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.name} title={item.name}>{item.name}</span>
              <span className={styles.hours}>{formatHours(hours)}</span>
            </div>
          );
        })}
      </div>

      {/* 底部操作 */}
      {mode === 'full' && (
        <button type="button" className={sharedStyles.addBtn} onClick={openAdd}>
          <Plus size={14} weight="bold" />
          <span>添加喜欢的东西</span>
        </button>
      )}

      {mode === 'compact' && (hasMore || showAllLink) && (
        <button type="button" className={styles.allLink} onClick={onShowAll}>
          查看全部 →
        </button>
      )}

      {/* ItemSheet（仅 full 模式需要弹窗编辑） */}
      {mode === 'full' && (
        <ItemSheet
          open={sheetOpen}
          editingItem={editingItem}
          onClose={() => setSheetOpen(false)}
          onSave={handleSave}
          onDelete={editingItem ? handleDelete : undefined}
        />
      )}
    </>
  );
}
