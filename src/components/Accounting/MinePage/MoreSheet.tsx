/**
 * MoreSheet — 「更多」底部弹层（v3.2）
 *
 * MINE 页的「更多」入口触发，四个动作：
 * 1. 打赏作者 —— 打开 DonateSheet（金额 / 微信 / 支付宝）
 * 2. 意见反馈 —— 打开 FeedbackSheet（内容存后端，管理后台可看）
 * 3. 使用指南 —— 打开 GuideSheet（复制链接 / 直接打开）
 * 4. 检查更新 —— 手动拉一次公告 / 更新，结果交给全局 NoticeModal 展示
 *
 * 设计要点：
 * - 不新增全局 toast 体系，提示就地展示在弹层里（保持改动收敛）
 * - 所有网络请求都走 `request()` / `fetchNotices()`，**永不抛错**
 * - 「使用指南」链接来自后台配置（`/api/config` → `userGuideUrl`）
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowClockwise,
  ArrowSquareOut,
  BookOpen,
  Check,
  Coffee,
  Copy,
  FlowerLotus,
  ChatCircleText,
} from '@phosphor-icons/react';
import { fetchNotices } from '../../../lib/notice';
import { fetchPublicConfig, normalizeGuideUrl } from '../../../lib/config';
import styles from './MoreSheet.module.css';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  /** 点击「打赏作者」时通知外部打开 DonateSheet */
  onOpenDonate: () => void;
  /** 点击「意见反馈」时通知外部打开 FeedbackSheet */
  onOpenFeedback: () => void;
}

/** 弹层内的子视图 */
type View = 'menu' | 'guide';

/**
 * 复制文本到剪贴板。
 *
 * 三级兜底（任一成功即返回 true）：
 * 1. `navigator.clipboard.writeText` —— 现代浏览器，但要求**文档处于焦点状态**，
 *    自动化 / 失焦场景会抛 NotAllowedError。
 * 2. 选中文本 + `execCommand('copy')` —— 老浏览器 / 非安全上下文可用。
 * 3. 弹窗让用户手动 Ctrl+C —— 返回 false，由调用方展示提示。
 */
async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Clipboard API
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 失焦 / 权限不足 → 走下面的兜底 */
  }

  // 2. execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    /* 老浏览器不支持 → 走第 3 级 */
  }

  // 3. 兜底：把链接显示出来让用户自己复制
  return false;
}

