/**
 * ConvertPage — 等价换算页（v1.3.4）
 *
 * v1.3.4 重构：
 * - 内部委托给 `<ConvertPanel mode="full" />`
 * - 移动端 Tab 体验不变（BottomNav → SWAP）
 * - 桌面端：等价比算已移至今日页右栏（`DesktopRightPanel` → `ConvertPanel mode="compact"`）
 *
 * 逻辑全在 `ConvertPanel` 内部实现。
 */
import { ConvertPanel } from '../components/ConvertPanel';
import styles from './ConvertPage.module.css';

export function ConvertPage() {
  return (
    <div className={styles.pageHead} style={{ paddingBottom: 24 }}>
      <div className={styles.eyebrow}>What does it cost</div>
      <h2 className={styles.title}>等价换算</h2>
      <ConvertPanel mode="full" />
    </div>
  );
}
