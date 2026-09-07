/**
 * CategoryFolderGrid — sortable category folders and record drop targets (v2.5-patch11)
 *
 * v2.5-patch11 重构：
 * - 文件夹排序模式开关：默认 folders 用 PlainFolder（点击进入详情，不可拖动排序）
 * - 启用 folderReorderMode 后用 SortableFolder（可拖动排序）
 * - 文件夹始终作为未分类记录的 drop target（useDroppable 不再 disabled）
 * - 未分类记录直接拖动归类（无需先点击「归类」启用模式） —— 由父级 AccountingPage 处理
 * - 按支出/收入分组渲染（视觉分组），各组末尾"添加分类"按钮
 *
 * 历史：
 * - v2.5-patch8：引入 folderReorderMode / recordDragMode 模式切换
 * - v2.5-patch9/patch10：多次重构未清理干净
 * - v2.5-patch11：明确「只有排序需要按钮，归类直接拖」的边界
 */
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { visibleRecords } from '../../../lib/accounting';
import { IconByKey } from '../../IconByKey';
import styles from './CategoryFolderGrid.module.css';

export const FOLDER_DRAG_PREFIX = 'folder:';

interface CategoryFolderGridProps {
  monthKey: string;
  activeId?: string | null;
  /** v2.5-patch11：排序模式开关 —— 启用后文件夹可拖动排序 */
  folderReorderMode?: boolean;
  onClickCategory?: (categoryId: string) => void;
  onAddCategory?: (type: 'expense' | 'income') => void;
}

