// Usage: node tools/qa/shot.mjs <url> <out.png> [waitMs] [w] [h]
import { chromium } from 'playwright';
const [url, out, wait = '2500', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(logs.filter((l) => !l.includes('[vite]')).slice(0, 30).join('\n'));
const gpu = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const e = c?.getExtension('WEBGL_debug_renderer_info');
  return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a';
});
console.log('GPU:', gpu);
await browser.close();
