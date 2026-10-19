/**
 * AddRecordModal — 完整添加 / 编辑记录弹窗
 *
 * 底部半屏模态框，支持：
 * - 金额输入（大字号）
 * - 类型切换（支出 / 收入）
 * - 分类选择（chip 列表，最多 2.5 行可滚动 — v3.0 TASK-056 用户要求）
 * - 备注输入
 * - 附图（v3.0 TASK-056：右侧图片按钮 / 已选时显示缩略图）
 * - 日期选择
 * - 账户选择
 *
 * 模式：
 * - add：添加新记录
 * - edit：编辑现有记录
 */
import { useEffect, useState, useRef, useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { useConfigStore } from '../../../store/configStore';
import type { AccountRecord, RecordType } from '../../../lib/types';
import { IconByKey } from '../../IconByKey';
import { AddCategoryModal } from '../AddCategoryModal';
import { compressImage, genImageId, ImageCompressError } from '../../../lib/imageCompress';
import { putImage, isImageDBSupported } from '../../../lib/imageStore';
import { useImage } from '../../../hooks/useImage';
import styles from './AddRecordModal.module.css';

interface AddRecordModalProps {
  open: boolean;
  /** 编辑模式：传入要编辑的记录 */
  editingRecord?: AccountRecord | null;
  /** 默认日期（YYYY-MM-DD） */
  defaultDate?: string;
  /** 默认类型 */
  defaultType?: RecordType;
  /** v3.0 TASK-057：钱包详情页快捷添加时预填账户 ID（开启钱包时生效） */
  defaultAccountId?: string;
  /** v3.0 TASK-059：从一程详情页添加时预填所属一程 */
  defaultJourneyId?: string;
  onClose: () => void;
  /** 保存成功 */
  onSaved?: (recordId: string) => void;
}

export function AddRecordModal({
  open,
  editingRecord,
  defaultDate,
  defaultType,
  defaultAccountId,
  defaultJourneyId,
  onClose,
  onSaved,
}: AddRecordModalProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const categories = useAccountStore((s) => s.categories);
  const pools = useAccountStore((s) => s.pools);
  const records = useAccountStore((s) => s.records);
  const addRecord = useAccountStore((s) => s.addRecord);
  const updateRecord = useAccountStore((s) => s.updateRecord);
  const deleteRecord = useAccountStore((s) => s.deleteRecord);
  const deleteRecordCascade = useAccountStore((s) => s.deleteRecordCascade);
  // v3.0 TASK-057：钱包模式开关。关闭时不展示账户选择器
  const walletEnabled = useConfigStore((s) => s.walletEnabled ?? false);

  // 表单状态
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<RecordType>(defaultType ?? 'expense');
  const [categoryId, setCategoryId] = useState<string>('');
  const [note, setNote] = useState('');
  const [dateKey, setDateKey] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  // v3.0 TASK-056：图片状态
  // - pendingBlob: 用户新选的、待 save 时入库的 Blob
  // - pendingId: 与 pendingBlob 配对的 imageId（genImageId 在选中时分配）
  // - removeExisting: 编辑模式下，用户点了「移除」要清除旧图
  // - previewUrl: pendingBlob 的 ObjectURL（用于 modal 内的缩略图预览）
  // - imageStatus: idle / compressing / ready / error
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<'idle' | 'compressing' | 'ready' | 'error'>('idle');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);

  // 初始化表单
  useEffect(() => {
    if (!open) return;
    if (editingRecord) {
      setAmountStr(String(Math.abs(editingRecord.amount)));
      setType(editingRecord.type);
      setCategoryId(editingRecord.categoryId);
      setNote(editingRecord.note ?? '');
      setDateKey(editingRecord.dateKey);
      setAccountId(editingRecord.accountId);
    } else {
      setAmountStr('');
      setType(defaultType ?? 'expense');
      setCategoryId('');
      setNote('');
      setDateKey(defaultDate ?? getTodayKey());
      // v3.0 TASK-057：钱包关闭时 accountId 恒为 ''（不展示账户选择器）；
      // 但若从 AccountDetailPage 显式传入了 defaultAccountId，优先使用（保持账户归属）
      if (defaultAccountId) {
        setAccountId(defaultAccountId);
      } else if (!walletEnabled) {
        setAccountId('');
      } else {
        setAccountId(accounts[0]?.id ?? '');
      }
    }
    // 打开 modal 时：清空上一轮的图片状态
    setPendingBlob(null);
    setPendingId(null);
    setRemoveExisting(false);
    setImageStatus('idle');
    setImageError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setError(null);
    const id = setTimeout(() => amountRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, [open, editingRecord, defaultDate, defaultType, accounts]);

  /**
   * v2.5-patch6 N-491:mobile 键盘弹起→收起后,grid item 行高偶发被压缩 / gap 失效
   * (浏览器对 max-height + overflow-y:auto 容器内的 grid 重排 bug)
   * 兜底:视觉视口变化时强制重排 modal 容器,触发 grid 重新计算。
   */
  useEffect(() => {
    if (!open) return;
    const onViewportResize = () => {
      // 触发一次 reflow,让 grid 重新测量
      const modal = document.querySelector(`.${styles.modal}`) as HTMLElement | null;
      if (!modal) return;
      modal.style.display = 'none';
      // eslint-disable-next-line no-unused-expressions
      modal.offsetHeight; // force reflow
      modal.style.display = '';
    };
    window.visualViewport?.addEventListener('resize', onViewportResize);
    window.addEventListener('orientationchange', onViewportResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      window.removeEventListener('orientationchange', onViewportResize);
    };
  }, [open]);

  // 过滤当前类型下的分类
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  // 类型切换时重置分类选择
  useEffect(() => {
    if (!categoryId || !filteredCategories.find((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ?? '');
    }
  }, [type, filteredCategories, categoryId]);

  // ── v3.0 TASK-056：图片处理 ──────────────────────────────
  const handlePickFile = async (file: File) => {
    if (!isImageDBSupported()) {
      setImageError('当前环境不支持图片存储');
      setImageStatus('error');
      return;
    }
    setImageStatus('compressing');
    setImageError(null);
    try {
      const { blob } = await compressImage(file);
      // 释放旧 preview URL
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setPendingBlob(blob);
      setPendingId(genImageId());
      // 编辑模式下选了新图 → 旧图不应再被 removeExisting 标记清掉（由 store 级联处理）
      setRemoveExisting(false);
      setImageStatus('ready');
    } catch (e) {
      const msg = e instanceof ImageCompressError
        ? e.code === 'UNSUPPORTED_FORMAT' ? '该图片格式暂不支持' : '图片处理失败'
        : '图片处理失败';
      setImageError(msg);
      setImageStatus('error');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handlePickFile(file);
    // 重置 value 以便重复选同一张图
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPendingBlob(null);
    setPendingId(null);
    setImageStatus('idle');
    setImageError(null);
    // 编辑模式下：标记删除现有图（save 时会传给 updateRecord）
    if (editingRecord?.imageId) setRemoveExisting(true);
  };

  // 弹窗关闭时回收 previewUrl（保险 — 上面 effect 也做了）
  useEffect(() => {
    if (!open) return;
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [open]);

  // 是否在弹窗内显示图片预览（优先级：新选的 > 编辑模式原有的）
  const showPreview = !!(previewUrl && pendingBlob);
  const editingHasImage = !!editingRecord?.imageId && !removeExisting && !pendingBlob;
  const showEditingImage = editingHasImage;

  const handleSave = async () => {
    const amount = parseAmountToNumber(amountStr);
    if (!isFinite(amount) || amount <= 0) {
      setError('请输入有效金额');
      return;
    }
    if (!categoryId) {
      setError('请选择分类');
      return;
    }

    const signedAmount = type === 'expense' ? -amount : amount;

    // v3.0 TASK-056：先入库待保存图片（成功后再写记录）
    let savedImageId: string | undefined;
    if (pendingBlob && pendingId) {
      const ok = await putImage(pendingId, pendingBlob);
      if (!ok) {
        setError('图片保存失败，请重试');
        return;
      }
      savedImageId = pendingId;
    } else if (editingRecord?.imageId && !removeExisting && !pendingBlob) {
      // 编辑但未改图：保留旧 imageId
      savedImageId = editingRecord.imageId;
    } else if (editingRecord && removeExisting) {
      // 编辑且明确移除：不传 imageId
      savedImageId = undefined;
    }

    const patchBase = {
      amount: signedAmount,
      type,
      categoryId,
      note: note.trim() || undefined,
      dateKey,
      accountId,
      isUncategorized: false,
      // v3.0 TASK-059：从一程详情页添加时预填所属一程
      ...(defaultJourneyId ? { journeyId: defaultJourneyId } : {}),
    };

    if (editingRecord) {
      // 含 imageId 字段（即便 undefined）以触发 store 的级联清理
      updateRecord(editingRecord.id, {
        ...patchBase,
        imageId: savedImageId,
      });
      onSaved?.(editingRecord.id);
    } else {
      const record = addRecord({
        ...patchBase,
        ...(savedImageId ? { imageId: savedImageId } : {}),
      });
      onSaved?.(record.id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingRecord) return;
    if (editingRecord.poolStatus === 'claimed' && editingRecord.poolId) {
      const poolExists = pools.some((p) => p.id === editingRecord.poolId);
      const poolRecords = records.filter((r) => r.poolId === editingRecord.poolId);
      if (!poolExists || poolRecords.length > 1) {
        const msg = !poolExists
          ? `该记录所属池已退休。删除此入账记录会同时删除该池关联的全部 ${poolRecords.length} 条记录（含每日均摊记录和其他入账记录），是否继续？`
          : `该池还有 ${poolRecords.length} 条关联记录。删除此入账记录会同时删除全部 ${poolRecords.length} 条记录，是否继续？`;
        if (!window.confirm(msg)) return;
        deleteRecordCascade(editingRecord.id);
        onSaved?.(editingRecord.id);
        onClose();
        return;
      }
    }
    if (!window.confirm('确定删除这条记录？')) return;
    deleteRecord(editingRecord.id);
    onSaved?.(editingRecord.id);
    onClose();
  };

  if (!open) return null;

  // ── Numpad 数字键盘处理 ──
  const handleNumpadKey = (key: string) => {
    setError(null);
    setAmountStr((prev) => applyNumpadKey(prev, key));
  };

  const handleNumpadBackspace = () => {
    setError(null);
    setAmountStr((prev) => prev.slice(0, -1));
  };

  const resolveAmount = (): number => parseAmountToNumber(amountStr);

  const canSubmit = () => {
    const amt = resolveAmount();
    return isFinite(amt) && amt > 0 && !!categoryId && imageStatus !== 'compressing';
  };

  const handleSaveAndAgain = async () => {
    if (!canSubmit()) {
      const amt = parseAmountToNumber(amountStr);
      if (!isFinite(amt) || amt <= 0) { setError('请输入有效金额'); return; }
      if (!categoryId) { setError('请选择分类'); return; }
      return;
    }
    const amount = parseAmountToNumber(amountStr);
    const signedAmount = type === 'expense' ? -amount : amount;
    let savedImageId: string | undefined;
    if (pendingBlob && pendingId) {
      const ok = await putImage(pendingId, pendingBlob);
      if (!ok) {
        setError('图片保存失败，请重试');
        return;
      }
      savedImageId = pendingId;
    } else if (editingRecord?.imageId && !removeExisting && !pendingBlob) {
      savedImageId = editingRecord.imageId;
    }
    const patchBase = {
      amount: signedAmount,
      type,
      categoryId,
      note: note.trim() || undefined,
      dateKey,
      accountId,
      isUncategorized: false,
      // v3.0 TASK-059：从一程详情页添加时预填所属一程
      ...(defaultJourneyId ? { journeyId: defaultJourneyId } : {}),
    };
    if (editingRecord) {
      updateRecord(editingRecord.id, { ...patchBase, imageId: savedImageId });
      onSaved?.(editingRecord.id);
    } else {
      const record = addRecord({
        ...patchBase,
        ...(savedImageId ? { imageId: savedImageId } : {}),
      });
      onSaved?.(record.id);
    }
    setAmountStr('');
    setNote('');
    setError(null);
    // 保留 imageId（在 IndexedDB 仍在用），清掉本地 blob 引用即可
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPendingBlob(null);
    setPendingId(null);
    setImageStatus('idle');
    setImageError(null);
    if (editingRecord?.imageId && removeExisting) setRemoveExisting(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* v2.5-patch6：极简 top bar — 关闭按钮 + 居中 eyebrow 标题 */}
        <div className={styles.topBar}>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            ✕
          </button>
          <div className={styles.topTitle}>
            {editingRecord ? '编辑记录' : '记一笔'}
          </div>
          <div className={styles.topSpacer} />
        </div>

        {/* ── 类型切换：−/+ 大按钮 + 文字标签 ── */}
        <div className={styles.typeRow}>
          <button
            type="button"
            className={styles.typeBackBtn}
            onClick={onClose}
            aria-label="返回"
            title="返回"
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.typeBtn} ${type === 'expense' ? styles.typeBtnExpenseActive : ''}`}
            onClick={() => setType('expense')}
          >
            <span className={styles.typeSign}>−</span>
            <span>支出</span>
          </button>
          <button
            type="button"
            className={`${styles.typeBtn} ${type === 'income' ? styles.typeBtnIncomeActive : ''}`}
            onClick={() => setType('income')}
          >
            <span className={styles.typeSign}>+</span>
            <span>收入</span>
          </button>
        </div>

        {/* ── 分类：v3.0 TASK-056 用户要求 4 列 × 2.5 行可滚动，不撑爆弹窗 ── */}
        <div className={styles.catGridScroll}>
          <div className={styles.catGrid}>
            {filteredCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.catGridCell} ${categoryId === cat.id ? styles.catGridCellActive : ''}`}
                onClick={() => setCategoryId(cat.id)}
                style={{
                  borderColor: categoryId === cat.id ? cat.color : undefined,
                  backgroundColor: categoryId === cat.id ? cat.color : undefined,
                }}
              >
                <span className={styles.catIcon}>
                  <IconByKey icon={cat.icon} size={18} weight="regular" color={categoryId === cat.id ? '#fff' : cat.color} />
                </span>
                <span className={styles.catName}>{cat.name}</span>
              </button>
            ))}
            <button
              type="button"
              className={styles.catGridCellAdd}
              onClick={() => setShowAddCategory(true)}
              aria-label="添加分类"
              title="添加分类"
            >
              <span className={styles.catAddSign}>+</span>
              <span className={styles.catName}>添加</span>
            </button>
          </div>
        </div>

        {/* ── 备注 + 金额 + 图片按钮 一行（v3.0 TASK-056） ── */}
        <div className={styles.noteAmountRow}>
          <input
            type="text"
            className={styles.minimalNote}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注（选填）"
            maxLength={50}
            aria-label="备注"
          />
          {/* v3.0 TASK-056：图片按钮（备注右侧）/ 选中时显示缩略图 */}
          {showPreview || showEditingImage ? (
            <div className={styles.imagePreviewChip}>
              {showPreview && previewUrl ? (
                <img src={previewUrl} alt="" className={styles.imagePreviewImg} />
              ) : showEditingImage && editingRecord?.imageId ? (
                <EditingImageThumb imageId={editingRecord.imageId} />
              ) : null}
              <button
                type="button"
                className={styles.imagePreviewRemove}
                onClick={handleRemoveImage}
                aria-label="移除图片"
                title="移除图片"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.imageAddBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={imageStatus === 'compressing'}
              aria-label="添加图片"
              title="添加图片"
            >
              {imageStatus === 'compressing' ? '…' : '🖼'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className={styles.fileInputHidden}
            aria-hidden
          />
          <div className={styles.miniAmountCell}>
            <span className={styles.miniAmountCurrency}>¥</span>
            <div className={styles.miniAmountText}>
              {amountStr ? formatAmountDisplay(amountStr) : <span className={styles.amountDisplayPlaceholder}>0.00</span>}
            </div>
            <input
              ref={amountRef}
              type="text"
              readOnly
              tabIndex={-1}
              aria-hidden
              className={styles.amountDisplayHidden}
              value={amountStr}
              onChange={() => {}}
            />
          </div>
        </div>

        {/* v3.0 TASK-056：图片错误提示 */}
        {imageError && <div className={styles.error}>{imageError}</div>}

        {/* ── 字段行：日期 / 账户(v3.0 TASK-057：钱包关闭时仅日期) ── */}
        <div className={styles.fieldRow}>
          <div className={styles.fieldCell}>
            <div className={styles.fieldLabel}>日期</div>
            <input
              type="date"
              className={styles.fieldInput}
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              aria-label="日期"
            />
          </div>
          {walletEnabled && (
            <>
              <span className={styles.fieldDivider} aria-hidden />
              <div className={styles.fieldCell}>
                <div className={styles.fieldLabel}>账户</div>
                <select
                  className={styles.fieldInput}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  aria-label="账户"
                >
                  <option value="">未归入</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {editingRecord && (
          <button
            className={styles.deleteBtn}
            onClick={handleDelete}
            aria-label="删除记录"
          >
            删除这条记录
          </button>
        )}

        {/* ── 数字键盘 ── */}
        <div className={styles.numpad} role="group" aria-label="数字键盘">
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('1')}>1</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('2')}>2</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('3')}>3</button>
          <button
            type="button"
            className={`${styles.numpadKey} ${styles.numpadKeyAction}`}
            onClick={handleNumpadBackspace}
            aria-label="删除"
          >
            ⌫
          </button>

          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('4')}>4</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('5')}>5</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('6')}>6</button>
          <button
            type="button"
            className={`${styles.numpadKey} ${styles.numpadKeyAction}`}
            onClick={() => handleNumpadKey('+')}
            aria-label="加"
            title="加"
          >
            +
          </button>

          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('7')}>7</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('8')}>8</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('9')}>9</button>
          <button
            type="button"
            className={`${styles.numpadKey} ${styles.numpadKeyAction}`}
            onClick={() => handleNumpadKey('\u2212')}
            aria-label="减"
            title="减"
          >
            −
          </button>

          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('0')}>0</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('.')}>.</button>
          <button
            type="button"
            className={`${styles.numpadKey} ${styles.numpadKeyAgain}`}
            onClick={handleSaveAndAgain}
            disabled={!canSubmit()}
          >
            再记
          </button>
          <button
            type="button"
            className={`${styles.numpadKey} ${styles.numpadKeyDone}`}
            onClick={handleSave}
            disabled={!canSubmit()}
          >
            完成
          </button>
        </div>
      </div>

      {showAddCategory && (
        <AddCategoryModal
          open={showAddCategory}
          defaultType={type}
          onClose={() => setShowAddCategory(false)}
          onCreated={(newId) => {
            setCategoryId(newId);
            setShowAddCategory(false);
          }}
        />
      )}
    </div>
  );
}