/** Renders expense categories as sortable folders and record drop targets. */
export function CategoryFolderGrid({
  monthKey,
  activeId,
  folderReorderMode = false,
  onClickCategory,
  onAddCategory,
}: CategoryFolderGridProps) {
  const folders = useAccountStore((state) => state.folders);
  const categories = useAccountStore((state) => state.categories);
  const records = useAccountStore((state) => state.records);

  // v2.5 T-417：支出 + 收入文件夹都展示
  const visibleFolders = useMemo(
    () => folders
      .filter((folder) => categories.some((category) => category.id === folder.categoryId))
      .sort((left, right) => left.order - right.order),
    [folders, categories],
  );

  // 兜底「存在记录的分类一定有 folder」
  const ensureOnceRef = useRef(false);
  useEffect(() => {
    if (ensureOnceRef.current) return;
    ensureOnceRef.current = true;
    const state = useAccountStore.getState();
    const folderCategoryIds = new Set(state.folders.map((f) => f.categoryId));
    const catIds = new Set(state.categories.map((c) => c.id));
    const missing: string[] = [];
    for (const r of records) {
      if (!r.categoryId) continue;
      if (folderCategoryIds.has(r.categoryId)) continue;
      if (!catIds.has(r.categoryId)) continue;
      if (!missing.includes(r.categoryId)) missing.push(r.categoryId);
    }
    if (missing.length > 0) state.ensureFoldersForCategories(missing);
  }, [records]);

  const statsByFolderId = useMemo(() => {
    const todayKey = getTodayKey();
    return new Map(visibleFolders.map((folder) => {
      const categoryType = categories.find((category) => category.id === folder.categoryId)?.type ?? 'expense';
      const monthRecords = visibleRecords(records).filter(
        (record) => record.categoryId === folder.categoryId
          && record.type === categoryType
          && record.dateKey.startsWith(monthKey),
      );
      return [folder.id, {
        total: monthRecords.reduce((sum, record) => sum + Math.abs(record.amount), 0),
        todayCount: monthRecords.filter((record) => record.dateKey === todayKey).length,
      }];
    }));
  }, [visibleFolders, categories, monthKey, records]);

  // v2.5-patch8：按 type 分组 — 支出在上，收入在下
  const expenseFolders = useMemo(
    () => visibleFolders.filter((f) =>
      categories.find((c) => c.id === f.categoryId)?.type === 'expense',
    ),
    [visibleFolders, categories],
  );
  const incomeFolders = useMemo(
    () => visibleFolders.filter((f) =>
      categories.find((c) => c.id === f.categoryId)?.type === 'income',
    ),
    [visibleFolders, categories],
  );

  const isRecordDragging = activeId?.startsWith('record:') ?? false;

  /**
   * v2.5-patch11：分组渲染（支出/收入），各组末尾"添加分类"按钮。
   * folderReorderMode=true 时所有 folders 用 SortableFolder（共享根级 SortableContext 跨组排序）；
   * folderReorderMode=false 时用 PlainFolder（点击进入详情，不可拖动）。
   * 两态下 useDroppable 都始终启用（始终可接收未分类记录拖入归类）。
   */
  const renderSplitGroup = (
    folderList: typeof visibleFolders,
    typeLabel: 'expense' | 'income',
  ) => {
    const folderItems = folderList.map((folder) => (
      <FolderItem
        key={folder.id}
        folder={folder}
        stat={statsByFolderId.get(folder.id)}
        isRecordDragging={isRecordDragging}
        sortable={folderReorderMode}
        onClickCategory={onClickCategory}
      />
    ));

    const addBtn = onAddCategory ? (
      <button
        key={`add-${typeLabel}`}
        type="button"
        className={styles.folderAdd}
        onClick={() => onAddCategory(typeLabel)}
        aria-label={`添加${typeLabel === 'expense' ? '支出' : '收入'}分类`}
        title={`添加${typeLabel === 'expense' ? '支出' : '收入'}分类`}
      >
        <span className={styles.addIcon}>+</span>
        <span className={styles.addName}>添加分类</span>
      </button>
    ) : null;

    return (
      <div className={styles.grid}>
        {folderItems}
        {addBtn}
      </div>
    );
  };

  const hasAnyFolder = expenseFolders.length > 0 || incomeFolders.length > 0;

  if (!hasAnyFolder) {
    return (
      <div className={styles.empty}>
        <span>暂无分类文件夹</span>
        {onAddCategory && (
          <div className={styles.emptyAddGroup}>
            <button className={styles.emptyAdd} onClick={() => onAddCategory('expense')}>+ 新建支出分类</button>
            <button className={styles.emptyAdd} onClick={() => onAddCategory('income')}>+ 新建收入分类</button>
          </div>
        )}
      </div>
    );
  }

  // 排序模式下才包 SortableContext；非排序模式 PlainFolder 不挂 useSortable，SortableContext 也没意义
  // v2.5-patch12:支出/收入两个独立 SortableContext —— 只能在各自区域内排序,不能跨组交换
  const folderContent = (
    <div className={styles.folderRoot}>
      <div className={styles.folderSection}>
        <div className={styles.sectionLabel}>支出</div>
        {folderReorderMode ? (
          <SortableContext
            items={expenseFolders.map((folder) => `${FOLDER_DRAG_PREFIX}${folder.id}`)}
            strategy={rectSortingStrategy}
          >
            {renderSplitGroup(expenseFolders, 'expense')}
          </SortableContext>
        ) : (
          renderSplitGroup(expenseFolders, 'expense')
        )}
      </div>
      <div className={styles.folderSection}>
        <div className={styles.sectionLabel}>收入</div>
        {folderReorderMode ? (
          <SortableContext
            items={incomeFolders.map((folder) => `${FOLDER_DRAG_PREFIX}${folder.id}`)}
            strategy={rectSortingStrategy}
          >
            {renderSplitGroup(incomeFolders, 'income')}
          </SortableContext>
        ) : (
          renderSplitGroup(incomeFolders, 'income')
        )}
      </div>
      <p className={styles.hint}>
        {folderReorderMode
          ? '拖动文件夹即可在各自区域内排序 · 完成后点「完成排序」退出'
          : '点击文件夹查看详情 · 未分类记录直接拖到下方文件夹归类'}
      </p>
    </div>
  );

  if (folderReorderMode) {
    return folderContent;
  }
  return folderContent;
}

