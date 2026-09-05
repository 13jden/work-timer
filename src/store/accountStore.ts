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
  /**
   * v2.5-fixbug (T-043)：解除记录的池关联（含回退池业务）。
   * - 均摊付款（claimed）：回退 cycles[].paidAmount，对齐 deleteRecord 行为
   * - 存池确认（confirmed）：移除对应 transactions
   * - 每日均摊（!poolStatus）：仅清空对应 transaction 的 recordId（防 sync 重新生成）
   * 最后清空记录上所有池字段（poolId/poolStatus/poolDirection/poolName
   *   /poolCycleStart/End/Total/poolSettledAt/Amount）
   * @returns 解除的金额；不存在的记录返回 0
   */
  unclaimToPool: (recordId: string) => number;

  /**
   * v2.5-patch2 T-505：池级别「部分到账」（partial claim）。
   * 仅 income equalize 池（联动工资池）支持 —— 用户在 time 模式下随日期累加的
   * 「已赚」联动 record 不会被改动,本 action 创建一条独立的 claimed income record
   * 表达「实发 X 元」,并把 X 累加进 cycle.paidAmount + 一条 in 交易。
   *
   * 核心语义:
   * - 已赚累计 = sum(confirmed in records with this poolId) → 不变
   * - 已到账累计 = sum(claimed in records with this poolId) → += finalAmt
   * - 未到账 = 已赚累计 - 已到账累计(由 calcVirtualAssets 派生)
   * - 账户余额 += finalAmt(因为是真实到账收入记录)
   *
   * 入参:
   * - claimAmount: 实际到账金额(>0);超过未到账部分会被夹到 remaining。
   * - opts.dateKey: 到账日(默认今天)
   * - opts.note: 备注(默认"部分到账")
   * - opts.accountId: 接收账户(默认 pool.targetAccountId ?? accounts[0].id)
   *
   * 仅对 type='equalize' && direction='income' 的池生效;其他类型返回 0。
   * @returns 实际写入金额(夹到 remaining 之后)
   */
  partialClaimToPool: (
    poolId: string,
    claimAmount: number,
    opts?: { dateKey?: string; note?: string; accountId?: string },
  ) => number;

  // ── Savings 操作 ──
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'createdAt'>) => SavingsGoal;
  updateSavingsGoal: (id: string, patch: Partial<Omit<SavingsGoal, 'id' | 'createdAt'>>) => void;
  deleteSavingsGoal: (id: string) => void;

  // ── v2.5 TASK-046 T-501：time → accounting 联动 ──
  /**
   * 确保存在固定「工资池」(deposit + income)。已有则返回 id,没有则创建并返回 id。
   * 工资池用于承载 time 模式「当日已赚」联动写入的 income record;
   * 实际到账时,用户用 claimToPool 把账户内的真实收入记录关联进此池。
   */
  ensureSalaryPool: () => string;
  /**
   * 按 dateKey 同步一条「time 模式当日已赚」联动记录。
   * - 同一 dateKey 已存在 linkageSource='salary-time-mode' 记录 → 更新 amount;
   * - 没有则新增一条 income record(income categoryId 默认 cat-salary,带 poolStatus='confirmed');
   * - amount <= 0 时删除该 dateKey 的联动记录(允许 0 已赚的日期不再出现)。
   * 不会触碰非联动记录,不动账户余额(进的是 deposit pool 而非 account)。
   */
  /** 联动 record 写入时确保 pool / cycle 存在（v2.5 TASK-046 T-501） */
  upsertSalaryLinkageForDate: (dateKey: string, amount: number) => void;

  /**
   * 为指定分类补一个 folder（v2.5 TASK-046 T-504）。
   * 已存在则跳过；分类不存在也跳过。
   * 用于「存在记录的分类一定在首页展示」的兜底（联动 record / 老数据 / 跨设备同步）。
   */
  ensureFoldersForCategories: (categoryIds: string[]) => void;

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
  // v2.5 TASK-046 T-502：默认把前 6 个支出 + 「工资」收入分类也建为 folder，
  // 让首页分类网格同时展示支出 + 工资联动记录入口。
  const expenseCats = categories.filter((c) => c.type === 'expense').slice(0, 6);
  const salaryCat = categories.find((c) => c.id === 'cat-salary');
  const folders: Folder[] = expenseCats.map((cat, i) => ({
    id: `folder-${cat.id}`,
    categoryId: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    order: i,
  }));
  if (salaryCat) {
    folders.push({
      id: `folder-${salaryCat.id}`,
      categoryId: salaryCat.id,
      name: salaryCat.name,
      icon: salaryCat.icon,
      color: salaryCat.color,
      order: folders.length,
    });
  }
  return folders;
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
        set((s) => {
          // v2.5-patch2 T-507：新建分类时同步创建 folder，否则 CategoryFolderGrid
          // (只渲染 folders)要等组件挂载后 ensureFoldersForCategories 兜底一次才补，
          // 用户从新建弹窗回到首页能看到文件夹出现，但若同时新建 + 切页面会出现时序缺口。
          const folder: Folder = {
            id: `folder-${newCategory.id}`,
            categoryId: newCategory.id,
            name: newCategory.name,
            icon: newCategory.icon,
            color: newCategory.color,
            order: s.folders.length,
          };
          return {
            categories: [...s.categories, newCategory],
            folders: [...s.folders, folder],
          };
        });
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
        // v2.4 T-410 + v2.5-patch2 T-505：仅 recordAffectsBalance() === true 的 record
        // 才回退余额（池逐日虚拟 / 联动 record 从未动过余额,反向减会凭空扣钱）
        const affected = get().records.filter((r) => r.poolId === id);
        for (const r of affected) {
          if (!recordAffectsBalance(r)) continue;
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

      // v2.5-patch2 T-505：池级别部分到账（仅 income equalize 池）
      // —— 工资池联动 record 是「已赚」,发工资时实际到账可能 < 已赚累计,
      // 用 partial claim 创建独立 claimed income record 表示「实发 X 元」,
      // 联动 records 全部保留(继续计入已赚)。
      partialClaimToPool: (poolId, claimAmount, opts) => {
        const state = get();
        const pool = state.pools.find((p) => p.id === poolId);
        // 仅 income equalize 池支持(支出均摊 / 存池暂不开放)
        if (!pool || pool.type !== 'equalize') return 0;
        if ((pool.direction ?? 'expense') !== 'income') return 0;

        const abs = Math.round(Math.abs(claimAmount) * 100) / 100;
        if (!(abs > 0)) return 0;

        const cycle = state.cycles.find((c) => c.poolId === poolId);
        if (!cycle) return 0;

        // 计算「已赚累计」「已到账累计」,夹到 remaining
        let earned = 0;
        let alreadyClaimed = 0;
        for (const r of state.records) {
          if (r.poolId !== poolId) continue;
          if (r.poolStatus === 'confirmed' && r.amount > 0) earned += r.amount;
          else if (r.poolStatus === 'claimed' && r.amount > 0) alreadyClaimed += r.amount;
        }
        const remaining = Math.max(0, Math.round((earned - alreadyClaimed) * 100) / 100);
        const finalAmt = Math.min(abs, remaining);
        if (!(finalAmt > 0)) return 0;

        const now = Date.now();
        const dateKey = opts?.dateKey ?? getTodayKey();
        const accountId =
          opts?.accountId ?? pool.targetAccountId ?? state.accounts[0]?.id ?? '';
        const cycleDateKeys = getCycleDateKeys(pool, cycle.monthKey);

        // 独立 claimed income record —— 不动联动 record,直接表达「实发 X 元」
        // 用 addRecord 走标准路径 → 账户余额 += finalAmt(与真实到账语义一致)
        const claimedRecord = get().addRecord({
          dateKey,
          amount: finalAmt,
          type: 'income',
          categoryId: pool.categoryId ?? 'cat-salary',
          accountId,
          note: opts?.note ?? '部分到账',
          poolId,
          poolDirection: 'in',
          poolStatus: 'claimed',
          poolName: pool.name,
          // v2.4 T-410：周期快照(池退休后仍可溯源)
          poolCycleStart: cycleDateKeys[0],
          poolCycleEnd: cycleDateKeys[cycleDateKeys.length - 1],
          poolCycleTotal: cycle.totalAmount,
        });

        const tx: PoolTransaction = {
          id: genId('ptx'),
          cycleId: cycle.id,
          dateKey,
          recordId: claimedRecord.id,
          amount: finalAmt,
          direction: 'in',
          status: 'confirmed',
          confirmedAt: now,
        };

        const newPaid = Math.round((cycle.paidAmount + finalAmt) * 100) / 100;
        const todayKey = getTodayKey();

        // 注:claimedRecord 已由 addRecord 自动写入 records / 更新账户余额;
        // 这里只更新 cycle.transactions + paidAmount + 状态
        set((s) => ({
          cycles: s.cycles.map((c) => {
            if (c.id !== cycle.id) return c;
            const updated = {
              ...c,
              paidAmount: newPaid,
              transactions: [...c.transactions, tx],
            };
            return refreshEqualizeCycleStatus(updated, pool, todayKey);
          }),
        }));

        // 满额且周期已过 → 池自动移除(记录保留)
        get().retireFinishedPools();
        return finalAmt;
      },

      unclaimToPool: (recordId) => {
        const state = get();
        const record = state.records.find((r) => r.id === recordId);
        if (!record || !record.poolId) return 0;

        const pool = state.pools.find((p) => p.id === record.poolId);
        const now = Date.now();
        const amount = Math.abs(record.amount);

        // 池业务回退（三分支对齐 deleteRecord 的池处理，但保留记录）
        if (pool && record.poolStatus === 'claimed') {
          // 均摊付款：认领额回退（只扣第一个含该额度的周期）
          const todayKey = getTodayKey();
          let deducted = false;
          set((s) => ({
            cycles: s.cycles.map((c) => {
              if (c.poolId !== record.poolId) return c;
              if (!deducted && (c.paidAmount ?? 0) + 1e-9 >= amount) {
                deducted = true;
                const updated = {
                  ...c,
                  paidAmount: Math.round(((c.paidAmount ?? 0) - amount) * 100) / 100,
                };
                return refreshEqualizeCycleStatus(updated, pool, todayKey);
              }
              return c;
            }),
          }));
        } else if (pool?.type === 'deposit' && record.poolStatus === 'confirmed') {
          // 存池确认：移除对应 transaction
          set((s) => ({
            cycles: s.cycles.map((c) =>
              c.poolId === record.poolId
                ? { ...c, transactions: c.transactions.filter((t) => t.recordId !== record.id) }
                : c,
            ),
          }));
        } else if (!record.poolStatus) {
          // 每日均摊：仅清空 transaction.recordId（防 sync 重新生成）
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

        // 清空记录上所有池字段（保留其他业务字段如 amount/accountId/goalId）
        set((s) => ({
          records: s.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  poolId: undefined,
                  poolDirection: undefined,
                  poolStatus: undefined,
                  poolName: undefined,
                  poolCycleStart: undefined,
                  poolCycleEnd: undefined,
                  poolCycleTotal: undefined,
                  poolSettledAt: undefined,
                  poolSettledAmount: undefined,
                  updatedAt: now,
                }
              : r,
          ),
        }));

        return amount;
      },

      syncPoolCycles: () => {
        const todayKey = getTodayKey();
        const currentMonth = getCurrentMonthKey();
        const now = Date.now();

        for (const pool of get().pools) {
          if (pool.type !== 'equalize') continue;
          // v2.5 TASK-046 T-505：noDailyVirtual 池(联动工资)完全跳过 sync：
          // 不生成 daily virtual record、不跨月补齐、不动 cycle 状态；
          // cycle 仅作为「联动 record 累加容器」,由 upsertSalaryLinkageForDate 自行维护。
          if (pool.noDailyVirtual) continue;
          const accountId = pool.targetAccountId ?? get().accounts[0]?.id ?? 'default';

          // 1. 按月模式跨月补齐（额度内且当月周期缺失）
          // v2.5 TASK-046 T-505：noDailyVirtual 池(联动工资)不做日均均摊,跳过周期补齐
          if (pool.cycleMode !== 'daily' && !pool.noDailyVirtual) {
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

      // ── v2.5 TASK-046 T-501：time → accounting 联动 ──

      /** 固定「工资池」常量 id(整个 accountStore 生命周期共用) */
      // —— 不导出常量,实现为 ensureSalaryPool 内 find-or-create。

      ensureSalaryPool: () => {
        const state = get();
        const existing = state.pools.find(
          (p) => p.type === 'equalize' && p.direction === 'income' && p.name === '工资池',
        );
        if (existing) return existing.id;
        const created = get().addPool({
          type: 'equalize',
          name: '工资池',
          // amount / totalAmount 在建池时为 0；后续由联动 record 写入 / 更新 / 删除
          // 累加而得(参见 upsertSalaryLinkageForDate)。
          amount: 0,
          cycleMonths: 12,
          cycleMode: 'monthly',
          dayRange: { start: 1, end: 31 },
          direction: 'income',
          // v2.5 TASK-046 T-505：「工资」联动池是特殊池 —— 不做日均均摊。
          // 联动 record 本身即为「已赚」,不再被 daily virtual record 二次计入。
          noDailyVirtual: true,
          // 收入型 equalize 池不会走 claimToPool,settleMode 仅用于 UI 标记；
          // 与支出型 equalize 互斥(支出型:押金先付,这里 income 用 'prepay' 占位不影响)
          settleMode: 'prepay',
          categoryId: 'cat-salary',
        });
        // 同步建一个空 cycle 承载累计：totalAmount 初始 0,dailyVirtual = 0
        // (noDailyVirtual 池不按日生成 record,cycle 仅用于记录 in/claimed 交易)
        const cycle = {
          id: genId('cycle'),
          poolId: created.id,
          monthKey: getCurrentMonthKey(),
          totalAmount: 0,
          dayCount: 31,
          dailyVirtual: 0,
          paidAmount: 0,
          status: 'generating' as const,
          transactions: [],
        };
        set((s) => ({ cycles: [...s.cycles, cycle] }));
        return created.id;
      },

      upsertSalaryLinkageForDate: (dateKey, amount) => {
        // 不合法日期直接返回
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;

        const state = get();
        const poolId = get().ensureSalaryPool();
        const accountId = state.accounts[0]?.id ?? '';

        // 找当天已存在的联动 record
        const linkage = state.records.find(
          (r) => r.linkageSource === 'salary-time-mode' && r.dateKey === dateKey,
        );

        // amount <= 0 时:删除当天联动 record + 同步从 cycle.totalAmount 减去原 amount
        if (!(amount > 0)) {
          if (!linkage) return;
          const removed = linkage.amount;
          set((s) => ({
            records: s.records.filter((r) => r.id !== linkage.id),
            cycles: s.cycles.map((c) =>
              c.poolId === poolId
                ? {
                    ...c,
                    totalAmount: Math.max(
                      0,
                      Math.round((c.totalAmount - removed) * 100) / 100,
                    ),
                    transactions: c.transactions.filter((t) => t.recordId !== linkage.id),
                  }
                : c,
            ),
          }));
          return;
        }

        const abs = Math.round(amount * 100) / 100;
        const now = Date.now();
        const cycle = state.cycles.find((c) => c.poolId === poolId);

        if (linkage) {
          // 已有 → 仅更新 amount;cycle.totalAmount 累加差额
          const delta = Math.round((abs - linkage.amount) * 100) / 100;
          set((s) => ({
            records: s.records.map((r) =>
              r.id === linkage.id
                ? { ...r, amount: abs, updatedAt: now, poolId }
                : r,
            ),
            cycles: s.cycles.map((c) =>
              c.id === cycle?.id
                ? { ...c, totalAmount: Math.max(0, Math.round((c.totalAmount + delta) * 100) / 100) }
                : c,
            ),
          }));
          return;
        }

        // 新增联动 record：直接 set records；同步在 cycle 里追加 in + confirmed transaction
        // 并把 abs 累加到 cycle.totalAmount（让池的「总额」=所有联动 record 之和）
        const newRecord: AccountRecord = {
          id: `rec-linkage-${dateKey}-${now}`,
          dateKey,
          amount: abs,
          type: 'income',
          categoryId: 'cat-salary',
          note: 'time 模式联动',
          accountId,
          createdAt: now,
          updatedAt: now,
          poolId,
          poolDirection: 'in',
          poolStatus: 'confirmed',
          poolName: '工资池',
          linkageSource: 'salary-time-mode',
        };

        if (!cycle) {
          set((s) => ({ records: [...s.records, newRecord] }));
          return;
        }
        const tx = {
          id: genId('ptx'),
          cycleId: cycle.id,
          dateKey,
          recordId: newRecord.id,
          amount: abs,
          direction: 'in' as const,
          status: 'confirmed' as const,
          confirmedAt: now,
        };
        set((s) => ({
          records: [...s.records, newRecord],
          cycles: s.cycles.map((c) =>
            c.id === cycle.id
              ? {
                  ...c,
                  totalAmount: Math.round((c.totalAmount + abs) * 100) / 100,
                  transactions: [...c.transactions, tx],
                }
              : c,
          ),
        }));
      },

      // v2.5 TASK-046 T-504：批量为指定分类补 folder（兜底 rehydrate + CategoryFolderGrid 兜底调用）。
      // 已存在则跳过；分类本身不存在也跳过；新建 folder 排在末尾。
      ensureFoldersForCategories: (categoryIds) => {
        const state = get();
        if (categoryIds.length === 0) return;
        const existingFolderCats = new Set(state.folders.map((f) => f.categoryId));
        const catById = new Map(state.categories.map((c) => [c.id, c]));
        const additions: Folder[] = [];
        for (const categoryId of categoryIds) {
          if (existingFolderCats.has(categoryId)) continue;
          const cat = catById.get(categoryId);
          if (!cat) continue;
          existingFolderCats.add(categoryId);
          additions.push({
            id: `folder-${cat.id}`,
            categoryId: cat.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            order: 0, // 入 store 后按当前 folders.length 重新计算，避免 order 冲突
          });
        }
        if (additions.length === 0) return;
        set((s) => {
          const baseOrder = s.folders.length;
          return {
            folders: [
              ...s.folders,
              ...additions.map((f, i) => ({ ...f, order: baseOrder + i })),
            ],
          };
        });
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
      // v2.5 TASK-046 T-504：rehydrate 后兜底「存在记录的分类必有 folder」——
      // 联动 record 写入的 cat-salary 可能老版本没建 folder，老数据 / 跨设备同步也可能
      // 让部分有 record 的分类缺 folder。一次性扫描 records 补齐。
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const { records, folders, categories } = state;
        const folderCategoryIds = new Set(folders.map((f) => f.categoryId));
        const existingCatIds = new Set(categories.map((c) => c.id));
        const missing = new Set<string>();
        for (const r of records) {
          if (!r.categoryId) continue;
          if (folderCategoryIds.has(r.categoryId)) continue;
          if (!existingCatIds.has(r.categoryId)) continue;
          missing.add(r.categoryId);
        }
        if (missing.size === 0) return;
        useAccountStore.getState().ensureFoldersForCategories([...missing]);
      },
    },
  ),
);
