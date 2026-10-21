// node tools/qa/ogimage.mjs [url] — renders the title screen without buttons to public/og-image.png (1200x630).
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(7000);
await page.addStyleTag({ content: '.btn, button, .toast, .hud-fps { display: none !important; }' });
await page.waitForTimeout(500);
await page.screenshot({ path: 'public/og-image.png' });
await browser.close();
