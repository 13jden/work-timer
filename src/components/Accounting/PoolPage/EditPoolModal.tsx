/**
 * @fileoverview EditPoolModal — 编辑池弹窗（v2.5-patch4 N-483）
 *
 * 复用 AddPoolModal 的表单结构与样式，按现有 pool 数据预填：
 * - name
 * - direction（equalize）
 * - amount（deposit 直接编辑 / equalize 按 dailyAmount × days 或总额）
 * - dateRange（equalize + cycleMode='daily'）
 * - categoryId（equalize）
 * - settleMode（deposit）
 *
 * 保存调 accountStore.updatePool（结构性字段变化自动触发 rebuildPoolCycles）。
 * 已生成的均摊 record 保留 poolCycleStart/End 快照（不二次调整金额）。
 */
import { useEffect, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import type { PoolConfig, PoolType } from '../../../lib/types';
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

/**
 * 编辑池弹窗。
 * poolId 为 null 时返回 null（不渲染）。
 */
export function EditPoolModal({ open, poolId, onClose }: EditPoolModalProps) {
  const pool = useAccountStore((s) =>
    poolId ? s.pools.find((p) => p.id === poolId) ?? null : null,
  );
  const categories = useAccountStore((s) => s.categories);
  const updatePool = useAccountStore((s) => s.updatePool);

  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');
  const [settleMode, setSettleMode] = useState<'prepay' | 'postpay'>('prepay');
  const [amountStr, setAmountStr] = useState('');
  const [dailyStr, setDailyStr] = useState('');
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [pickEnd, setPickEnd] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** 池类型（编辑时锁定，不允许切换） */
  const [type] = useState<PoolType>('equalize');

  // 每次 open 或 poolId 变化时，用 pool 当前值重置所有字段
  useEffect(() => {
    if (!open || !pool) return;
    setName(pool.name);
    setDirection(pool.direction ?? 'expense');
    setSettleMode(pool.settleMode ?? 'prepay');
    setAmountStr(String(pool.amount ?? ''));
    if (pool.dailyAmount != null) {
      setDailyStr(String(pool.dailyAmount));
    } else {
      setDailyStr('');
    }
    if (pool.dateRange) {
      setPickStart(pool.dateRange.start);
      setPickEnd(pool.dateRange.end);
    } else {
      setPickStart(null);
      setPickEnd(null);
    }
    setCategoryId(pool.categoryId ?? '');
    setError(null);
  }, [open, pool]);

  if (!open || !pool) return null;

  const directionCategories = categories.filter((c) => c.type === direction);

  // 范围 + 天数
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
      setError('请输入池名称');
      return;
    }

    if (pool.type === 'deposit') {
      if (!hasAmount) {
        setError('请输入押金金额');
        return;
      }
      updatePool(pool.id, {
        name: name.trim(),
        settleMode,
        amount: amountVal,
      });
      onClose();
      return;
    }

    // 均摊型：必须有日期范围 + 金额
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
    const patch: Partial<PoolConfig> = {
      name: name.trim(),
      direction,
      amount: total,
      cycleMode: 'daily',
      dateRange,
      dailyAmount: hasDaily ? dailyVal : undefined,
      categoryId: categoryId || undefined,
      // 与 AddPoolModal 一致：cycleMonths = 跨自然月数
      cycleMonths: eachMonthInRange(dateRange).length,
    };
    updatePool(pool.id, patch);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>编辑池「{pool.name}」</div>

        {/* 类型锁定：编辑不可切换类型，仅展示 */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>类型（不可修改）</label>
          <div className={styles.typeRow}>
            <div
              className={`${styles.typeOpt} ${pool.type === 'equalize' ? styles.typeOptActive : ''}`}
              style={{ cursor: 'default' }}
            >
              <span className={styles.typeOptName}>{pool.type === 'equalize' ? '均摊型' : '存池型'}</span>
              <span className={styles.typeOptDesc}>
                {pool.type === 'equalize' ? '逐日均摊' : '押金池'}
              </span>
            </div>
          </div>
        </div>

        {/* v2.5-patch5 N-485：方向 ± 大按钮（与 AddPoolModal 同规格） */}
        {pool.type === 'equalize' && (
          <div className={styles.amountWrapNew}>
            <button
              type="button"
              className={`${styles.amtSignBtn} ${direction === 'expense' ? styles.amtSignActive : ''} ${styles.amtSignMinus}`}
              onClick={() => setDirection('expense')}
              aria-label="支出方向"
            >
              −
            </button>
            <div className={styles.amtField}>
              <span className={styles.amtFieldText}>
                {direction === 'expense' ? '支出方向 · 逐日记支出' : '收入方向 · 逐日记收入'}
              </span>
            </div>
            <button
              type="button"
              className={`${styles.amtSignBtn} ${direction === 'income' ? styles.amtSignActive : ''} ${styles.amtSignPlus}`}
              onClick={() => setDirection('income')}
              aria-label="收入方向"
            >
              +
            </button>
          </div>
        )}

        {/* v2.5-patch5 N-485：顶部分类（仅均摊型按当前 direction 过滤；存池型无分类） */}
        {pool.type === 'equalize' && (
          <div className={styles.catHeader}>
            <div className={styles.catHeaderLabel}>挂载分类（每日均摊记录归入）</div>
            <div className={styles.typeToggleInline}>
              <button
                type="button"
                className={`${styles.typeChip} ${direction === 'expense' ? styles.typeChipActive : ''}`}
                onClick={() => setDirection('expense')}
                aria-label="支出"
              >
                支出
              </button>
              <button
                type="button"
                className={`${styles.typeChip} ${direction === 'income' ? styles.typeChipActive : ''}`}
                onClick={() => setDirection('income')}
                aria-label="收入"
              >
                收入
              </button>
            </div>
          </div>
        )}

        {pool.type === 'equalize' && (
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
        )}

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

        {type === 'equalize' && pool.type === 'equalize' && (
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
          </>
        )}

        {pool.type === 'deposit' && (
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
          保存
        </button>
      </div>
    </div>
  );
}
