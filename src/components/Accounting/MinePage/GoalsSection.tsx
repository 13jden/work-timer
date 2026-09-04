/**
 * GoalsSection — 存钱目标区（v2.4 · TASK-040 T-404）
 *
 * 目标卡片：进度条 + 截止倒计时；点击编辑，✕ 删除（仅解除关联，记录保留）。
 * 进度由记账关联目标自动累计（收入+ / 支出−）。
 */
import { useState } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { formatAmount, getTodayKey } from '../../../lib/accounting';
import type { SavingsGoal } from '../../../lib/types';
import { AddGoalModal } from './AddGoalModal';
import styles from './MinePage.module.css';

export function GoalsSection() {
  const goals = useAccountStore((s) => s.savingsGoals);
  const deleteSavingsGoal = useAccountStore((s) => s.deleteSavingsGoal);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (goal: SavingsGoal) => {
    setEditing(goal);
    setModalOpen(true);
  };

  const handleDelete = (goal: SavingsGoal) => {
    if (
      !window.confirm(
        `删除目标「${goal.name}」？已关联的记账记录会保留，仅解除目标关系。`,
      )
    )
      return;
    deleteSavingsGoal(goal.id);
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>存钱目标</div>
        <button type="button" className={styles.addBtn} onClick={openAdd}>
          + 新建
        </button>
      </div>

      {goals.length === 0 ? (
        <div className={styles.emptySmall}>定个目标吧，记账时关联它自动攒进度</div>
      ) : (
        goals.map((goal) => <GoalCard key={goal.id} goal={goal} onEdit={() => openEdit(goal)} onDelete={() => handleDelete(goal)} />)
      )}

      <AddGoalModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
    </section>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const progress = goal.targetAmount > 0 ? Math.min(1, goal.currentAmount / goal.targetAmount) : 0;
  const done = goal.currentAmount >= goal.targetAmount;
  const deadlineInfo = describeDeadline(goal.deadline, done);

  return (
    <div className={styles.goalCard} onClick={onEdit}>
      <div className={styles.goalTop}>
        <span className={styles.goalName}>{goal.name}</span>
        {done && <span className={`${styles.badge} ${styles.badgeDone}`}>已达成</span>}
        {!done && deadlineInfo?.overdue && (
          <span className={`${styles.badge} ${styles.badgeOverdue}`}>已超期</span>
        )}
        <button
          type="button"
          className={styles.delBtn}
          aria-label="删除目标"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ✕
        </button>
      </div>

      <div className={styles.goalAmtRow}>
        <span className={styles.goalAmt}>¥{formatAmount(goal.currentAmount)}</span>
        <span className={styles.goalAmtLabel}>/ ¥{formatAmount(goal.targetAmount)}</span>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div className={styles.goalMeta}>
        <span>{Math.round(progress * 100)}%</span>
        <span>{deadlineInfo?.text ?? '无截止日期'}</span>
      </div>
    </div>
  );
}

/** 截止日期描述：剩余天数 / 超期天数 */
function describeDeadline(
  deadline: string | undefined,
  done: boolean,
): { text: string; overdue: boolean } | null {
  if (!deadline) return null;
  const today = getTodayKey();
  if (deadline === today) return { text: '今天截止', overdue: false };
  const diffDays = Math.round(
    (new Date(`${deadline}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000,
  );
  if (diffDays > 0) return { text: `剩 ${diffDays} 天`, overdue: false };
  if (done) return { text: '已达成', overdue: false };
  return { text: `超期 ${-diffDays} 天`, overdue: true };
}
