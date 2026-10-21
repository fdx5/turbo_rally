// Perf report: node tools/qa/perf.mjs [desktop|mobile] [tracks]
import { chromium } from 'playwright';
const profile = process.argv[2] ?? 'desktop';
const tracks = (process.argv[3] ?? 't1,t2,t3,t4,t5,t6,t7,t8').split(',');
const mobile = profile === 'mobile';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [];
for (const t of tracks) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }
    : { viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  if (mobile) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  await page.goto(`http://localhost:5173/dev/race.html?track=${t}&autoplay=1&q=${mobile ? 'auto' : 'high'}`);
  await page.waitForFunction(() => window.session && window.session.phase === 'race', null, { timeout: 120000 });
  const samples = [];
  let info = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => { const r = window.session.R; const inf = r.renderer.info.render; return { fps: window.__fps, calls: inf.calls, tris: inf.triangles, preset: r.preset, dpr: r.renderer.getPixelRatio() }; });
    samples.push(s.fps); info = s;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  rows.push({ t, avg: avg.toFixed(1), low: sorted[0], calls: info.calls, tris: Math.round(info.tris / 1000) + 'k', preset: info.preset, dpr: info.dpr.toFixed(2) });
  console.log(JSON.stringify(rows[rows.length - 1]));
  await ctx.close();
}
await browser.close();
