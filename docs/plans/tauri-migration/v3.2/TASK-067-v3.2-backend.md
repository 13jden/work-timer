# TASK-067 · v3.2 后端服务 + 日活统计 + 管理后台

> **状态**：🧩 实现中，待验收
> **分支**：`feat/v3.2-backend`
> **范围**：`server/` 目录 + `docker-compose.yml` / `Caddyfile` / `vite.config.ts` 改动 + `src/lib/track.ts` / `src/hooks/useDailyPing.ts`

---

## 目标

给项目加一个**能跑起来、能看数据**的最小后端：

1. 客户端每日打开时上报一次，服务端按天去重 → 日活统计
2. 统计总用户数、新用户数
3. 一个简单的数据展示页，账号密码写死（admin / 2018Skskwain），配 `.env`

---

## 实现

### 1. `server/`（Node 22 + Express 4 + better-sqlite3）

```
server/
├── package.json
├── tsconfig.json
├── Dockerfile            # 多阶段构建，alpine 装编译工具链
├── .dockerignore
├── .env.example          # 环境变量模板
├── .env                  # 本地实际值（gitignore）
├── scripts/smoke.mjs     # 冒烟测试脚本
├── public/admin/index.html   # 管理后台（纯静态页，自带登录表单）
└── src/
    ├── index.ts          # Express 路由 + CORS + 静态托管
    ├── db.ts             # 建表 / recordPing / queryStats
    └── auth.ts           # 登录校验 + HMAC token 签发/校验
```

**建表**（`db.ts`）

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,   -- 匿名设备 ID
  first_seen_at INTEGER NOT NULL,
  first_day     TEXT NOT NULL,      -- YYYY-MM-DD，新用户判定
  last_seen_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_active (
  day     TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (day, user_id)        -- 同一天同一设备只计一次
);
```

**去重逻辑**：`daily_active` 的联合主键承担「每日一次」的判定，客户端重复上报不会重复计数。

### 2. API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/ping` | body `{ userId }`；`userId` 缺失或超 64 字符 → 400。返回 `{ ok, isNewUser }` |
| GET | `/api/stats` | 需要 `x-admin-token` 头（或 `?token=`）。返回 `{ ok, totalUsers, todayActive, todayNewUsers, last7Days[] }` |
| POST | `/api/auth/login` | body `{ username, password }`。成功返回 `{ ok, token }`，失败 401 + `{ ok:false, error:'账号或密码不正确' }` |
| GET | `/health` | 存活探针 |

Token 格式 `base64url(username).expiresAt.hmac`，`SESSION_TTL_MS` 默认 12 小时。
账号密码比较用 `timingSafeEqual`，避免时序侧信道。

### 3. 管理后台 `/admin`

纯静态 HTML（`server/public/admin/index.html`），不依赖前端构建产物：

- 登录表单 → 拿 token 存 sessionStorage → 拉 `/api/stats`
- 三个数字卡：总用户 / 今日活跃 / 今日新增
- 近 7 天表格：日期、活跃、新增、活跃占比横条
- 样式复用项目 design token（paper 底 + 柠檬黄 accent + Cormorant Garamond 标题 + JetBrains Mono 数字）

### 4. 部署接线

**`docker-compose.yml`** 新增 `api` 服务：

```yaml
api:
  build: { context: ./server }
  environment:
    ADMIN_USERNAME: "${ADMIN_USERNAME:-admin}"
    ADMIN_PASSWORD: "${ADMIN_PASSWORD:-2018Skskwain}"
    SESSION_SECRET: "${SESSION_SECRET:-salary-timer-dev-secret}"
  volumes: [api_data:/data]     # SQLite 持久化
  expose: ["8787"]
```

**`Caddyfile`** 新增反代：

```caddyfile
handle /api/*  { reverse_proxy api:8787 }
handle /admin* { reverse_proxy api:8787 }
handle /health { reverse_proxy api:8787 }
```

**`vite.config.ts`** 新增 dev 代理（本地开发时前端也能打到本地后端）：

```ts
proxy: {
  '/api':   { target: 'http://localhost:8787', changeOrigin: true },
  '/admin': { target: 'http://localhost:8787', changeOrigin: true },
}
```

### 5. 客户端上报

**`src/lib/track.ts`**

- `getAnonId()`：首次生成 `u-<base36时间戳>-<随机>`，存 localStorage `st_anon_id`
- `pingDailyActivity()`：比对 localStorage `st_last_ping_day` 与今天；不同才发请求，成功后写入当天日期
- 失败静默返回 false，不抛错、不阻塞主流程

**`src/hooks/useDailyPing.ts`** → `useEffect` 里调一次。

**`src/App.tsx`** → 根组件调 `useDailyPing()`（桌面端 / 移动端两个分支都覆盖，因为 Hook 在组件顶层）。

### 6. `.env`

根目录 `.env`（gitignore）+ `.env.example` 补 `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `SESSION_SECRET`。
`server/.env` 是后端本地开发用的那份。

---

## 验证

**类型检查 + 构建**：`npm run typecheck`、`npm run build`（前端）· `npm run build`（后端）——全通过。

**单测**：前端 `npm run test` → 18 文件 / 470 用例全通过。

**API 冒烟**（`server/scripts/smoke.mjs`）：

```
PASS  ping 新用户 · {"ok":true,"isNewUser":true}
PASS  ping 重复非新用户 · {"ok":true,"isNewUser":false}
PASS  ping 第二个新用户 · {"ok":true,"isNewUser":true}
PASS  ping 缺 userId 报错 · status=400
PASS  stats 未授权 401 · status=401
PASS  错误密码 401 · status=401
PASS  登录拿到 token · {"ok":true,"token":"..."}
PASS  stats 正常返回 · total=2 dau=2 new=2
PASS  近 7 天序列

ALL PASS
```

**后台页面**：`GET /admin/` → 200，标题 `Salary Timer · 数据后台`。

---

## 待用户验收

- [ ] 浏览器打开站点 → 抓包看到 `POST /api/ping` 成功
- [ ] 打开 `/admin` 用 admin/2018Skskwain 登录 → 数字正确
- [ ] 部署到服务器后 `/admin` 与 `/api` 都能访问

---

## 遗留 / 后续

- 收款码还没放 `public/donate/`（属于 TASK-068）
- `SESSION_SECRET` 生产环境要改随机值
- 后台目前没有「按天删除明细」或图表趋势，够用即可
