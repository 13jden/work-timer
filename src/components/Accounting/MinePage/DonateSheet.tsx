/**
 * @fileoverview DonateSheet — 「打赏作者」弹层（v3.2）
 *
 * MINE 页底部的「打赏作者」行触发。
 *
 * 交互:
 * 1. 选金额（小红花 ¥2 / 咖啡 ¥9.9）
 * 2. 选支付方式（微信 / 支付宝）
 * 3. 展示对应收款码
 *
 * 视觉:延续项目的「纸感编辑风」——收据式卡片 + 打孔撕线 + 等宽数字,
 * 与 MINE 页的墨黑总资产卡形成一暗一亮的对位。
 *
 * 收款码:默认走 /donate/<method>-qr.png,图片缺失时回落成占位提示,
 * 作者把真实收款码丢进 public/donate/ 即可生效,无需改代码。
 */
import { useState } from 'react';
import { Coffee, FlowerLotus, HeartStraight } from '@phosphor-icons/react';
import styles from './MinePage.module.css';

type TipId = 'flower' | 'coffee';
type PayMethod = 'wechat' | 'alipay';

interface TipOption {
  id: TipId;
  label: string;
  amount: string;
  note: string;
}

const TIPS: TipOption[] = [
  { id: 'flower', label: '小红花', amount: '¥2', note: '一朵花的心意' },
  { id: 'coffee', label: '咖啡', amount: '¥9.9', note: '换一杯续命' },
];

const METHODS: { id: PayMethod; label: string }[] = [
  { id: 'wechat', label: '微信' },
  { id: 'alipay', label: '支付宝' },
];

interface DonateSheetProps {
  open: boolean;
  onClose: () => void;
}

export function DonateSheet({ open, onClose }: DonateSheetProps) {
  const [tip, setTip] = useState<TipId>('coffee');
  const [method, setMethod] = useState<PayMethod>('wechat');
  const [qrFailed, setQrFailed] = useState(false);

  if (!open) return null;

  const current = TIPS.find((t) => t.id === tip)!;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.donateModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.donateTitle}>打赏作者</div>
        <div className={styles.donateSub}>一人力更全,项目才能继续跑</div>

        {/* ── 金额 ── */}
        <div className={styles.tipGrid}>
          {TIPS.map((t) => {
            const active = t.id === tip;
            return (
              <button
                key={t.id}
                type="button"
                className={`${styles.tipCard} ${active ? styles.tipCardActive : ''}`}
                onClick={() => setTip(t.id)}
                aria-pressed={active}
              >
                <span className={styles.tipIcon}>
                  {t.id === 'flower' ? (
                    <FlowerLotus size={20} weight="regular" />
                  ) : (
                    <Coffee size={20} weight="regular" />
                  )}
                </span>
                <span className={styles.tipAmount}>{t.amount}</span>
                <span className={styles.tipLabel}>{t.label}</span>
                <span className={styles.tipNote}>{t.note}</span>
              </button>
            );
          })}
        </div>

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