/** 编辑模式下显示已有图片缩略图（包一层 useImage hook） */
function EditingImageThumb({ imageId }: { imageId: string }) {
  const { url, status } = useImage(imageId);
  if (status === 'ok' && url) {
    return <img src={url} alt="" className={styles.imagePreviewImg} />;
  }
  return <span className={styles.imagePreviewImg} style={{ opacity: 0.2 }} />;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 处理 numpad 按键
 */
export function applyNumpadKey(prev: string, key: string): string {
  if (key === '.') {
    if (prev.length >= 16) return prev;
    const tail = lastNumberBlock(prev);
    if (tail.includes('.')) return prev;
    if (prev === '' || /[+\u2212]$/.test(prev)) return prev + '0.';
    return prev + '.';
  }
  if (/^[0-9]$/.test(key)) {
    if (prev.length >= 16) return prev;
    const tail = lastNumberBlock(prev);
    if (tail.length >= 10) return prev;
    if (tail === '0') return prev.slice(0, -1) + key;
    return prev + key;
  }
  if (key === '+' || key === '\u2212') {
    if (prev === '') return prev;
    if (/[+\u2212]$/.test(prev)) return prev.slice(0, -1) + key;
    if (prev.endsWith('.')) return prev + '0' + key;
    return prev + key;
  }
  return prev;
}

function lastNumberBlock(expr: string): string {
  const m = expr.match(/[0-9]+(?:\.[0-9]*)?$/);
  return m ? m[0] : '';
}

function evalAmountExpr(expr: string): number {
  let e = expr.replace(/[+\u2212.]+$/, '');
  if (!e) return NaN;
  const tokens: (number | string)[] = [];
  let buf = '';
  for (const ch of e) {
    if (ch === '+' || ch === '\u2212') {
      if (buf) {
        const n = parseFloat(buf);
        if (!isFinite(n)) return NaN;
        tokens.push(n);
      }
      tokens.push(ch);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) {
    const n = parseFloat(buf);
    if (!isFinite(n)) return NaN;
    tokens.push(n);
  }
  if (tokens.length === 0) return NaN;
  let acc = tokens[0] as number;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as string;
    const n = tokens[i + 1] as number;
    if (n === undefined) break;
    acc = op === '+' ? acc + n : acc - n;
  }
  return acc;
}

export function formatAmountDisplay(raw: string): string {
  if (!raw) return '';
  const hasOp = /[+\u2212]/.test(raw);
  if (!hasOp) {
    const [intPart, decPart] = raw.split('.');
    const intFmt = intPart ? Number(intPart).toLocaleString('en-US') : '';
    if (decPart === undefined) return intFmt;
    const dec = decPart.replace(/0+$/, '');
    return dec ? `${intFmt}.${dec}` : intFmt;
  }
  const result = evalAmountExpr(raw);
  if (!isFinite(result)) return raw;
  const resultStr = result.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${raw} = ${resultStr}`;
}

export function parseAmountToNumber(raw: string): number {
  if (!raw) return NaN;
  if (/[+\u2212]/.test(raw)) return evalAmountExpr(raw);
  return parseFloat(raw);
}
