import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://127.0.0.1:5193',
  out = process.argv[3] ?? 'test-results/item-trick';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/dev/race.html?track=t8&mode=practice&autoplay=1&q=high`);
  await page.waitForFunction(() => window.session?.player.ai);
  const result = await page.evaluate(() => {
    const s = window.session,
      r = s.player,
      b = r.body,
      w = s.world,
      p = w.main;
    s.paused = true;
    const idle = { steer: 0, throttle: 0, brake: 0, drift: false, driftPress: false };
    b.place(w, w.pads[0].s, 0);
    r.items = ['sugar3'];
    s.items.prepareHeld(r);
    s.items.useItem(r);
    const single = b.itemBoostT;
    s.items.useItem(r);
    s.items.useItem(r);
    const triple = b.itemBoostT;
    b.freezeT = 1;
    for (let n = 0; n < 60; n++) b.step(1 / 120, idle, w);
    const frozen = b.itemBoostT;
    b.freezeT = 0;
    for (let n = 0; n < 120; n++) b.step(1 / 120, idle, w);
    const afterSecond = b.itemBoostT;
    b.place(w, p.length * 0.875, 0);
    b.boostT = b.itemBoostT = 0;
    b.speed = 30;
    let max = 0,
      started = false,
      landed = false,
      mid = null;
    for (let n = 0; n < 1200; n++) {
      const c = r.ai.update(1 / 120, b, {
        world: w,
        dangers: [],
        boxes: [],
        playerDist: 0,
        myDist: 0,
        hasItem: true,
        wantsBoost: false,
        time: n / 120,
      });
      if (b.trickReady && b.airT > 0.15 && !b.tricked) c.driftPress = true;
      b.step(1 / 120, c, w);
      max = Math.max(max, b.trickAngle);
      started ||= b.tricked;
      if (!mid && b.trickAngle > Math.PI)
        mid = Object.fromEntries(
          [
            'x',
            'y',
            'z',
            'yaw',
            'px',
            'py',
            'pz',
            'pyaw',
            'grounded',
            'trickAngle',
            'prevTrickAngle',
            'vy',
          ].map((k) => [k, b[k]]),
        );
      if (started && b.grounded) {
        landed = true;
        break;
      }
    }
    const contactError = Math.abs(b.y - b.proj.y);
    if (mid) Object.assign(b, mid);
    s.player.model.update(1 / 60, b, 1, s.time, null, { steer: 0, throttle: 1 });
    s.scene.updateMatrixWorld(true);
    s.wheels.update();
    s.camera.up.set(0, 1, 0);
    s.camera.position.set(b.x - Math.sin(b.yaw) * 12, b.y + 4, b.z - Math.cos(b.yaw) * 12);
    s.camera.lookAt(b.x, b.y + 1, b.z);
    return {
      single,
      triple,
      frozen,
      afterSecond,
      itemsRemaining: r.items.length,
      started,
      landed,
      rotation: max,
      contactError,
      loops: p.loops.length,
    };
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/air-360.png` });
  console.log(JSON.stringify({ ...result, errors }));
  await writeFile(`${out}/results.json`, JSON.stringify({ ...result, errors }, null, 2));
  if (
    result.single !== 2 ||
    result.triple !== 6 ||
    result.frozen !== 6 ||
    Math.abs(result.afterSecond - 5) > 0.001 ||
    result.itemsRemaining ||
    !result.landed ||
    Math.abs(result.rotation - Math.PI * 2) > 0.001 ||
    result.contactError > 0.025 ||
    result.loops ||
    errors.length
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
