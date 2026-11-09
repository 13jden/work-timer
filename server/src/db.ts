/**
 * Salary Timer 后端 — 数据库层
 *
 * 两张表：
 * - users        每个匿名设备一行（首次出现时间 = 新用户判定依据）
 * - daily_active (day, user_id) 主键 → 同一天同一设备只算一次活跃
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
  last7Days: { day: string; active: number; newUsers: number }[];
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
      last_seen_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_active (
      day     TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (day, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_active_day ON daily_active(day);
    CREATE INDEX IF NOT EXISTS idx_users_first_day ON users(first_day);
  `);
  return db;
}

/** 记录一次活跃（每个设备每天只生效一次） */
export function recordPing(db: Database.Database, userId: string, now = new Date()): { isNewUser: boolean } {
  const ts = now.getTime();
  const day = toDayKey(now);

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  const isNewUser = !existing;

  if (isNewUser) {
    db.prepare(
      'INSERT INTO users (id, first_seen_at, first_day, last_seen_at) VALUES (?, ?, ?, ?)',
    ).run(userId, ts, day, ts);
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

  const last7Days: Stats['last7Days'] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = toDayKey(new Date(now.getTime() - i * 86_400_000));
    last7Days.push({
      day,
      active: count(db, 'SELECT COUNT(*) AS n FROM daily_active WHERE day = ?', [day]),
      newUsers: count(db, 'SELECT COUNT(*) AS n FROM users WHERE first_day = ?', [day]),
    });
  }

  return { totalUsers, todayActive, todayNewUsers, last7Days };
}

/** YYYY-MM-DD（服务器本地时区） */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function count(db: Database.Database, sql: string, params: unknown[] = []): number {
  const row = db.prepare(sql).get(...(params as never[])) as { n: number } | undefined;
  return row?.n ?? 0;
}
