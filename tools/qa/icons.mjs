import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [size, name, pad] of [[192, 'icon-192.png', 0], [512, 'icon-512.png', 0], [512, 'icon-maskable-512.png', 60], [180, 'apple-touch-icon.png', 0]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:#ffc8dd"><div style="padding:${pad}px;box-sizing:border-box;width:${size}px;height:${size}px">${svg.replace('<svg', `<svg width="${size - pad * 2}" height="${size - pad * 2}"`)}</div></body></html>`);
  await page.screenshot({ path: `public/${name}`, omitBackground: false });
  await page.close();
}
await browser.close();
console.log('icons ok');
