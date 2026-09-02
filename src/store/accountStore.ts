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
  SavingsGoal,
} from '../lib/types';

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
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          // 同时删除关联的记录
          records: s.records.map((r) =>
            r.accountId === id ? { ...r, accountId: 'deleted' } : r,
          ),
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
        return newRecord;
      },

      updateRecord: (id, patch) => {
        const oldRecord = get().records.find((r) => r.id === id);
        if (!oldRecord) return;

        // 计算余额变化
        const oldAmount = oldRecord.amount;
        const newAmount = patch.amount ?? oldAmount;
        const delta = newAmount - oldAmount;

        set((s) => ({
          records: s.records.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r,
          ),
        }));

        // 更新账户余额
        if (delta !== 0) {
          get().updateAccount(oldRecord.accountId, {
            balance: get().getAccountBalance(oldRecord.accountId) + delta,
          });
        }
      },

      deleteRecord: (id) => {
        const record = get().records.find((r) => r.id === id);
        if (!record) return;

        // 恢复账户余额
        get().updateAccount(record.accountId, {
          balance: get().getAccountBalance(record.accountId) - record.amount,
        });

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
        set((s) => ({
          pools: s.pools.filter((p) => p.id !== id),
          cycles: s.cycles.filter((c) => c.poolId !== id),
          records: s.records.map((r) =>
            r.poolId === id ? { ...r, poolId: undefined, poolDirection: undefined, poolStatus: undefined } : r,
          ),
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
        set((s) => ({
          savingsGoals: s.savingsGoals.filter((g) => g.id !== id),
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
        return get().records.filter((r) => r.isUncategorized || !r.categoryId);
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
