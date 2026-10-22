import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5193',
  out = process.argv[3] ?? 'test-results/caverns';
const tracks = (process.argv[4] ?? Array.from({ length: 16 }, (_, i) => `t${i + 1}`).join(',')).split(',');
await mkdir(out, { recursive: true });
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
    page.on('console', (m) => {
      if (m.type() === 'error' && /shader|WebGL|GLSL/i.test(m.text())) errors.push(m.text().slice(0, 500));
    });
    await page.route('**/qa-three/*', async (route) => {
      const file = new URL(route.request().url()).pathname.split('/').pop();
      let body = await readFile(
        file === 'bvh.js'
          ? 'node_modules/three-mesh-bvh/build/index.module.js'
          : 'node_modules/three/build/' + file,
        'utf8',
      );
      if (file === 'bvh.js') body = body.replaceAll("from 'three'", "from '/qa-three/three.module.js'");
      await route.fulfill({ contentType: 'text/javascript', body });
    });
    await page.goto(`${base}/dev/race.html?track=${track}&q=high`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.session, undefined, { timeout: 60000 });
    const review = await page.evaluate(async () => {
      const T = await import('/qa-three/three.module.js'),
        { MeshBVH } = await import('/qa-three/bvh.js');
      const s = window.session;
      s.phase = 'countdown';
      s.phaseT = 2.99;
      s.frame(0.05);
      s.paused = true;
      const p = s.world.main,
        def = s.world.def;
      const zones = [...(def.adventures ?? []).filter((z) => z.kind !== 'ruins'), ...(def.tunnel ?? [])];
      const meshes = [];
      s.world.group.traverse((o) => {
        if (o.name === 'exploration-cavern') meshes.push(o);
      });
      const origin = new T.Vector3(),
        direction = new T.Vector3(),
        ray = new T.Ray();
      const issues = [];
      let checks = 0;
      const bvhs = meshes.map((m) => new MeshBVH(m.geometry, { indirect: true }));
      for (const m of meshes)
        if (m.material.side !== T.DoubleSide || !m.castShadow)
          issues.push('Roof has wrong culling/shadow settings');
      for (let k = 0; k < zones.length; k++) {
        const zone = zones[k];
        for (const u of [0.12, 0.3, 0.5, 0.7, 0.88]) {
          const d = (zone.u0 + (zone.u1 - zone.u0) * u) * p.length,
            i = p.idxAtS(d);
          for (const lane of [-0.85, 0, 0.85]) {
            p.pointAt(d, lane * p.halfW[i], origin, 3.5);
            for (const tilt of [-0.28, 0, 0.28]) {
              direction.set(p.hx[i] * tilt, 1, p.hz[i] * tilt).normalize();
              ray.set(origin, direction);
              checks++;
              if (!bvhs.some((t) => t.raycastFirst(ray, T.DoubleSide, 0, 180)))
                issues.push({ k, u, lane, tilt, kind: 'open roof' });
            }
          }
        }
      }
      window.caveReviewPose = (k, lookUp = false) => {
        const z = zones[k],
          d = (z.u0 + z.u1) * 0.5 * p.length,
          b = s.player.body;
        b.place(s.world, d, 0);
        s.chase.mode = 'chase';
        s.chase.snap(b);
        for (let i = 0; i < 25; i++) s.chase.update(1 / 60, b, b.x, b.y, b.z, b.yaw, false);
        s.updateCaveLighting(2);
        const sd = new T.Vector3(...s.world.theme.sky.sunDir).normalize();
        s.sun.position.set(b.x + sd.x * 80, b.y + sd.y * 80, b.z + sd.z * 80);
        s.sun.target.position.set(b.x, b.y, b.z);
        const pos = s.camera.position.clone(),
          look = s.chase.look.clone();
        if (lookUp) {
          p.pointAt(d + 6, 0, pos, 3.5);
          p.pointAt(d + 16, 0, look, 13);
        }
        s.debugCam = { pos, look };
        s.camera.position.copy(pos);
        s.camera.lookAt(look);
        s.camera.updateMatrixWorld(true);
        s.player.model.update(0, b, 1, s.time, null, { steer: 0, throttle: 0 });
        s.scene.updateMatrixWorld(true);
        s.wheels.update();
        return { mix: s.caveMix, headlamp: s.caveHeadlamp.intensity, sun: s.sun.intensity };
      };
      return {
        sections: zones.length,
        meshes: meshes.length,
        checks,
        issues,
        geometry: meshes.map((m) => m.geometry.userData.cavern),
      };
    });
    for (let k = 0; k < review.sections; k++)
      for (const up of [false, true]) {
        const lighting = await page.evaluate(({ k, up }) => window.caveReviewPose(k, up), { k, up });
        if (lighting.mix < 0.9 || lighting.headlamp < 50)
          review.issues.push({ kind: 'lighting', ...lighting });
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${out}/${track}-${k}-${up ? 'roof' : 'drive'}.png` });
      }
    results.push({ track, ...review, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some((r) => r.issues.length || r.errors.length || r.meshes !== r.sections)) process.exitCode = 1;
