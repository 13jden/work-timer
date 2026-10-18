/**
 * @fileoverview JourneyEditModal — 新建/编辑一程（v3.0 TASK-059 T-593 + T-597）
 *
 * 新建：标题 + 类型即可；封面后补。
 * 编辑：标题 / 备注 / 封面。
 */
import { useState, useEffect, useRef } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { X } from '@phosphor-icons/react';
import styles from './JourneyEditModal.module.css';

interface JourneyEditModalProps {
  open: boolean;
  /** 有值 = 编辑模式，无值 = 新建模式 */
  journeyId?: string | null;
  onClose: () => void;
  onCreated?: (journeyId: string) => void;
}

export function JourneyEditModal({ open, journeyId, onClose, onCreated }: JourneyEditModalProps) {
  const addJourney = useAccountStore((s) => s.addJourney);
  const updateJourney = useAccountStore((s) => s.updateJourney);
  const deleteJourney = useAccountStore((s) => s.deleteJourney);
  const journeys = useAccountStore((s) => s.journeys);

  const existing = journeyId ? journeys.find((j) => j.id === journeyId) : undefined;
  const isEdit = !!existing;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [note, setNote] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (existing) {
        setTitle(existing.title);
        setType(existing.type);
        setNote(existing.note ?? '');
      } else {
        setTitle('');
        setType('expense');
        setNote('');
      }
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open, existing]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) { titleRef.current?.focus(); return; }
    if (isEdit && existing) {
      updateJourney(existing.id, { title: trimmed, note: note.trim() || undefined });
      onClose();
    } else {
      const newJourney = addJourney({ title: trimmed, type, note: note.trim() || undefined });
      onCreated?.(newJourney.id);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    if (!window.confirm(`删除「${existing.title}」？关联记录会保留。`)) return;
    deleteJourney(existing.id);
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{isEdit ? '编辑一程' : '新建一程'}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          {/* 类型选择（仅新建时显示） */}
          {!isEdit && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>类型</div>
              <div className={styles.typeRow}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${type === 'expense' ? styles.typeBtnActiveExpense : ''}`}
                  onClick={() => setType('expense')}
                >
                  💸 支出程
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${type === 'income' ? styles.typeBtnActiveIncome : ''}`}
                  onClick={() => setType('income')}
                >
                  💰 收入程
                </button>
              </div>
            </div>
          )}

          {/* 标题 */}
          <div className={styles.field}>
            <div className={styles.fieldLabel}>标题 <em className={styles.required}>*</em></div>
            <input
              ref={titleRef}
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：云南 7 日游"
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <div className={styles.charCount}>{title.length}/20</div>
          </div>

          {/* 备注 */}
          <div className={styles.field}>
            <div className={styles.fieldLabel}>备注（可选）</div>
            <textarea
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="补充说明"
              rows={3}
            />
          </div>

          {/* 封面提示 */}
          <div className={styles.field}>
            <div className={styles.fieldLabel}>封面</div>
            <div className={styles.coverHint}>
              {isEdit
                ? '可在详情页设置封面（从相册选择或使用记录附图）'
                : '创建后可从详情页设置封面'}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {isEdit && (
            <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
              删除一程
            </button>
          )}
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            取消
          </button>
          <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
