/**
 * AccountingPage — standalone accounting workspace.
 *
 * v2.5-patch11：
 * - 保留 folderReorderMode 排序模式（默认 folders 不可拖动，点击进入详情）
 * - 移除 recordDragMode 模式（未分类记录始终可拖动归类，无需按钮启用）
 * - 「调整顺序」按钮启动 folderReorderMode（点击即拖）
 * - 「归类」按钮已删除（未分类记录直接拖到下方文件夹）
 * - 单一传感器配置：pointer distance 5px / touch delay 0 + tolerance 8px
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
  // v2.5-patch11：保留 folderReorderMode（排序按钮启用）；移除 recordDragMode（归类直接拖）
  const [folderReorderMode, setFolderReorderMode] = useState(false);
  // v2.2 TASK-038:分类记录页(全部记录)入口
  const [allRecordsCategoryId, setAllRecordsCategoryId] = useState<string | null>(null);

  // v2.5-patch11:单一传感器配置（pointer distance 5px / touch delay 0 + tolerance 8px）
  // - 未分类记录始终可拖动（distance 5 启动）
  // - folderReorderMode=true 时文件夹可拖动排序；否则文件夹不参与拖动
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 8 } }),
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
      return;
    }

    // v2.5-patch11：文件夹排序要求 folderReorderMode 启用
    // v2.5-patch12:分组排序 —— 支出/收入各自分组,不允许跨组交换
    if (!folderReorderMode) return;
    if (!activeIdValue.startsWith(FOLDER_DRAG_PREFIX) || !overIdValue.startsWith(FOLDER_DRAG_PREFIX)) return;
    if (activeIdValue === overIdValue) return;

    const activeFolderId = activeIdValue.slice(FOLDER_DRAG_PREFIX.length);
    const overFolderId = overIdValue.slice(FOLDER_DRAG_PREFIX.length);
    const activeFolder = state.folders.find((folder) => folder.id === activeFolderId);
    const overFolder = state.folders.find((folder) => folder.id === overFolderId);
    if (!activeFolder || !overFolder) return;
    const activeCategory = state.categories.find((category) => category.id === activeFolder.categoryId);
    const overCategory = state.categories.find((category) => category.id === overFolder.categoryId);
    if (!activeCategory || !overCategory) return;
    // 不同类型 → 拒绝(支出/收入各自独立排序,不允许跨组)
    if (activeCategory.type !== overCategory.type) return;

    // 同组内:按当前 order 排序,只在组内 arrayMove,不影响另一组
    const groupType = activeCategory.type;
    const groupFolderIds = state.folders
      .filter((folder) => {
        const cat = state.categories.find((category) => category.id === folder.categoryId);
        return cat?.type === groupType;
      })
      .sort((left, right) => left.order - right.order)
      .map((folder) => `${FOLDER_DRAG_PREFIX}${folder.id}`);
    const oldIndex = groupFolderIds.indexOf(activeIdValue);
    const newIndex = groupFolderIds.indexOf(overIdValue);
    if (oldIndex < 0 || newIndex < 0) return;

    // 重排组内顺序
    const reorderedGroupIds = arrayMove(groupFolderIds, oldIndex, newIndex)
      .map((id) => id.slice(FOLDER_DRAG_PREFIX.length));

    // 其他组(folder)按当前 order 保持不变
    const reorderedSet = new Set(reorderedGroupIds);
    const otherFolderIds = state.folders
      .filter((folder) => !reorderedSet.has(folder.id))
      .sort((left, right) => left.order - right.order)
      .map((folder) => folder.id);

    // 拼接:本组使用新顺序(连续),另一组保持原 order 连续;两组拼接 = 整体顺序
    // —— reorderFolders 会按数组索引重写 order,所以拼接顺序就是最终顺序。
    // 由于两组 order 互不相干,我们把本组排前面(因为 order 通常 0..n 连续),
    // 另一组追加在后面;用户视觉上仍是「支出在上、收入在下」(由 Section UI 决定)
    state.reorderFolders([...reorderedGroupIds, ...otherFolderIds]);
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
          <UncategorizedArea onPickRecord={handlePickRecord} />
        </section>

        <section className={styles.extrasWrap} aria-label="分类文件夹">
          <div className={styles.sectionHeader}>
            <span>分类文件夹</span>
            <span className={styles.sectionHeaderRight}>
              <span className={styles.sectionHeaderMonth}>{monthKey}</span>
              {/* v2.5-patch11：保留「调整顺序」按钮，用户主动启用文件夹排序模式 */}
              <button
                type="button"
                className={`${styles.reorderBtn} ${folderReorderMode ? styles.reorderBtnActive : ''}`}
                onClick={() => setFolderReorderMode((v) => !v)}
                aria-label={folderReorderMode ? '退出排序模式' : '调整顺序'}
                title={folderReorderMode ? '点击退出排序模式' : '点击启用拖动排序'}
              >
                {folderReorderMode ? '完成排序' : '调整顺序'}
              </button>
            </span>
          </div>
          <CategoryFolderGrid
            monthKey={monthKey}
            activeId={activeId}
            folderReorderMode={folderReorderMode}
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