interface FolderItemProps {
  folder: { id: string; categoryId: string; name: string; icon: string; color: string };
  stat?: { total: number; todayCount: number };
  isRecordDragging: boolean;
  /** v2.5-patch11：true → SortableFolder（可拖动排序）；false → PlainFolder（点击进入详情） */
  sortable: boolean;
  onClickCategory?: (categoryId: string) => void;
}

function FolderItem({ folder, stat, isRecordDragging, sortable, onClickCategory }: FolderItemProps) {
  if (sortable) {
    return (
      <SortableFolder
        folder={folder}
        stat={stat}
        isRecordDragging={isRecordDragging}
        onClickCategory={onClickCategory}
      />
    );
  }
  return (
    <PlainFolder
      folder={folder}
      stat={stat}
      isRecordDragging={isRecordDragging}
      onClickCategory={onClickCategory}
    />
  );
}

/** 排序模式下的文件夹：useSortable 提供拖动手柄（点击不进入详情） */
function SortableFolder({ folder, stat, isRecordDragging }: Omit<FolderItemProps, 'sortable'>) {
  const sortableId = `${FOLDER_DRAG_PREFIX}${folder.id}`;
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: { type: 'folder', folderId: folder.id },
  });
  // v2.5-patch11:droppable 始终启用（始终接收未分类记录）
  const droppable = useDroppable({
    id: sortableId,
    data: { type: 'folder', folderId: folder.id, categoryId: folder.categoryId },
  });
  const { setNodeRef: setDropRef, isOver } = droppable;

  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDropRef(node);
  };

  return (
    <div
      ref={setNodeRef}
      id={`accounting-folder-${folder.categoryId}`}
      className={`${styles.folderWrap} ${isOver && isRecordDragging ? styles.folderWrapOver : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className={`${styles.folder} ${isDragging ? styles.folderDragging : ''} ${styles.folderReorderMode}`}
        style={{ ['--folder-color' as string]: folder.color }}
        aria-label={`${folder.name} 分类文件夹`}
        {...attributes}
        {...listeners}
      >
        <FolderInner folder={folder} stat={stat} />
      </button>
    </div>
  );
}

/** 正常模式下的文件夹：点击进入详情，droppable 仍启用（接收未分类记录） */
function PlainFolder({ folder, stat, isRecordDragging, onClickCategory }: Omit<FolderItemProps, 'sortable'>) {
  const sortableId = `${FOLDER_DRAG_PREFIX}${folder.id}`;
  // v2.5-patch11:droppable 始终启用（始终接收未分类记录）
  const droppable = useDroppable({
    id: sortableId,
    data: { type: 'folder', folderId: folder.id, categoryId: folder.categoryId },
  });
  const { setNodeRef, isOver } = droppable;

  return (
    <div
      ref={setNodeRef}
      id={`accounting-folder-${folder.categoryId}`}
      className={`${styles.folderWrap} ${isOver && isRecordDragging ? styles.folderWrapOver : ''}`}
    >
      <button
        type="button"
        className={styles.folder}
        onClick={() => onClickCategory?.(folder.categoryId)}
        style={{ ['--folder-color' as string]: folder.color }}
        aria-label={`${folder.name} 分类文件夹`}
      >
        <FolderInner folder={folder} stat={stat} />
      </button>
    </div>
  );
}

function FolderInner({
  folder,
  stat,
}: {
  folder: { name: string; icon: string; color: string };
  stat?: { total: number; todayCount: number };
}) {
  return (
    <>
      <span className={styles.icon}>
        <IconByKey icon={folder.icon} size={18} weight="regular" color="var(--folder-color, #9CA3AF)" />
      </span>
      <span className={styles.name}>{folder.name}</span>
      <span className={styles.amount}>¥{(stat?.total ?? 0).toFixed(0)}</span>
      {stat && stat.todayCount > 0 && <span className={styles.count}>{stat.todayCount}</span>}
    </>
  );
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
