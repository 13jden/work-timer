/**
 * PlaceholderPage — 记账主题未实现页面的占位
 *
 * v2.1 TASK-037:记账主题 4 tab 中,除 ACCT 外其余页面在 v2.2–v2.4 完成,
 * 当前显示居中图标 + 标题 + 规划版本提示。
 */
import { Hourglass } from '@phosphor-icons/react';
import styles from './PlaceholderPage.module.css';

interface PlaceholderPageProps {
  title: string;
  /** 规划版本提示,如 "v2.2" */
  plannedIn: string;
}

export function PlaceholderPage({ title, plannedIn }: PlaceholderPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.icon}>
        <Hourglass size={28} weight="thin" />
      </div>
      <div className={styles.title}>{title}</div>
      <div className={styles.hint}>{plannedIn} 规划中</div>
    </div>
  );
}
