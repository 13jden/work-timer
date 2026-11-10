/**
 * @fileoverview DonateSheet — 「打赏作者」弹层（v3.2）
 *
 * MINE 页底部的「打赏作者」行触发。
 *
 * 交互:
 * 1. 选金额（小红花 ¥2 / 咖啡 ¥9.9 / 自定义）
 * 2. 选支付方式（微信 / 支付宝）
 * 3. 展示对应收款码
 *
 * 「自定义」是第三个选项：自己填金额 + 写一句留言，
 * 留言会印在收据的「留言」那一行上。
 *
 * 视觉:延续项目的「纸感编辑风」——收据式卡片 + 打孔撕线 + 等宽数字,
 * 与 MINE 页的墨黑总资产卡形成一暗一亮的对位。
 *
 * 收款码:默认走 /donate/<method>-qr.png,图片缺失时回落成占位提示,
 * 作者把真实收款码丢进 public/donate/ 即可生效,无需改代码。
 */
import { useEffect, useState } from 'react';
import { Coffee, FlowerLotus, HeartStraight, PencilSimple } from '@phosphor-icons/react';
import {
  TIPS,
  CUSTOM_TIP_ID,
  validateDonation,
  formatAmount,
  DONATE_MAX_NOTE_LEN,
} from '../../../lib/donate';
import styles from './MinePage.module.css';

type PayMethod = 'wechat' | 'alipay';

const METHODS: { id: PayMethod; label: string }[] = [
  { id: 'wechat', label: '微信' },
  { id: 'alipay', label: '支付宝' },
];

interface DonateSheetProps {
  open: boolean;
  onClose: () => void;
}

