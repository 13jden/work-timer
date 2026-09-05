/** @fileoverview CategoryFolderGrid — sortable category folders and record drop targets. */
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
  onClickCategory?: (categoryId: string) => void;
  onAddCategory?: () => void;
}

/** Renders expense categories as sortable folders and record drop targets. */
export function CategoryFolderGrid({
  monthKey,
  activeId,
  onClickCategory,
  onAddCategory,
}: CategoryFolderGridProps) {
  const folders = useAccountStore((state) => state.folders);
  const categories = useAccountStore((state) => state.categories);
  const records = useAccountStore((state) => state.records);

  // v2.5 T-417：支出 + 收入文件夹都展示（此前仅支出，收入分类建了不显示）
  const visibleFolders = useMemo(
    () => folders
      .filter((folder) => categories.some((category) => category.id === folder.categoryId))
      .sort((left, right) => left.order - right.order),
    [folders, categories],
  );

  // v2.5 TASK-046 T-504：兜底「存在记录的分类一定有 folder」——
  // 联动 record 写入的 cat-salary、跨设备同步等场景下老数据可能没 folder；
  // 这里在组件挂载时主动补一次即可(ensureFoldersForCategories 内部去重)。
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
      // v2.3：虚拟池预扣不计入分类文件夹月度统计
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

  if (visibleFolders.length === 0) {
    return (
      <div className={styles.empty}>
        <span>暂无分类文件夹</span>
        {onAddCategory && <button className={styles.emptyAdd} onClick={onAddCategory}>+ 新建分类</button>}
      </div>
    );
  }

  return (
    <>
      <SortableContext items={visibleFolders.map((folder) => `${FOLDER_DRAG_PREFIX}${folder.id}`)} strategy={rectSortingStrategy}>
        <div className={styles.grid}>
          {visibleFolders.map((folder) => (
            <SortableFolder
              key={folder.id}
              folder={folder}
              stat={statsByFolderId.get(folder.id)}
              isRecordDragging={activeId?.startsWith('record:') ?? false}
              onClickCategory={onClickCategory}
            />
          ))}
          {onAddCategory && (
            <div className={styles.folderWrap}>
              <button type="button" className={styles.folderAdd} onClick={onAddCategory}>
                <span className={styles.addIcon}>+</span>
                <span className={styles.addName}>新建分类</span>
              </button>
            </div>
          )}
        </div>
      </SortableContext>
      <p className={styles.hint}>按住文件夹可排序 · 未分类记录拖到文件夹即可归类</p>
    </>
  );
}

interface SortableFolderProps {
  folder: { id: string; categoryId: string; name: string; icon: string; color: string };
  stat?: { total: number; todayCount: number };
  isRecordDragging: boolean;
  onClickCategory?: (categoryId: string) => void;
}

function SortableFolder({ folder, stat, isRecordDragging, onClickCategory }: SortableFolderProps) {
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
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: sortableId,
    data: { type: 'folder', folderId: folder.id, categoryId: folder.categoryId },
  });

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
        className={`${styles.folder} ${isDragging ? styles.folderDragging : ''}`}
        onClick={() => !isDragging && onClickCategory?.(folder.categoryId)}
        style={{ ['--folder-color' as string]: folder.color }}
        aria-label={`${folder.name} 分类文件夹`}
        {...attributes}
        {...listeners}
      >
        <span className={styles.icon}>
          <IconByKey icon={folder.icon} size={20} color="var(--folder-color, #9CA3AF)" />
        </span>
        <span className={styles.name}>{folder.name}</span>
        <span className={styles.amount}>¥{(stat?.total ?? 0).toFixed(0)}</span>
        {stat && stat.todayCount > 0 && <span className={styles.count}>{stat.todayCount}</span>}
      </button>
    </div>
  );
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
