/**
 * AddRecordModal — 完整添加 / 编辑记录弹窗
 *
 * 底部半屏模态框，支持：
 * - 金额输入（大字号）
 * - 类型切换（支出 / 收入）
 * - 分类选择（chip 列表）
 * - 备注输入
 * - 日期选择
 * - 账户选择
 *
 * 模式：
 * - add：添加新记录
 * - edit：编辑现有记录
 */
import { useEffect, useState, useRef, useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { AccountRecord, PoolConfig, RecordType } from '../../../lib/types';
import { IconByKey } from '../../IconByKey';
import { AddCategoryModal } from '../AddCategoryModal';
import styles from './AddRecordModal.module.css';

interface AddRecordModalProps {
  open: boolean;
  /** 编辑模式：传入要编辑的记录 */
  editingRecord?: AccountRecord | null;
  /** 默认日期（YYYY-MM-DD） */
  defaultDate?: string;
  /** 默认类型 */
  defaultType?: RecordType;
  onClose: () => void;
  /** 保存成功 */
  onSaved?: (recordId: string) => void;
}

export function AddRecordModal({
  open,
  editingRecord,
  defaultDate,
  defaultType,
  onClose,
  onSaved,
}: AddRecordModalProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const categories = useAccountStore((s) => s.categories);
  const pools = useAccountStore((s) => s.pools);
  const addRecord = useAccountStore((s) => s.addRecord);
  const updateRecord = useAccountStore((s) => s.updateRecord);
  const deleteRecord = useAccountStore((s) => s.deleteRecord);
  const claimToPool = useAccountStore((s) => s.claimToPool);
  const unclaimToPool = useAccountStore((s) => s.unclaimToPool);

  // 表单状态
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<RecordType>(defaultType ?? 'expense');
  const [categoryId, setCategoryId] = useState<string>('');
  const [note, setNote] = useState('');
  const [dateKey, setDateKey] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  /** v2.3：关联池（认领入口）；''=不关联 */
  const [poolId, setPoolId] = useState<string>('');
  /** v2.5-patch5 N-485：移除存钱目标关联 UI（goalId 不再写入） */
  const [error, setError] = useState<string | null>(null);
  /** v2.5-patch6：内嵌打开「添加分类」 */
  const [showAddCategory, setShowAddCategory] = useState(false);
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
      setPoolId(editingRecord.poolId ?? '');
    } else {
      setAmountStr('');
      setType(defaultType ?? 'expense');
      setCategoryId('');
      setNote('');
      setDateKey(defaultDate ?? getTodayKey());
      setAccountId(accounts[0]?.id ?? '');
      setPoolId('');
    }
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

  // v2.3+v2.4：可认领的池（同方向均摊池 + 任意存池型）
  const claimablePools = useMemo(
    () => pools.filter((p) => p.type === 'deposit' || (p.direction ?? 'expense') === type),
    [pools, type],
  );

  // v2.5-fixbug (T-043)：编辑模式下若当前关联池已退休（不在 pools 里），
  // 在下拉里追加一项「{poolName}（已退休）」，让用户能保留现状或解绑。
  const editablePoolOptions = useMemo<PoolConfig[]>(() => {
    if (!editingRecord?.poolId) return claimablePools;
    if (claimablePools.find((p) => p.id === editingRecord.poolId)) return claimablePools;
    const retiredName = editingRecord.poolName ?? '未知池';
    return [
        {
          id: editingRecord.poolId,
          name: `${retiredName}（已退休）`,
          type: 'equalize',
          amount: 0,
          cycleMonths: 0,
          createdAt: 0,
        } as PoolConfig,
        ...claimablePools,
      ];
  }, [claimablePools, editingRecord]);

  // 类型切换时重置分类选择（及不再可认领的池）
  useEffect(() => {
    if (!categoryId || !filteredCategories.find((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ?? '');
    }
    if (poolId && !editablePoolOptions.find((p) => p.id === poolId)) {
      setPoolId('');
    }
  }, [type, filteredCategories, categoryId, editablePoolOptions, poolId]);

  const handleSave = () => {
    const amount = parseAmountToNumber(amountStr);
    if (!isFinite(amount) || amount <= 0) {
      setError('请输入有效金额');
      return;
    }
    if (!categoryId) {
      setError('请选择分类');
      return;
    }
    // v2.4 T-409：账户可为空（未归入），总资产卡以调整项展示

    // 支出存负数，收入存正数
    const signedAmount = type === 'expense' ? -amount : amount;

    if (editingRecord) {
      const oldPoolId = editingRecord.poolId;
      const newPoolId = poolId || undefined; // '' → undefined 表示解绑
      updateRecord(editingRecord.id, {
        amount: signedAmount,
        type,
        categoryId,
        note: note.trim() || undefined,
        dateKey,
        accountId,
        // v2.5-patch5 N-485：移除存钱目标字段，不再写入 goalId
        // v2.4 T-410：弹窗内必然选中了真实分类，清除未分类状态
        isUncategorized: false,
      });
      // v2.5-fixbug (T-043)：编辑模式下处理池关联变化
      // 先解绑旧池（含 cycles[].paidAmount / transactions 回退），再认领到新池
      if (oldPoolId && oldPoolId !== newPoolId) {
        unclaimToPool(editingRecord.id);
      }
      if (newPoolId && newPoolId !== oldPoolId) {
        claimToPool(editingRecord.id, newPoolId);
      }
      onSaved?.(editingRecord.id);
    } else {
      const record = addRecord({
        dateKey,
        amount: signedAmount,
        type,
        categoryId,
        note: note.trim() || undefined,
        accountId,
      });
      // v2.3：关联池认领（未匹配部分正常记账不挂池）
      if (poolId) {
        claimToPool(record.id, poolId);
      }
      onSaved?.(record.id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingRecord) return;
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
    return isFinite(amt) && amt > 0 && !!categoryId;
  };

  const handleSaveAndAgain = () => {
    if (!canSubmit()) {
      // 若分类未选：只报错，不关闭
      const amt = parseAmountToNumber(amountStr);
      if (!isFinite(amt) || amt <= 0) { setError('请输入有效金额'); return; }
      if (!categoryId) { setError('请选择分类'); return; }
      return;
    }
    handleSave();
    // 关键：保留分类 / 日期 / 账户，仅清空金额，方便快速连记
    setAmountStr('');
    setError(null);
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

        {/* ── 分类：4 列网格（可滑动），最后一项是 + 添加 ── */}
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
          {/* v2.5-patch6：自定义添加分类按钮（每种类型下都能添加） */}
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

        {/* ── 备注 + 金额 一行（两列：备注占主，金额占辅） ── */}
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
          <div className={styles.miniAmountCell}>
            <span className={styles.miniAmountCurrency}>¥</span>
            <div className={styles.miniAmountText}>
              {amountStr ? formatAmountDisplay(amountStr) : <span className={styles.amountDisplayPlaceholder}>0.00</span>}
            </div>
            {/* 隐藏的 input — 阻止 native keyboard */}
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

        {/* ── 字段行：日期 / 池关联 / 账户（三列并排） ── */}
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
          <span className={styles.fieldDivider} aria-hidden />
          <div className={styles.fieldCell}>
            <div className={styles.fieldLabel}>池</div>
            <select
              className={styles.fieldInput}
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              aria-label="池关联"
            >
              <option value="">无</option>
              {editablePoolOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.type === 'equalize' ? '均摊' : '存池'}）
                </option>
              ))}
            </select>
          </div>
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

        {/* ── 数字键盘：固定最底部（移动端输入控件） ── */}
        <div className={styles.numpad} role="group" aria-label="数字键盘">
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('7')}>7</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('8')}>8</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('9')}>9</button>
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

          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('1')}>1</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('2')}>2</button>
          <button type="button" className={styles.numpadKey} onClick={() => handleNumpadKey('3')}>3</button>
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

      {/* v2.5-patch6：自定义添加分类 — 内嵌在弹窗里打开 */}
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

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 处理 numpad 按键
 *
 * 表达式输入：把当前 amountStr 当成「数字 + 运算符 + 数字」的算式缓冲，
 * 支持 `20-10.5` 这类连续运算。规则：
 *  - 数字：追加；前导 0 时替换而非累加
 *  - 小数点：当前数字块只能有一个
 *  - `+` / `−`：数字后追加运算符；末尾已运算符则替换
 *  - 长度上限 16 字符
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

/** 取表达式里「最后一个数字块」 */
function lastNumberBlock(expr: string): string {
  const m = expr.match(/[0-9]+(?:\.[0-9]*)?$/);
  return m ? m[0] : '';
}

/** 从左到右计算 `a±b±c`（仅 + / −） */
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

/**
 * 格式化金额显示。
 *  - 纯数字：千分位 + 保留必要小数（`1234.5` → `"1,234.5"`）
 *  - 表达式：原样显示 + `= 预览结果`（`20-10.5` → `"20-10.5 = 9.5"`）
 */
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

/**
 * 把 amountStr 解析成可保存的数字（仅数字部分走表达式求值）。
 */
export function parseAmountToNumber(raw: string): number {
  if (!raw) return NaN;
  if (/[+\u2212]/.test(raw)) return evalAmountExpr(raw);
  return parseFloat(raw);
}
