/**
 * @fileoverview RecordRow — 记账记录行共用组件（v3.0 TASK-055 T-555 + TASK-056）
 *
 * 日视图 / 月视图列表 / 年视图列表共用的记录行。
 * 展示：分类图标 + 分类名/池名 + 备注 + 账户标签 + 缩略图（v3.0）+ 金额。
 * 不含拖拽逻辑（拖拽由调用方在 StatsPage 层通过 dnd-kit 包装）。
 */
import { useAccountStore } from '../../../store/accountStore';
import { useConfigStore } from '../../../store/configStore';
import type { AccountRecord } from '../../../lib/types';
import { formatAmount } from '../../../lib/accounting';
import { IconByKey } from '../../IconByKey';
import { RecordThumb } from '../RecordThumb';
import styles from './RecordRow.module.css';

export interface RecordRowProps {
  record: AccountRecord;
  /** 点击打开编辑弹窗 */
  onOpen: () => void;
  /** v3.0 TASK-056：点击缩略图预览图片 */
  onPreviewImage?: (imageId: string) => void;
}

/** 结算时间戳 → "M月D日"（同年省略年份） */
function formatSettledDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}年${md}`;
}

/**
 * 记账记录行。
 * 行为：
 * - 点击行体打开编辑弹窗
 * - 认领付款（poolStatus='claimed'）保留展示，金额不计入统计
 * - 关联池记录显示池名（保留分类图标）
 * - 虚拟预扣记录不出现于此组件（已在 listableRecords 层过滤）
 * - v3.0：有图时在「备注右侧、金额左侧」显示 36px 缩略图；点击缩略图触发预览（不打开编辑）
 */
export function RecordRow({ record, onOpen, onPreviewImage }: RecordRowProps) {
  const categories = useAccountStore((s) => s.categories);
  const accounts = useAccountStore((s) => s.accounts);
  // v3.0 TASK-057：钱包模式开关。关闭时不展示账户标签(包含"未归入"红标)
  const walletEnabled = useConfigStore((s) => s.walletEnabled ?? false);
  const category = categories.find((c) => c.id === record.categoryId);
  const account = accounts.find((a) => a.id === record.accountId);

  // 名称：未分类 > 关联池名 > 分类名
  const name = record.isUncategorized
    ? '未分类'
    : record.poolId
      ? (record.poolName ?? '关联池')
      : (category?.name ?? '未知分类');

  const icon = record.isUncategorized ? 'no' : (category?.icon ?? '❓');
  const color = record.isUncategorized ? 'var(--muted)' : (category?.color ?? 'var(--muted)');
  const isExpense = record.type === 'expense';

  // 池相关状态
  const isPoolDaily = !!record.poolId && !record.poolStatus;
  const isSettled = isPoolDaily && !!record.poolSettledAt;
  const isClaimed = record.poolStatus === 'claimed';

  // 副标题：结算信息优先 > 备注
  const sub = isSettled
    ? `已关联 · ${formatSettledDate(record.poolSettledAt!)} · ¥${formatAmount(record.poolSettledAmount ?? Math.abs(record.amount))}`
    : record.note?.trim() || null;

  return (
    <div className={styles.row} onClick={onOpen}>
      <span className={styles.icon} style={{ background: color }}>
        <IconByKey icon={icon} size={16} weight="regular" color="#fff" />
      </span>
      <span className={styles.info}>
        <span className={styles.name}>
          {name}
          {isClaimed && <span className={styles.tagClaimed}>已关联池 · 不计统计</span>}
          {isSettled && <span className={styles.tagSettled}>已关联池</span>}
          {isPoolDaily && !isSettled && (
            <span className={record.poolDirection === 'in' ? styles.tagVirtualIn : styles.tagVirtualOut}>
              {record.poolDirection === 'in' ? '虚拟到账' : '虚拟均摊'}
            </span>
          )}
        </span>
        {sub ? <span className={styles.sub}>{sub}</span> : null}
      </span>
      {walletEnabled && (account ? (
        <span className={styles.acct}>
          <span className={styles.acctDot} style={{ background: account.color }} />
          {account.name}
        </span>
      ) : (
        <span className={`${styles.acct} ${styles.acctNone}`}>未归入</span>
      ))}
      {/* v3.0 TASK-056：附图缩略图，备注右侧、金额左侧 */}
      {record.imageId && (
        <RecordThumb
          imageId={record.imageId}
          onPreview={onPreviewImage ? () => onPreviewImage(record.imageId!) : undefined}
        />
      )}
      <span className={`${styles.amt} ${isExpense ? styles.amtExpense : styles.amtIncome}`}>
        {isExpense ? '-' : '+'}¥{formatAmount(Math.abs(record.amount))}
      </span>
    </div>
  );
}
