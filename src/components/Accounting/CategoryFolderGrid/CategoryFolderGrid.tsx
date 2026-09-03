/**
 * CategoryFolderGrid — sortable category folders and record drop targets.
 */
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
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

  const expenseFolders = useMemo(
    () => folders
      .filter((folder) => categories.find((category) => category.id === folder.categoryId)?.type === 'expense')
      .sort((left, right) => left.order - right.order),
    [folders, categories],
  );

  const statsByFolderId = useMemo(() => {
    const todayKey = getTodayKey();
    return new Map(expenseFolders.map((folder) => {
      const monthRecords = records.filter(
        (record) => record.categoryId === folder.categoryId
          && record.type === 'expense'
          && record.dateKey.startsWith(monthKey),
      );
      return [folder.id, {
        total: monthRecords.reduce((sum, record) => sum + Math.abs(record.amount), 0),
        todayCount: monthRecords.filter((record) => record.dateKey === todayKey).length,
      }];
    }));
  }, [expenseFolders, monthKey, records]);

  if (expenseFolders.length === 0) {
    return (
      <div className={styles.empty}>
        <span>暂无分类文件夹</span>
        {onAddCategory && <button className={styles.emptyAdd} onClick={onAddCategory}>+ 新建分类</button>}
      </div>
    );
  }

  return (
    <>
      <SortableContext items={expenseFolders.map((folder) => `${FOLDER_DRAG_PREFIX}${folder.id}`)} strategy={rectSortingStrategy}>
        <div className={styles.grid}>
          {expenseFolders.map((folder) => (
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
