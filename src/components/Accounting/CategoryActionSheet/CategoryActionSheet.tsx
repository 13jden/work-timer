/**
 * CategoryActionSheet — 分类操作底部 sheet
 *
 * 从分类详情页右上角「⋯」打开，提供：
 * - 添加记录（预填该分类）
 * - 删除分类
 */
import styles from './CategoryActionSheet.module.css';

interface CategoryActionSheetProps {
  open: boolean;
  onClose: () => void;
  onAddRecord: () => void;
  onDelete: () => void;
}

export function CategoryActionSheet({
  open,
  onClose,
  onAddRecord,
  onDelete,
}: CategoryActionSheetProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.head}>
          <div className={styles.title}>分类操作</div>
        </div>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={onAddRecord}>
            <span className={styles.actionIcon}>✏️</span>
            <span className={styles.actionLabel}>添加记录</span>
          </button>
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={onDelete}>
            <span className={styles.actionIcon}>🗑️</span>
            <span className={styles.actionLabel}>删除分类</span>
          </button>
          <button className={`${styles.actionBtn} ${styles.cancel}`} onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
