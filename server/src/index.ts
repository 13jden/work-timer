/**
 * Salary Timer 后端 — HTTP 服务
 *
 * 路由：
 * - POST /api/ping        客户端每日心跳（记录活跃 + 新用户）
 * - GET  /api/stats       管理统计（需 Bearer token）
 * - POST /api/auth/login  管理后台登录
 * - GET  /admin           管理后台静态页（自带登录表单）
 */
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDb, recordPing, queryStats } from './db.js';
import { loadAdminConfig, login, verifyToken } from './auth.js';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? join(here, '..', 'data', 'salary-timer.db');
const ADMIN_TOKEN_HEADER = 'x-admin-token';

const db = createDb(DB_PATH);
const admin = loadAdminConfig();
const app = express();

app.use(express.json({ limit: '8kb' }));

// 非法 JSON 不返回 HTML 堆栈，统一 400 JSON
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    res.status(400).json({ ok: false, error: 'invalid json' });
    return;
  }
  next(err);
});

// 管理后台与前端同域部署（Caddy 反代 /api 与 /admin 到本服务），但本地开发跨端口，放开 CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

/** 客户端每日心跳：body { userId } */
app.post('/api/ping', (req, res) => {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  if (!userId || userId.length > 64) {
    res.status(400).json({ ok: false, error: 'invalid userId' });
    return;
  }
  const { isNewUser } = recordPing(db, userId);
  res.json({ ok: true, isNewUser });
});

/** 管理统计 */
app.get('/api/stats', (req, res) => {
  const token = req.header(ADMIN_TOKEN_HEADER) ?? (req.query.token as string | undefined);
  if (!verifyToken(admin, token)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  res.json({ ok: true, ...queryStats(db) });
});

/** 登录 */
app.post('/api/auth/login', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const token = login(admin, username, password);
  if (!token) {
    res.status(401).json({ ok: false, error: '账号或密码不正确' });
    return;
  }
  res.json({ ok: true, token });
});

// 管理后台静态页
app.use('/admin', express.static(join(here, '..', 'public', 'admin')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[salary-timer-api] listening on :${PORT} · db=${DB_PATH}`);
});
