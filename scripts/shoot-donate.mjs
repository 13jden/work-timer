/**
 * 打赏弹层视觉自检（playwright 截图）
 * 用法：node scripts/shoot-donate.mjs [baseUrl]
 *
 * 走桌面端布局（≥1024px）→ 侧栏「我的」→ MINE 页 → 打赏作者。
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'design-preview';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const URL = process.argv[2] ?? 'http://localhost:5176';
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 侧栏「我的」
const mine = page.getByText('我的', { exact: true }).first();
await mine.waitFor({ timeout: 8000 });
await mine.click();
await page.waitForTimeout(700);

// 「打赏作者」入口
const donate = page.getByText('打赏作者', { exact: true }).first();
await donate.waitFor({ timeout: 8000 });
await donate.click();
await page.waitForTimeout(700);

await page.screenshot({ path: `${OUT}/v32-donate-sheet.png` });
console.log('saved', `${OUT}/v32-donate-sheet.png`);

await browser.close();
