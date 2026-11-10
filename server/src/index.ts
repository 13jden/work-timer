/**
 * Salary Timer 后端 — HTTP 服务
 *
 * 路由：
 * - POST /api/ping          客户端每日心跳（记录活跃 + 新用户）
 * - POST /api/feedback      客户端提交意见反馈（无需鉴权）
 * - GET  /api/notice        客户端拉取公告 / 更新（无需鉴权）
 * - GET  /api/config        客户端拉取公开配置（无需鉴权）
 * - GET  /api/stats         管理统计（需 token）
 * - GET  /api/notices       管理端：公告 / 更新列表（需 token）
 * - POST /api/notices       管理端：新建（需 token）
 * - PATCH /api/notices/:id  管理端：编辑（需 token）
 * - DELETE /api/notices/:id 管理端：删除（需 token）
 * - GET  /api/feedbacks     管理端：反馈列表（需 token）
 * - PATCH /api/feedbacks/:id 管理端：更新反馈状态（需 token）
 * - DELETE /api/feedbacks/:id 管理端：删除反馈（需 token）
 * - GET  /api/settings      管理端：读取配置（需 token）
 * - PUT  /api/settings      管理端：写入配置（需 token）
 * - POST /api/auth/login    管理后台登录
 * - GET  /admin             管理后台静态页（自带登录表单）
 */
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createDb,
  recordPing,
  queryStats,
  listNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  queryNoticesForClient,
  getAllSettings,
  setSetting,
  listFeedbacks,
  createFeedback,
  updateFeedbackStatus,
  deleteFeedback,
  type NoticeType,
  type ClientPlatform,
  type FeedbackStatus,
} from './db.js';
import { loadAdminConfig, login, verifyToken } from './auth.js';

const here = dirname(fileURLToPath(import.meta.url));
// 默认端口 8800 —— 8787 常被本机其他服务（如 Cursor 的 cursorfree）占用
const PORT = Number(process.env.PORT ?? 8800);
const DB_PATH = process.env.DB_PATH ?? join(here, '..', 'data', 'salary-timer.db');
const ADMIN_TOKEN_HEADER = 'x-admin-token';

const db = createDb(DB_PATH);
const admin = loadAdminConfig();
const app = express();

app.use(express.json({ limit: '64kb' }));

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

/** 管理端鉴权中间件 */
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const token = req.header(ADMIN_TOKEN_HEADER) ?? (req.query.token as string | undefined);
  if (!verifyToken(admin, token)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  next();
}

// ── 客户端接口 ────────────────────────────────────────────

/** 客户端每日心跳：body { userId, platform? } */
app.post('/api/ping', (req, res) => {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  if (!userId || userId.length > 64) {
    res.status(400).json({ ok: false, error: 'invalid userId' });
    return;
  }
  // platform 只影响「新用户首次登记」时的归类；老客户端不传就按 web 算
  const platform: ClientPlatform =
    req.body?.platform === 'app' ? 'app' : 'web';
  const { isNewUser } = recordPing(db, userId, new Date(), platform);
  res.json({ ok: true, isNewUser });
});

/**
 * 客户端提交意见反馈
 *
 * POST /api/feedback  body { content, contact?, platform?, userId? }
 *
 * 这是一个**公开写接口**，所以要防刷：
 * - 单条内容长度上限（1~2000 字）
 * - 联系方式长度上限（0~120 字）
 * - 同一 userId 60 秒内最多提交 3 条（内存计数，进程重启即失效，够用）
 */
const FEEDBACK_MAX_LEN = 2000;
const FEEDBACK_MAX_CONTACT_LEN = 120;
const FEEDBACK_RATE_WINDOW_MS = 60_000;
const FEEDBACK_RATE_MAX = 3;

/** userId → 最近提交时间戳数组（滑动窗口） */
const feedbackHits = new Map<string, number[]>();

function feedbackRateLimited(userId: string, now: number): boolean {
  const list = (feedbackHits.get(userId) ?? []).filter((t) => now - t < FEEDBACK_RATE_WINDOW_MS);
  if (list.length >= FEEDBACK_RATE_MAX) {
    feedbackHits.set(userId, list);
    return true;
  }
  list.push(now);
  feedbackHits.set(userId, list);
  return false;
}

