/**
 * @fileoverview AddPoolModal — 建池弹窗（v2.3 · TASK-039）
 *
 * 均摊型统一为日历点选日期范围（可跨月，按自然月拆周期）：
 * 选开始/结束日期 + 填日均或总额。存池型仅填押金金额。
 * 建池不生成任何记录；均摊消费记录由日期到来时逐日生成。
 */
import { useEffect, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { PoolType } from '../../../lib/types';
import {
  eachMonthInRange,
  buildDateRangeKeys,
} from '../../../lib/accounting/pool';
import { DateRangePicker } from './DateRangePicker';
import styles from './PoolPage.module.css';

interface AddPoolModalProps {
  open: boolean;
  onClose: () => void;
}

/** 建池弹窗。 */
export function AddPoolModal({ open, onClose }: AddPoolModalProps) {
  const categories = useAccountStore((s) => s.categories);
  const createPoolWithCycles = useAccountStore((s) => s.createPoolWithCycles);

  const [name, setName] = useState('');
  const [type, setType] = useState<PoolType>('equalize');
  /** v2.4：资金方向（支出池 / 收入池） */
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');
  /** v2.5 T-416：存池结算方式（押金先付 / 先用后付） */
  const [settleMode, setSettleMode] = useState<'prepay' | 'postpay'>('prepay');
  const [amountStr, setAmountStr] = useState('');
  const [dailyStr, setDailyStr] = useState('');
  /** 日历选择的日期范围（YYYY-MM-DD） */
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [pickEnd, setPickEnd] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const directionCategories = categories.filter((c) => c.type === direction);

  useEffect(() => {
    if (!open) return;
    setName('');
    setType('equalize');
    setDirection('expense');
    setSettleMode('prepay');
    setAmountStr('');
    setDailyStr('');
    setPickStart(null);
    setPickEnd(null);
    setCategoryId(categories.find((c) => c.type === 'expense')?.id ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 方向切换时重置分类选择
  useEffect(() => {
    if (!directionCategories.find((c) => c.id === categoryId)) {
      setCategoryId(directionCategories[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  if (!open) return null;

  // ── 天数与金额联动推导 ──────────────────────────────
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
  // 推导展示：填日均 → 算总额；填总额 → 算日均
  const derivedTotal = hasDaily && days > 0 ? Math.round(dailyVal * days * 100) / 100 : null;
  const derivedDaily =
    !hasDaily && hasAmount && days > 0 ? Math.round((amountVal / days) * 100) / 100 : null;

  const handlePick = (start: string | null, end: string | null) => {
    setPickStart(start);
    setPickEnd(end);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('请输入池名称');
      return;
    }
    if (type === 'deposit') {
      if (!hasAmount) {
        setError('请输入押金金额');
        return;
      }
      createPoolWithCycles({
        name: name.trim(),
        type,
        amount: amountVal,
        cycleMonths: 1,
        direction,
        settleMode,
      });
      onClose();
      return;
    }

    // 均摊型：必须日历选择日期范围
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

    createPoolWithCycles({
      name: name.trim(),
      type,
      amount: total,
      cycleMonths: eachMonthInRange(dateRange).length,
      cycleMode: 'daily',
      dateRange,
      dailyAmount: hasDaily ? dailyVal : undefined,
      categoryId: categoryId || undefined,
      direction,
    });
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>新建池</div>

        <div className={styles.typeRow}>
          <button
            type="button"
            className={`${styles.typeOpt} ${type === 'equalize' ? styles.typeOptActive : ''}`}
            onClick={() => setType('equalize')}
          >
            <span className={styles.typeOptName}>均摊型</span>
            <span className={styles.typeOptDesc}>房租/会员 · 到期逐日记一笔</span>
          </button>
          <button
            type="button"
            className={`${styles.typeOpt} ${type === 'deposit' ? styles.typeOptActive : ''}`}
            onClick={() => setType('deposit')}
          >
            <span className={styles.typeOptName}>存池型</span>
            <span className={styles.typeOptDesc}>押金 · 存入/取出</span>
          </button>
        </div>

        {/* v2.4：资金方向 */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>资金方向</label>
          <div className={styles.typeRow}>
            <button
              type="button"
              className={`${styles.typeOpt} ${direction === 'expense' ? styles.typeOptActive : ''}`}
              onClick={() => setDirection('expense')}
            >
              <span className={styles.typeOptName}>支出</span>
              <span className={styles.typeOptDesc}>{type === 'equalize' ? '逐日记支出' : '支出=存入'}</span>
            </button>
            <button
              type="button"
              className={`${styles.typeOpt} ${direction === 'income' ? styles.typeOptActive : ''}`}
              onClick={() => setDirection('income')}
            >
              <span className={styles.typeOptName}>收入</span>
              <span className={styles.typeOptDesc}>{type === 'equalize' ? '逐日记收入' : '收入=存入'}</span>
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>名称</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'equalize' ? '如：房租' : '如：租房押金'}
            maxLength={20}
          />
        </div>

        {type === 'equalize' && (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>日期范围（日历点选，可跨月）</label>
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
                <div className={styles.hint}>
                  日均 ¥{dailyVal} × {days} 天 = 总额 ¥{derivedTotal}
                </div>
              )}
              {derivedDaily !== null && (
                <div className={styles.hint}>
                  总额 ¥{amountVal} ÷ {days} 天 = 日均 ¥{derivedDaily}
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>挂载分类（每日均摊记录归入）</label>
              <div className={styles.catChips}>
                {directionCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.catChip} ${categoryId === cat.id ? styles.catChipActive : ''}`}
                    onClick={() => setCategoryId(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {type === 'deposit' && (
          <>
            {/* v2.5 T-416：存池结算方式 */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>结算方式</label>
              <div className={styles.typeRow}>
                <button
                  type="button"
                  className={`${styles.typeOpt} ${settleMode === 'prepay' ? styles.typeOptActive : ''}`}
                  onClick={() => setSettleMode('prepay')}
                >
                  <span className={styles.typeOptName}>押金 · 先付</span>
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

        {error && <div className={styles.error}>{error}</div>}

        <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
          创建
        </button>
      </div>
    </div>
  );
}
