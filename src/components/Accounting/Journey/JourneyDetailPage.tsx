/**
 * @fileoverview JourneyDetailPage — 一程详情页（v3.0 TASK-059 T-594）
 *
 * 封面头图 + 标题/起止 + 总账 + 关联记录清单 + 「给这一程记一笔」。
 */
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals } from '../../../lib/accounting/journey';
import { formatAmount } from '../../../lib/accounting';
import { JourneyEditModal } from './JourneyEditModal';
import { PencilSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import styles from './JourneyDetailPage.module.css';

interface JourneyDetailPageProps {
  journeyId: string;
  onBack: () => void;
}

export function JourneyDetailPage({ journeyId, onBack }: JourneyDetailPageProps) {
  const journey = useAccountStore((s) => s.journeys.find((j) => j.id === journeyId));
  const records = useAccountStore((s) => s.records);
  const getJourneyRecords = useAccountStore((s) => s.getJourneyRecords);
  const [editOpen, setEditOpen] = useState(false);

  if (!journey) return null;

  const linkedRecords = useMemo(
    () => getJourneyRecords(journeyId),
    [journeyId, records, getJourneyRecords],
  );

  const summaries = useMemo(() => journeyTotals([journey], records), [journey, records]);
  const summary = summaries.get(journeyId);

  // 计算跨度天数
  const spanDays = summary && summary.firstKey && summary.lastKey
    ? (() => {
        const start = new Date(summary.firstKey);
        const end = new Date(summary.lastKey);
        return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      })()
    : 0;

  const dateRange = summary?.firstKey && summary?.lastKey
    ? `${summary.firstKey.slice(5)} ~ ${summary.lastKey.slice(5)}`
    : '';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="返回">
          ←
        </button>
        <span className={styles.headerTitle}>一程详情</span>
        <button type="button" className={styles.editBtn} onClick={() => setEditOpen(true)} aria-label="编辑" title="编辑">
          <PencilSimple size={18} />
        </button>
      </div>

      {/* 封面 */}
      <div className={`${styles.cover} ${!journey.coverImageId ? (journey.type === 'income' ? styles.incomeBg : styles.expenseBg) : ''}`}>
        {journey.coverImageId ? (
          <img src={`__image__:${journey.coverImageId}`} alt="封面" className={styles.coverImg} />
        ) : (
          <div className={styles.coverPlaceholder}>
            <span className={styles.coverType}>
              {journey.type === 'income' ? '💰 收入程' : '💸 支出程'}
            </span>
          </div>
        )}
      </div>

      {/* 信息区 */}
      <div className={styles.info}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{journey.title}</h1>
          <span className={`${styles.badge} ${journey.type === 'income' ? styles.badgeIncome : styles.badgeExpense}`}>
            {journey.type === 'income' ? '收入程' : '支出程'}
          </span>
        </div>
        {dateRange && <div className={styles.dateRange}>{dateRange}</div>}
        {journey.note && <div className={styles.note}>{journey.note}</div>}
      </div>

      {/* 总账条 */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryMain}>
          <span className={styles.summaryAmount}>
            {journey.type === 'income' ? '+' : '-' }¥{formatAmount(summary?.total ?? 0, true)}
          </span>
          <span className={styles.summaryLabel}>
            {journey.type === 'income' ? '总收入' : '总支出'}
          </span>
        </div>
        <div className={styles.summaryStats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{summary?.count ?? 0}</span>
            <span className={styles.statLabel}>笔</span>
          </div>
          {spanDays > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statValue}>{spanDays}</span>
              <span className={styles.statLabel}>天</span>
            </div>
          )}
        </div>
      </div>

      {/* 含定期账标注 */}
      {summary && summary.claimedCount > 0 && (
        <div className={styles.claimedNote}>
          含定期账还款 {summary.claimedCount} 笔（¥{formatAmount(summary.claimedTotal)}）
        </div>
      )}

      {/* 记录清单 */}
      <div className={styles.recordsSection}>
        <div className={styles.sectionHeader}>关联记录</div>
        {linkedRecords.length === 0 ? (
          <div className={styles.recordsEmpty}>还没有记录</div>
        ) : (
          linkedRecords.map((record) => (
            <div key={record.id} className={styles.recordRow}>
              <div className={styles.recordLeft}>
                <div className={styles.recordDate}>{record.dateKey.slice(5)}</div>
                <div className={styles.recordNote}>{record.note || '无备注'}</div>
              </div>
              <div className={styles.recordRight}>
                <span className={record.type === 'income' ? styles.incomeAmt : styles.expenseAmt}>
                  {record.type === 'income' ? '+' : '-' }¥{formatAmount(Math.abs(record.amount))}
                </span>
                {record.poolStatus === 'claimed' && (
                  <span className={styles.claimedTag}>定期账</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 「给这一程记一笔」按钮 */}
      {/* 跳转到快速记账页面并预填一程（通过 URL 参数或 store 状态传递） */}
      <div className={styles.addRecordHint}>
        在记录编辑弹窗中选择「所属一程」
      </div>

      <JourneyEditModal
        open={editOpen}
        journeyId={journeyId}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
