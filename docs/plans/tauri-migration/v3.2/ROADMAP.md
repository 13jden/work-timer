# v3.2 「后端 + 打赏」· 路线图

> **基线**：v3.1（`main` @ 23cf011，v3.1 全部 TASK 完成）。
> **分支**：`feat/v3.2-backend`
> **范围**：新增一个轻量后端（Node + SQLite）做日活/用户统计 + 管理后台；MINE 页加「打赏作者」入口。
> **不做**：账号体系、云同步、支付网关、任何用户数据上报（只上报匿名设备 ID）。

---

## 版本主题

v3.1 把「一程」和 MINE 页做完，功能面收口了。这次补的是**项目之外的东西**：

```
后端   —— 一个 SQLite 文件 + 一个 Express 进程 + 一个 /admin 页面
打赏   —— MINE 页底部一行入口，点开是收据式打赏弹层
```

一条取舍依据：**只统计数量，不收集内容**。用户端只上报一个本地生成的匿名 ID，
服务端只关心「今天有多少设备打开过」和「有多少设备是第一次出现」，
不存任何账号、金额、备注、个人信息。

---

## TASK 索引

| TASK ID | 标题 | 状态 | 文档 |
|---|---|---|---|
| TASK-067 | 后端服务 + 日活统计 + 管理后台 | 🧩 实现中，待验收 | [`TASK-067-v3.2-backend.md`](./TASK-067-v3.2-backend.md) |
| TASK-068 | MINE 页打赏入口 + 打赏弹层 | 🧩 实现中，待验收 | [`TASK-068-v3.2-donate.md`](./TASK-068-v3.2-donate.md) |

---

## 架构

```
浏览器 / APK
   │  POST /api/ping  { userId }        ← 每天一次，成功后本地打标
   ▼
Caddy（persecond.work）
   ├── /api/*   ──► api 容器 :8787
   ├── /admin*  ──► api 容器 :8787（自带登录页）
   └── /*       ──► 静态站点（现有）
                    ▼
              Node 22 + Express
                    ▼
              SQLite（/data/salary-timer.db，docker volume 持久化）
```

### 数据表

| 表 | 字段 | 用途 |
|---|---|---|
| `users` | `id`(匿名设备ID, PK) / `first_seen_at` / `first_day` / `last_seen_at` | 总用户数、新用户数 |
| `daily_active` | `day` + `user_id` 联合主键 | 日活（同一设备同一天只计一次） |

### API

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/api/ping` | 无 | 上报活跃。body `{ userId }`，返回 `{ ok, isNewUser }` |
| GET | `/api/stats` | `x-admin-token` | 总用户 / 今日活跃 / 今日新增 / 近 7 天序列 |
| POST | `/api/auth/login` | 无 | body `{ username, password }`，返回 HMAC 签名 token（12h 有效） |
| GET | `/health` | 无 | 存活探针 |

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | 后台账号 |
| `ADMIN_PASSWORD` | `2018Skskwain` | 后台密码 |
| `SESSION_SECRET` | — | token 签名密钥，生产必须改 |
| `DB_PATH` | `/data/salary-timer.db` | SQLite 路径 |
| `PORT` | `8787` | 监听端口 |

---

## 验收清单

- [ ] 打开 App → 服务端 `users` 表新增一行，`daily_active` 当天新增一行
- [ ] 同一天重复打开 → `daily_active` 不新增
- [ ] 换浏览器 / 清 localStorage → `users` 新增一行（算新用户）
- [ ] `https://<域名>/admin` → 用 admin/2018Skskwain 登录 → 看到三个数字 + 7 天表格
- [ ] 错误密码 → 报「账号或密码不正确」
- [ ] MINE 页底部 → 「打赏作者」→ 弹层能选小红花/咖啡、微信/支付宝
- [ ] 收款码图片缺失时显示占位提示，不报错
