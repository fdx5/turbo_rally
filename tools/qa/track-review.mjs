// Visual and runtime regression checks against the same track geometry as the game.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3] ?? 'test-results/track-review';
const tracks = (process.argv[4] ?? 't1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16').split(',');
const drive = process.argv.includes('--drive');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const track of tracks) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/dev/race.html?track=${track}&autoplay=1&ts=8&laps=1&q=medium`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.session, undefined, { timeout: 60000 });
    await page.waitForTimeout(500);
    // Fixed camera and pose make before/after shots comparable.
    await page.evaluate(() => {
      const s = window.session;
      s.paused = true;
      const p = s.world.main;
      const i = p.idxAtS(p.length * 0.22);
      s.player.body.place(s.world, i * p.ds, 0);
      s.debugCam = {
        pos: s.camera.position.clone().set(p.px[i] - p.fx[i] * 16, p.py[i] + 9, p.pz[i] - p.fz[i] * 16),
        look: s.camera.position.clone().set(p.px[i] + p.fx[i] * 22, p.py[i] + 1, p.pz[i] + p.fz[i] * 22),
      };
      s.camera.position.copy(s.debugCam.pos);
      s.camera.lookAt(s.debugCam.look);
      s.player.model.update(0, s.player.body, 1, s.time, null, { steer: 0, throttle: 0 });
      s.scene.updateMatrixWorld(true);
      s.wheels.update();
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/${track}.png` });
    const result = await page.evaluate(async () => {
      const s = window.session;
      const ground = s.world.group.getObjectByName('ground');
      let terrainIntrusions = 0;
      let worstClearance = Infinity;
      if (ground) {
        const g = ground.geometry;
        const pos = g.attributes.position;
        const res = g.parameters.widthSegments;
        const spacing = pos.getX(1) - pos.getX(0);
        const heightAt = (x, z) => {
          const col = Math.floor((x - pos.getX(0)) / spacing);
          const row = Math.floor((z - pos.getZ(0)) / spacing);
          const start = (row * res + col) * 6;
          for (let j = 0; j < 6; j += 3) {
            const a = g.index.getX(start + j), b = g.index.getX(start + j + 1), c = g.index.getX(start + j + 2);
            const ax = pos.getX(a), az = pos.getZ(a);
            const bx = pos.getX(b) - ax, bz = pos.getZ(b) - az;
            const cx = pos.getX(c) - ax, cz = pos.getZ(c) - az;
            const det = bx * cz - bz * cx;
            const u = ((x - ax) * cz - (z - az) * cx) / det;
            const v = (bx * (z - az) - bz * (x - ax)) / det;
            if (u >= -0.001 && v >= -0.001 && u + v <= 1.001) return pos.getY(a) + u * (pos.getY(b) - pos.getY(a)) + v * (pos.getY(c) - pos.getY(a));
          }
          throw new Error('Terrain sample outside mesh');
        };
        const p = s.world.main;
        for (let i = 0; i < p.n; i += 4) {
          if (p.gap[i]) continue;
          for (const side of [-0.95, 0, 0.95]) {
            const v = p.pointAt(i * p.ds, p.halfW[i] * side, s.camera.position.clone());
            {
              const clearance = v.y - heightAt(v.x, v.z);
              worstClearance = Math.min(worstClearance, clearance);
              if (clearance < 0.02) terrainIntrusions++;
            }
          }
        }
      }
      s.debugCam = null;
      return { terrainIntrusions, worstClearance: Number.isFinite(worstClearance) ? worstClearance : null };
    });
    if (drive) {
      await page.evaluate(() => {
        const s = window.session, main = s.world.main;
        for (const r of s.racers) {
          const gi = r.slot, row = Math.floor(gi / 2);
          r.body.place(s.world, main.length - 9 - row * 7.5 - (gi % 2) * 3.5,
            (gi % 2 === 0 ? -1 : 1) * Math.min(4.2, main.halfW[0] - 2.5));
          r.prevS = r.body.progressS;
          r.raceDist = r.prevS;
          r.started = true;
        }
        s.debugCam = null;
        s.chase.mode = 'chase';
        s.chase.snap(s.player.body);
        s.phase = 'countdown';
        s.phaseT = 2.9;
        s.paused = false;
      });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${out}/${track}-driving.png` });
      try {
        await page.waitForFunction(() => ['finish', 'done'].includes(window.session.phase), undefined, { timeout: 60000 });
      } catch (error) {
        console.log('DRIVE_STATE',JSON.stringify(await page.evaluate(() => {
          const s=window.session,b=s.player.body;
          return {track:s.cfg.trackId,phase:s.phase,time:s.raceMs,lap:s.player.lap,progress:b.progressS/s.world.main.length,path:b.onPath,t:b.proj.t,speed:b.speed,position:[b.x,b.y,b.z],falls:s.falls};
        })));
        await page.screenshot({path:`${out}/${track}-timeout.png`});
        throw error;
      }
      Object.assign(result, await page.evaluate(() => {
        const s = window.session;
        return { phase: s.phase, lap: s.player.lap, raceMs: Math.round(s.raceMs), falls: s.falls, fps: window.__fps };
      }));
    }
    results.push({ track, ...result, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some(r => r.errors.length || r.terrainIntrusions)) process.exitCode = 1;
