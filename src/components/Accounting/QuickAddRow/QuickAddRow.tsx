/**
 * QuickAddRow — 左快速记录 / 右详细记录
 *
 * v2.1 重构:
 * - 与 TimeTrackerWidget 占据同一容器位置,骨架尺寸基本一致
 * - 移动端:两卡纵向叠放(快速记录优先,占满宽度)
 * - 桌面端:并排两卡
 *
 * 快速记录默认保存到"未分类",详细记录可指定分类保存。
 */
import { useState } from 'react';
import { QuickAddRecord } from '../QuickAddRecord';
import { AddRecordModal } from '../AddRecordModal';
import type { AccountRecord } from '../../../lib/types';
import styles from './QuickAddRow.module.css';

interface QuickAddRowProps {
  /** 长按记录时回调（预留，v2.5 完善） */
  onEditRecord?: (record: AccountRecord) => void;
}

export function QuickAddRow(_props: QuickAddRowProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AccountRecord | null>(null);

  const handleOpenFull = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingRecord(null);
  };

  return (
    <>
      <div className={styles.row}>
        {/* 上/左：快速记录 */}
        <div className={`${styles.card} ${styles.quickCard}`}>
          <div className={styles.label}>QUICK · 快速记录</div>
          {/* QuickAddRecord 不传 onOpenFull，避免显示其内置详细按钮 */}
          <QuickAddRecord onSubmitted={() => { /* TODO v2.5 提交后高亮 */ }} />
        </div>

        {/* 下/右：详细记录 */}
        <button
          type="button"
          className={`${styles.card} ${styles.fullCard}`}
          onClick={handleOpenFull}
          aria-label="打开详细记录"
        >
          <div className={styles.label}>FULL · 详细记录</div>
          <div className={styles.fullSub}>分类 · 备注 · 关联池</div>
          <div className={styles.fullOpen}>打开弹窗 ›</div>
        </button>
      </div>

      <AddRecordModal
        open={modalOpen}
        editingRecord={editingRecord}
        onClose={handleClose}
      />
    </>
  );
}