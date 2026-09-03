/**
 * QuickAddRow — 快速记录占满一行,详细记录为行内按钮
 *
 * v2.1 重构:
 * - 快速记录卡占满整行
 * - 「详细」按钮内嵌在快速记录条右侧(QuickAddRecord onOpenFull),打开完整弹窗
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
        {/* 快速记录占满一行,详细记录按钮内嵌 */}
        <div className={`${styles.card} ${styles.quickCard}`}>
          <div className={styles.label}>QUICK · 快速记录</div>
          <QuickAddRecord
            onSubmitted={() => { /* TODO v2.5 提交后高亮 */ }}
            onOpenFull={handleOpenFull}
          />
        </div>
      </div>

      <AddRecordModal
        open={modalOpen}
        editingRecord={editingRecord}
        onClose={handleClose}
      />
    </>
  );
}