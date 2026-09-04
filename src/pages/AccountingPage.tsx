/**
 * AccountingPage — standalone accounting workspace.
 */
import { useState } from 'react';
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
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // v2.2 TASK-038:分类记录页(全部记录)入口
  const [allRecordsCategoryId, setAllRecordsCategoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      if (folder) {
        state.updateRecord(recordId, { categoryId: folder.categoryId, isUncategorized: false });
      }
      return;
    }

    if (!activeIdValue.startsWith(FOLDER_DRAG_PREFIX) || !overIdValue.startsWith(FOLDER_DRAG_PREFIX)) return;
    if (activeIdValue === overIdValue) return;

    const expenseFolderIds = state.folders
      .filter((folder) => state.categories.find((category) => category.id === folder.categoryId)?.type === 'expense')
      .sort((left, right) => left.order - right.order)
      .map((folder) => `${FOLDER_DRAG_PREFIX}${folder.id}`);
    const oldIndex = expenseFolderIds.indexOf(activeIdValue);
    const newIndex = expenseFolderIds.indexOf(overIdValue);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedExpenseIds = arrayMove(expenseFolderIds, oldIndex, newIndex)
      .map((id) => id.slice(FOLDER_DRAG_PREFIX.length));
    const otherFolderIds = state.folders
      .filter((folder) => !reorderedExpenseIds.includes(folder.id))
      .sort((left, right) => left.order - right.order)
      .map((folder) => folder.id);
    state.reorderFolders([...reorderedExpenseIds, ...otherFolderIds]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
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

        <section className={styles.actionWrap} aria-label="快速记账"><QuickAddRow /></section>

        <section className={styles.extrasWrap} aria-label="未分类记录">
          <UncategorizedArea onPickRecord={handlePickRecord} />
        </section>

        <section className={styles.extrasWrap} aria-label="支出分类">
          <div className={styles.sectionHeader}><span>分类文件夹</span><span>{monthKey}</span></div>
          <CategoryFolderGrid
            monthKey={monthKey}
            activeId={activeId}
            onClickCategory={handleOpenCategory}
            onAddCategory={() => setAddCategoryOpen(true)}
          />
        </section>

        <AddRecordModal open={modalOpen} editingRecord={editingRecord} onClose={closeEditor} />
        <AddCategoryModal
          open={addCategoryOpen}
          defaultType="expense"
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