app.post('/api/feedback', (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content) {
    res.status(400).json({ ok: false, error: 'content is required' });
    return;
  }
  if (content.length > FEEDBACK_MAX_LEN) {
    res.status(400).json({ ok: false, error: `content too long (max ${FEEDBACK_MAX_LEN})` });
    return;
  }

  const contact =
    typeof req.body?.contact === 'string' ? req.body.contact.trim().slice(0, FEEDBACK_MAX_CONTACT_LEN) : '';
  const platform: ClientPlatform = req.body?.platform === 'app' ? 'app' : 'web';
  const userId =
    typeof req.body?.userId === 'string' ? req.body.userId.trim().slice(0, 64) : '';

  // 没带 userId 的请求不做限流（无法定位来源），但内容长度限制仍然生效
  if (userId && feedbackRateLimited(userId, Date.now())) {
    res.status(429).json({ ok: false, error: 'too many submissions, please slow down' });
    return;
  }

  const feedback = createFeedback(db, { content, contact, platform, userId });
  res.status(201).json({ ok: true, feedback });
});

/**
 * 客户端拉取公告 / 更新
 *
 * GET /api/notice?currentVersion=3.1.0&seen=12,13&force=true
 *   currentVersion —— App 端传当前版本；Web 端不传（视为 null）
 *   seen           —— 客户端已看过的公告 id，逗号分隔
 *   force          —— 手动「检查更新」时传 true，忽略 seen 过滤
 *
 * 返回 { ok, notices: [...] }
 */
app.get('/api/notice', (req, res) => {
  const versionRaw = req.query.currentVersion;
  const currentVersion =
    typeof versionRaw === 'string' && versionRaw.trim() ? versionRaw.trim() : null;

  // 手动检查更新时，用户主动想再看一遍 —— 不过滤已读
  const force = req.query.force === 'true';

  const seenRaw = req.query.seen;
  const seenIds = force
    ? []
    : (typeof seenRaw === 'string' && seenRaw.trim() ? seenRaw : '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);

  const notices = queryNoticesForClient(db, currentVersion, seenIds);
  res.json({ ok: true, notices });
});

/**
 * 客户端公开配置（无需鉴权）
 *
 * 只暴露少数「客户端需要知道」的白名单配置，不返回全部 settings
 * （避免把后台内部配置泄漏出去）。
 */
const PUBLIC_SETTING_KEYS = ['userGuideUrl', 'currentVersion', 'footerText'] as const;

app.get('/api/config', (_req, res) => {
  const all = getAllSettings(db);
  const config: Record<string, string> = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    const value = all[key];
    if (typeof value === 'string' && value) config[key] = value;
  }
  res.json({ ok: true, config });
});

// ── 管理端接口 ────────────────────────────────────────────

/** 管理统计 */
app.get('/api/stats', requireAdmin, (_req, res) => {
  res.json({ ok: true, ...queryStats(db) });
});

/** 公告 / 更新列表 */
app.get('/api/notices', requireAdmin, (req, res) => {
  const typeRaw = req.query.type;
  const type = typeRaw === 'announcement' || typeRaw === 'update' ? (typeRaw as NoticeType) : undefined;
  const includeDrafts = req.query.includeDrafts === 'true';
  res.json({ ok: true, notices: listNotices(db, { type, includeDrafts }) });
});

/** 新建公告 / 更新 */
app.post('/api/notices', requireAdmin, (req, res) => {
  const parsed = parseNoticeInput(req.body);
  if ('error' in parsed) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }
  res.status(201).json({ ok: true, notice: createNotice(db, parsed) });
});

/** 编辑公告 / 更新 */
app.patch('/api/notices/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ ok: false, error: 'invalid id' });
    return;
  }
  const parsed = parseNoticeInput(req.body, true);
  if ('error' in parsed) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }
  const notice = updateNotice(db, id, parsed);
  if (!notice) {
    res.status(404).json({ ok: false, error: 'not found' });
    return;
  }
  res.json({ ok: true, notice });
});

