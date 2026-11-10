/**
 * Salary Timer 后端 — 数据库层
 *
 * 五张表：
 * - users         每个匿名设备一行（首次出现时间 = 新用户判定依据）
 * - daily_active  (day, user_id) 主键 → 同一天同一设备只算一次活跃
 * - notices       公告 / 更新（type 区分），支持版本号与草稿
 * - settings      单行 key-value 配置（站点配置、当前版本号等）
 * - feedbacks     用户意见反馈（只增不改内容，只流转状态）
 *
 * 用 SQLite 单文件存储，部署时用 docker volume 持久化。
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Stats {
  totalUsers: number;
  todayActive: number;
  todayNewUsers: number;
  /** App 端用户数（platform = 'app'） */
  appUsers: number;
  /** Web 端用户数（platform = 'web'） */
  webUsers: number;
  last7Days: { day: string; active: number; newUsers: number }[];
}

/** 客户端平台：app = 原生 App；web = 浏览器 */
export type ClientPlatform = 'app' | 'web';

/** 公告类型：announcement = 纯展示；update = 版本更新（App 端要比对版本） */
export type NoticeType = 'announcement' | 'update';

export interface Notice {
  id: number;
  type: NoticeType;
  title: string;
  body: string;
  /** update 类型的目标版本号；announcement 为 null */
  version: string | null;
  /** 是否已发布（草稿不对客户端可见） */
  published: boolean;
  /** 发布时间戳（ms） */
  createdAt: number;
  /** 最后更新时间戳（ms） */
  updatedAt: number;
}

export interface NoticeInput {
  type: NoticeType;
  title: string;
  body: string;
  version?: string | null;
  published?: boolean;
}

/** 反馈处理状态：new = 新反馈；reviewing = 处理中；done = 已处理 */
export type FeedbackStatus = 'new' | 'reviewing' | 'done';

export interface Feedback {
  id: number;
  /** 反馈内容（用户原文，不做改写） */
  content: string;
  /** 用户自愿留下的联系方式（邮箱 / 微信 / 手机号），可为空 */
  contact: string;
  /** 来源平台：app / web */
  platform: ClientPlatform;
  /** 反馈者匿名 ID（用于关联同一设备，不含个人信息） */
  userId: string;
  status: FeedbackStatus;
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackInput {
  content: string;
  contact?: string;
  platform?: ClientPlatform;
  userId?: string;
}

export function createDb(file: string): Database.Database {
  mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      first_seen_at INTEGER NOT NULL,
      first_day     TEXT NOT NULL,
      last_seen_at  INTEGER NOT NULL,
      platform      TEXT NOT NULL DEFAULT 'web'
    );

    CREATE TABLE IF NOT EXISTS daily_active (
      day     TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (day, user_id)
    );

