import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://127.0.0.1:5193';
const output = process.argv[3] ?? 'test-results/adventure-features';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const results = [];
try {
  for (const [track, feature] of [['t3','loop'], ['t3','inverted'], ['t4','cave'], ['t5','lava'], ['t6','glacier'], ['t7','bridge'], ['t8','fork'], ['t1','boost']]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/dev/race.html?track=${track}&q=high`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.session);
    const state = await page.evaluate(({ feature }) => {
      const s = window.session, p = s.world.main, L = p.length;
      s.paused = true;
      let progress = feature === 'boost' ? s.world.pads[1].s - 5 : feature === 'bridge' ? L * 0.28 : L * 0.15;
      if (['cave','lava','glacier'].includes(feature)) {
        const zone = s.world.def.adventures.find(z => z.kind === feature || (feature === 'cave' && z.kind === 'cave'));
        progress = ((zone.u0 + zone.u1) / 2) * L;
      }
      if (feature === 'fork') progress = s.world.def.shortcuts[0].fromU * L - 100;
      if (feature === 'loop') progress = p.loops[0].s0 - 12;
      if (feature === 'inverted') progress = (p.loops[0].s0 + p.loops[0].s1) / 2;
      const b = s.player.body;
      b.place(s.world, progress, 0);
      if (feature === 'inverted') {
        p.frameAt(progress, b.loopFrame); b.loopActive = true;
        b.x = b.px = b.loopFrame.x; b.y = b.py = b.loopFrame.y; b.z = b.pz = b.loopFrame.z;
      }
      s.player.model.update(0, b, 1, s.time, null, { steer: 0, throttle: 0 });
      const i = p.idxAtS(progress);
      const pos = s.camera.position.clone().set(b.x - p.fx[i] * 15, b.y + 7, b.z - p.fz[i] * 15);
      const look = p.pointAt(progress + 25, 0, pos.clone(), 2);
      if (feature === 'loop') {
        const loop = p.loops[0];
        const centre = p.pointAt((loop.s0 + loop.s1) / 2, 0, pos.clone());
        pos.set(centre.x - p.fx[i] * 15 + p.hx[i] * 95, centre.y - 15, centre.z - p.fz[i] * 15 + p.hz[i] * 95);
        look.copy(centre).add(pos.clone().set(0, -18, 0));
      }
      if (feature === 'bridge') {
        pos.set(b.x + p.hx[i] * 70 - p.fx[i] * 40, b.y + 32, b.z + p.hz[i] * 70 - p.fz[i] * 40);
        look.set(b.x, b.y + 5, b.z);
      }
      s.camera.up.set(0, 1, 0);
      s.camera.position.copy(pos); s.camera.lookAt(look);
      if (feature === 'inverted') {
        s.chase.mode = 'chase'; s.phase = 'race';
        s.chase.update(1 / 60, b, b.x, b.y, b.z, b.yaw, false);
      }
      s.scene.updateMatrixWorld(true); s.wheels.update();
      return { track: s.cfg.trackId, feature, height: Math.round(b.y), branches: s.world.shortcuts.length, loops: p.loops.length, boostPads: s.world.pads.length };
    }, { feature });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${output}/${track}-${feature}.png` });
    results.push({ ...state, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }

  const page = await browser.newPage();
  await page.goto(`${base}/dev/audio-review.html?qa=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.audioReview);
  const sounds = await page.evaluate(async () => {
    const { audio } = window.audioReview;
    await audio.unlock();
    return ['boost', 'pad', 'rocketStart'].map(id => {
      const buffer = audio.buffers.get(id), data = buffer.getChannelData(0);
      let peak = 0, sum = 0;
      for (const v of data) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
      return { id, rate: buffer.sampleRate, length: buffer.length, duration: buffer.duration, peak, rms: Math.sqrt(sum / data.length), samples: Array.from(data) };
    });
  });
  for (const sound of sounds) {
    const wav = Buffer.alloc(44 + sound.length * 2);
    wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sound.rate, 24); wav.writeUInt32LE(sound.rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(sound.length * 2, 40);
    sound.samples.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
    await writeFile(`${output}/${sound.id}.wav`, wav);
    delete sound.samples;
    if (!(sound.peak > 0.1 && sound.peak <= 0.701 && sound.rms > 0.01)) throw new Error(`Invalid audio render: ${sound.id}`);
  }
  console.log('Audio QA', JSON.stringify(sounds));
  await writeFile(`${output}/audio.json`, JSON.stringify(sounds, null, 2));
} finally {
  await browser.close();
  await writeFile(`${output}/features.json`, JSON.stringify(results, null, 2));
}
if (results.some(r => r.errors.length)) process.exitCode = 1;
