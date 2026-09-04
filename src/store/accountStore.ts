/**
 * Salary Timer — Account Store (v2.0 Accounting)
 *
 * 管理记账功能的所有状态:
 *   - 账户 (Account)
 *   - 分类 (Category)
 *   - 分类文件夹 (Folder)
 *   - 记账记录 (AccountRecord)
 *   - 池配置 (PoolConfig)
 *   - 池周期 (PoolCycle)
 *   - 存钱目标 (SavingsGoal)
 *
 * 自动持久化到 localStorage。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  ACCOUNTING_KEY,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  ACCOUNT_TYPE_COLORS,
} from '../lib/constants';
import type {
  Account,
  Category,
  Folder,
  AccountRecord,
  PoolConfig,
  PoolCycle,
  PoolTransaction,
  SavingsGoal,
} from '../lib/types';
import {
  buildEqualizeCycleDraft,
  buildDepositCycleDraft,
  getCycleDateKeys,
  eachMonthInRange,
  splitDailyAmount,
  planDailyRecords,
  deriveCycleStatus,
  isCycleEnded,
  type CycleDraft,
} from '../lib/accounting/pool';
import { getCurrentMonthKey, getTodayKey, recordAffectsBalance } from '../lib/accounting';
import { shiftMonth } from '../lib/accounting/stats';

// ── Store 形状 ──────────────────────────────────────────────
interface AccountStore {
  // 账户
  accounts: Account[];
  // 分类（收入 + 支出）
  categories: Category[];
  // 分类文件夹
  folders: Folder[];
  // 记账记录
  records: AccountRecord[];
  // 池配置
  pools: PoolConfig[];
  // 池周期
  cycles: PoolCycle[];
  // 存钱目标
  savingsGoals: SavingsGoal[];

  // ── Account 操作 ──
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => Account;
  updateAccount: (id: string, patch: Partial<Omit<Account, 'id' | 'createdAt'>>) => void;
  deleteAccount: (id: string) => void;
  reorderAccounts: (ids: string[]) => void;

  // ── Category 操作 ──
  addCategory: (category: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (type: 'income' | 'expense', ids: string[]) => void;

  // ── Folder 操作 ──
  addFolder: (folder: Omit<Folder, 'id'>) => Folder;
  updateFolder: (id: string, patch: Partial<Omit<Folder, 'id'>>) => void;
  deleteFolder: (id: string) => void;
  reorderFolders: (ids: string[]) => void;

  // ── Record 操作 ──
  addRecord: (record: Omit<AccountRecord, 'id' | 'createdAt' | 'updatedAt'>) => AccountRecord;
  updateRecord: (id: string, patch: Partial<Omit<AccountRecord, 'id' | 'createdAt'>>) => void;
  deleteRecord: (id: string) => void;

  // ── Pool 操作 ──
  addPool: (pool: Omit<PoolConfig, 'id' | 'createdAt'>) => PoolConfig;
  updatePool: (id: string, patch: Partial<Omit<PoolConfig, 'id' | 'createdAt'>>) => void;
  deletePool: (id: string) => void;
  addCycle: (cycle: Omit<PoolCycle, 'id'>) => PoolCycle;
  updateCycle: (id: string, patch: Partial<Omit<PoolCycle, 'id'>>) => void;

  // ── Pool 业务 actions（v2.3 TASK-039） ──
  /** 创建池：均摊型预生成周期 + 每日虚拟记录；存池型建常驻周期 */
  createPoolWithCycles: (pool: Omit<PoolConfig, 'id' | 'createdAt'>) => PoolConfig;
  /**
   * 认领：实际记录关联池。
   * 均摊型按周期月份升序贪心匹配虚拟交易（可拆分/跨周期）；
   * 存池型按记录方向（支出→存入 in / 收入→取出 out）追加已确认交易。
   * @returns 实际匹配金额（未匹配部分正常记账不挂池）
   */
  claimToPool: (recordId: string, poolId: string) => number;
  /** 跨月补齐均摊池周期 + 逾期扫描（应用启动时调用） */
  syncPoolCycles: () => void;
  /**
   * v2.4 T-410：满额且周期已过的均摊池自动移除。
   * 只删池配置与周期元数据；均摊记录与认领记录全部保留
   * （记录自带周期快照与实际关联时间/金额）。
   */
  retireFinishedPools: () => void;

  // ── Savings 操作 ──
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'createdAt'>) => SavingsGoal;
  updateSavingsGoal: (id: string, patch: Partial<Omit<SavingsGoal, 'id' | 'createdAt'>>) => void;
  deleteSavingsGoal: (id: string) => void;

  // ── 聚合查询 ──
  getRecordsByDate: (dateKey: string) => AccountRecord[];
  getRecordsByMonth: (year: number, month: number) => AccountRecord[];
  getRecordsByCategory: (categoryId: string) => AccountRecord[];
  getUncategorizedRecords: () => AccountRecord[];
  getAccountBalance: (accountId: string) => number;
  getTotalBalance: () => number;

  // ── 重置 ──
  reset: () => void;
}

