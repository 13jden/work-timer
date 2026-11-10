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

async function post(path, body, token) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-admin-token': token } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function get(path, token) {
  const res = await fetch(base + path, { headers: token ? { 'x-admin-token': token } : {} });
  return { status: res.status, data: await res.json() };
}

// 用户 id 加时间戳后缀 —— 脚本可重复运行（否则第二次跑就不是「新用户」了）
const RUN = Date.now().toString(36);
const U1 = `u-smoke-1-${RUN}`;
const U2 = `u-smoke-2-${RUN}`;

// 1. ping：首个用户 = 新用户
const p1 = await post('/api/ping', { userId: U1 });
check('ping 新用户', p1.status === 200 && p1.data.ok && p1.data.isNewUser === true, JSON.stringify(p1.data));

// 2. ping：同一用户同一天 = 非新用户
const p2 = await post('/api/ping', { userId: U1 });
check('ping 重复非新用户', p2.status === 200 && p2.data.isNewUser === false, JSON.stringify(p2.data));

// 3. ping：第二个用户 = 新用户
const p3 = await post('/api/ping', { userId: U2 });
check('ping 第二个新用户', p3.status === 200 && p3.data.isNewUser === true, JSON.stringify(p3.data));

// 3b. ping 带 platform=app → 归类为 app 用户
const APP = `u-smoke-app-${RUN}`;
const pa = await post('/api/ping', { userId: APP, platform: 'app' });
check('ping 带 platform=app', pa.status === 200 && pa.data.isNewUser === true, JSON.stringify(pa.data));

// 3c. 非法 platform 降级为 web（不报错）
const PW = `u-smoke-bad-${RUN}`;
const pw = await post('/api/ping', { userId: PW, platform: 'hacker' });
check('非法 platform 降级', pw.status === 200 && pw.data.ok === true, JSON.stringify(pw.data));

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

// 9b. stats 里 app / web 用户数分开
check(
  'stats 含 app/web 拆分',
  typeof s1.data.appUsers === 'number'
    && typeof s1.data.webUsers === 'number'
    && s1.data.appUsers >= 1
    && s1.data.appUsers + s1.data.webUsers === s1.data.totalUsers,
  `app=${s1.data.appUsers} web=${s1.data.webUsers} total=${s1.data.totalUsers}`,
);

// ── 公告 / 更新 ──────────────────────────────────────────
const token = l1.data.token;

// 10. 新建公告（草稿）
const n1 = await post('/api/notices', { type: 'announcement', title: '测试公告', body: '内容' }, token);
check('新建公告', n1.status === 201 && n1.data.notice?.id > 0, JSON.stringify(n1.data));
const annId = n1.data.notice.id;

// 11. 草稿不对客户端可见
const c0 = await get('/api/notice');
check(
  '草稿对客户端不可见',
  c0.status === 200 && !(c0.data.notices || []).some((n) => n.id === annId),
  JSON.stringify(c0.data),
);

// 12. 发布后客户端可见
await fetch(base + '/api/notices/' + annId, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', 'x-admin-token': token },
  body: JSON.stringify({ published: true }),
});
const c1 = await get('/api/notice');
check('发布后客户端可见', (c1.data.notices || []).some((n) => n.id === annId));

// 13. 已读过滤：带上 seen 就不返回
const c2 = await get('/api/notice?seen=' + annId);
check('已读过滤', !(c2.data.notices || []).some((n) => n.id === annId));

// 13b. force=true 时忽略 seen（手动「检查更新」要能再看一遍）
const c2b = await get('/api/notice?seen=' + annId + '&force=true');
check(
  'force 忽略已读过滤',
  (c2b.data.notices || []).some((n) => n.id === annId),
  JSON.stringify(c2b.data),
);

// 14. 新建更新（目标版本 9.9.9）
const n2 = await post('/api/notices', {
  type: 'update', title: '测试更新', body: '更新内容', version: '9.9.9', published: true,
}, token);
check('新建更新', n2.status === 201, JSON.stringify(n2.data));
const updId = n2.data.notice.id;

// 15. App 端版本低于目标 → 返回更新
const c3 = await get('/api/notice?currentVersion=3.1.0');
check('App 低版本收到更新', (c3.data.notices || []).some((n) => n.id === updId));

// 16. App 端版本已达标 → 不返回更新
const c4 = await get('/api/notice?currentVersion=9.9.9');
check('App 已是最新不提示', !(c4.data.notices || []).some((n) => n.id === updId));

// 17. Web 端（不带版本）→ 更新等同公告，可见
const c5 = await get('/api/notice');
check('Web 端更新可见', (c5.data.notices || []).some((n) => n.id === updId));

// 18. 配置读写
const cfg = await fetch(base + '/api/settings', {
  method: 'PUT',
  headers: { 'content-type': 'application/json', 'x-admin-token': token },
  body: JSON.stringify({ settings: { currentVersion: '3.2.0' } }),
});
const cfgData = await cfg.json();
check('写入配置', cfg.status === 200 && cfgData.settings?.currentVersion === '3.2.0');

// 18b. 写入「使用指南链接」
const cfg2 = await fetch(base + '/api/settings', {
  method: 'PUT',
  headers: { 'content-type': 'application/json', 'x-admin-token': token },
  body: JSON.stringify({ settings: { userGuideUrl: 'https://example.com/guide' } }),
});
const cfg2Data = await cfg2.json();
check(
  '写入使用指南链接',
  cfg2.status === 200 && cfg2Data.settings?.userGuideUrl === 'https://example.com/guide',
  JSON.stringify(cfg2Data.settings),
);

// 18c. 公开配置：无需鉴权即可拿到 userGuideUrl
const pub = await get('/api/config');
check(
  '公开配置可读',
  pub.status === 200 && pub.data.config?.userGuideUrl === 'https://example.com/guide',
  JSON.stringify(pub.data),
);

// 18d. 公开配置不泄漏内部配置（如 defaultNotice 不在白名单里）
check(
  '公开配置不泄漏内部项',
  pub.data.config?.defaultNotice === undefined,
  JSON.stringify(pub.data.config),
);

// 19. 删除公告
const del = await fetch(base + '/api/notices/' + annId, {
  method: 'DELETE', headers: { 'x-admin-token': token },
});
check('删除公告', del.status === 200);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
