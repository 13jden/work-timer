/**
 * ItemSheet — 添加 / 编辑物品
 * 底部弹窗,受控表单。
 */
import { useEffect, useRef, useState } from 'react';
import { EMOJI_CHOICES } from '../../lib/constants';
import type { Item } from '../../lib/types';
import styles from './ItemSheet.module.css';

interface ItemSheetProps {
  open: boolean;
  editingItem?: Item | null;
  onClose: () => void;
  onSave: (item: { name: string; price: number; icon: string }) => void;
  onDelete?: () => void;
}

const NAME_REGEX = /^[\u4e00-\u9fa5A-Za-z0-9\s·•\-_]{1,20}$/;

export function ItemSheet({ open, editingItem, onClose, onSave, onDelete }: ItemSheetProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [icon, setIcon] = useState('📦');
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // 打开时重置 / 预填字段
  useEffect(() => {
    if (open) {
      setName(editingItem?.name ?? '');
      setPrice(editingItem ? String(editingItem.price) : '');
      setIcon(editingItem?.icon ?? '📦');
      setError(null);
      // 等动画开始后再 focus
      const id = setTimeout(() => nameRef.current?.focus(), 350);
      return () => clearTimeout(id);
    }
  }, [open, editingItem]);

  function handleSave() {
    const trimmedName = name.trim();
    const parsedPrice = parseFloat(price);
    if (!trimmedName) { setError('请输入物品名称'); return; }
    if (!NAME_REGEX.test(trimmedName)) { setError('名称最多 20 字符'); return; }
    if (isNaN(parsedPrice) || parsedPrice <= 0) { setError('请输入有效价格'); return; }
    onSave({ name: trimmedName, price: parsedPrice, icon });
    onClose();
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.sheet}`} style={{ display: open ? 'block' : 'none' }}>
        <div className={styles.handle} />
        <h3 className={styles.title}>{editingItem ? '编辑物品' : '添加物品'}</h3>

        <div className={styles.field}>
          <label className={styles.label}>名称</label>
          <input
            ref={nameRef}
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="咖啡 / 球鞋 / 一杯奶茶…"
            maxLength={20}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>单价 (¥)</label>
          <input
            className={styles.input}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>图标</label>
          <div className={styles.emojiGrid}>
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                className={`${styles.emojiBtn} ${icon === e ? styles.emojiSelected : ''}`}
                onClick={() => setIcon(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12, padding: '0 4px', marginBottom: 8 }}>
            {error}
          </div>
        )}

        <div className={styles.actions}>
          {editingItem && onDelete && (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => { onDelete(); onClose(); }}
            >
              删除
            </button>
          )}
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </>
  );
}