// ── ID 生成器 ──────────────────────────────────────────────
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * v2.3：物化周期草稿 —— 只分配 id 生成周期元数据，**不生成任何记录**。
 * 均摊消费记录由 syncPoolCycles 在日期到来时逐日生成。
 */
function materializeCycle(
  poolId: string,
  cycleDraft: CycleDraft,
): PoolCycle {
  return {
    id: genId('cycle'),
    poolId,
    monthKey: cycleDraft.monthKey,
    totalAmount: cycleDraft.totalAmount,
    dayCount: cycleDraft.dayCount,
    dailyVirtual: cycleDraft.dailyVirtual,
    paidAmount: cycleDraft.paidAmount,
    status: cycleDraft.status,
    transactions: [],
  };
}

/** v2.4：目标进度累计（带符号差量，四舍五入到分） */
function applyGoalDelta(
  set: (partial: (s: AccountStore) => Pick<AccountStore, 'savingsGoals'>) => void,
  goalId: string,
  delta: number,
) {
  set((s) => ({
    savingsGoals: s.savingsGoals.map((g) =>
      g.id === goalId
        ? { ...g, currentAmount: Math.round((g.currentAmount + delta) * 100) / 100 }
        : g,
    ),
  }));
}

/** v2.3：重算均摊周期状态（已认领额 + 是否到期） */
function refreshEqualizeCycleStatus(
  cycle: PoolCycle,
  pool: PoolConfig,
  todayKey: string,
): PoolCycle {
  const dateKeys = getCycleDateKeys(pool, cycle.monthKey);
  const ended = isCycleEnded(dateKeys, todayKey);
  const paid = cycle.paidAmount ?? 0;
  return { ...cycle, paidAmount: paid, status: deriveCycleStatus(paid, cycle.totalAmount, ended) };
}

// ── 默认分类 ──────────────────────────────────────────────
function buildDefaultCategories(): Category[] {
  const expense: Category[] = DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    type: 'expense' as const,
    order: i,
  }));

  const income: Category[] = DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    type: 'income' as const,
    order: i,
  }));

  return [...expense, ...income];
}

// ── 默认文件夹 ─────────────────────────────────────────────
function buildDefaultFolders(categories: Category[]): Folder[] {
  // 默认使用前几个支出分类创建文件夹
  const expenseCats = categories.filter(c => c.type === 'expense').slice(0, 6);
  return expenseCats.map((cat, i) => ({
    id: `folder-${cat.id}`,
    categoryId: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    order: i,
  }));
}

// ── 默认账户 ──────────────────────────────────────────────
function buildDefaultAccounts(): Account[] {
  return [
    {
      id: 'account-alipay',
      name: '支付宝',
      type: 'alipay',
      balance: 0,
      color: ACCOUNT_TYPE_COLORS.alipay,
      order: 0,
      createdAt: Date.now(),
    },
    {
      id: 'account-wechat',
      name: '微信',
      type: 'wechat',
      balance: 0,
      color: ACCOUNT_TYPE_COLORS.wechat,
      order: 1,
      createdAt: Date.now(),
    },
    {
      id: 'account-card',
      name: '银行卡',
      type: 'card',
      balance: 0,
      color: ACCOUNT_TYPE_COLORS.card,
      order: 2,
      createdAt: Date.now(),
    },
  ];
}

// ── 初始状态 ──────────────────────────────────────────────
function buildInitialState() {
  const categories = buildDefaultCategories();
  const folders = buildDefaultFolders(categories);
  const accounts = buildDefaultAccounts();

  return {
    accounts,
    categories,
    folders,
    records: [],
    pools: [],
    cycles: [],
    savingsGoals: [],
  };
}