/** 删除公告 / 更新 */
app.delete('/api/notices/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ ok: false, error: 'invalid id' });
    return;
  }
  if (!deleteNotice(db, id)) {
    res.status(404).json({ ok: false, error: 'not found' });
    return;
  }
  res.json({ ok: true });
});

/** 反馈列表 */
app.get('/api/feedbacks', requireAdmin, (req, res) => {
  const statusRaw = req.query.status;
  const status =
    statusRaw === 'new' || statusRaw === 'reviewing' || statusRaw === 'done'
      ? (statusRaw as FeedbackStatus)
      : undefined;
  const limitRaw = Number(req.query.limit);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  res.json({ ok: true, feedbacks: listFeedbacks(db, { status, limit }) });
});

/** 更新反馈状态（new / reviewing / done） */
app.patch('/api/feedbacks/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ ok: false, error: 'invalid id' });
    return;
  }
  const status = req.body?.status;
  if (status !== 'new' && status !== 'reviewing' && status !== 'done') {
    res.status(400).json({ ok: false, error: 'status must be new, reviewing or done' });
    return;
  }
  const feedback = updateFeedbackStatus(db, id, status);
  if (!feedback) {
    res.status(404).json({ ok: false, error: 'not found' });
    return;
  }
  res.json({ ok: true, feedback });
});

/** 删除反馈 */
app.delete('/api/feedbacks/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ ok: false, error: 'invalid id' });
    return;
  }
  if (!deleteFeedback(db, id)) {
    res.status(404).json({ ok: false, error: 'not found' });
    return;
  }
  res.json({ ok: true });
});

/** 读取配置 */
app.get('/api/settings', requireAdmin, (_req, res) => {
  res.json({ ok: true, settings: getAllSettings(db) });
});

/** 写入配置 */
app.put('/api/settings', requireAdmin, (req, res) => {
  const body = req.body?.settings;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ ok: false, error: 'settings must be an object' });
    return;
  }
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    setSetting(db, key, value);
  }
  res.json({ ok: true, settings: getAllSettings(db) });
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

// 端口被占用时给一句人话,而不是 Node 的 EADDRINUSE 堆栈
const server = app.listen(PORT, () => {
  console.log(`[salary-timer-api] listening on :${PORT} · db=${DB_PATH}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      [
        '',
        `  ✗ 端口 ${PORT} 已被占用,后端启动失败。`,
        '',
        '    处理办法（任选其一）：',
        `      1. 换个端口:  $env:PORT=8801; npm run dev`,
        `      2. 杀掉占用进程:`,
        `         Get-NetTCPConnection -LocalPort ${PORT} -State Listen |`,
        `           ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`,
        '',
        '    提示：本机 8787 常被 Cursor 的 cursorfree.exe 占用，',
        '          所以本地开发默认端口是 8800。',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
  throw err;
});

// ── 辅助 ───────────────────────────────────────────────────

type NoticeBody = {
  type?: NoticeType;
  title?: string;
  body?: string;
  version?: string | null;
  published?: boolean;
};

type ParsedNotice =
  | { type: NoticeType; title: string; body: string; version?: string | null; published?: boolean }
  | { error: string };

/** 解析并校验公告请求体；partial=true 时允许只传部分字段（PATCH） */
function parseNoticeInput(raw: unknown, partial = false): ParsedNotice {
  const input = (raw ?? {}) as NoticeBody;

  if (input.type !== undefined && input.type !== 'announcement' && input.type !== 'update') {
    return { error: 'type must be announcement or update' };
  }
  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string' || !input.title.trim()) {
      return { error: 'title is required' };
    }
  }
  if (!partial || input.body !== undefined) {
    if (typeof input.body !== 'string') {
      return { error: 'body must be a string' };
    }
  }
  if (input.version !== undefined && input.version !== null && typeof input.version !== 'string') {
    return { error: 'version must be a string' };
  }
  if (input.published !== undefined && typeof input.published !== 'boolean') {
    return { error: 'published must be a boolean' };
  }

  return {
    type: input.type ?? 'announcement',
    title: (input.title ?? '').trim(),
    body: input.body ?? '',
    version: input.version ?? null,
    published: input.published ?? false,
  };
}
