/**
 * AddCategoryModal — 新增分类弹窗
 *
 * 用于「分类文件夹」区域右上角「添加」按钮。
 * 支持：
 * - 名称输入
 * - emoji 选取（内置候选）
 * - 颜色选取（内置色板）
 * - 类型选择（支出 / 收入）
 *
 * v2.1：仅保留最简表单，避免一次性引入过多字段。
 */
import { useState, useRef, useEffect } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { ACCOUNTING_ICON_GROUPS, IconByKey } from '../../IconByKey';
import type { RecordType } from '../../../lib/types';
import styles from './AddCategoryModal.module.css';

interface AddCategoryModalProps {
  open: boolean;
  /** 默认类型（支出/收入） */
  defaultType?: RecordType;
  onClose: () => void;
  /** 新建分类后回调（返回新分类 id） */
  onCreated?: (categoryId: string) => void;
}

// 内置色板（覆盖支出/收入常用色）
const COLOR_PALETTE = [
  '#FF9B8E', // 餐饮粉
  '#60A5FA', // 交通蓝
  '#F472B6', // 购物粉
  '#A78BFA', // 娱乐紫
  '#34D399', // 住房绿
  '#FBBF24', // 水电黄
  '#F87171', // 医疗红
  '#38BDF8', // 教育青
  '#9CA3AF', // 其他灰
  '#C9A84C', // 香槟金
  '#7C6FF7', // 靛蓝
  '#1F2937', // 墨黑
];

export function AddCategoryModal({
  open,
  defaultType = 'expense',
  onClose,
  onCreated,
}: AddCategoryModalProps) {
  const addCategory = useAccountStore((s) => s.addCategory);
  const addFolder = useAccountStore((s) => s.addFolder);
  const categories = useAccountStore((s) => s.categories);
  const folders = useAccountStore((s) => s.folders);

  const [name, setName] = useState('');
  const [type, setType] = useState<RecordType>(defaultType);
  const [iconKey, setIconKey] = useState<string>('box');
  const [color, setColor] = useState<string>(COLOR_PALETTE[8]!);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // 打开时重置 + 默认聚焦
  useEffect(() => {
    if (!open) return;
    setName('');
    setType(defaultType);
    setIconKey('box');
    setColor(COLOR_PALETTE[8]!);
    setError(null);
    const id = setTimeout(() => nameRef.current?.focus(), 250);
    return () => clearTimeout(id);
  }, [open, defaultType]);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('请输入分类名称');
      nameRef.current?.focus();
      return;
    }
    if (trimmed.length > 8) {
      setError('名称最多 8 个字');
      return;
    }

    // 计算新分类的 order（同类末尾）
    const maxOrder = categories
      .filter((c) => c.type === type)
      .reduce((m, c) => Math.max(m, c.order), -1);

    const newCategory = addCategory({
      name: trimmed,
      icon: iconKey,
      color,
      type,
      order: maxOrder + 1,
    });

    // 同时创建对应 Folder（仅支出/收入均创建）
    const maxFolderOrder = folders.reduce((m, f) => Math.max(m, f.order), -1);
    addFolder({
      categoryId: newCategory.id,
      name: trimmed,
      icon: iconKey,
      color,
      order: maxFolderOrder + 1,
    });

    onCreated?.(newCategory.id);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            ✕
          </button>
          <div className={styles.title}>新建分类</div>
          <div className={styles.placeholder} />
        </div>

        {/* 预览 */}
        <div className={styles.preview}>
          <div className={styles.previewFolder} style={{ background: color }}>
            <span className={styles.previewIcon}>
              <IconByKey icon={iconKey} size={20} weight="regular" color="#fff" />
            </span>
            <span className={styles.previewName}>{name.trim() || '新分类'}</span>
          </div>
        </div>

        {/* 类型切换 */}
        <div className={styles.typeToggle}>
          <button
            className={`${styles.typeBtn} ${type === 'expense' ? styles.typeBtnActive : ''}`}
            onClick={() => setType('expense')}
          >
            支出
          </button>
          <button
            className={`${styles.typeBtn} ${type === 'income' ? styles.typeBtnActive : ''}`}
            onClick={() => setType('income')}
          >
            收入
          </button>
        </div>

        {/* 名称输入 */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>名称</label>
          <input
            ref={nameRef}
            type="text"
            className={styles.fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：餐饮 / 工资"
            maxLength={8}
          />
        </div>

        {/* 图标选取（v2.1:Phosphor 线稿分组 picker） */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>图标</label>
          <div className={styles.iconPicker}>
            {ACCOUNTING_ICON_GROUPS.map((group) => (
              <div key={group.label} className={styles.iconGroup}>
                <div className={styles.iconGroupLabel}>{group.label}</div>
                <div className={styles.iconGroupRow}>
                  {group.icons.map((key) => (
                    <button
                      key={key}
                      className={`${styles.emojiChip} ${iconKey === key ? styles.emojiChipActive : ''}`}
                      onClick={() => setIconKey(key)}
                      aria-label={`选择图标 ${key}`}
                    >
                      <IconByKey icon={key} size={18} weight="regular" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 颜色选取 */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>颜色</label>
          <div className={styles.colorGrid}>
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                className={`${styles.colorChip} ${color === c ? styles.colorChipActive : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`选择颜色 ${c}`}
              />
            ))}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.submitBtn} onClick={handleSave}>
            新建
          </button>
        </div>
      </div>
    </div>
  );
}