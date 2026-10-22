/**
 * @fileoverview JourneyDetailPage — 旅游记录详情页（v3.0 TASK-059 T-594 重设计）
 *
 * 设计：英雄封面 + 邮戳日期 + 大字 serif 标题 + 总账 + 「给这段记一笔」/「关联其他」CTA。
 * v3.0 TASK-059 fix: 封面图可点击更换（原生文件选择 + imageStore）
 *
 * v3.0 TASK-061 重设计（记录区）：
 * - 记录按「日期」分组，每组一个墨块日期章 + 当日小计（旅行手账语言）
 * - 有照片的记录 → 拍立得贴片（大图 + 备注 + 金额），点击照片放大
 * - 无照片的记录 → 紧凑行（分类 + 备注 + 金额）
 * - 记录行可点击 → 打开编辑弹窗（与统计页记录列表一致）
 */
import { useMemo, useState, useRef } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals, groupJourneyRecordsByDay, journeyStampDate, journeyWeekday } from '../../../lib/accounting/journey';
import { formatAmount } from '../../../lib/accounting';
import type { AccountRecord } from '../../../lib/types';
import { JourneyEditModal } from './JourneyEditModal';
import { JourneyRecordPicker } from './JourneyRecordPicker';
import { JourneyPhotoTile } from './JourneyPhotoTile';
import { AddRecordModal } from '../AddRecordModal/AddRecordModal';
import { ImagePreview } from '../ImagePreview';
import { IconByKey } from '../../IconByKey';
import { compressImage, genImageId } from '../../../lib/imageCompress';
import { putImage } from '../../../lib/imageStore';
import { useImage } from '../../../hooks/useImage';
import {
  ArrowLeft, Plus, Link as LinkIcon, PencilSimple, AirplaneTilt, Image as ImageIcon,
} from '@phosphor-icons/react';
import styles from './JourneyDetailPage.module.css';

interface JourneyDetailPageProps {
  journeyId: string;
  onBack: () => void;
}

