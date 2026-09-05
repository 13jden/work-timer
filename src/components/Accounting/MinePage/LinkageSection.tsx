/**
 * LinkageSection — MINE 页「time → accounting 联动」开关
 * (v2.5 · TASK-046 T-501-3)
 *
 * 单个开关 + 工资池当前余额 + 简要说明,允许用户关掉联动而不丢旧数据。
 */
import { useMemo } from 'react';
import { useConfigStore } from '../../../store/configStore';
import { useAccountStore } from '../../../store/accountStore';
import { depositBalance } from '../../../lib/accounting/pool';
import { formatAmount } from '../../../lib/accounting';
import type { PoolCycle } from '../../../lib/types';
import styles from './MinePage.module.css';

export function LinkageSection() {
  const enabled = useConfigStore((s) => s.salaryLinkageEnabled ?? true);
  const setConfig = useConfigStore((s) => s.setConfig);
  const pools = useAccountStore((s) => s.pools);
  const cycles = useAccountStore((s) => s.cycles);
  const records = useAccountStore((s) => s.records);

  /** 计算「工资池」(deposit + income + name='工资池') 当前余额 */
  const salaryPool = useMemo(
    () => pools.find((p) => p.type === 'deposit' && p.direction === 'income' && p.name === '工资池'),
    [pools],
  );

  /** 工资池联动 record 总数(用于决策是否清干净可选) */
  const linkageCount = useMemo(
    () => records.filter((r) => r.linkageSource === 'salary-time-mode').length,
    [records],
  );

  /** 工资池余额 = 该池所有 confirmed transactions Σ(in) − Σ(out) */
  const balance = useMemo(() => {
    if (!salaryPool) return 0;
    const poolCycles: PoolCycle[] = cycles.filter((c) => c.poolId === salaryPool.id);
    let total = 0;
    for (const c of poolCycles) total += depositBalance(c.transactions);
    return Math.round(total * 100) / 100;
  }, [salaryPool, cycles]);

  /** 总联动金额(工资池里所有 linkage record 求和) */
  const linkageTotal = useMemo(
    () => records
      .filter((r) => r.linkageSource === 'salary-time-mode')
      .reduce((sum, r) => sum + r.amount, 0),
    [records],
  );

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>time 联动</span>
        {salaryPool && (
          <span className={styles.sectionMeta}>
            工资池 ¥{formatAmount(balance, true)}
          </span>
        )}
      </div>
      <button
        type="button"
        className={`${styles.toggleRow} ${enabled ? styles.toggleOn : ''}`}
        onClick={() => setConfig({ salaryLinkageEnabled: !enabled })}
        aria-pressed={enabled}
      >
        <span className={styles.toggleInfo}>
          <span className={styles.toggleName}>联动 time 模式已赚</span>
          <span className={styles.toggleHint}>
            {enabled
              ? 'time 日历页「当日已赚」实时同步为记账收入,落入工资池'
              : '已关闭;存在的联动记录保留,新同步停止'}
          </span>
        </span>
        <span className={styles.toggleSwitch} aria-hidden>
          <span className={styles.toggleDot} />
        </span>
      </button>
      {salaryPool && (
        <div className={styles.linkageStats}>
          <span>{linkageCount} 条联动记录</span>
          <span className={styles.linkageDiv}>·</span>
          <span>累计 ¥{formatAmount(linkageTotal, true)}</span>
        </div>
      )}
    </div>
  );
}
