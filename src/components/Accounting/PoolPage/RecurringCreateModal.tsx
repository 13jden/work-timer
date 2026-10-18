/**
 * @fileoverview RecurringCreateModal — 定期账创建弹窗（TASK-058 T-581）
 *
 * 3 步直觉表单替代 AddPoolModal 的 12 字段复杂表单：
 *   Step 1 · 这是哪种钱？（类型选择）
 *   Step 2 · 叫什么 + 多少钱
 *   Step 3 · 什么节奏（均摊）/ 已经付了吗（押金）
 *
 * 数据映射到现有 PoolConfig，数据结构零改动。
 * 机制红线：不动 lib/accounting/pool.ts 任何逻辑。
 */
import { useEffect, useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { eachMonthInRange, buildDateRangeKeys } from '../../../lib/accounting/pool';
import { DateRangePicker } from './DateRangePicker';
import styles from './PoolPage.module.css';

// ── 类型枚举（前端表单用，与 PoolConfig 字段映射见下）─────────────────────
type RecurringType = 'expense' | 'income' | 'deposit';

/** 3 步进度指示 */
const STEPS = ['哪种钱', '名称金额', '周期配置'] as const;
type Step = typeof STEPS[number];

// ── 预设名称 chips ─────────────────────────────────────────────
const PRESET_NAMES: Record<RecurringType, string[]> = {
  expense: ['房租', '会员费', '年费', '保险', '水电', '贷款', '学费'],
  income: ['工资', '兼职', '奖金', '分红', '退款'],
  deposit: ['租房押金', '健身卡押金', '设备押金', '会员押金'],
};

export interface RecurringCreateModalProps {
  open: boolean;
  onClose: () => void;
}

export function RecurringCreateModal({ open, onClose }: RecurringCreateModalProps) {
  const categories = useAccountStore((s) => s.categories);
  const createPoolWithCycles = useAccountStore((s) => s.createPoolWithCycles);

  // ── 状态 ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('哪种钱');
  const [recurringType, setRecurringType] = useState<RecurringType>('expense');
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [pickEnd, setPickEnd] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  // 押金付款状态（默认已付 = prepay）
  const [depositPaid, setDepositPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const directionCategories = categories.filter((c) => c.type === (recurringType === 'income' ? 'income' : 'expense'));

  // ── 重置 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStep('哪种钱');
    setRecurringType('expense');
    setName('');
    setAmountStr('');
    setPickStart(null);
    setPickEnd(null);
    setCategoryId(directionCategories[0]?.id ?? '');
    setDepositPaid(true);
    setError(null);
  }, [open]);

  // ── 天数计算 ──────────────────────────────────────────────────
  let days = 0;
  let dateRange: { start: string; end: string } | undefined;
  if (pickStart && pickEnd) {
    dateRange = { start: pickStart, end: pickEnd };
    days = eachMonthInRange(dateRange).reduce(
      (sum, mk) => sum + buildDateRangeKeys(dateRange as { start: string; end: string }, mk).length,
      0,
    );
  }

  const amountVal = parseFloat(amountStr);
  const hasAmount = isFinite(amountVal) && amountVal > 0;

  const handlePick = (start: string | null, end: string | null) => {
    setPickStart(start);
    setPickEnd(end);
  };

  // ── 提交 ─────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!name.trim()) {
      setError('请输入名称');
      return;
    }
    if (!hasAmount) {
      setError('请输入金额');
      return;
    }

    if (recurringType === 'deposit') {
      createPoolWithCycles({
        name: name.trim(),
        type: 'deposit',
        amount: amountVal,
        cycleMonths: 1,
        settleMode: depositPaid ? 'prepay' : 'postpay',
        categoryId: categoryId || undefined,
        direction: 'expense',
      });
      onClose();
      return;
    }

    // 均摊型
    if (!pickStart || !pickEnd || !dateRange) {
      setError('请在日历上选择日期范围');
      return;
    }
    if (days <= 0) {
      setError('所选范围内没有有效天数');
      return;
    }

    createPoolWithCycles({
      name: name.trim(),
      type: 'equalize',
      amount: amountVal,
      cycleMonths: eachMonthInRange(dateRange).length,
      cycleMode: 'daily',
      dateRange,
      categoryId: categoryId || undefined,
      direction: recurringType,
    });
    onClose();
  };

  if (!open) return null;

  // ── 步骤导航 ─────────────────────────────────────────────────
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 标题 + 步骤指示 */}
        <div className={styles.modalTitle}>
          新建定期账
          <div className={styles.stepIndicator}>
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`${styles.stepDot} ${i <= stepIndex ? styles.stepDotActive : ''}`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* ── Step 1: 类型选择 ──────────────────────────────────── */}
        {step === '哪种钱' && (
          <>
            <div className={styles.typeRow}>
              <button
                type="button"
                className={`${styles.typeOpt} ${recurringType === 'expense' ? styles.typeOptActive : ''}`}
                onClick={() => setRecurringType('expense')}
              >
                <span className={styles.typeOptName}>均摊支出</span>
                <span className={styles.typeOptDesc}>房租 / 会员 · 按日均摊</span>
              </button>
              <button
                type="button"
                className={`${styles.typeOpt} ${recurringType === 'income' ? styles.typeOptActive : ''}`}
                onClick={() => setRecurringType('income')}
              >
                <span className={styles.typeOptName}>均摊收入</span>
                <span className={styles.typeOptDesc}>工资 / 兼职 · 按日累计</span>
              </button>
              <button
                type="button"
                className={`${styles.typeOpt} ${recurringType === 'deposit' ? styles.typeOptActive : ''}`}
                onClick={() => setRecurringType('deposit')}
              >
                <span className={styles.typeOptName}>押金</span>
                <span className={styles.typeOptDesc}>会退的钱 · 存入 / 取出</span>
              </button>
            </div>

            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => {
                setStep('名称金额');
                // 重置名称和分类
                setName('');
                setCategoryId(directionCategories[0]?.id ?? '');
              }}
            >
              下一步
            </button>
          </>
        )}

        {/* ── Step 2: 名称 + 金额 ────────────────────────────────── */}
        {step === '名称金额' && (
          <>
            {/* 名称预设 chips */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>名称（选预设或自填）</label>
              <div className={styles.catChips}>
                {PRESET_NAMES[recurringType].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.catChip} ${name === preset ? styles.catChipActive : ''}`}
                    onClick={() => setName(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className={styles.fieldInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="自定义名称"
                maxLength={20}
              />
            </div>

            {/* 分类（均摊类型） */}
            {recurringType !== 'deposit' && (
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

            {/* 金额 */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>金额（¥）</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={styles.fieldInput}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder={recurringType === 'deposit' ? '押金金额' : '总金额'}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.stepNavRow}>
              <button type="button" className={styles.stepBackBtn} onClick={() => setStep('哪种钱')}>
                上一步
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                style={{ flex: 1 }}
                onClick={() => {
                  setError(null);
                  setStep('周期配置');
                }}
              >
                下一步
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: 周期配置 / 押金状态 ───────────────────────── */}
        {step === '周期配置' && (
          <>
            {recurringType === 'deposit' ? (
              // 押金：付款状态
              <div className={styles.field}>
                <label className={styles.fieldLabel}>已经付了吗？</label>
                <div className={styles.typeRow}>
                  <button
                    type="button"
                    className={`${styles.typeOpt} ${depositPaid ? styles.typeOptActive : ''}`}
                    onClick={() => setDepositPaid(true)}
                  >
                    <span className={styles.typeOptName}>已付款 ✓</span>
                    <span className={styles.typeOptDesc}>计入绿色资产 · 到期退回</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeOpt} ${!depositPaid ? styles.typeOptActive : ''}`}
                    onClick={() => setDepositPaid(false)}
                  >
                    <span className={styles.typeOptName}>还没付</span>
                    <span className={styles.typeOptDesc}>红色待付 · 到账后退回</span>
                  </button>
                </div>
              </div>
            ) : (
              // 均摊：日期范围
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>日期范围（日历点选，可跨月）</label>
                  <DateRangePicker start={pickStart} end={pickEnd} onPick={handlePick} />
                </div>

                {days > 0 && hasAmount && (
                  <div className={styles.hint}>
                    共 {days} 天 · 日均 ¥{(amountVal / days).toFixed(2)}
                  </div>
                )}
              </>
            )}

            {/* 实时预览 */}
            {hasAmount && recurringType !== 'deposit' && days > 0 && (
              <div className={styles.recurringPreview}>
                <span className={styles.recurringPreviewLabel}>预计</span>
                <span className={styles.recurringPreviewAmount}>
                  ≈ ¥{(amountVal / days).toFixed(0)} / 天
                </span>
              </div>
            )}
            {hasAmount && recurringType === 'deposit' && (
              <div className={styles.recurringPreview}>
                <span className={styles.recurringPreviewLabel}>状态</span>
                <span className={styles.recurringPreviewAmount}>
                  {depositPaid ? '+¥' + amountVal + ' 待退' : '-¥' + amountVal + ' 待付'}
                </span>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.stepNavRow}>
              <button type="button" className={styles.stepBackBtn} onClick={() => setStep('名称金额')}>
                上一步
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                style={{ flex: 1 }}
                onClick={handleSubmit}
              >
                创建
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
