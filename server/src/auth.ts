/**
 * Salary Timer 后端 — 管理后台鉴权
 *
 * 账号密码来自环境变量（.env），默认 admin / 2018Skskwain。
 * 登录成功后签发一个 HMAC 签名 token（含过期时间），前端存 sessionStorage。
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AdminConfig {
  username: string;
  password: string;
  secret: string;
  tokenTtlMs: number;
}

export function loadAdminConfig(): AdminConfig {
  return {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? '2018Skskwain',
    secret: process.env.SESSION_SECRET ?? 'salary-timer-dev-secret',
    tokenTtlMs: Number(process.env.SESSION_TTL_MS ?? 12 * 60 * 60 * 1000),
  };
}

/** 校验登录；成功返回 token，失败返回 null */
export function login(config: AdminConfig, username: string, password: string): string | null {
  if (!safeEqual(username, config.username)) return null;
  if (!safeEqual(password, config.password)) return null;
  return signToken(config, config.username);
}

/** 校验 token 是否有效且未过期 */
export function verifyToken(config: AdminConfig, token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [payload, exp, sig] = parts as [string, string, string];
  const expected = hmac(config.secret, `${payload}.${exp}`);
  if (!safeEqual(sig, expected)) return false;
  const expMs = Number(exp);
  return Number.isFinite(expMs) && Date.now() < expMs;
}

function signToken(config: AdminConfig, username: string): string {
  const payload = Buffer.from(username).toString('base64url');
  const exp = String(Date.now() + config.tokenTtlMs);
  return `${payload}.${exp}.${hmac(config.secret, `${payload}.${exp}`)}`;
}

function hmac(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