export function JourneyDetailPage({ journeyId, onBack }: JourneyDetailPageProps) {
  const journey = useAccountStore((s) => s.journeys.find((j) => j.id === journeyId));
  const records = useAccountStore((s) => s.records);
  const categories = useAccountStore((s) => s.categories);
  const getJourneyRecords = useAccountStore((s) => s.getJourneyRecords);
  const [editOpen, setEditOpen] = useState(false);
  const updateJourney = useAccountStore((s) => s.updateJourney);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  // v3.0 TASK-061：点击记录 → 编辑弹窗；点击照片 → 全屏预览
  const [editingRecord, setEditingRecord] = useState<AccountRecord | null>(null);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // v3.0 TASK-061 fix：所有 hook 必须在 early return 之前无条件调用，
  // 否则「一程被删除」时 journey 变为 undefined → 提前 return → 渲染时报
  // “Rendered fewer hooks than expected”。
  const { url: coverUrl } = useImage(journey?.coverImageId);

  const linkedRecords = useMemo(
    () => (journey ? getJourneyRecords(journeyId) : []),
    [journey, journeyId, records, getJourneyRecords],
  );

  // v3.0 TASK-061：按日期分组（getJourneyRecords 已按 dateKey 降序 → 日期倒序）
  const dayGroups = useMemo(
    () => groupJourneyRecordsByDay(linkedRecords),
    [linkedRecords],
  );

  const summaries = useMemo(
    () => journeyTotals(journey ? [journey] : [], records),
    [journey, records],
  );
  const summary = journey ? summaries.get(journeyId) : undefined;

  // v3.0 TASK-059 fix: 点击封面 → 更换封面图（原生文件选择）
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await compressImage(file);
      const imageId = genImageId();
      const ok = await putImage(imageId, result.blob);
      if (!ok) { return; }
      updateJourney(journeyId, { coverImageId: imageId });
    } catch {
      // 图片处理失败，静默忽略（用户可重试）
    }
    // 清空 input，允许重复选同一张
    e.target.value = '';
  };

  if (!journey) return null;

  // v3.0 TASK-059 fix: 类型由关联记录决定，不依赖新建时的默认值
  const expenseTotal = summary?.expenseTotal ?? 0;
  const incomeTotal = summary?.incomeTotal ?? 0;
  const effectiveType: 'income' | 'expense' =
    incomeTotal > expenseTotal ? 'income' : 'expense';
  const effectiveTotal = effectiveType === 'income' ? incomeTotal : expenseTotal;

  const spanDays = summary && summary.firstKey && summary.lastKey
    ? Math.round(
        (new Date(summary.lastKey).getTime() - new Date(summary.firstKey).getTime()) / 86_400_000,
      ) + 1
    : 0;

  const dateRange = summary?.firstKey && summary?.lastKey
    ? `${summary.firstKey.slice(5)} → ${summary.lastKey.slice(5)}`
    : '';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="返回">
          <ArrowLeft size={18} weight="bold" />
        </button>
        <div className={styles.headerTitle}>旅游记录</div>
        <button type="button" className={styles.editBtn} onClick={() => setEditOpen(true)} aria-label="编辑">
          <PencilSimple size={16} />
        </button>
      </div>

      {/* 英雄封面（点击可更换） */}
      {/* v3.0 TASK-059 fix: 点击封面 → 触发文件选择 */}
      <div className={styles.hero} onClick={() => coverInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && coverInputRef.current?.click()} aria-label="点击更换封面">
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleCoverChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        {journey.coverImageId ? (
          <>
            <img src={coverUrl ?? ''} alt="封面" className={styles.heroImg} />
            {/* 更换图标浮层 */}
            <div className={styles.coverOverlay} aria-hidden>
              <ImageIcon size={28} weight="duotone" />
            </div>
          </>
        ) : (
          <div className={`${styles.heroBg} ${effectiveType === 'income' ? styles.incomeBg : styles.expenseBg}`}>
            <AirplaneTilt size={64} weight="duotone" />
            <div className={styles.coverAddHint}>
              <ImageIcon size={18} weight="duotone" />
              <span>设置封面</span>
            </div>
          </div>
        )}
        {/* 邮戳 */}
        {summary && (summary.firstKey || summary.lastKey) && (
          <div className={styles.heroStamp}>
            <div className={styles.stampCircle}>
              <span className={styles.stampDate}>
                {(summary.firstKey || summary.lastKey || '').slice(2, 7).replace('-', '/')}
              </span>
              <span className={styles.stampDivider} />
              <span className={styles.stampType}>{effectiveType === 'income' ? '收入' : '支出'}</span>
            </div>
          </div>
        )}
        {/* 渐变蒙版（让文字可读） */}
        <div className={styles.heroOverlay} aria-hidden />
        {/* 标题区（封面底部） */}
        <div className={styles.heroBottom}>
          <div className={styles.heroTitle}>{journey.title}</div>
          {dateRange && <div className={styles.heroDateRange}>{dateRange}</div>}
        </div>
      </div>

      {/* 总账条 */}
      <div className={styles.totalBox}>
        {/* v3.0 TASK-059 fix: 按实际记录展示金额，不依赖 journey.type */}
        <div className={styles.totalMain}>
          <span className={styles.totalLabel}>
            {effectiveType === 'income' ? '总收入' : '总支出'}
            {incomeTotal > 0 && expenseTotal > 0 && (
              <span className={styles.totalMix}>（含两类）</span>
            )}
          </span>
          <span className={styles.totalAmount}>
            {effectiveType === 'income' ? '+' : '-'}¥{formatAmount(effectiveTotal, true)}
          </span>
        </div>
        <div className={styles.totalStats}>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{summary?.count ?? 0}</span>
            <span className={styles.statLabel}>笔</span>
          </div>
          {spanDays > 0 && (
            <>
              <span className={styles.statDivider} aria-hidden />
              <div className={styles.statCell}>
                <span className={styles.statValue}>{spanDays}</span>
                <span className={styles.statLabel}>天</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* claimed 标注 */}
      {summary && summary.claimedCount > 0 && (
        <div className={styles.claimedNote}>
          含定期账还款 {summary.claimedCount} 笔（¥{formatAmount(summary.claimedTotal)}）
        </div>
      )}

      {/* CTA 按钮组 */}
      <div className={styles.ctaRow}>
        <button
          type="button"
          className={`${styles.cta} ${styles.ctaPrimary}`}
          onClick={() => setAddRecordOpen(true)}
        >
          <Plus size={16} weight="bold" />
          <span>给这段记一笔</span>
        </button>
        <button
          type="button"
          className={`${styles.cta} ${styles.ctaSecondary}`}
          onClick={() => setLinkPickerOpen(true)}
        >
          <LinkIcon size={16} weight="bold" />
          <span>关联其他</span>
        </button>
      </div>

      {/* 记录清单（v3.0 TASK-061：按日期分组 + 有图记录单独形态） */}
      <div className={styles.recordsSection}>
        <div className={styles.recordsHeader}>
          <span className={styles.recordsHeaderTitle}>记录</span>
          {linkedRecords.length > 0 && (
            <span className={styles.recordsHeaderCount}>
              共 {linkedRecords.length} 笔
            </span>
          )}
        </div>
        {linkedRecords.length === 0 ? (
          <div className={styles.recordsEmpty}>
            <span className={styles.recordsEmptyIcon}>📒</span>
            <span>还没有记录·「给这一程记一笔」</span>
          </div>
        ) : (
          <div className={styles.dayGroups}>
            {dayGroups.map((group) => (
              <section key={group.dateKey} className={styles.dayGroup}>
                {/* 日期章：墨块 + 虚线 + 当日小计 */}
                <div className={styles.dayHeader}>
                  <span className={styles.dayStamp}>
                    <span className={styles.dayStampDate}>{journeyStampDate(group.dateKey)}</span>
                    <span className={styles.dayStampWeek}>{journeyWeekday(group.dateKey)}</span>
                  </span>
                  <span className={styles.dayRule} aria-hidden />
                  <span className={styles.dayMeta}>
                    <span className={styles.dayCount}>{group.items.length} 笔</span>
                    {group.expense > 0 && (
                      <span className={styles.dayExpense}>-¥{formatAmount(group.expense)}</span>
                    )}
                    {group.income > 0 && (
                      <span className={styles.dayIncome}>+¥{formatAmount(group.income)}</span>
                    )}
                  </span>
                </div>

                <div className={styles.dayItems}>
                  {group.items.map((record) => {
                    const category = categories.find((c) => c.id === record.categoryId);
                    const isExpense = record.type === 'expense';
                    const hasImage = !!record.imageId;
                    const catName = record.isUncategorized
                      ? '未分类'
                      : record.poolId
                        ? (record.poolName ?? '定期账')
                        : (category?.name ?? '未知分类');
                    const catIcon = record.isUncategorized ? '❓' : (category?.icon ?? '❓');
                    const catColor = record.isUncategorized ? 'var(--muted)' : (category?.color ?? 'var(--muted)');
                    return (
                      <div
                        key={record.id}
                        className={`${styles.entry} ${hasImage ? styles.entryWithPhoto : styles.entryPlain}`}
                        onClick={() => setEditingRecord(record)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setEditingRecord(record);
                          }
                        }}
                        aria-label={`编辑记录 ${catName} ${record.note ?? ''}`}
                      >
                        {/* 左槽：有照片 → 拍立得贴片；无照片 → 分类圆标 */}
                        {hasImage ? (
                          <JourneyPhotoTile
                            imageId={record.imageId!}
                            onPreview={() => setPreviewImageId(record.imageId!)}
                          />
                        ) : (
                          <span className={styles.entryGlyph} style={{ background: catColor }}>
                            <IconByKey icon={catIcon} size={15} weight="regular" color="#fff" />
                          </span>
                        )}

                        <div className={styles.entryBody}>
                          <div className={styles.entryMeta}>
                            <span className={styles.entryCat}>{catName}</span>
                            {record.poolStatus === 'claimed' && (
                              <span className={styles.claimedTag}>定期账</span>
                            )}
                          </div>
                          <div className={styles.entryNote}>{record.note || '无备注'}</div>
                        </div>

                        <div className={styles.entryAmount}>
                          <span className={isExpense ? styles.expenseAmt : styles.incomeAmt}>
                            {isExpense ? '-' : '+'}¥{formatAmount(Math.abs(record.amount))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {journey.note && (
        <div className={styles.noteBox}>
          <div className={styles.noteLabel}>备注</div>
          <div className={styles.noteText}>{journey.note}</div>
        </div>
      )}

      <JourneyEditModal
        open={editOpen}
        journeyId={journeyId}
        onClose={() => setEditOpen(false)}
      />

      <JourneyRecordPicker
        open={linkPickerOpen}
        journeyId={journeyId}
        type={journey.type}
        onClose={() => setLinkPickerOpen(false)}
      />

      <AddRecordModal
        open={addRecordOpen}
        defaultType={journey.type}
        defaultJourneyId={journeyId}
        onClose={() => setAddRecordOpen(false)}
      />

      {/* v3.0 TASK-061：点击记录 → 编辑弹窗（与统计页记录列表一致） */}
      <AddRecordModal
        open={!!editingRecord}
        editingRecord={editingRecord}
        onClose={() => setEditingRecord(null)}
      />

      {/* v3.0 TASK-061：点击照片 → 全屏放大 */}
      <ImagePreview
        imageId={previewImageId}
        onClose={() => setPreviewImageId(null)}
      />
    </div>
  );
}
