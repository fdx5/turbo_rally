import { chromium } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForTimeout(4000);
await page.getByText('게스트로 시작').click(); await page.waitForTimeout(1200);
await page.getByText('상점').first().click(); await page.waitForTimeout(5000);
await page.screenshot({ path: `${out}/shop_hat.png` });
for (const cat of ['윗옷', '신발', '목걸이', '선글라스']) { await page.locator('.tab', { hasText: cat }).click(); await page.waitForTimeout(4500); await page.screenshot({ path: `${out}/shop_${cat}.png` }); }
console.log(errs);
await browser.close();
