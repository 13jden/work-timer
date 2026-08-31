/**
 * Monthly Goal Store — 桌面端月度收入目标
 *
 * v1.3.4-patch1 新增:
 *   - 桌面端侧边栏左下角显示「本月已赚 / 月度目标」进度条
 *   - 首次打开未设置目标 → 引导用户去设置(跳转 SettingsDrawer)
 *
 * 设计:
 *   - 独立 store,不与 configStore 耦合(monthlySalary 是用户填的月薪,不一定是月度目标)
 *   - 持久化 key:salary_timer_monthly_goal_v1
 *   - null = 未设置,UI 引导设置
 *   - 数字 = 当前目标(¥)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORAGE_KEY = 'salary_timer_monthly_goal_v1';

interface MonthlyGoalStore {
  /** 月度收入目标(¥),null = 未设置 */
  monthlyGoal: number | null;

  /** 设置月度目标 */
  setGoal: (goal: number | null) => void;

  /** 重置 */
  reset: () => void;
}

export const useMonthlyGoalStore = create<MonthlyGoalStore>()(
  persist(
    (set) => ({
      monthlyGoal: null,
      setGoal: (goal) => set({ monthlyGoal: goal }),
      reset: () => set({ monthlyGoal: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
