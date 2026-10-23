import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5193',
  out = 'test-results/course-races';
await mkdir(out, { recursive: true });
const tracks = (process.argv[3] ?? Array.from({ length: 16 }, (_, i) => `t${i + 1}`).join(',')).split(',');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const results = [];
try {
  for (const track of tracks) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/dev/race.html?track=${track}&autoplay=1&q=medium`);
    await page.waitForFunction(() => window.session && window.session.player.ai, undefined, {
      timeout: 60000,
    });
    await page.evaluate(() => {
      const s = window.session;
      s.paused = true;
      s.phase = 'countdown';
      s.phaseT = 2.99;
      s.qaRender = s.render.bind(s);
      s.render = () => {};
      s.qaRoutes = s.racers.map(() => new Set());
      s.updateAudio = () => {};
    });
    for (let batch = 0; batch < 40; batch++) {
      const st = await page.evaluate(() => {
        const s = window.session;
        s.paused = false;
        for (let i = 0; i < 120 && !['done'].includes(s.phase); i++) {
          s.frame(0.25);
          s.racers.forEach((r, j) => {
            if (r.body.onPath > 0) s.qaRoutes[j].add(r.body.onPath);
          });
        }
        s.paused = true;
        return { phase: s.phase, time: s.raceMs, finished: s.player.finished, lap: s.player.lap };
      });
      if (st.phase === 'done' || st.finished) break;
    }
    const result = await page.evaluate(() => {
      const s = window.session;
      s.qaRender(0);
      return {
        track: s.cfg.trackId,
        laps: s.cfg.laps,
        phase: s.phase,
        finished: s.player.finished,
        lapTimes: s.player.lapTimes.map(Math.round),
        total: Math.round(s.player.finishMs),
        falls: s.falls,
        racers: s.racers.map((r, i) => ({
          slot: r.slot,
          lap: r.lap,
          finished: r.finished,
          paths: [...s.qaRoutes[i]],
          s: Math.round(r.body.progressS),
        })),
      };
    });
    await page.screenshot({ path: `${out}/${track}-finish.png` });
    results.push({ ...result, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some((r) => !r.finished || r.lapTimes.length !== r.laps || r.errors.length)) process.exitCode = 1;