    CREATE TABLE IF NOT EXISTS notices (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      version    TEXT,
      published  INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      content    TEXT NOT NULL,
      contact    TEXT NOT NULL DEFAULT '',
      platform   TEXT NOT NULL DEFAULT 'web',
      user_id    TEXT NOT NULL DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'new',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_daily_active_day ON daily_active(day);
    CREATE INDEX IF NOT EXISTS idx_users_first_day ON users(first_day);
    CREATE INDEX IF NOT EXISTS idx_notices_type ON notices(type);
    CREATE INDEX IF NOT EXISTS idx_notices_published ON notices(published);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
  `);

  // ── 迁移：users.platform（老库没有这一列）────────────────
  // SQLite 的 `ALTER TABLE ADD COLUMN` 不支持 IF NOT EXISTS，
  // 所以先查列名，存在就跳过。
  const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'platform')) {
    db.exec("ALTER TABLE users ADD COLUMN platform TEXT NOT NULL DEFAULT 'web'");
  }

  return db;
}

/**
 * 记录一次活跃（每个设备每天只生效一次）
 *
 * @param platform 客户端平台（app / web），仅在**首次**登记用户时写入，
 *                 后续上报不会覆盖（避免 web 首访后装 App 把老用户改判成 app）
 */
export function recordPing(
  db: Database.Database,
  userId: string,
  now = new Date(),
  platform: ClientPlatform = 'web',
): { isNewUser: boolean } {
  const ts = now.getTime();
  const day = toDayKey(now);

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  const isNewUser = !existing;

  if (isNewUser) {
    db.prepare(
      'INSERT INTO users (id, first_seen_at, first_day, last_seen_at, platform) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, ts, day, ts, platform);
  } else {
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(ts, userId);
  }

  // 同一天重复 ping 由主键冲突忽略
  db.prepare('INSERT OR IGNORE INTO daily_active (day, user_id) VALUES (?, ?)').run(day, userId);

  return { isNewUser };
}

export function queryStats(db: Database.Database, now = new Date()): Stats {
  const today = toDayKey(now);

  const totalUsers = count(db, 'SELECT COUNT(*) AS n FROM users');
  const todayActive = count(
    db,
    'SELECT COUNT(*) AS n FROM daily_active WHERE day = ?',
    [today],
  );
  const todayNewUsers = count(
    db,
    'SELECT COUNT(*) AS n FROM users WHERE first_day = ?',
    [today],
  );
  const appUsers = count(db, "SELECT COUNT(*) AS n FROM users WHERE platform = 'app'");
  const webUsers = count(db, "SELECT COUNT(*) AS n FROM users WHERE platform = 'web'");

  const last7Days: Stats['last7Days'] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = toDayKey(new Date(now.getTime() - i * 86_400_000));
    last7Days.push({
      day,
      active: count(db, 'SELECT COUNT(*) AS n FROM daily_active WHERE day = ?', [day]),
      newUsers: count(db, 'SELECT COUNT(*) AS n FROM users WHERE first_day = ?', [day]),
    });
  }

  return { totalUsers, todayActive, todayNewUsers, appUsers, webUsers, last7Days };
}

// ── 公告 / 更新 ────────────────────────────────────────────

/** 列出公告（管理端用，可包含草稿） */
export function listNotices(
  db: Database.Database,
  opts: { type?: NoticeType; includeDrafts?: boolean } = {},
): Notice[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.type) {
    where.push('type = ?');
    params.push(opts.type);
  }
  if (!opts.includeDrafts) {
    where.push('published = 1');
  }
  const sql =
    `SELECT * FROM notices` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY created_at DESC`;

  const rows = db.prepare(sql).all(...(params as never[])) as NoticeRow[];
  return rows.map(toNotice);
}

export function getNotice(db: Database.Database, id: number): Notice | null {
  const row = db.prepare('SELECT * FROM notices WHERE id = ?').get(id) as NoticeRow | undefined;
  return row ? toNotice(row) : null;
}

export function createNotice(db: Database.Database, input: NoticeInput): Notice {
  const ts = Date.now();
  const result = db
    .prepare(
      `INSERT INTO notices (type, title, body, version, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.type,
      input.title,
      input.body,
      input.version ?? null,
      input.published ? 1 : 0,
      ts,
      ts,
    );
  return getNotice(db, Number(result.lastInsertRowid))!;
}

export function updateNotice(db: Database.Database, id: number, input: Partial<NoticeInput>): Notice | null {
  const existing = getNotice(db, id);
  if (!existing) return null;

  db.prepare(
    `UPDATE notices
     SET type = ?, title = ?, body = ?, version = ?, published = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.type ?? existing.type,
    input.title ?? existing.title,
    input.body ?? existing.body,
    input.version === undefined ? existing.version : input.version,
    input.published === undefined ? (existing.published ? 1 : 0) : input.published ? 1 : 0,
    Date.now(),
    id,
  );

  return getNotice(db, id);
}

export function deleteNotice(db: Database.Database, id: number): boolean {
  return db.prepare('DELETE FROM notices WHERE id = ?').run(id).changes > 0;
}

/**
 * 客户端查询：返回该客户端需要看到的公告 / 更新
 *
 * @param currentVersion 客户端当前版本（App 端用；Web 端传 null）
 * @param seenIds       客户端已看过的公告 id 列表
 *
 * 规则：
 * - announcement：纯展示，客户端按 id 去重后只要没在 seenIds 里就返回
 * - update：
 *   - Web 端（currentVersion 为 null）：同公告，看过就不展示
 *   - App 端：只有 target version > currentVersion 才算「有更新」才返回
 */
export function queryNoticesForClient(
  db: Database.Database,
  currentVersion: string | null,
  seenIds: number[],
): Notice[] {
  const all = listNotices(db, { includeDrafts: false });
  const seen = new Set(seenIds);

  return all.filter((n) => {
    // 已经看过的（按 id 去重）直接跳过
    if (seen.has(n.id)) return false;

    if (n.type === 'announcement') return true;

    // update 类型
    if (currentVersion === null) {
      // Web 端：与公告同逻辑，看过就不展示
      return true;
    }
    // App 端：目标版本必须比当前版本新
    if (!n.version) return true;
    return compareVersions(n.version, currentVersion) > 0;
  });
}

// ── 意见反馈 ───────────────────────────────────────────────

/**
 * 列出反馈（管理端用）
 *
 * @param opts.status  按状态过滤；不传则返回全部
 * @param opts.limit   最多返回条数（默认 200，防止一次性拉爆内存）
 */
export function listFeedbacks(
  db: Database.Database,
  opts: { status?: FeedbackStatus; limit?: number } = {},
): Feedback[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    where.push('status = ?');
    params.push(opts.status);
  }
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const sql =
    `SELECT * FROM feedbacks` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY created_at DESC LIMIT ${limit}`;

  const rows = db.prepare(sql).all(...(params as never[])) as FeedbackRow[];
  return rows.map(toFeedback);
}

export function getFeedback(db: Database.Database, id: number): Feedback | null {
  const row = db.prepare('SELECT * FROM feedbacks WHERE id = ?').get(id) as
    | FeedbackRow
    | undefined;
  return row ? toFeedback(row) : null;
}

/** 新建一条反馈 */
export function createFeedback(db: Database.Database, input: FeedbackInput): Feedback {
  const ts = Date.now();
  const result = db
    .prepare(
      `INSERT INTO feedbacks (content, contact, platform, user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'new', ?, ?)`,
    )
    .run(
      input.content,
      input.contact ?? '',
      input.platform ?? 'web',
      input.userId ?? '',
      ts,
      ts,
    );
  return getFeedback(db, Number(result.lastInsertRowid))!;
}

/**
 * 更新反馈状态
 *
 * 只允许流转到合法状态；内容与联系方式不可改（反馈是用户原话）。
 */
export function updateFeedbackStatus(
  db: Database.Database,
  id: number,
  status: FeedbackStatus,
): Feedback | null {
  const existing = getFeedback(db, id);
  if (!existing) return null;

  db.prepare('UPDATE feedbacks SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    Date.now(),
    id,
  );
  return getFeedback(db, id);
}

/** 删除反馈 */
export function deleteFeedback(db: Database.Database, id: number): boolean {
  return db.prepare('DELETE FROM feedbacks WHERE id = ?').run(id).changes > 0;
}

// ── 配置 ───────────────────────────────────────────────────

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/** YYYY-MM-DD（服务器本地时区） */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 语义化版本比较：a > b 返回正数，a < b 返回负数，相等返回 0
 * 非标准版本号（如 "3.1" / "3.1.0-beta"）也能比较。
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/).filter(Boolean);
  const pb = b.split(/[.\-+]/).filter(Boolean);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    const va = Number.isFinite(na) ? na : 0;
    const vb = Number.isFinite(nb) ? nb : 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

interface NoticeRow {
  id: number;
  type: string;
  title: string;
  body: string;
  version: string | null;
  published: number;
  created_at: number;
  updated_at: number;
}

interface FeedbackRow {
  id: number;
  content: string;
  contact: string;
  platform: string;
  user_id: string;
  status: string;
  created_at: number;
  updated_at: number;
}

function toNotice(row: NoticeRow): Notice {
  return {
    id: row.id,
    type: row.type === 'update' ? 'update' : 'announcement',
    title: row.title,
    body: row.body,
    version: row.version,
    published: row.published === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFeedback(row: FeedbackRow): Feedback {
  const status: FeedbackStatus =
    row.status === 'done' ? 'done' : row.status === 'reviewing' ? 'reviewing' : 'new';
  return {
    id: row.id,
    content: row.content,
    contact: row.contact,
    platform: row.platform === 'app' ? 'app' : 'web',
    userId: row.user_id,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function count(db: Database.Database, sql: string, params: unknown[] = []): number {
  const row = db.prepare(sql).get(...(params as never[])) as { n: number } | undefined;
  return row?.n ?? 0;
}
