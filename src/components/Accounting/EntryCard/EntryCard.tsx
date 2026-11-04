/**
 * @fileoverview EntryCard — MINE 页入口卡通用骨架（v3.1 TASK-064）
 *
 * MINE 页底部并排的两张入口卡（一程 / 定期账）共用同一套骨架：
 *
 *   邮戳圆 + 等宽眉标
 *   ↓
 *   大数字（display font）+ 副行（mono）
 *   ↓
 *   底部动作行 + 箭头
 *
 * 视觉签名沿用 v3.1 一程的「登机牌 / 收据」语言：斜纹底纹 + 虚线边框 + 邮戳圆。
 * 两张卡共用本组件 → 移动端 / 桌面端共用同一份实现。
 */
import type { ReactNode } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import styles from './EntryCard.module.css';

export interface EntryCardProps {
  /** 眉标（如 ONE WAY / RECUR） */
  overline: string;
  /** 圆形图标 */
  icon: ReactNode;
  /** 邮戳样式：虚线内环 + 轻微旋转（一程用） */
  stamp?: boolean;
  /** 主数字 */
  value: string;
  /** 数字单位（如 程 / 个） */
  unit?: string;
  /** 副行文字 */
  meta?: string;
  /** 底部动作：字符串走默认样式，也可传自定义节点（如按钮） */
  foot?: ReactNode;
  /** 整卡点击（导航） */
  onOpen: () => void;
  /** 无障碍标签 */
  ariaLabel: string;
}

export function EntryCard({
  overline,
  icon,
  stamp = false,
  value,
  unit,
  meta,
  foot,
  onOpen,
  ariaLabel,
}: EntryCardProps) {
  return (
    <section
      className={styles.card}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={ariaLabel}
    >
      {/* 顶部：邮戳 / 图标 + 眉标 */}
      <div className={styles.top}>
        <span className={stamp ? styles.stampCircle : styles.iconCircle}>{icon}</span>
        <span className={styles.overline}>{overline}</span>
      </div>

      {/* 主区：数字 + 副行 */}
      <div className={styles.main}>
        <div className={styles.value}>
          {value}
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        {meta && <div className={styles.meta}>{meta}</div>}
      </div>

      {/* 底部动作行 */}
      <div className={styles.foot}>
        {typeof foot === 'string' ? <span className={styles.footText}>{foot}</span> : foot}
        <CaretRight size={14} weight="bold" className={styles.chev} aria-hidden />
      </div>
    </section>
  );
}