export function MoreSheet({ open, onClose, onOpenDonate, onOpenFeedback }: MoreSheetProps) {
  const [view, setView] = useState<View>('menu');

  // ── 使用指南 ──
  const [guideUrl, setGuideUrl] = useState('');
  const [guideLoading, setGuideLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [guideError, setGuideError] = useState('');

  // ── 检查更新 ──
  const [checking, setChecking] = useState(false);
  const [updateHint, setUpdateHint] = useState('');

  // 每次打开时重置内部状态
  useEffect(() => {
    if (!open) return;
    setView('menu');
    setCopied(false);
    setGuideError('');
    setUpdateHint('');
    setGuideUrl('');
  }, [open]);

  const loadGuide = useCallback(async () => {
    setGuideLoading(true);
    setGuideError('');
    try {
      const cfg = await fetchPublicConfig();
      const url = normalizeGuideUrl(cfg.userGuideUrl);
      setGuideUrl(url);
      if (!url) setGuideError('尚未配置使用指南链接');
    } finally {
      setGuideLoading(false);
    }
  }, []);

  /** 打开「使用指南」子视图，顺手拉一次配置 */
  const openGuide = useCallback(() => {
    setView('guide');
    setCopied(false);
    setGuideError('');
    void loadGuide();
  }, [loadGuide]);

  /** 复制链接 */
  const handleCopy = useCallback(async () => {
    if (!guideUrl) return;
    try {
      if (await copyText(guideUrl)) {
        setCopied(true);
        setGuideError('');
      } else {
        setGuideError('复制失败，请长按上方链接手动复制');
      }
    } catch {
      setGuideError('复制失败，请长按上方链接手动复制');
    }
  }, [guideUrl]);

  /** 直接打开（新标签页） */
  const handleOpen = useCallback(() => {
    if (!guideUrl) return;
    window.open(guideUrl, '_blank', 'noopener');
    setView('menu');
    onClose();
  }, [guideUrl, onClose]);

  /** 检查更新 —— 拉到的内容通过全局事件交给 NoticeModal */
  const handleCheckUpdate = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setUpdateHint('');
    try {
      const list = await fetchNotices(true);
      if (list.length === 0) {
        setUpdateHint('已是最新版本');
      } else {
        window.dispatchEvent(
          new CustomEvent('st:notices', { detail: { notices: list } }),
        );
        setUpdateHint('发现新内容，正在展示…');
        setView('menu');
        onClose();
      }
    } catch {
      setUpdateHint('检查失败，请稍后再试');
    } finally {
      setChecking(false);
    }
  }, [checking, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div className={styles.handle} />

          {view === 'menu' ? (
            <>
              <div className={styles.title}>更多</div>
              <div className={styles.sub}>作者、指南与版本，都在这儿</div>

              <div className={styles.actions}>
                {/* ── 打赏作者 ── */}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => {
                    onOpenDonate();
                    onClose();
                  }}
                >
                  <span className={`${styles.actionIcon} ${styles.iconHeart}`}>
                    <Coffee size={19} weight="regular" />
                  </span>
                  <span className={styles.actionMain}>
                    <span className={styles.actionLabel}>打赏作者</span>
                    <span className={styles.actionHint}>小红花 ¥2 · 咖啡 ¥9.9</span>
                  </span>
                  <FlowerLotus size={16} weight="regular" className={styles.actionArrow} />
                </button>

                {/* ── 意见反馈 ── */}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => {
                    onOpenFeedback();
                    onClose();
                  }}
                >
                  <span className={styles.actionIcon}>
                    <ChatCircleText size={19} weight="regular" />
                  </span>
                  <span className={styles.actionMain}>
                    <span className={styles.actionLabel}>意见反馈</span>
                    <span className={styles.actionHint}>哪儿不顺手，说一声</span>
                  </span>
                </button>

                {/* ── 使用指南 ── */}
                <button type="button" className={styles.actionBtn} onClick={openGuide}>
                  <span className={styles.actionIcon}>
                    <BookOpen size={19} weight="regular" />
                  </span>
                  <span className={styles.actionMain}>
                    <span className={styles.actionLabel}>使用指南</span>
                    <span className={styles.actionHint}>复制链接或直接打开</span>
                  </span>
                </button>

                {/* ── 检查更新 ── */}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handleCheckUpdate}
                  disabled={checking}
                >
                  <span className={styles.actionIcon}>
                    <ArrowClockwise size={19} weight="regular" />
                  </span>
                  <span className={styles.actionMain}>
                    <span className={styles.actionLabel}>
                      {checking ? '检查中…' : '检查更新'}
                    </span>
                    <span className={styles.actionHint}>
                      {updateHint || '看看有没有新版本'}
                    </span>
                  </span>
                </button>

                <button type="button" className={styles.cancelBtn} onClick={onClose}>
                  取消
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.title}>使用指南</div>
              {guideLoading ? (
                <div className={styles.sub}>正在获取链接…</div>
              ) : guideUrl ? (
                /* 链接文本可选中：复制失败时用户可以手动选中复制 */
                <div className={styles.urlBox}>{guideUrl}</div>
              ) : (
                <div className={styles.sub}>尚未配置使用指南链接</div>
              )}

              {guideError && <div className={styles.error}>{guideError}</div>}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handleCopy}
                  disabled={!guideUrl || guideLoading}
                >
                  <span className={styles.actionIcon}>
                    {copied ? (
                      <Check size={19} weight="bold" />
                    ) : (
                      <Copy size={19} weight="regular" />
                    )}
                  </span>
                  <span className={styles.actionMain}>
                    <span className={styles.actionLabel}>
                      {copied ? '已复制' : '复制链接'}
                    </span>
                    <span className={styles.actionHint}>
                      {guideUrl ? '把链接发给别人' : '暂无可复制的链接'}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handleOpen}
                  disabled={!guideUrl || guideLoading}
                >
                  <span className={styles.actionIcon}>
                    <ArrowSquareOut size={19} weight="regular" />
                  </span>
                  <span className={styles.actionMain}>
                    <span className={styles.actionLabel}>直接打开</span>
                    <span className={styles.actionHint}>在浏览器中查看指南</span>
                  </span>
                </button>

                <button type="button" className={styles.cancelBtn} onClick={() => setView('menu')}>
                  返回
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
