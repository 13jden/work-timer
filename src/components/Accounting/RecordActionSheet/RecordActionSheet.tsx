/**
 * RecordActionSheet — 记录操作 sheet
 *
 * 长按记录后弹出，提供：
 * - 编辑（打开 AddRecordModal）
 * - 标记为已分类
 * - 删除
 */
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord } from '../../../lib/types';
import styles from './RecordActionSheet.module.css';

interface RecordActionSheetProps {
  open: boolean;
  record: AccountRecord | null;
  onClose: () => void;
  onEdit: (recordId: string) => void;
}

export function RecordActionSheet({
  open,
  record,
  onClose,
  onEdit,
}: RecordActionSheetProps) {
  const deleteRecord = useAccountStore((s) => s.deleteRecord);
  const updateRecord = useAccountStore((s) => s.updateRecord);

  if (!open || !record) return null;

  const handleEdit = () => {
    onEdit(record.id);
    onClose();
  };

  const handleDelete = () => {
    if (!window.confirm('确定删除这条记录？')) return;
    deleteRecord(record.id);
    onClose();
  };

  const handleMarkCategorized = () => {
    updateRecord(record.id, { isUncategorized: false });
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.head}>
          <div className={styles.title}>记录操作</div>
        </div>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={handleEdit}>
            <span className={styles.actionIcon}>✏️</span>
            <span className={styles.actionLabel}>编辑</span>
          </button>
          {record.isUncategorized && (
            <button className={styles.actionBtn} onClick={handleMarkCategorized}>
              <span className={styles.actionIcon}>📁</span>
              <span className={styles.actionLabel}>标记为已分类</span>
            </button>
          )}
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={handleDelete}>
            <span className={styles.actionIcon}>🗑️</span>
            <span className={styles.actionLabel}>删除</span>
          </button>
          <button className={`${styles.actionBtn} ${styles.cancel}`} onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
