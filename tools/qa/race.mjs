// node tools/qa/race.mjs <url> <outPrefix> <shots> <intervalMs>
import { chromium } from 'playwright';
const [url, out, shots = '4', every = '4000', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!t.includes('[vite]') && !t.includes('X4122') && !t.includes('deprecated')) logs.push(`[${m.type()}] ${t.slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack?.split('\n').slice(0, 4).join('\n')}`));
await page.goto(url, { waitUntil: 'load' });
for (let i = 0; i < +shots; i++) {
  await page.waitForTimeout(+every);
  await page.screenshot({ path: `${out}_${i}.png` });
  const fps = await page.evaluate(() => window.__fps);
  const st = await page.evaluate(() => { const s = window.session; if (!s) return null; const p = s.player; return { phase: s.phase, lap: p.lap, pos: p.position, speed: p.body.speed.toFixed(1), s: p.body.progressS.toFixed(0), path: p.body.onPath, items: p.items.join(','), coins: p.body.coins, raceMs: Math.round(s.raceMs) }; });
  console.log(`shot ${i}: fps=${fps}`, JSON.stringify(st));
}
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
