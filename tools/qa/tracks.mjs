// Autoplay every track at 4x, check full completion, collect shots & stats.
import { chromium } from 'playwright';
const out = process.argv[2];
const tracks = (process.argv[3] ?? 't1,t2,t3,t4,t5,t6,t7,t8').split(',');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const t of tracks) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text().slice(0, 200)); if (m.text().startsWith('RESULT')) errs.push(m.text()); });
  await page.goto(`http://localhost:5173/dev/race.html?track=${t}&autoplay=1&ts=4`);
  let shots = 0;
  const t0 = Date.now();
  let st;
  while (Date.now() - t0 < 150000) {
    await page.waitForTimeout(5000);
    st = await page.evaluate(() => { const s = window.session; const p = s.player; return { phase: s.phase, lap: p.lap, pos: p.position, raceMs: Math.round(s.raceMs), falls: s.falls, ais: s.racers.map((r) => r.lap + ':' + Math.round(r.body.progressS)).join(' '), fps: window.__fps }; });
    if (shots < 2 && st.raceMs > 15000 * (shots + 1)) { await page.screenshot({ path: `${out}/${t}_${shots}.png` }); shots++; }
    if (st.phase === 'done' || st.phase === 'finish') break;
  }
  console.log(t, JSON.stringify(st));
  if (errs.length) console.log('  ', errs.slice(0, 6).join('\n   '));
  await page.close();
}
await browser.close();
