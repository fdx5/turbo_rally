import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5193',
  out = process.argv[3] ?? 'test-results/descent';
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
      if (m.type() === 'error' && /shader|WebGL|GLSL/i.test(m.text())) errors.push(m.text().slice(0, 800));
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
    const state = await page.evaluate(async () => {
      const T = await import('/qa-three/three.module.js'),
        { MeshBVH, acceleratedRaycast } = await import('/qa-three/bvh.js');
      const s = window.session,
        b = s.player.body;
      s.phase = 'countdown';
      s.phaseT = 2.99;
      s.frame(0.05);
      s.paused = true;
      const roads = [];
      s.world.group.traverse((o) => {
        if (o.name === 'road') {
          o.geometry.boundsTree = new MeshBVH(o.geometry, { indirect: true });
          o.raycast = acceleratedRaycast;
          roads.push(o);
        }
      });
      s.scene.updateMatrixWorld(true);
      const materials = [...new Set(roads.map((m) => m.material))],
        sides = materials.map((m) => m.side);
      materials.forEach((m) => (m.side = T.DoubleSide));
      const anchor = new T.Vector3(),
        v = new T.Vector3(),
        dir = new T.Vector3(),
        ray = new T.Raycaster();
      ray.firstHitOnly = true;
      const issues = [];
      let checks = 0,
        minClearance = Infinity;
      const put = (p, k, d, t = 0) => {
        p.pointAt(d, t, v);
        b.x = b.px = v.x;
        b.y = b.py = v.y;
        b.z = b.pz = v.z;
        b.yaw = b.pyaw = p.headingAt(d);
        b.onPath = k;
        b.progressS = d;
        p.project(b.x, b.y, b.z, p.idxAtS(d), b.proj);
        b.grounded = true;
        b.speed = 60;
        b.boostT = 1;
      };
      s.chase.mode = 'chase';
      for (let k = 0; k < s.world.paths.length; k++) {
        const p = s.world.paths[k];
        let centre = 20;
        for (let i = 20; i < p.n - 20; i++) if (p.fy[i] < p.fy[centre] && !p.gap[i]) centre = i;
        for (const back of [false, true]) {
          const start = Math.max(0, centre * p.ds - 45);
          put(p, k, start);
          s.chase.snap(b);
          for (let f = 0; f < 150; f++) {
            const d = Math.min(p.length - 2, start + f * 0.75);
            if (p.gap[p.idxAtS(d)]) continue;
            put(p, k, d, Math.sin(f * 0.04) * 2);
            s.chase.update(1 / 60, b, b.x, b.y, b.z, b.yaw, back);
            checks++;
            anchor.set(b.x, b.y + 1.15, b.z);
            dir.subVectors(s.camera.position, anchor);
            ray.set(anchor, dir.clone().normalize());
            ray.far = Math.max(0, dir.length() - 0.1);
            const hits = ray.intersectObjects(roads, false);
            if (hits.length && issues.length < 12)
              issues.push({ k, d, back, kind: 'occluded', distance: hits[0].distance });
            const pr = p.project(
              s.camera.position.x,
              s.camera.position.y,
              s.camera.position.z,
              p.idxAtS(d),
              s.chase.projection,
              32,
              Infinity,
            );
            if (!pr.gap && Math.abs(pr.t) < pr.halfW) {
              const clearance = s.camera.position.y - pr.y;
              minClearance = Math.min(minClearance, clearance);
              if (clearance < 0.3 && issues.length < 12)
                issues.push({ k, d, back, kind: 'below', clearance });
            }
          }
        }
      }
      materials.forEach((m, i) => (m.side = sides[i]));
      const p = s.world.main;
      let worst = 20;
      for (let i = 20; i < p.n - 20; i++) if (p.fy[i] < p.fy[worst] && !p.gap[i]) worst = i;
      put(p, 0, worst * p.ds);
      s.chase.snap(b);
      for (let i = 0; i < 30; i++) s.chase.update(1 / 60, b, b.x, b.y, b.z, b.yaw, false);
      s.debugCam = { pos: s.camera.position.clone(), look: s.chase.look.clone() };
      s.player.model.update(0, b, 1, s.time, null, { steer: 0, throttle: 0 });
      s.scene.updateMatrixWorld(true);
      s.wheels.update();
      const landscape = s.world.group.getObjectByName('natural-landscape');
      return {
        checks,
        minClearance,
        issues,
        grade: p.fy[worst] / Math.hypot(p.fx[worst], p.fz[worst]),
        details: landscape?.userData.detailCount ?? 0,
        rangeVertices: landscape?.getObjectByName('distant-ranges')?.geometry.attributes.position.count,
      };
    });
    await page.waitForTimeout(750);
    await page.screenshot({ path: `${out}/${track}-descent.png` });
    results.push({ track, ...state, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some((r) => r.issues.length || r.errors.length || r.minClearance < 0.3)) process.exitCode = 1;
