/**
 * AccountingPage — standalone accounting workspace.
 */
import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useAccountStore } from '../store/accountStore';
import { useNow } from '../hooks/useNow';
import {
  formatAmount,
  getCurrentMonthKey,
  getTodayKey,
  sumExpense,
  sumIncome,
  visibleRecords,
} from '../lib/accounting';
import type { AccountRecord } from '../lib/types';
import { AddRecordModal } from '../components/Accounting/AddRecordModal';
import { AccountingTopCard } from '../components/Accounting/AccountingTopCard';
import { AddCategoryModal } from '../components/Accounting/AddCategoryModal';
import { CategoryDetailPanel } from '../components/Accounting/CategoryDetailPanel';
import { CategoryRecordsPage } from '../components/Accounting/CategoryRecordsPage';
import { CategoryFolderGrid, FOLDER_DRAG_PREFIX } from '../components/Accounting/CategoryFolderGrid';
import { QuickAddRow } from '../components/Accounting/QuickAddRow';
import { SavingsQuote } from '../components/Accounting/SavingsQuote';
import { UncategorizedArea, RECORD_DRAG_PREFIX } from '../components/Accounting/UncategorizedArea';
import { StatCard } from '../components/StatCard';
import styles from './AccountingPage.module.css';

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** Renders the accounting page with touch-capable category drag and drop. */
export function AccountingPage() {
  const now = useNow(60_000);
  const records = useAccountStore((state) => state.records);
  const categories = useAccountStore((state) => state.categories);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AccountRecord | null>(null);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addCategoryDefaultType, setAddCategoryDefaultType] = useState<'expense' | 'income'>('expense');
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // v2.5 TASK-046 T-504：文件夹排序按钮启动后使用 0 延迟传感器（点击即拖）
  const [folderReorderMode, setFolderReorderMode] = useState(false);
  // v2.5-patch8：「归类」模式 —— 默认关闭，开启后未分类记录直接拖（0 延迟）,
  // 文件夹区域才挂 droppable 监听（避免拦截页面滚动）
  const [recordDragMode, setRecordDragMode] = useState(false);
  // v2.2 TASK-038:分类记录页(全部记录)入口
  const [allRecordsCategoryId, setAllRecordsCategoryId] = useState<string | null>(null);

  // 排序模式时退出详情编辑（避免与文件夹点击冲突）
  useEffect(() => {
    if (folderReorderMode) setDetailCategoryId(null);
  }, [folderReorderMode]);

  // v2.5-patch8：开启 recordDragMode 时自动退出 reorder / detail / 弹窗，互斥
  useEffect(() => {
    if (!recordDragMode) return;
    setFolderReorderMode(false);
    setDetailCategoryId(null);
  }, [recordDragMode]);

  // v2.5 T-414：触摸拖拽需长按 1 秒才激活（避免滚动/主题下滑手势误触发）
  // v2.5-patch6 N-489：桌面 pointer 也走 1 秒长按才激活（防点击误拖）
  // v2.5-patch7 T-511：tolerance 6 → 12
  // v2.5 TASK-046 T-504：排序/归类模式都用 0 延迟传感器（点击即拖）
  const normalSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 1000, tolerance: 12 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 1000, tolerance: 12 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const reorderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sensors = (folderReorderMode || recordDragMode) ? reorderSensors : normalSensors;

  const monthKey = getCurrentMonthKey();
  const todayKey = getTodayKey();
  // v2.3：虚拟池预扣不计入今日流水（统计页可开关）
  const todayRecords = visibleRecords(records).filter((record) => record.dateKey === todayKey);
  const todayIncome = sumIncome(todayRecords);
  const todayExpense = sumExpense(todayRecords);
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );

  const closeEditor = () => {
    setModalOpen(false);
    setEditingRecord(null);
  };

  const handlePickRecord = (recordId: string) => {
    const record = useAccountStore.getState().records.find((item) => item.id === recordId);
    if (!record) return;
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleOpenCategory = (categoryId: string) => {
    setDetailCategoryId(categoryId);
  };

  const handleCloseCategory = () => {
    setDetailCategoryId(null);
  };

  const handleEditCategory = (categoryId: string) => {
    const state = useAccountStore.getState();
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return;
    if (state.records.some((record) => record.categoryId === categoryId)) {
      window.alert('该分类还有记录，不能删除');
      return;
    }
    if (window.confirm(`删除分类「${category.name}」？`)) {
      state.deleteCategory(categoryId);
      setDetailCategoryId(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  // v2.5-patch9：未分类记录只能拖入同类型（收入/支出）分类文件夹，
  // 拖到不同类型上时屏蔽 drop target，避免用户误操作。
  const handleDragOver = (event: DragOverEvent) => {
    const activeIdValue = String(event.active.id);
    const overIdValue = event.over ? String(event.over.id) : null;
    if (!overIdValue) return;

    // 仅对未分类记录的拖动做类型过滤
    if (!activeIdValue.startsWith(RECORD_DRAG_PREFIX)) return;
    if (!overIdValue.startsWith(FOLDER_DRAG_PREFIX)) return;

    const state = useAccountStore.getState();
    const recordId = activeIdValue.slice(RECORD_DRAG_PREFIX.length);
    const folderId = overIdValue.slice(FOLDER_DRAG_PREFIX.length);
    const folder = state.folders.find((item) => item.id === folderId);
    const record = state.records.find((item) => item.id === recordId);
    const folderCategory = folder ? state.categories.find((c) => c.id === folder.categoryId) : undefined;

    if (folder && record && folderCategory && folderCategory.type !== record.type) {
      // 类型不匹配 → 屏蔽该 folder 作为 drop target
      // eslint-disable-next-line @dnd-kit/no-dnd-kit-internals
      (event as unknown as { over: unknown }).over = null;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const activeIdValue = String(event.active.id);
    const overIdValue = event.over ? String(event.over.id) : null;
    if (!overIdValue) return;

    const state = useAccountStore.getState();
    if (activeIdValue.startsWith(RECORD_DRAG_PREFIX) && overIdValue.startsWith(FOLDER_DRAG_PREFIX)) {
      const recordId = activeIdValue.slice(RECORD_DRAG_PREFIX.length);
      const folderId = overIdValue.slice(FOLDER_DRAG_PREFIX.length);
      const folder = state.folders.find((item) => item.id === folderId);
      const record = state.records.find((item) => item.id === recordId);
      const folderCategory = folder
        ? state.categories.find((category) => category.id === folder.categoryId)
        : undefined;
      // v2.5 T-417：只允许归入同类型（支出/收入）分类，避免串类
      if (folder && record && folderCategory && folderCategory.type === record.type) {
        state.updateRecord(recordId, { categoryId: folder.categoryId, isUncategorized: false });
      }
      // v2.5-patch9：归类成功不自动退出归类模式，由用户手动点「完成归类」关闭
      return;
    }

    if (!activeIdValue.startsWith(FOLDER_DRAG_PREFIX) || !overIdValue.startsWith(FOLDER_DRAG_PREFIX)) return;
    if (activeIdValue === overIdValue) return;

    // v2.5 T-417：网格已含支出+收入全部文件夹，排序按全集处理
    const folderIds = state.folders
      .filter((folder) => state.categories.some((category) => category.id === folder.categoryId))
      .sort((left, right) => left.order - right.order)
      .map((folder) => `${FOLDER_DRAG_PREFIX}${folder.id}`);
    const oldIndex = folderIds.indexOf(activeIdValue);
    const newIndex = folderIds.indexOf(overIdValue);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedIds = arrayMove(folderIds, oldIndex, newIndex)
      .map((id) => id.slice(FOLDER_DRAG_PREFIX.length));
    const otherFolderIds = state.folders
      .filter((folder) => !reorderedIds.includes(folder.id))
      .sort((left, right) => left.order - right.order)
      .map((folder) => folder.id);
    state.reorderFolders([...reorderedIds, ...otherFolderIds]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.page}>
        <header className={styles.topbar}>
          <div className={styles.topbarEyebrowRow}>
            <span className={styles.topbarEyebrow}>accounting</span>
            <span className={styles.topbarEnglish}>Track every dollar</span>
            <span className={styles.topbarRight}>{formatDate(now)}</span>
          </div>
          <h1 className={styles.topbarCenter}>存钱 · 记一笔</h1>
        </header>

        <section className={styles.topRow} aria-label="本月记账概览">
          <div className={styles.timerWrap}><AccountingTopCard /></div>
          <div className={styles.sideCol}>
            <div className={styles.quoteWrap}><SavingsQuote index={dayOfYear} /></div>
            <div className={styles.statsRow}>
              <StatCard index="01 / TODAY IN" value={`¥${formatAmount(todayIncome)}`} variant="income" sub={`今日收入 · ${todayRecords.filter((record) => record.type === 'income').length} 笔`} extra="含虚拟" />
              <StatCard index="02 / TODAY OUT" value={`¥${formatAmount(todayExpense)}`} variant="equivalent" sub={`今日支出 · ${todayRecords.filter((record) => record.type === 'expense').length} 笔`} extra="今日流水 →" />
            </div>
          </div>
        </section>

        <section className={styles.actionWrap} aria-label="快速记账">
          <QuickAddRow />
        </section>

        <section className={styles.extrasWrap} aria-label="未分类记录">
          <UncategorizedArea
            onPickRecord={handlePickRecord}
            dragMode={recordDragMode}
          />
        </section>

        <section className={styles.extrasWrap} aria-label="分类文件夹">
          <div className={styles.sectionHeader}>
            <span>分类文件夹</span>
            <span className={styles.sectionHeaderRight}>
              <span className={styles.sectionHeaderMonth}>{monthKey}</span>
              {/* v2.5-patch8：归类开关（未分类记录拖到下方文件夹） */}
              <button
                type="button"
                className={`${styles.reorderBtn} ${recordDragMode ? styles.reorderBtnActive : ''}`}
                onClick={() => setRecordDragMode((v) => !v)}
                aria-label={recordDragMode ? '退出归类模式' : '归类'}
                title={recordDragMode ? '点击退出归类模式' : '点击启用拖动归类'}
              >
                {recordDragMode ? '完成归类' : '归类'}
              </button>
              <button
                type="button"
                className={`${styles.reorderBtn} ${folderReorderMode ? styles.reorderBtnActive : ''}`}
                onClick={() => setFolderReorderMode((v) => !v)}
                aria-label={folderReorderMode ? '退出排序模式' : '调整顺序'}
                title={folderReorderMode ? '点击退出排序模式' : '点击启动拖动排序'}
              >
                {folderReorderMode ? '完成排序' : '调整顺序'}
              </button>
            </span>
          </div>
          <CategoryFolderGrid
            monthKey={monthKey}
            activeId={activeId}
            folderReorderMode={folderReorderMode}
            recordDragMode={recordDragMode}
            onClickCategory={handleOpenCategory}
            onAddCategory={(type) => {
              setAddCategoryDefaultType(type);
              setAddCategoryOpen(true);
            }}
          />
        </section>

        <AddRecordModal open={modalOpen} editingRecord={editingRecord} onClose={closeEditor} />
        <AddCategoryModal
          open={addCategoryOpen}
          defaultType={addCategoryDefaultType}
          onCreated={(categoryId) => {
            setAddCategoryOpen(false);
            requestAnimationFrame(() => {
              document.getElementById(`accounting-folder-${categoryId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              });
            });
          }}
          onClose={() => setAddCategoryOpen(false)}
        />
      </div>
      {detailCategoryId && (
        <div className={styles.detailOverlay}>
          <CategoryDetailPanel
            categoryId={detailCategoryId}
            monthKey={monthKey}
            onClose={handleCloseCategory}
            onPickRecord={handlePickRecord}
            onDeleteCategory={handleEditCategory}
            onShowAllRecords={(categoryId) => setAllRecordsCategoryId(categoryId)}
          />
          <AddRecordModal open={modalOpen} editingRecord={editingRecord} onClose={closeEditor} />
        </div>
      )}
      {allRecordsCategoryId && (
        <CategoryRecordsPage
          categoryId={allRecordsCategoryId}
          type={
            categories.find((c) => c.id === allRecordsCategoryId)?.type ?? 'expense'
          }
          onBack={() => setAllRecordsCategoryId(null)}
        />
      )}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
        {activeId?.startsWith(RECORD_DRAG_PREFIX) ? <div className={styles.dragOverlay}>拖到分类文件夹归类</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
