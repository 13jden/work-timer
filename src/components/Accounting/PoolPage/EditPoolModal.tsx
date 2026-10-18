/**
 * @fileoverview EditPoolModal — 编辑定期账弹窗（TASK-058 T-586）
 *
 * 简化重排（替代原来的复杂表单）：
 * - 常用字段外露：名称、日期范围 / 押金金额、结算方式
 * - 高级选项折叠：分类、日均金额
 *
 * 机制红线：不动 lib/accounting/pool.ts 任何生成 / 认领 / 回滚逻辑。
 */
import { useEffect, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import {
  eachMonthInRange,
  buildDateRangeKeys,
} from '../../../lib/accounting/pool';
import { DateRangePicker } from './DateRangePicker';
import styles from './PoolPage.module.css';

interface EditPoolModalProps {
  open: boolean;
  poolId: string | null;
  onClose: () => void;
}

export function EditPoolModal({ open, poolId, onClose }: EditPoolModalProps) {
  const pool = useAccountStore((s) =>
    poolId ? s.pools.find((p) => p.id === poolId) ?? null : null,
  );
  const categories = useAccountStore((s) => s.categories);
  const updatePool = useAccountStore((s) => s.updatePool);

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dailyStr, setDailyStr] = useState('');
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [pickEnd, setPickEnd] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [settleMode, setSettleMode] = useState<'prepay' | 'postpay'>('prepay');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pool) return;
    setName(pool.name);
    setAmountStr(String(pool.amount ?? ''));
    setDailyStr(pool.dailyAmount != null ? String(pool.dailyAmount) : '');
    setPickStart(pool.dateRange?.start ?? null);
    setPickEnd(pool.dateRange?.end ?? null);
    setCategoryId(pool.categoryId ?? '');
    setSettleMode(pool.settleMode ?? 'prepay');
    setAdvancedOpen(false);
    setError(null);
  }, [open, pool]);

  if (!open || !pool) return null;

  const isEqualize = pool.type === 'equalize';
  const isIncome = pool.direction === 'income';
  const directionCategories = categories.filter((c) => c.type === (isIncome ? 'income' : 'expense'));

  let days = 0;
  let dateRange: { start: string; end: string } | undefined;
  if (pickStart && pickEnd) {
    dateRange = { start: pickStart, end: pickEnd };
    days = eachMonthInRange(dateRange).reduce(
      (sum, mk) => sum + buildDateRangeKeys(dateRange as { start: string; end: string }, mk).length,
      0,
    );
  }

  const dailyVal = parseFloat(dailyStr);
  const amountVal = parseFloat(amountStr);
  const hasDaily = isFinite(dailyVal) && dailyVal > 0;
  const hasAmount = isFinite(amountVal) && amountVal > 0;
  const derivedTotal = hasDaily && days > 0 ? Math.round(dailyVal * days * 100) / 100 : null;
  const derivedDaily =
    !hasDaily && hasAmount && days > 0 ? Math.round((amountVal / days) * 100) / 100 : null;

  const handlePick = (start: string | null, end: string | null) => {
    setPickStart(start);
    setPickEnd(end);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('请输入名称');
      return;
    }

    if (!isEqualize) {
      if (!hasAmount) {
        setError('请输入押金金额');
        return;
      }
      updatePool(pool.id, {
        name: name.trim(),
        settleMode,
        amount: amountVal,
        categoryId: categoryId || undefined,
      });
      onClose();
      return;
    }

    // 均摊型
    if (!pickStart || !pickEnd || !dateRange) {
      setError('请在日历上选择日期范围');
      return;
    }
    if (!hasDaily && !hasAmount) {
      setError('请填写日均或总额（二选一）');
      return;
    }
    if (days <= 0) {
      setError('所选范围内没有有效天数');
      return;
    }

    const total = hasDaily ? Math.round(dailyVal * days * 100) / 100 : amountVal;

    // 若已认领金额 > 新总额，阻止修改
    const poolCycles = useAccountStore.getState().cycles.filter((c) => c.poolId === pool.id);
    const claimedTotal = poolCycles.reduce((sum, c) => sum + (c.paidAmount ?? 0), 0);
    if (claimedTotal > total + 1e-9) {
      setError(`已认领 ¥${claimedTotal.toFixed(2)}，超过新总额 ¥${total.toFixed(2)}，无法缩小`);
      return;
    }

    updatePool(pool.id, {
      name: name.trim(),
      amount: total,
      cycleMode: 'daily',
      dateRange,
      dailyAmount: hasDaily ? dailyVal : undefined,
      categoryId: categoryId || undefined,
      cycleMonths: eachMonthInRange(dateRange).length,
    });
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>编辑定期账「{pool.name}」</div>

        {/* 类型锁定提示 */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>类型</label>
          <div className={styles.typeRow}>
            <div
              className={`${styles.typeOpt} ${styles.typeOptActive}`}
              style={{ cursor: 'default' }}
            >
              <span className={styles.typeOptName}>
                {isEqualize
                  ? isIncome ? '均摊·收入' : '均摊·支出'
                  : (pool.settleMode ?? 'prepay') === 'postpay' ? '押金·未付' : '押金·已付'}
              </span>
            </div>
          </div>
        </div>

        {/* 名称 */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>名称</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：房租"
            maxLength={20}
          />
        </div>

        {/* 均摊：日期范围 */}
        {isEqualize && (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>日期范围</label>
              <DateRangePicker start={pickStart} end={pickEnd} onPick={handlePick} />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>金额（日均 / 总额 二选一）</label>
              <div className={styles.rangeRow}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={styles.fieldInput}
                  value={dailyStr}
                  onChange={(e) => setDailyStr(e.target.value)}
                  placeholder="日均"
                  aria-label="日均金额"
                />
                <span className={styles.rangeSep}>/</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={styles.fieldInput}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="总额"
                  aria-label="总金额"
                />
              </div>
              {days > 0 && <div className={styles.hint}>共 {days} 天</div>}
              {derivedTotal !== null && (
                <div className={styles.hint}>日均 ¥{dailyVal} × {days} 天 = 总额 ¥{derivedTotal}</div>
              )}
              {derivedDaily !== null && (
                <div className={styles.hint}>总额 ¥{amountVal} ÷ {days} 天 = 日均 ¥{derivedDaily}</div>
              )}
            </div>
          </>
        )}

        {/* 押金：结算方式 + 金额 */}
        {!isEqualize && (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>结算方式</label>
              <div className={styles.typeRow}>
                <button
                  type="button"
                  className={`${styles.typeOpt} ${settleMode === 'prepay' ? styles.typeOptActive : ''}`}
                  onClick={() => setSettleMode('prepay')}
                >
                  <span className={styles.typeOptName}>押金·先付</span>
                  <span className={styles.typeOptDesc}>钱已付出，可退 · 计入绿色资产</span>
                </button>
                <button
                  type="button"
                  className={`${styles.typeOpt} ${settleMode === 'postpay' ? styles.typeOptActive : ''}`}
                  onClick={() => setSettleMode('postpay')}
                >
                  <span className={styles.typeOptName}>先用后付</span>
                  <span className={styles.typeOptDesc}>尚未支付 · 红色待付</span>
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>押金金额（¥）</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={styles.fieldInput}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </>
        )}

        {/* 高级选项折叠 */}
        <button
          type="button"
          className={styles.advancedToggle}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? '收起' : '高级选项'}
          <span className={styles.advancedToggleArrow}>{advancedOpen ? ' ▲' : ' ▼'}</span>
        </button>

        {advancedOpen && (
          <div className={styles.advancedSection}>
            {/* 分类 */}
            {isEqualize && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>挂载分类</label>
                <div className={styles.catGrid}>
                  {directionCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`${styles.catChipPool} ${categoryId === cat.id ? styles.catChipActive : ''}`}
                      onClick={() => setCategoryId(cat.id)}
                      style={{ backgroundColor: categoryId === cat.id ? cat.color : undefined }}
                    >
                      <span className={styles.catName}>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
          保存
        </button>
      </div>
    </div>
  );
}
