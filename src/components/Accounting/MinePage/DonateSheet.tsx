/**
 * @fileoverview DonateSheet — 「打赏作者」弹层（v3.2）
 *
 * MINE 页底部的「打赏作者」行触发。
 *
 * 交互（TASK-070）：
 * 页面极简 —— 只有三个金额档位按钮（小红花 ¥2 / 咖啡 ¥9.9 / 自定义），
 * **点任意一个都直接跳转支付宝**，不需要先选再确认。
 *
 * 为什么没有金额输入框：
 * 支付宝**个人**收款码无法预置金额 —— 跳转后仍需用户在支付宝 App 里
 * 自己输入数字。既然金额最终由用户在 App 内填写，页面上再填一遍就是
 * 无意义的重复劳动，还会让人以为「这里填了 App 里就不用填了」。
 * 所以把输入框整个去掉，只留一行文字把这���说清楚。
 *
 * 收款方式：
 * - **只有支付宝**。微信个人收款码是 `wxp://` 私有协议，微信官方不允许
 *   第三方页面直接跳转唤起，只能扫码 —— 既然不做二维码，微信就没意义了。
 *
 * 视觉：延续项目的「纸感编辑风」，但这一屏刻意做轻：
 * 三个档位是唯一的主体，其余全是留白与一行小字说明。
 */
import { useEffect, useState } from 'react';
import { Coffee, FlowerLotus, HeartStraight, PencilSimple, Copy } from '@phosphor-icons/react';
import {
  TIPS,
  formatAmount,
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
  // ── 收款跳转链接（后台配置）──
  const [payUrls, setPayUrls] = useState<DonatePayUrls>(EMPTY_PAY_URLS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setPayUrls(EMPTY_PAY_URLS);
    // 拉一次收款跳转链接（拿不到就保持空配置 = 按钮不可用）
    void fetchDonatePayUrls().then(setPayUrls);
  }, [open]);

  if (!open) return null;

  /** 收款链接（空串 = 后台没配） */
  const payUrl = payUrls.alipayUrl;

  /** 微信内置浏览器会拦截支付宝链接，只能引导复制出去 */
  const blockedInWechat = isWechatBrowser();

  /**
   * 跳转付款 —— 三个档位共用这一个动作。
   *
   * 微信里打不开支付宝 → 退化成「复制链接」，提示用户到系统浏览器打开。
   */
  const handleDonate = () => {
    if (!payUrl) return;
    if (blockedInWechat) {
      void copyText(payUrl).then((ok) => setCopied(ok));
      return;
    }
    window.location.href = payUrl;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.donateModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.donateTitle}>打赏作者</div>
        <div className={styles.donateSub}>一人力更全，项目才能继续跑</div>

        {/* ── 三个档位，点任意都直接跳支付宝 ── */}
        <div className={styles.tipGrid}>
          {TIPS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.tipCard}
              onClick={handleDonate}
              disabled={!payUrl}
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
          ))}

          <button
            type="button"
            className={`${styles.tipCard} ${styles.tipCardWide}`}
            onClick={handleDonate}
            disabled={!payUrl}
          >
            <span className={styles.tipIcon}>
              <PencilSimple size={20} weight="regular" />
            </span>
            <span className={styles.tipAmount}>自定义</span>
            <span className={styles.tipLabel}>随心意</span>
          </button>
        </div>

        {/* ── 文字提示 ── */}
        {payUrl ? (
          <div className={styles.donateNote}>
            {blockedInWechat ? (
              <>
                {copied ? (
                  <>
                    <Copy size={13} weight="regular" />
                    <span>链接已复制，去浏览器打开支付宝</span>
                  </>
                ) : (
                  <span>微信里打不开支付宝，点任意档位复制链接</span>
                )}
              </>
            ) : (
              <>
                <HeartStraight size={13} weight="regular" />
                <span>点任意档位打开支付宝 · 个人收款码无法预置金额，请在 App 内输入金额</span>
              </>
            )}
          </div>
        ) : (
          <div className={styles.donateNote}>
            <HeartStraight size={13} weight="regular" />
            <span>收款链接待配置</span>
          </div>
        )}

        <button type="button" className={styles.submitBtn} onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}

/** 供外部复用的金额格式化 */
export { formatAmount };
