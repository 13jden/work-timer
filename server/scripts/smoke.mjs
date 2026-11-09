/**
 * 后端 API 冒烟测试（手工脚本，不进 vitest）
 * 用法：node scripts/smoke.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://localhost:8799';

let failed = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' · ' + extra : ''}`);
  if (!ok) failed += 1;
}

async function post(path, body) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function get(path, token) {
  const res = await fetch(base + path, { headers: token ? { 'x-admin-token': token } : {} });
  return { status: res.status, data: await res.json() };
}

// 1. ping：首个用户 = 新用户
const p1 = await post('/api/ping', { userId: 'u-smoke-1' });
check('ping 新用户', p1.status === 200 && p1.data.ok && p1.data.isNewUser === true, JSON.stringify(p1.data));

// 2. ping：同一用户同一天 = 非新用户
const p2 = await post('/api/ping', { userId: 'u-smoke-1' });
check('ping 重复非新用户', p2.status === 200 && p2.data.isNewUser === false, JSON.stringify(p2.data));

// 3. ping：第二个用户 = 新用户
const p3 = await post('/api/ping', { userId: 'u-smoke-2' });
check('ping 第二个新用户', p3.status === 200 && p3.data.isNewUser === true, JSON.stringify(p3.data));

// 4. ping：缺 userId → 400
const p4 = await post('/api/ping', {});
check('ping 缺 userId 报错', p4.status === 400, `status=${p4.status}`);

// 5. stats 未授权 → 401
const s0 = await get('/api/stats');
check('stats 未授权 401', s0.status === 401, `status=${s0.status}`);

// 6. 错误密码 → 401
const l0 = await post('/api/auth/login', { username: 'admin', password: 'wrong' });
check('错误密码 401', l0.status === 401, `status=${l0.status}`);

// 7. 正确登录 → token
const l1 = await post('/api/auth/login', { username: 'admin', password: '2018Skskwain' });
check('登录拿到 token', l1.status === 200 && !!l1.data.token, JSON.stringify(l1.data));

// 8. 带 token 取统计
const s1 = await get('/api/stats', l1.data.token);
check(
  'stats 正常返回',
  s1.status === 200 && s1.data.totalUsers >= 2 && s1.data.todayActive >= 2,
  `total=${s1.data.totalUsers} dau=${s1.data.todayActive} new=${s1.data.todayNewUsers}`,
);

// 9. 7 天序列长度
check('近 7 天序列', Array.isArray(s1.data.last7Days) && s1.data.last7Days.length === 7);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