// ── Store 实现 ──────────────────────────────────────────────
export const useAccountStore = create<AccountStore>()(
  persist(
    (set, get) => ({
      ...buildInitialState(),

      // ── Account ──
      addAccount: (account) => {
        const newAccount: Account = {
          ...account,
          id: genId('acc'),
          createdAt: Date.now(),
        };
        set((s) => ({ accounts: [...s.accounts, newAccount] }));
        return newAccount;
      },

      updateAccount: (id, patch) => {
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));
      },

      deleteAccount: (id) => {
        // v2.4：删账户连带删除其记录，逐条复用 deleteRecord 回退余额/池/目标
        const affected = get().records.filter((r) => r.accountId === id);
        for (const r of affected) {
          get().deleteRecord(r.id);
        }
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
        }));
      },

      reorderAccounts: (ids) => {
        set((s) => ({
          accounts: ids.map((id, i) => {
            const acc = s.accounts.find((a) => a.id === id)!;
            return { ...acc, order: i };
          }),
        }));
      },

      // ── Category ──
      addCategory: (category) => {
        const newCategory: Category = {
          ...category,
          id: genId('cat'),
        };
        set((s) => ({ categories: [...s.categories, newCategory] }));
        return newCategory;
      },

      updateCategory: (id, patch) => {
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },

      deleteCategory: (id) => {
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          // 标记关联记录为未分类
          records: s.records.map((r) =>
            r.categoryId === id ? { ...r, isUncategorized: true } : r,
          ),
          // 删除关联文件夹
          folders: s.folders.filter((f) => f.categoryId !== id),
        }));
      },

      reorderCategories: (type, ids) => {
        set((s) => ({
          categories: s.categories.map((c) => {
            if (c.type !== type) return c;
            const idx = ids.indexOf(c.id);
            return idx >= 0 ? { ...c, order: idx } : c;
          }),
        }));
      },

      // ── Folder ──
      addFolder: (folder) => {
        const newFolder: Folder = {
          ...folder,
          id: genId('folder'),
        };
        set((s) => ({ folders: [...s.folders, newFolder] }));
        return newFolder;
      },

      updateFolder: (id, patch) => {
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        }));
      },

      deleteFolder: (id) => {
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
        }));
      },

      reorderFolders: (ids) => {
        set((s) => ({
          folders: ids.map((id, i) => {
            const folder = s.folders.find((f) => f.id === id)!;
            return { ...folder, order: i };
          }),
        }));
      },

      // ── Record ──
      addRecord: (record) => {
        const now = Date.now();
        const newRecord: AccountRecord = {
          ...record,
          id: genId('rec'),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ records: [...s.records, newRecord] }));
        // 更新账户余额
        get().updateAccount(record.accountId, {
          balance: get().getAccountBalance(record.accountId) + record.amount,
        });
        // v2.4：关联目标的记录自动累计进度（带符号：收入+ / 支出−）
        if (record.goalId) {
          applyGoalDelta(set, record.goalId, record.amount);
        }
        return newRecord;
      },

      updateRecord: (id, patch) => {
        const oldRecord = get().records.find((r) => r.id === id);
        if (!oldRecord) return;

        // 计算余额变化
        const oldAmount = oldRecord.amount;
        const newAmount = patch.amount ?? oldAmount;
        const oldAccountId = oldRecord.accountId;
        const newAccountId = patch.accountId ?? oldAccountId;

        set((s) => ({
          records: s.records.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r,
          ),
        }));

        // 更新账户余额（支持编辑时换账户）
        // v2.4 T-410：池逐日均摊等虚拟记录本就未动余额，编辑时不做迁移
        if (recordAffectsBalance(oldRecord)) {
          if (newAccountId === oldAccountId) {
            const delta = newAmount - oldAmount;
            if (delta !== 0) {
              get().updateAccount(oldAccountId, {
                balance: get().getAccountBalance(oldAccountId) + delta,
              });
            }
          } else {
            get().updateAccount(oldAccountId, {
              balance: get().getAccountBalance(oldAccountId) - oldAmount,
            });
            get().updateAccount(newAccountId, {
              balance: get().getAccountBalance(newAccountId) + newAmount,
            });
          }
        }

        // v2.4：目标进度差量（先回退旧贡献，再计入新贡献）
        // 'goalId' in patch：显式传键才算修改（传 undefined = 解除关联）
        const newGoalId = 'goalId' in patch ? patch.goalId : oldRecord.goalId;
        if (oldRecord.goalId) {
          applyGoalDelta(set, oldRecord.goalId, -oldAmount);
        }
        if (newGoalId) {
          applyGoalDelta(set, newGoalId, newAmount);
        }
      },

      deleteRecord: (id) => {
        const record = get().records.find((r) => r.id === id);
        if (!record) return;

        // 恢复账户余额（v2.4 T-410：虚拟记录未动过余额，不回退）
        if (recordAffectsBalance(record)) {
          get().updateAccount(record.accountId, {
            balance: get().getAccountBalance(record.accountId) - record.amount,
          });
        }

        // v2.4：回退目标进度
        if (record.goalId) {
          applyGoalDelta(set, record.goalId, -record.amount);
        }

        // v2.3：池关联记录删除处理（三类相互独立）
        if (record.poolId) {
          const pool = get().pools.find((p) => p.id === record.poolId);
          if (pool && record.poolStatus === 'claimed') {
            // 均摊付款记录：认领额回退（只扣第一个含该额度的周期），每日均摊记录不受影响
            const amount = Math.abs(record.amount);
            const todayKey = getTodayKey();
            let deducted = false;
            set((s) => ({
              cycles: s.cycles.map((c) => {
                if (c.poolId !== record.poolId) return c;
                if (!deducted && (c.paidAmount ?? 0) + 1e-9 >= amount) {
                  deducted = true;
                  const updated = { ...c, paidAmount: Math.round(((c.paidAmount ?? 0) - amount) * 100) / 100 };
                  return refreshEqualizeCycleStatus(updated, pool, todayKey);
                }
                return c;
              }),
            }));
          } else if (pool?.type === 'deposit' && record.poolStatus === 'confirmed') {
            // 存池型：移除对应交易
            set((s) => ({
              cycles: s.cycles.map((c) =>
                c.poolId === record.poolId
                  ? { ...c, transactions: c.transactions.filter((t) => t.recordId !== record.id) }
                  : c,
              ),
            }));
          } else if (!record.poolStatus) {
            // 每日均摊记录：交易保留（防止 sync 重新生成），仅清空关联
            set((s) => ({
              cycles: s.cycles.map((c) =>
                c.poolId === record.poolId
                  ? {
                      ...c,
                      transactions: c.transactions.map((t) =>
                        t.recordId === record.id ? { ...t, recordId: undefined } : t,
                      ),
                    }
                  : c,
              ),
            }));
          }
        }

        set((s) => ({
          records: s.records.filter((r) => r.id !== id),
        }));
      },

      // ── Pool ──
      addPool: (pool) => {
        const newPool: PoolConfig = {
          ...pool,
          id: genId('pool'),
          createdAt: Date.now(),
        };
        set((s) => ({ pools: [...s.pools, newPool] }));
        return newPool;
      },

      updatePool: (id, patch) => {
        set((s) => ({
          pools: s.pools.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
      },

      deletePool: (id) => {
        // v2.3：删池连带删除其全部记录（每日均摊 + 认领付款），并回退账户余额
        const affected = get().records.filter((r) => r.poolId === id);
        for (const r of affected) {
          get().updateAccount(r.accountId, {
            balance: get().getAccountBalance(r.accountId) - r.amount,
          });
        }
        set((s) => ({
          pools: s.pools.filter((p) => p.id !== id),
          cycles: s.cycles.filter((c) => c.poolId !== id),
          records: s.records.filter((r) => r.poolId !== id),
        }));
      },

      addCycle: (cycle) => {
        const newCycle: PoolCycle = {
          ...cycle,
          id: genId('cycle'),
        };
        set((s) => ({ cycles: [...s.cycles, newCycle] }));
        return newCycle;
      },

      updateCycle: (id, patch) => {
        set((s) => ({
          cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },

      // ── Pool 业务 actions（v2.3 TASK-039） ──
      createPoolWithCycles: (poolInput) => {
        const pool = get().addPool(poolInput);
        const currentMonth = getCurrentMonthKey();

        if (pool.type === 'equalize') {
          // 只生成周期元数据，不生成任何记录
          if (pool.cycleMode === 'daily' && pool.dateRange) {
            // 按日模式：完整日期范围按自然月拆周期
            const monthKeys = eachMonthInRange(pool.dateRange);
            for (const monthKey of monthKeys) {
              const draft = buildEqualizeCycleDraft(pool, monthKey);
              set((s) => ({ cycles: [...s.cycles, materializeCycle(pool.id, draft)] }));
            }
          } else {
            // 按月模式：当月 + 未来共 cycleMonths 个周期
            for (let i = 0; i < Math.max(1, pool.cycleMonths); i += 1) {
              const monthKey = shiftMonth(currentMonth, i);
              const draft = buildEqualizeCycleDraft(pool, monthKey);
              set((s) => ({ cycles: [...s.cycles, materializeCycle(pool.id, draft)] }));
            }
          }
        } else {
          // 存池型：常驻空周期
          const draft = buildDepositCycleDraft(pool, currentMonth);
          set((s) => ({ cycles: [...s.cycles, materializeCycle(pool.id, draft)] }));
        }

        // 建池后立即为已到来日期生成均摊消费记录
        get().syncPoolCycles();
        return pool;
      },

      claimToPool: (recordId, poolId) => {
        const state = get();
        const record = state.records.find((r) => r.id === recordId);
        const pool = state.pools.find((p) => p.id === poolId);
        if (!record || !pool || record.poolStatus) return 0;
        const now = Date.now();
        const amount = Math.abs(record.amount);

        // 存池型：追加已确认交易（与池方向同→存入 in，相反→取出 out），正常计入统计
        if (pool.type === 'deposit') {
          const cycle = state.cycles.find((c) => c.poolId === poolId);
          if (!cycle) return 0;
          const direction: 'in' | 'out' =
            record.type === (pool.direction ?? 'expense') ? 'in' : 'out';
          const tx: PoolTransaction = {
            id: genId('ptx'),
            cycleId: cycle.id,
            dateKey: record.dateKey,
            recordId,
            amount,
            direction,
            status: 'confirmed',
            confirmedAt: now,
          };
          set((s) => ({
            cycles: s.cycles.map((c) =>
              c.id === cycle.id ? { ...c, transactions: [...c.transactions, tx] } : c,
            ),
            records: s.records.map((r) =>
              r.id === recordId
                ? { ...r, poolId, poolDirection: direction, poolStatus: 'confirmed' as const, poolName: pool.name, updatedAt: now }
                : r,
            ),
          }));
          return amount;
        }

        // 均摊型：付款记录打 'claimed' 标记（预付，不计入消费统计），
        // 认领额计入第一个未认领足的周期；与每日均摊记录相互独立
        const poolCycles = state.cycles
          .filter((c) => c.poolId === poolId)
          .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
        const targetCycle =
          poolCycles.find((c) => (c.paidAmount ?? 0) + 1e-9 < c.totalAmount) ??
          poolCycles[poolCycles.length - 1];
        if (!targetCycle) return 0;

        const todayKey = getTodayKey();
        const newPaid = Math.round(((targetCycle.paidAmount ?? 0) + amount) * 100) / 100;
        const cycleDateKeys = getCycleDateKeys(pool, targetCycle.monthKey);
        set((s) => ({
          cycles: s.cycles.map((c) => {
            if (c.id !== targetCycle.id) return c;
            const updated = { ...c, paidAmount: newPaid };
            return refreshEqualizeCycleStatus(updated, pool, todayKey);
          }),
          records: s.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  poolId,
                  poolDirection: (pool.direction === 'income' ? 'in' : 'out') as 'in' | 'out',
                  poolStatus: 'claimed' as const,
                  poolName: pool.name,
                  // v2.4 T-410：认领记录快照该周期的起止与总额（池移除后仍可溯源）
                  poolCycleStart: cycleDateKeys[0],
                  poolCycleEnd: cycleDateKeys[cycleDateKeys.length - 1],
                  poolCycleTotal: targetCycle.totalAmount,
                  updatedAt: now,
                }
              : r,
          ),
        }));

        // v2.4 T-410：周期认领满额 → 该周期均摊记录「虚拟变实际」，
        // 回写真实关联时间与金额
        if (newPaid + 1e-9 >= targetCycle.totalAmount) {
          const startKey = cycleDateKeys[0];
          const endKey = cycleDateKeys[cycleDateKeys.length - 1];
          if (startKey && endKey) {
            set((s) => ({
              records: s.records.map((r) =>
                r.poolId === poolId &&
                !r.poolStatus &&
                !r.poolSettledAt &&
                r.dateKey >= startKey &&
                r.dateKey <= endKey
                  ? { ...r, poolSettledAt: now, poolSettledAmount: newPaid, updatedAt: now }
                  : r,
              ),
            }));
          }
        }

        // 满额且周期已过 → 池自动移除（记录保留）
        get().retireFinishedPools();
        return amount;
      },

      syncPoolCycles: () => {
        const todayKey = getTodayKey();
        const currentMonth = getCurrentMonthKey();
        const now = Date.now();

        for (const pool of get().pools) {
          if (pool.type !== 'equalize') continue;
          const accountId = pool.targetAccountId ?? get().accounts[0]?.id ?? 'default';

          // 1. 按月模式跨月补齐（额度内且当月周期缺失）
          if (pool.cycleMode !== 'daily') {
            const poolCycles = get().cycles.filter((c) => c.poolId === pool.id);
            const hasCurrent = poolCycles.some((c) => c.monthKey === currentMonth);
            if (!hasCurrent && poolCycles.length < Math.max(1, pool.cycleMonths)) {
              const draft = buildEqualizeCycleDraft(pool, currentMonth);
              set((s) => ({ cycles: [...s.cycles, materializeCycle(pool.id, draft)] }));
            }
          }

          // 2. 到期生成：已到来且未生成的日期 → 每天一条真实消费记录
          for (const cycle of get().cycles.filter((c) => c.poolId === pool.id)) {
            const dateKeys = getCycleDateKeys(pool, cycle.monthKey);
            const due = planDailyRecords(cycle, dateKeys, todayKey);

            // 3. 状态刷新（认领额 + 到期）
            const refreshed = refreshEqualizeCycleStatus(cycle, pool, todayKey);

            if (due.length === 0) {
              if (refreshed.status !== cycle.status) {
                set((s) => ({
                  cycles: s.cycles.map((c) => (c.id === cycle.id ? refreshed : c)),
                }));
              }
              continue;
            }

            // 精确金额分配（尾差补最后一天）
            const amounts = splitDailyAmount(cycle.totalAmount, dateKeys.length);
            // v2.4：收入池生成收入记录（+），支出池生成支出记录（−）
            const recType = pool.direction ?? 'expense';
            const txDir: 'in' | 'out' = recType === 'income' ? 'in' : 'out';
            const newTxs: PoolTransaction[] = [];
            const newRecords: AccountRecord[] = [];
            for (const dateKey of due) {
              const idx = dateKeys.indexOf(dateKey);
              const amount = amounts[idx] ?? cycle.dailyVirtual;
              const recId = genId('rec');
              newTxs.push({
                id: genId('ptx'),
                cycleId: cycle.id,
                dateKey,
                recordId: recId,
                amount,
                direction: txDir,
                status: 'confirmed',
                confirmedAt: now,
              });
              newRecords.push({
                id: recId,
                dateKey,
                amount: recType === 'income' ? amount : -amount,
                type: recType,
                categoryId: pool.categoryId ?? '',
                isUncategorized: !pool.categoryId,
                accountId,
                createdAt: now,
                updatedAt: now,
                poolId: pool.id,
                poolDirection: txDir,
                // 无 poolStatus → 普通记录：计入统计、可编辑可删除
                // v2.4 T-410：周期快照（几号到几号、多少钱均摊出来的）
                poolCycleStart: dateKeys[0],
                poolCycleEnd: dateKeys[dateKeys.length - 1],
                poolCycleTotal: cycle.totalAmount,
                poolName: pool.name,
              });
            }

            set((s) => ({
              cycles: s.cycles.map((c) =>
                c.id === cycle.id
                  ? { ...refreshed, transactions: [...c.transactions, ...newTxs] }
                  : c,
              ),
              records: [...s.records, ...newRecords],
            }));
          }

          // 4. v2.4 T-410 回补：存量均摊记录缺失的周期快照 / 已付满周期的结算信息
          const patchById = new Map<string, Partial<AccountRecord>>();
          for (const cycle of get().cycles.filter((c) => c.poolId === pool.id)) {
            const dateKeys = getCycleDateKeys(pool, cycle.monthKey);
            const startKey = dateKeys[0];
            const endKey = dateKeys[dateKeys.length - 1];
            if (!startKey || !endKey) continue;
            const fullyPaid = (cycle.paidAmount ?? 0) + 1e-9 >= cycle.totalAmount;
            for (const r of get().records) {
              if (r.poolId !== pool.id || r.poolStatus) continue;
              if (r.dateKey < startKey || r.dateKey > endKey) continue;
              const patch: Partial<AccountRecord> = {};
              if (!r.poolCycleStart) {
                patch.poolCycleStart = startKey;
                patch.poolCycleEnd = endKey;
                patch.poolCycleTotal = cycle.totalAmount;
              }
              if (!r.poolName) patch.poolName = pool.name;
              if (fullyPaid && !r.poolSettledAt) {
                patch.poolSettledAt = now;
                patch.poolSettledAmount = cycle.paidAmount;
              }
              if (Object.keys(patch).length > 0) patchById.set(r.id, patch);
            }
          }
          if (patchById.size > 0) {
            set((s) => ({
              records: s.records.map((r) =>
                patchById.has(r.id) ? { ...r, ...patchById.get(r.id) } : r,
              ),
            }));
          }
        }

        // v2.4 T-410：满额且周期已过的池自动移除（记录保留）
        get().retireFinishedPools();
      },

      retireFinishedPools: () => {
        const todayKey = getTodayKey();
        const done = new Set<string>();
        for (const pool of get().pools) {
          if (pool.type !== 'equalize') continue;
          const poolCycles = get().cycles.filter((c) => c.poolId === pool.id);
          if (poolCycles.length === 0) continue;
          const allPaid = poolCycles.every(
            (c) => (c.paidAmount ?? 0) + 1e-9 >= c.totalAmount,
          );
          if (!allPaid) continue;
          const allDates = poolCycles
            .flatMap((c) => getCycleDateKeys(pool, c.monthKey))
            .sort();
          const lastEnd = allDates[allDates.length - 1];
          if (lastEnd && lastEnd < todayKey) done.add(pool.id);
        }
        if (done.size === 0) return;
        set((s) => ({
          pools: s.pools.filter((p) => !done.has(p.id)),
          cycles: s.cycles.filter((c) => !done.has(c.poolId)),
        }));
      },

      // ── Savings ──
      addSavingsGoal: (goal) => {
        const newGoal: SavingsGoal = {
          ...goal,
          id: genId('goal'),
          createdAt: Date.now(),
        };
        set((s) => ({ savingsGoals: [...s.savingsGoals, newGoal] }));
        return newGoal;
      },

      updateSavingsGoal: (id, patch) => {
        set((s) => ({
          savingsGoals: s.savingsGoals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }));
      },

      deleteSavingsGoal: (id) => {
        // v2.4：删目标仅解除记录关联，记录本身保留（钱已真实发生）
        set((s) => ({
          savingsGoals: s.savingsGoals.filter((g) => g.id !== id),
          records: s.records.map((r) =>
            r.goalId === id ? { ...r, goalId: undefined } : r,
          ),
        }));
      },

      // ── 聚合查询 ──
      getRecordsByDate: (dateKey) => {
        return get().records.filter((r) => r.dateKey === dateKey);
      },

      getRecordsByMonth: (year, month) => {
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        return get().records.filter((r) => r.dateKey.startsWith(prefix));
      },

      getRecordsByCategory: (categoryId) => {
        return get().records.filter((r) => r.categoryId === categoryId);
      },

      getUncategorizedRecords: () => {
        // v2.3：虚拟预扣与认领付款不进未分类
        return get().records.filter(
          (r) =>
            (r.isUncategorized || !r.categoryId) &&
            r.poolStatus !== 'virtual' &&
            r.poolStatus !== 'claimed',
        );
      },

      getAccountBalance: (accountId) => {
        const account = get().accounts.find((a) => a.id === accountId);
        return account?.balance ?? 0;
      },

      getTotalBalance: () => {
        return get().accounts.reduce((sum, a) => sum + a.balance, 0);
      },

      // ── 重置 ──
      reset: () => {
        set(buildInitialState());
      },
    }),
    {
      name: ACCOUNTING_KEY,
      storage: createJSONStorage(() => localStorage),
      // 不做版本迁移，首次 v2.0 直接使用
      version: 0,
    },
  ),
);
