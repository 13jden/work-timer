/**
 * @fileoverview FeedbackSheet — 「意见反馈」弹层（v3.2）
 *
 * MINE 页「更多 → 意见反馈」触发。
 *
 * 交互：
 * 1. 写反馈内容（必填）
 * 2. 留联系方式（选填 —— 不想留邮箱也能提）
 * 3. 寄出 → 内容存到后端，管理后台「社区 → 反馈」里能看到
 *
 * 视觉：延续项目的「纸感编辑风」——把反馈写成一张**工单便条**：
 * 上半截是用户写的字，下半截是打孔撕线 + 字数，右下角盖「已收到」章。
 * 撕线与 DonateSheet 的收据撕线同源，是这一套「纸」语言里的一部分，
 * 但方向相反：收据是「你收到」，工单是「你寄出」。
 *
 * 约定：
 * - 提交失败就地把原因写在便条下方，不弹 toast
 * - 成功后留在原地展示回执，不自动关闭（让用户看清「收到了」）
 */
import { useEffect, useRef, useState } from 'react';
import { CheckCircle, PaperPlaneTilt, X } from '@phosphor-icons/react';
import { submitFeedback, FEEDBACK_MAX_LEN } from '../../../lib/feedback';
import styles from './FeedbackSheet.module.css';

interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackSheet({ open, onClose }: FeedbackSheetProps) {
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 每次打开时重置成干净的一张便条
  useEffect(() => {
    if (!open) return;
    setContent('');
    setContact('');
    setError('');
    setSent(false);
    setSubmitting(false);
    // 等弹层渲染出来再聚焦，否则 focus 会落空
    const timer = setTimeout(() => textareaRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const res = await submitFeedback({ content, contact });
    setSubmitting(false);
    if (res.ok) {
      setSent(true);
    } else {
      setError(res.error);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const remaining = FEEDBACK_MAX_LEN - content.trim().length;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="意见反馈"
      >
        <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="关闭">
          <X size={16} weight="regular" />
        </button>

        {sent ? (
          /* ── 回执：便条盖了「已收到」章 ── */
          <div className={styles.doneWrap}>
            <div className={styles.slip}>
              <div className={styles.stamp} aria-hidden="true">
                <span>已收到</span>
              </div>
              <div className={styles.doneIcon}>
                <CheckCircle size={30} weight="fill" />
              </div>
              <h2 className={styles.doneTitle}>反馈已寄出</h2>
              <p className={styles.doneText}>
                {contact.trim()
                  ? '作者会看到你说的这些，也会用你留的联系方式回你。'
                  : '作者会看到你说的这些。留个联系方式的话，就更容易回上你。'}
              </p>
            </div>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setContent('');
                setContact('');
                setSent(false);
                setTimeout(() => textareaRef.current?.focus(), 60);
              }}
            >
              再写一条
            </button>
            <button type="button" className={styles.sendBtn} onClick={handleClose}>
              完成
            </button>
          </div>
        ) : (
          <>
            <div className={styles.title}>意见反馈</div>
            <div className={styles.sub}>哪儿不顺手，写下来</div>

            {/* ── 便条 ── */}
            <div className={styles.slip}>
              <label className={styles.label} htmlFor="fb-content">
                反馈内容
              </label>
              <textarea
                id="fb-content"
                ref={textareaRef}
                className={styles.textarea}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (error) setError('');
                }}
                placeholder="例：记账里「一程」和「定期账」我看不懂…"
                maxLength={FEEDBACK_MAX_LEN}
                rows={5}
                disabled={submitting}
              />

              {/* 打孔撕线 —— 这张纸的「断口」 */}
              <div className={styles.perf} aria-hidden="true" />

              <div className={styles.slipFoot}>
                <span className={styles.ticketNo}>NO.{String(content.trim().length).padStart(4, '0')}</span>
                <span className={styles.counter}>
                  {remaining <= 0 ? '到上限了' : `还剩 ${remaining}`}
                </span>
              </div>
            </div>

            {/* ── 联系方式（选填） ── */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fb-contact">
                联系方式<span className={styles.optional}>选填</span>
              </label>
              <input
                id="fb-contact"
                className={styles.input}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="邮箱或微信，方便回你"
                maxLength={120}
                disabled={submitting}
                autoComplete="off"
              />
              <div className={styles.hint}>只用来回复这一条，不会拿去做别的。</div>
            </div>

            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
            >
              <PaperPlaneTilt size={16} weight="regular" />
              {submitting ? '寄出中…' : '寄出反馈'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
