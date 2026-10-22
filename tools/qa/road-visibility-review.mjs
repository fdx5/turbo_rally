import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5193',
  out = process.argv[3] ?? 'test-results/road-visibility';
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
    await page.goto(`${base}/dev/race.html?track=${track}&q=medium`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.session, undefined, { timeout: 60000 });
    const result = await page.evaluate(async () => {
      const T = await import('/qa-three/three.module.js'),
        { MeshBVH, acceleratedRaycast } = await import('/qa-three/bvh.js');
      const s = window.session;
      s.paused = true;
      s.phase = 'countdown';
      const foundations = [];
      s.world.group.traverse((o) => {
        if (o.name === 'road-foundation') foundations.push(o);
      });
      let maxSkirt = 0,
        checks = 0;
      const blocked = [];
      for (const m of foundations) {
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 2) maxSkirt = Math.max(maxSkirt, p.getY(i) - p.getY(i + 1));
        m.geometry.boundsTree = new MeshBVH(m.geometry);
        m.raycast = acceleratedRaycast;
      }
      s.scene.updateMatrixWorld(true);
      const ray = new T.Raycaster();
      ray.firstHitOnly = true;
      const a = new T.Vector3(),
        b = new T.Vector3(),
        direction = new T.Vector3();
      const check = (path, distance, t, kind) => {
        path.pointAt(distance, t, a, kind === 'lens' ? 3 : 1.8);
        path.pointAt(distance + (kind === 'lens' ? 8 : 5), t, b, 1.8);
        direction.subVectors(b, a);
        ray.set(a, direction.clone().normalize());
        ray.far = direction.length();
        checks++;
        const hit = ray.intersectObjects(foundations, false)[0];
        if (hit && blocked.length < 30)
          blocked.push({ path: path.id, s: Math.round(distance), t, kind, distance: hit.distance });
      };
      for (const path of s.world.paths)
        for (let d = 0; d < path.length - 10; d += 5) {
          if (path.gap[path.idxAtS(d)] || path.gap[path.idxAtS(d + 8)]) continue;
          const w = path.halfW[path.idxAtS(d)] * 0.65;
          for (const t of [-w, 0, w]) {
            check(path, d, t, 'lane');
            check(path, d, t, 'lens');
          }
        }
      s.chase.mode = 'chase';
      s.chase.snap(s.player.body);
      const kart = s.player.body;
      s.chase.update(1, kart, kart.x, kart.y, kart.z, kart.yaw, false);
      s.camera.updateMatrixWorld(true);
      const startBlocked = [];
      for (const [x, y] of [
        [0, 0],
        [-0.25, 0],
        [0.25, 0],
        [0, 0.35],
      ]) {
        ray.setFromCamera(new T.Vector2(x, y), s.camera);
        ray.far = 15;
        const hit = ray.intersectObjects(foundations, false)[0];
        if (hit) startBlocked.push({ x, y, distance: hit.distance });
      }
      return { checks, maxSkirt, blocked, startBlocked };
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${out}/${track}-start.png` });
    results.push({ track, ...result, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some((r) => r.maxSkirt > 1.61 || r.blocked.length || r.startBlocked.length || r.errors.length))
  process.exitCode = 1;
