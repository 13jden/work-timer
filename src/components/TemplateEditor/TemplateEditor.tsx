/**
 * TemplateEditor — v1.3.5 工时模板编辑器
 *
 * 功能：
 *   - 管理 WorkTemplate 列表（Config.workTemplates）
 *   - 单时段设计（start-end）
 *   - 支持添加、编辑（弹窗）、删除模板
 *   - 颜色从 TEMPLATE_COLORS 选择
 *
 * 使用方式：
 *   - 列表展示模板名称 + 时段 + 颜色
 *   - 点击模板打开弹窗编辑
 *   - 点击「+」添加新模板
 */
import { useState } from 'react';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
import { TEMPLATE_COLORS } from '../../lib/constants';
import type { WorkTemplate } from '../../lib/types';
import styles from './TemplateEditor.module.css';

interface Props {
  templates: WorkTemplate[];
  onUpdate: (id: string, patch: Partial<WorkTemplate>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

/** 跨天段(end <= start)把 end 加 +1 角标 */
function formatEndLabel(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ((eh ?? 0) * 60 + (em ?? 0) <= (sh ?? 0) * 60 + (sm ?? 0)) {
    return `${end}+1`;
  }
  return end;
}

interface EditModalProps {
  template: WorkTemplate | null; // null = 新建模式
  onSave: (patch: Partial<WorkTemplate>) => void;
  onClose: () => void;
}

function EditModal({ template, onSave, onClose }: EditModalProps) {
  const isNew = template === null;
  const [name, setName] = useState(template?.name ?? '');
  const [start, setStart] = useState(template?.workSegment.start ?? '09:00');
  const [end, setEnd] = useState(template?.workSegment.end ?? '18:00');
  const [color, setColor] = useState(template?.color ?? TEMPLATE_COLORS[0]!);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      workSegment: { start, end },
      color,
    });
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? '新建模板' : '编辑模板'}</span>
          <button type="button" className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {/* 名称 */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>模板名称</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：常规班、早班、夜班"
              maxLength={20}
              autoFocus
            />
          </div>

          {/* 时段 */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>工作时段</label>
            <div className={styles.timeRow}>
              <input
                type="time"
                className={styles.timeInput}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <span className={styles.timeSep}>至</span>
              <input
                type="time"
                className={styles.timeInput}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <div className={styles.hint}>支持跨天（例如 22:00 至 06:00）</div>
          </div>

          {/* 颜色 */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>标识颜色</label>
            <div className={styles.colorPicker}>
              {TEMPLATE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorBtn} ${color === c ? styles.colorBtnActive : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {isNew ? '创建' : '保存'}
          </button>
        </div>
      </div>
    </>
  );
}

export function TemplateEditor({ templates, onUpdate, onRemove, onAdd }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = editingId ? templates.find((t) => t.id === editingId) ?? null : null;
  const isNew = editingId === 'new';

  function handleOpenNew() {
    onAdd(); // 先通知父组件添加
    setEditingId('new'); // 然后打开弹窗
  }

  function handleSave(patch: Partial<WorkTemplate>) {
    if (isNew) {
      // 新建模式下，patch 包含完整数据（由 EditModal 提供）
      // 通知父组件更新最后添加的那个模板
      const lastTemplate = templates[templates.length - 1];
      if (lastTemplate) {
        onUpdate(lastTemplate.id, patch);
      }
    } else if (editingId) {
      onUpdate(editingId, patch);
    }
    setEditingId(null);
  }

  function handleDelete(id: string) {
    if (templates.length <= 1) {
      alert('至少保留一个模板');
      return;
    }
    if (confirm('确认删除该模板？日历中已标记的工作日不会自动清除。')) {
      onRemove(id);
    }
  }

  return (
    <div className={styles.container}>
      {/* 模板列表 */}
      <div className={styles.list}>
        {templates.map((tpl) => (
          <div key={tpl.id} className={styles.item}>
            <span
              className={styles.colorDot}
              style={{ backgroundColor: tpl.color }}
            />
            <div className={styles.info}>
              <span className={styles.name}>{tpl.name}</span>
              <span className={styles.time}>
                {tpl.workSegment.start}–{formatEndLabel(tpl.workSegment.start, tpl.workSegment.end)}
              </span>
            </div>
            <button
              type="button"
              className={styles.editBtn}
              onClick={() => setEditingId(tpl.id)}
              aria-label="编辑"
            >
              <Pencil size={14} weight="regular" />
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => handleDelete(tpl.id)}
              disabled={templates.length <= 1}
              aria-label="删除"
            >
              <Trash size={14} weight="regular" />
            </button>
          </div>
        ))}
      </div>

      {/* 添加按钮 */}
      <button type="button" className={styles.addBtn} onClick={handleOpenNew}>
        <Plus size={14} weight="bold" />
        添加模板
      </button>

      {/* 编辑弹窗 */}
      {(editing || isNew) && (
        <EditModal
          template={editing}
          onSave={handleSave}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