export function DonateSheet({ open, onClose }: DonateSheetProps) {
  const [tip, setTip] = useState<string>('coffee');
  const [method, setMethod] = useState<PayMethod>('wechat');
  const [qrFailed, setQrFailed] = useState(false);

  // ── 自定义打赏 ──
  const [customAmount, setCustomAmount] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [customError, setCustomError] = useState('');

  // 每次打开重置（保留上次输入更贴心？不 —— 保持每次打开是干净的一张）
  useEffect(() => {
    if (!open) return;
    setTip('coffee');
    setMethod('wechat');
    setQrFailed(false);
    setCustomAmount('');
    setCustomNote('');
    setCustomError('');
  }, [open]);

  if (!open) return null;

  const isCustom = tip === CUSTOM_TIP_ID;

  /** 自定义金额校验 —— 选自定义时才需要 */
  const validateCustom = (): boolean => {
    const res = validateDonation(customAmount, customNote);
    if (!res.ok) {
      setCustomError(res.error);
      return false;
    }
    setCustomError('');
    return true;
  };

  /** 收据上显示的「项目」和「金额」 */
  const current = isCustom
    ? (() => {
        const res = validateDonation(customAmount, customNote);
        return res.ok
          ? { label: '自定义', amount: `¥${res.amountText}` }
          : { label: '自定义', amount: '¥—' };
      })()
    : (() => {
        const t = TIPS.find((x) => x.id === tip);
        return { label: t?.label ?? '', amount: t ? `¥${t.amount}` : '¥—' };
      })();

  /** 切换到自定义时先校验一次已有输入 */
  const handleTipChange = (id: string) => {
    setTip(id);
    if (id === CUSTOM_TIP_ID) {
      validateCustom();
    } else {
      setCustomError('');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.donateModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.donateTitle}>打赏作者</div>
        <div className={styles.donateSub}>一人力更全，项目才能继续跑</div>

        {/* ── 金额 ── */}
        <div className={styles.tipGrid}>
          {TIPS.map((t) => {
            const active = t.id === tip;
            return (
              <button
                key={t.id}
                type="button"
                className={`${styles.tipCard} ${active ? styles.tipCardActive : ''}`}
                onClick={() => handleTipChange(t.id)}
                aria-pressed={active}
              >
                <span className={styles.tipIcon}>
                  {t.id === 'flower' ? (
                    <FlowerLotus size={20} weight="regular" />
                  ) : (
                    <Coffee size={20} weight="regular" />
                  )}
                </span>
                <span className={styles.tipAmount}>¥{t.amount}</span>
                <span className={styles.tipLabel}>{t.label}</span>
                <span className={styles.tipNote}>{t.note}</span>
              </button>
            );
          })}

          {/* ── 自定义 ── */}
          <button
            type="button"
            className={`${styles.tipCard} ${isCustom ? styles.tipCardActive : ''} ${styles.tipCardWide}`}
            onClick={() => handleTipChange(CUSTOM_TIP_ID)}
            aria-pressed={isCustom}
          >
            <span className={styles.tipIcon}>
              <PencilSimple size={20} weight="regular" />
            </span>
            <span className={styles.tipAmount}>自定义</span>
            <span className={styles.tipLabel}>随心意</span>
            <span className={styles.tipNote}>自己填金额</span>
          </button>
        </div>

        {/* ── 自定义金额 / 留言 ── */}
        {isCustom && (
          <div className={styles.donateCustom}>
            <div className={styles.donateField}>
              <label className={styles.donateFieldLabel} htmlFor="donate-amount">
                金额
              </label>
              <div className={styles.donateAmountRow}>
                <span className={styles.donateAmountPrefix}>¥</span>
                <input
                  id="donate-amount"
                  className={styles.donateAmountInput}
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    if (customError) validateCustom();
                  }}
                  onBlur={validateCustom}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className={styles.donateField}>
              <label className={styles.donateFieldLabel} htmlFor="donate-note">
                留言<span className={styles.donateOptional}>选填</span>
              </label>
              <input
                id="donate-note"
                className={styles.donateNoteInput}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="写句话，会印在收据上"
                maxLength={DONATE_MAX_NOTE_LEN}
                autoComplete="off"
              />
            </div>

            {customError && (
              <div className={styles.donateError} role="alert">
                {customError}
              </div>
            )}
          </div>
        )}

        {/* ── 支付方式 ── */}
        <div className={styles.payTabs}>
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.payTab} ${m.id === method ? styles.payTabActive : ''}`}
              onClick={() => {
                setMethod(m.id);
                setQrFailed(false);
              }}
              aria-pressed={m.id === method}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ── 收据 ── */}
        <div className={styles.receipt}>
          <div className={styles.receiptRow}>
            <span>项目</span>
            <span className={styles.receiptMono}>{current.label}</span>
          </div>
          <div className={styles.receiptRow}>
            <span>金额</span>
            <span className={styles.receiptMono}>{current.amount}</span>
          </div>
          <div className={styles.receiptRow}>
            <span>方式</span>
            <span className={styles.receiptMono}>
              {METHODS.find((m) => m.id === method)?.label}
            </span>
          </div>
          {isCustom && customNote.trim() && (
            <div className={styles.receiptRow}>
              <span>留言</span>
              <span className={styles.receiptMono}>{customNote.trim()}</span>
            </div>
          )}
          <div className={styles.receiptPerf} />
          <div className={styles.receiptQr}>
            {qrFailed ? (
              <div className={styles.qrPlaceholder}>
                <HeartStraight size={22} weight="regular" />
                <span>收款码待补充</span>
                <span className={styles.qrPlaceholderHint}>
                  把图片放到 public/donate/{method}-qr.png
                </span>
              </div>
            ) : (
              <img
                src={`/donate/${method}-qr.png`}
                alt={`${method === 'wechat' ? '微信' : '支付宝'}收款码`}
                className={styles.qrImage}
                onError={() => setQrFailed(true)}
              />
            )}
          </div>
          <div className={styles.receiptFoot}>扫码 · 谢谢你的这一份</div>
        </div>

        <button type="button" className={styles.submitBtn} onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}

/** 供外部复用的金额格式化（收据上显示用） */
export { formatAmount };
