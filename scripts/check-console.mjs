/**
 * 后端不可用时的浏览器控制台检查（v3.2）
 * 用法：node scripts/check-console.mjs [baseUrl]
 *
 * 断言：后端没启动时，页面**不应该**出现任何 console error / pageerror。
 */
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:5176';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('requestfailed', (req) => {
  errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`);
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// 触发一次上报（后端不通时不应该炸）
await page.evaluate(() => localStorage.removeItem('st_last_ping_day'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await browser.close();

if (errors.length === 0) {
  console.log('PASS  后端不可用时控制台无任何报错');
  process.exit(0);
}
console.log(`FAIL  发现 ${errors.length} 条报错:`);
for (const e of errors) console.log('  - ' + e);
process.exit(1);
