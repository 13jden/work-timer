/**
 * AddCategoryModal — 新增分类弹窗
 *
 * 用于「分类文件夹」区域右上角「添加」按钮。
 * 支持：
 * - 名称输入
 * - 图标选取（Phosphor 线稿分组 picker）
 * - **自定义图片**（v3.2 TASK-070：上传一张图当分类图标，自动压缩到 256px）
 * - 颜色选取（内置色板）
 * - 类型选择（支出 / 收入）
 *
 * v2.1：仅保留最简表单，避免一次性引入过多字段。
 */
import { useState, useRef, useEffect } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { ACCOUNTING_ICON_GROUPS, IconByKey } from '../../IconByKey';
import { compressImage, genImageId, ImageCompressError } from '../../../lib/imageCompress';
import { putImage, isImageDBSupported } from '../../../lib/imageStore';
import type { RecordType } from '../../../lib/types';
import styles from './AddCategoryModal.module.css';

/** 分类图标的压缩参数 —— 比记账图片（1280px）小得多，256px 足够清晰 */
const CATEGORY_ICON_MAX_EDGE = 256;
const CATEGORY_ICON_QUALITY = 0.8;

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
  const categories = useAccountStore((s) => s.categories);

  const [name, setName] = useState('');
  const [type, setType] = useState<RecordType>(defaultType);
  const [iconKey, setIconKey] = useState<string>('box');
  const [color, setColor] = useState<string>(COLOR_PALETTE[8]!);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── v3.2 TASK-070：自定义图片 ────────────────────────────
  // pendingBlob: 用户新选的、待保存时入库的 Blob
  // pendingId:   与 pendingBlob 配对的 imageId
  // previewUrl:  pendingBlob 的 ObjectURL（弹层内缩略图）
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<'idle' | 'compressing' | 'ready'>('idle');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // 打开时重置 + 默认聚焦
  useEffect(() => {
    if (!open) return;
    setName('');
    setType(defaultType);
    setIconKey('box');
    setColor(COLOR_PALETTE[8]!);
    setError(null);
    setPendingBlob(null);
    setPendingId(null);
    setImageStatus('idle');
    setImageError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    const id = setTimeout(() => nameRef.current?.focus(), 250);
    return () => clearTimeout(id);
  }, [open, defaultType]);

  // 关闭 / 卸载时回收 ObjectURL
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  /** 选了自定义图片 → 线稿 picker 的选中态清空（图片优先） */
  const handlePickLineIcon = (key: string) => {
    setIconKey(key);
    // 有自定义图片时，线稿图标的选中态不该还亮着
    if (pendingBlob) {
      setPendingBlob(null);
      setPendingId(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
      setImageStatus('idle');
    }
  };

  /** 选图 → 压缩 → 预览 */
  const handlePickFile = async (file: File) => {
    if (!isImageDBSupported()) {
      setImageError('当前环境不支持图片存储');
      return;
    }
    setImageStatus('compressing');
    setImageError(null);
    try {
      const { blob } = await compressImage(file, CATEGORY_ICON_MAX_EDGE, CATEGORY_ICON_QUALITY);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setPendingBlob(blob);
      setPendingId(genImageId());
      setImageStatus('ready');
    } catch (err) {
      setImageStatus('idle');
      setImageError(
        err instanceof ImageCompressError && err.code === 'UNSUPPORTED_FORMAT'
          ? '这个格式不支持，换张 JPG / PNG 试试'
          : '图片处理失败，换一张试试',
      );
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 重置 value，否则同一张图连选两次不会触发 change
    e.target.value = '';
    if (file) void handlePickFile(file);
  };

  const handleSave = async () => {
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
    // v2.5 TASK-046 T-504：同名分类不允许（跨类型、与现有分类同名）
    const duplicate = categories.find((c) => c.name === trimmed);
    if (duplicate) {
      setError('该分类名称已存在，请换一个名字');
      return;
    }

    // 计算新分类的 order（同类末尾）
    const maxOrder = categories
      .filter((c) => c.type === type)
      .reduce((m, c) => Math.max(m, c.order), -1);

    // v3.2 TASK-070：先把图片写进 IndexedDB，写成功才建分类 ——
    // 反过来的话会出现「分类建好了但图没存进去」的孤儿分类。
    let iconImageId: string | undefined;
    if (pendingBlob && pendingId) {
      const ok = await putImage(pendingId, pendingBlob);
      if (!ok) {
        setError('图片保存失败，请重试');
        return;
      }
      iconImageId = pendingId;
    }

    // v2.5 TASK-046 T-504：addCategory 内部已同步创建 Folder，
    // 不能再调 addFolder —— 否则会重复建出两个 folder。
    const newCategory = addCategory({
      name: trimmed,
      icon: iconKey,
      ...(iconImageId ? { iconImageId } : {}),
      color,
      type,
      order: maxOrder + 1,
    });

    onCreated?.(newCategory.id);
    onClose();
  };

  /** 预览卡里的图标：有自定义图就显示图，否则显示线稿 */
  const hasCustomImage = !!previewUrl;

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
              {hasCustomImage && previewUrl ? (
                <img src={previewUrl} alt="" className={styles.customIconPreview} />
              ) : (
                <IconByKey icon={iconKey} size={20} weight="regular" color="#fff" />
              )}
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
                      className={`${styles.emojiChip} ${iconKey === key && !hasCustomImage ? styles.emojiChipActive : ''}`}
                      onClick={() => handlePickLineIcon(key)}
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

        {/* ── v3.2 TASK-070：自定义图片 ───────────────────── */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>自定义图片</label>
          <div className={styles.customImageRow}>
            {hasCustomImage && previewUrl ? (
              <div className={styles.customImageThumb}>
                <img src={previewUrl} alt="自定义分类图标" />
                <button
                  type="button"
                  className={styles.customImageRemove}
                  onClick={() => {
                    setPendingBlob(null);
                    setPendingId(null);
                    if (previewUrlRef.current) {
                      URL.revokeObjectURL(previewUrlRef.current);
                      previewUrlRef.current = null;
                    }
                    setPreviewUrl(null);
                    setImageStatus('idle');
                    setImageError(null);
                  }}
                  aria-label="移除自定义图片"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.customImagePick}
                onClick={() => fileInputRef.current?.click()}
                disabled={imageStatus === 'compressing'}
              >
                {imageStatus === 'compressing' ? '处理中…' : '＋ 选一张图'}
              </button>
            )}
            <span className={styles.customImageHint}>
              {imageError
                ? imageError
                : hasCustomImage
                  ? '已选好，会自动压缩到 256px'
                  : '从相册选一张图当分类图标'}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className={styles.fileInputHidden}
            tabIndex={-1}
            aria-hidden="true"
          />
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
          <button className={styles.submitBtn} onClick={handleSave} disabled={imageStatus === 'compressing'}>
            新建
          </button>
        </div>
      </div>
    </div>
  );
}
