/**
 * QuickAddRecord — 快速记录条
 *
 * 一行输入 + 类型切换 + 提交按钮
 * 适用于「快速记一笔」场景（不带分类、不带备注）
 *
 * v2.1 行为：
 * - 提交时 **不** 自动选默认分类，而是直接保存到「未分类」区域
 * - 用户可通过"未分类区域 → 拖拽到分类文件夹"完成归类
 * - 通过「详细记录」按钮可指定分类保存
 *
 * v2.4 T-410：
 * - 快速记录同时不绑账户（accountId=''），总资产卡以「未分类」调整项展示，
 *   之后在统计页拖拽归入账户或编辑指定，余额届时才迁移
 */
import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import styles from './QuickAddRecord.module.css';

type QuickType = 'expense' | 'income';

interface QuickAddRecordProps {
  /** 提交成功回调 */
  onSubmitted?: (recordId: string) => void;
  /** 打开完整弹窗 */
  onOpenFull?: () => void;
}

export function QuickAddRecord({
  onSubmitted,
  onOpenFull,
}: QuickAddRecordProps) {
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<QuickType>('expense');
  const inputRef = useRef<HTMLInputElement>(null);

  const addRecord = useAccountStore((s) => s.addRecord);

  const handleSubmit = useCallback(() => {
    const amount = parseFloat(amountStr);
    if (!isFinite(amount) || amount <= 0) {
      inputRef.current?.focus();
      return;
    }

    // 支出存负数，收入存正数
    const signedAmount = type === 'expense' ? -amount : amount;
    const today = getTodayKey();

    // v2.1: 快速记录默认归入"未分类"区域，等待用户拖拽归类
    // 使用占位 categoryId（isUncategorized=true 才是真正的未分类标记）
    const record = addRecord({
      dateKey: today,
      amount: signedAmount,
      type,
      // 占位：使用第一个可用的分类 id（store schema 要求有值）
      // isUncategorized=true 时会在 UI 上识别为"未分类"
      categoryId: getPlaceholderCategoryId(type),
      // v2.4 T-410：不绑账户，进总资产「未分类」调整项
      accountId: '',
      isUncategorized: true,
    });

    setAmountStr('');
    onSubmitted?.(record.id);
  }, [amountStr, type, addRecord, onSubmitted]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className={styles.row}>
      <div className={styles.inputWrap}>
        <span className={styles.currency}>¥</span>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className={styles.input}
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          aria-label="金额"
        />
      </div>

      <div className={styles.toggleWrap}>
        <button
          className={`${styles.toggleBtn} ${type === 'expense' ? styles.toggleActive : ''} ${styles.expense}`}
          onClick={() => setType('expense')}
          aria-pressed={type === 'expense'}
        >
          支出
        </button>
        <button
          className={`${styles.toggleBtn} ${type === 'income' ? styles.toggleActive : ''} ${styles.income}`}
          onClick={() => setType('income')}
          aria-pressed={type === 'income'}
        >
          收入
        </button>
      </div>

      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!amountStr || parseFloat(amountStr) <= 0}
        aria-label="提交快速记录"
      >
        +
      </button>

      {onOpenFull && (
        <button
          className={styles.fullBtn}
          onClick={onOpenFull}
          aria-label="打开完整添加"
        >
          详细
        </button>
      )}
    </div>
  );
}

// 快速记录占位分类（store schema 要求 categoryId 非空）
// 使用一个固定 ID，在 UI 上靠 isUncategorized 标记识别
const PLACEHOLDER_CAT_IDS = {
  expense: '__placeholder_uncat_expense__',
  income: '__placeholder_uncat_income__',
};

function getPlaceholderCategoryId(type: 'expense' | 'income'): string {
  return type === 'income' ? PLACEHOLDER_CAT_IDS.income : PLACEHOLDER_CAT_IDS.expense;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}