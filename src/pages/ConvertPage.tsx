import { useMemo, useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useItemsStore } from '../store/itemsStore';
import { HOLIDAYS } from '../lib/constants';
import { hourlyRate } from '../lib/compute';
import { useNow } from '../hooks/useNow';
import { ItemSheet } from '../components/ItemSheet';
import type { Item } from '../lib/types';
import styles from './ConvertPage.module.css';

/** 把小时数格式化为人类可读:1.2h / 45min */
function formatHours(h: number): string {
  if (!isFinite(h) || h <= 0) return '0h';
  if (h >= 100) return Math.round(h).toLocaleString('en-US') + 'h';
  if (h >= 10) return h.toFixed(1) + 'h';
  if (h >= 1) return h.toFixed(2).replace(/\.?0+$/, '') + 'h';
  const mins = Math.max(1, Math.round(h * 60));
  return mins + 'min';
}

export function ConvertPage() {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const items = useItemsStore((s) => s.items);
  const addItem = useItemsStore((s) => s.add);
  const updateItem = useItemsStore((s) => s.update);
  const removeItem = useItemsStore((s) => s.remove);

  const rate = useMemo(
    () => hourlyRate(now.getFullYear(), now.getMonth(), config, overrides, HOLIDAYS),
    [now, config, overrides],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  function openAdd() {
    setEditingItem(null);
    setSheetOpen(true);
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setSheetOpen(true);
  }

  function handleSave(data: { name: string; price: number; icon: string }) {
    if (editingItem) {
      updateItem(editingItem.id, data);
    } else {
      addItem(data);
    }
  }

  function handleDelete() {
    if (editingItem) removeItem(editingItem.id);
  }

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.order - b.order),
    [items],
  );

  return (
    <>

      {/* 匹配 index.html:page-head (eyebrow + h2 衬线斜体) */}
      <div className={styles.pageHead}>
        <div className={styles.eyebrow}>What does it cost</div>
        <h2 className={styles.title}>等价换算</h2>
      </div>

      {/* 列表 */}
      <div className={styles.list}>
        {sortedItems.map((item) => {
          const hours = item.price / rate;
          return (
            <div
              key={item.id}
              className={styles.item}
              onClick={() => openEdit(item)}
              role="button"
            >
              <div className={styles.icon}>{item.icon}</div>
              <div className={styles.info}>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.price}>¥{item.price}</div>
              </div>
              <div className={styles.result}>
                <div className={styles.count}>{formatHours(hours)}</div>
                <div className={styles.unit}>需要工作</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 添加按钮:虚线边框 + 居中 */}
      <button type="button" className={styles.addBtn} onClick={openAdd}>
        <span className={styles.addPlus}>＋</span>
        <span>添加喜欢的东西</span>
      </button>

      <ItemSheet
        open={sheetOpen}
        editingItem={editingItem}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        onDelete={editingItem ? handleDelete : undefined}
      />
    </>
  );
}
