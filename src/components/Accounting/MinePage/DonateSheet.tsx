/**
 * @fileoverview DonateSheet — 「打赏作者」弹层（v3.2）
 *
 * MINE 页底部的「打赏作者」行触发。
 *
 * 交互:
 * 1. 选金额（小红花 ¥2 / 咖啡 ¥9.9 / 自定义）
 * 2. 点「打开支付宝」直接唤起支付宝 App 付款
 *
 * 「自定义」是第三个选项：自己填金额 + 写一句留言，
 * 留言会印在收据的「留言」那一行上。
 *
 * 视觉:延续项目的「纸感编辑风」——收据式卡片 + 打孔撕线 + 等宽数字,
 * 与 MINE 页的墨黑总资产卡形成一暗一亮的对位。
 *
 * 收款方式(TASK-069):
 * - **只有支付宝**,没有二维码,点按钮直接跳转。
 *   支付宝个人收款码解码后是标准 https 链接(qr.alipay.com/...),
 *   浏览器直接跳就能唤起支付宝 App 的付款页。
 * - 微信这一档被去掉了:微信**个人**收款码是 `wxp://` 私有协议,
 *   微信官方不允许第三方页面直接跳转唤起,只能扫码。
 *   既然不做二维码,微信就没有存在意义了。
 *
 * 金额说明:个人收款码**无法预置金额**,选了 ¥50 跳转后仍需自己输入 50 块。
 * 这个错位必须在收据上写清楚,否则会造成「金额对不上」的误会。
 */
import { useEffect, useState } from 'react';
import { Coffee, FlowerLotus, HeartStraight, PencilSimple, ArrowSquareOut, Copy } from '@phosphor-icons/react';
import {
  TIPS,
  CUSTOM_TIP_ID,
  validateDonation,
  formatAmount,
  DONATE_MAX_NOTE_LEN,
  fetchDonatePayUrls,
  isWechatBrowser,
  EMPTY_PAY_URLS,
  type DonatePayUrls,
} from '../../../lib/donate';
import styles from './MinePage.module.css';

/**
 * 复制文本到剪贴板（三级兜底，与 MoreSheet 同思路）。
 *
 * 微信内置浏览器里没法直接跳支付宝，只能让用户复制到系统浏览器打开，
 * 所以这个兜底是刚需，不是装饰。
 */
async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 失焦 / 权限不足 → 走下面的兜底 */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface DonateSheetProps {
  open: boolean;
  onClose: () => void;
}

export function DonateSheet({ open, onClose }: DonateSheetProps) {
  const [tip, setTip] = useState<string>('coffee');

  // ── 收款跳转链接（后台配置）──
  const [payUrls, setPayUrls] = useState<DonatePayUrls>(EMPTY_PAY_URLS);
  const [copied, setCopied] = useState(false);

  // ── 自定义打赏 ──
  const [customAmount, setCustomAmount] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [customError, setCustomError] = useState('');

  // 每次打开重置（保留上次输入更贴心？不 —— 保持每次打开是干净的一张）
  useEffect(() => {
    if (!open) return;
    setTip('coffee');
    setCustomAmount('');
    setCustomNote('');
    setCustomError('');
    setCopied(false);
    setPayUrls(EMPTY_PAY_URLS);
    // 拉一次收款跳转链接（拿不到就保持空配置 = 不显示按钮）
    void fetchDonatePayUrls().then(setPayUrls);
  }, [open]);

  if (!open) return null;

  const isCustom = tip === CUSTOM_TIP_ID;

  /** 收款链接（空串 = 后台没配，不显示按钮） */
  const payUrl = payUrls.alipayUrl;

  /** 微信内置浏览器会拦截支付宝链接，只能引导复制出去 */
  const blockedInWechat = isWechatBrowser();

  /** 跳转付款 */
  const handleOpenPay = () => {
    if (!payUrl) return;
    if (blockedInWechat) {
      void copyText(payUrl).then((ok) => setCopied(ok));
      return;
    }
    window.location.href = payUrl;
  };

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
            <span className={styles.receiptMono}>支付宝</span>
          </div>
          {isCustom && customNote.trim() && (
            <div className={styles.receiptRow}>
              <span>留言</span>
              <span className={styles.receiptMono}>{customNote.trim()}</span>
            </div>
          )}
          <div className={styles.receiptPerf} />

          {/* ── 跳转按钮 ── */}
          {payUrl ? (
            <>
              <button type="button" className={styles.payLinkBtn} onClick={handleOpenPay}>
                {blockedInWechat ? (
                  <>
                    <Copy size={15} weight="regular" />
                    {copied ? '已复制，去浏览器打开' : '复制链接'}
                  </>
                ) : (
                  <>
                    <ArrowSquareOut size={15} weight="regular" />
                    打开支付宝
                  </>
                )}
              </button>
              <div className={styles.payLinkHint}>
                {blockedInWechat
                  ? '微信里打不开支付宝，复制到浏览器打开'
                  : '个人收款码无法预置金额，请在 App 内手动输入该金额'}
              </div>
            </>
          ) : (
            <div className={styles.payLinkHint}>
              <HeartStraight size={13} weight="regular" />
              收款链接待配置
            </div>
          )}

          <div className={styles.receiptFoot}>谢谢你的这一份</div>
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
