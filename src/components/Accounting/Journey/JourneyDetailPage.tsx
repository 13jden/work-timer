/**
 * @fileoverview JourneyDetailPage — 一程详情（v3.1 TASK-063 重设计）
 *
 * 设计语言：护照页 / 旅行手账。
 * - 头图（300px）：封面压衬线标题 + 浮动圆钮（返回 / 编辑）+ 角落邮戳
 * - 总账带：总支出 / 记录 / 旅途 三栏（细线分隔）
 * - 双按钮：记一笔（墨底）/ 关联旧账（描边）
 * - 沿途：按日期分组，每组一个墨块日期章 + 虚线 + 当日小计
 * - 记录行：有图 → 拍立得贴片；无图 → 分类圆标；点击行编辑记录
 * - 收尾：END OF ONE WAY · 标题
 *
 * 数据口径（v3.0 保持不变）：总额 = Σ|amount|，类型按收入/支出合计大小推断。
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
  const journeys = useAccountStore((s) => s.journeys);
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
  const { url: coverUrl, status: coverStatus } = useImage(journey?.coverImageId);

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

  // v3.1：这一程是第几程（按创建时间升序编号）
  const ordinal = useMemo(() => {
    if (!journey) return 0;
    const ordered = [...journeys].sort((a, b) => a.createdAt - b.createdAt);
    const index = ordered.findIndex((j) => j.id === journey.id);
    return index >= 0 ? index + 1 : 0;
  }, [journeys, journey]);

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

  const startWeekday = summary?.firstKey ? journeyWeekday(summary.firstKey) : '';
  const stampDate = summary?.firstKey ? journeyStampDate(summary.firstKey) : '';

  return (
    <div className={styles.page}>
      {/* ── 头图（点击可更换封面） ── */}
      <header
        className={styles.hero}
        onClick={() => coverInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && coverInputRef.current?.click()}
        aria-label="点击更换封面"
      >
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleCoverChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        {journey.coverImageId && coverStatus === 'ok' && coverUrl ? (
          <>
            <img src={coverUrl} alt="封面" className={styles.heroImg} />
            {/* 更换图标浮层（悬停/聚焦时出现） */}
            <div className={styles.coverOverlay} aria-hidden>
              <ImageIcon size={26} weight="duotone" />
            </div>
          </>
        ) : (
          <div className={styles.heroFallback} aria-hidden>
            <span className={styles.heroFallbackGlyph}>{journey.title.slice(0, 1)}</span>
            <span className={styles.heroFallbackHint}>
              {journey.coverImageId ? '封面加载中' : '没有封面的旅程'}
            </span>
          </div>
        )}
        {/* 渐变蒙版（让文字可读） */}
        <div className={styles.heroOverlay} aria-hidden />

        {/* 浮动圆钮 */}
        <div className={styles.heroBar}>
          <button
            type="button"
            className={styles.floatBtn}
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            aria-label="返回"
          >
            <ArrowLeft size={16} weight="bold" />
          </button>
          <button
            type="button"
            className={styles.floatBtn}
            onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
            aria-label="编辑一程"
          >
            <PencilSimple size={16} weight="bold" />
          </button>
        </div>

        {/* 邮戳 */}
        {stampDate && (
          <div className={styles.heroStamp} aria-hidden>
            <span className={styles.stampDate}>{stampDate}</span>
            <span className={styles.stampLine} />
            <span className={styles.stampType}>{effectiveType === 'income' ? '收入' : '支出'}</span>
          </div>
        )}

        {/* 标题区 */}
        <div className={styles.heroBottom}>
          <div className={styles.heroOverline}>
            ONE WAY{ordinal > 0 && ` · 第 ${ordinal} 程`}
          </div>
          <h1 className={styles.heroTitle}>{journey.title}</h1>
          {dateRange && (
            <div className={styles.heroDates}>
              <span>{dateRange}</span>
              {startWeekday && (
                <>
                  <i aria-hidden />
                  <span>{startWeekday}</span>
                </>
              )}
              {spanDays > 0 && (
                <>
                  <i aria-hidden />
                  <span>{spanDays} 天</span>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── 总账带 ── */}
      <div className={styles.stats}>
        <div className={`${styles.stat} ${styles.statLead}`}>
          <span className={styles.statLabel}>
            {effectiveType === 'income' ? '总收入' : '总支出'}
            {incomeTotal > 0 && expenseTotal > 0 && (
              <span className={styles.statMix}>（含两类）</span>
            )}
          </span>
          <span className={`${styles.statValue} ${effectiveType === 'income' ? styles.statValueIncome : styles.statValueExpense}`}>
            {effectiveType === 'income' ? '+' : '-'}${formatAmount(effectiveTotal)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>记录</span>
          <span className={styles.statValue}>
            {summary?.count ?? 0}
            <small>笔</small>
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>旅途</span>
          <span className={styles.statValue}>
            {spanDays}
            <small>天</small>
          </span>
        </div>
      </div>

      {/* claimed 标注 */}
      {summary && summary.claimedCount > 0 && (
        <div className={styles.claimedNote}>
          含定期账还款 {summary.claimedCount} 笔（¥{formatAmount(summary.claimedTotal)}）
        </div>
      )}

      {/* ── 双按钮 ── */}
      <div className={styles.ctaRow}>
        <button
          type="button"
          className={`${styles.cta} ${styles.ctaPrimary}`}
          onClick={() => setAddRecordOpen(true)}
        >
          <Plus size={15} weight="bold" />
          <span>记一笔</span>
        </button>
        <button
          type="button"
          className={`${styles.cta} ${styles.ctaSecondary}`}
          onClick={() => setLinkPickerOpen(true)}
        >
          <LinkIcon size={15} weight="bold" />
          <span>关联旧账</span>
        </button>
      </div>

      {/* ── 沿途 ── */}
      <section className={styles.recordsSection}>
        <div className={styles.recordsHeader}>
          <span className={styles.recordsHeaderTitle}>沿途</span>
          {linkedRecords.length > 0 && (
            <span className={styles.recordsHeaderCount}>共 {linkedRecords.length} 笔</span>
          )}
        </div>
        {linkedRecords.length === 0 ? (
          <div className={styles.recordsEmpty}>
            <span className={styles.recordsEmptyIcon} aria-hidden>
              <AirplaneTilt size={26} weight="duotone" />
            </span>
            <span>这一程还没有账 · 给它记一笔</span>
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
                  <span className={styles.dayCount}>{group.items.length} 笔</span>
                  <span className={styles.dayRule} aria-hidden />
                  {group.expense > 0 && (
                    <span className={styles.dayExpense}>-¥{formatAmount(group.expense)}</span>
                  )}
                  {group.income > 0 && (
                    <span className={styles.dayIncome}>+¥{formatAmount(group.income)}</span>
                  )}
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
                            {record.amount === 0
                              ? `¥${formatAmount(0)}`
                              : `${isExpense ? '-' : '+'}¥${formatAmount(Math.abs(record.amount))}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            <div className={styles.endNote}>
              END OF ONE WAY · {journey.title}
            </div>
          </div>
        )}
      </section>

      {journey.note && (
        <div className={styles.noteBox}>
          <div className={styles.noteLabel}>随记</div>
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
