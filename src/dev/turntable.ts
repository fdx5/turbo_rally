import * as THREE from 'three';
import { Renderer, makeLights } from '../core/renderer';
import { loadFonts } from '../art/fonts';
import { VehicleModel } from '../vehicles/vehicleModel';
import { CharacterModel } from '../characters/model';
import { VEHICLES } from '../data/vehicles';
import { CHARACTERS, type CharId } from '../data/characters';
import { COSMETICS } from '../data/cosmetics';
import type { CosmeticLoadout } from '../characters/cosmeticBuild';
import { toon } from '../art/toon';
import { sharedTime } from '../art/materials';
import { buildProp, PROPS } from '../art/props';

/**
 * /dev/turntable.html?asset=vehicle:coupang&char=momo&angle=0.6&light=day
 *   grid=vehicles | characters | props | cosmetics:<category>
 * Used for the §6.2-5 visual QA loop (screenshots).
 */
const q = new URLSearchParams(location.search);
await loadFonts();
const R = new Renderer(document.getElementById('c') as HTMLCanvasElement, 'high');
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 500);
R.setSceneCamera(scene, cam);
const light = q.get('light') ?? 'day';
const L =
  light === 'night'
    ? makeLights('#E4D2FF', 1.4, '#A88BFF', '#FF9ED2', 1.1, 0.35, 2048)
    : light === 'sunset'
      ? makeLights('#FFD0A8', 2.1, '#FFC2D6', '#FFE6C0', 1.2, 0.3, 2048)
      : makeLights('#FFF4E8', 2.3, '#DCEBFF', '#FFE9D6', 1.25, 0.28, 2048);
L.sun.position.set(6, 10, 7);
L.sun.shadow.camera.left = L.sun.shadow.camera.bottom = -12;
L.sun.shadow.camera.right = L.sun.shadow.camera.top = 12;
scene.add(L.group);
scene.background = new THREE.Color(light === 'night' ? '#3B3166' : '#FFF0F6');
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2), toon({ color: light === 'night' ? '#6A5A9E' : '#FFE3EF' }));
floor.receiveShadow = true;
scene.add(floor);

const grid = q.get('grid');
const items: { obj: THREE.Object3D; v?: VehicleModel; c?: CharacterModel }[] = [];
const loadout: CosmeticLoadout = {};
for (const k of ['hat', 'glasses', 'sunglasses', 'top', 'pants', 'shoes', 'necklace', 'bracelet'] as const) {
  const v = q.get(k);
  if (v) loadout[k] = v;
}
let span = 6;
if (grid === 'vehicles') {
  const page = Number(q.get('page') ?? -1);
  VEHICLES.forEach((vd, i) => {
    if (page >= 0 && Math.floor(i / 5) !== page) return;
    const v = new VehicleModel(vd.id);
    const c = new CharacterModel(CHARACTERS[i % 8].id, {}, v.bp.pose, true, true);
    v.seat.add(c.root);
    v.root.position.set(((i % 5) - 2) * 5.2, 0, page >= 0 ? 0 : (Math.floor(i / 5) - 1.5) * 6);
    v.root.rotation.y = 0.7;
    scene.add(v.root);
    items.push({ obj: v.root, v, c });
  });
  span = page >= 0 ? 15 : 34;
} else if (grid === 'characters') {
  CHARACTERS.forEach((cd, i) => {
    const c = new CharacterModel(cd.id, loadout, 'showcase');
    c.root.position.set((i - 3.5) * 1.9, 0.5, 0);
    scene.add(c.root);
    items.push({ obj: c.root, c });
  });
  span = 16;
} else if (grid?.startsWith('cosmetics:')) {
  const cat = grid.split(':')[1];
  const list = COSMETICS.filter((x) => x.category === cat);
  const ch = (q.get('char') as CharId) ?? 'momo';
  list.forEach((cd, i) => {
    const c = new CharacterModel(ch, { [cat]: cd.id } as CosmeticLoadout, 'showcase');
    c.root.position.set(((i % 10) - 4.5) * 1.9, 0.5, (Math.floor(i / 10) - 0.5) * 3.2);
    scene.add(c.root);
    items.push({ obj: c.root, c });
  });
  span = 20;
} else if (grid === 'props') {
  const names = Object.keys(PROPS).filter((n) => !['creamHill', 'cakeCastle', 'apartments', 'archBridge', 'n63', 'namsan', 'skyline', 'gate', 'mountain', 'crane', 'unfinished', 'iceMountain', 'igloo', 'hallasan', 'castle', 'floatIsland', 'rainbowArch', 'pagoda', 'lighthouse'].includes(n));
  names.forEach((n, i) => {
    const g = buildProp(n, 3, 0.8).build();
    g.position.set(((i % 8) - 3.5) * 10, 0, (Math.floor(i / 8) - 2) * 10);
    scene.add(g);
    items.push({ obj: g });
  });
  span = 80;
} else {
  const asset = q.get('asset') ?? 'vehicle:coupang';
  const [kind, id] = asset.split(':');
  const ch = (q.get('char') as CharId) ?? 'momo';
  if (kind === 'vehicle') {
    const v = new VehicleModel(id);
    const c = new CharacterModel(ch, loadout, v.bp.pose);
    v.seat.add(c.root);
    scene.add(v.root);
    items.push({ obj: v.root, v, c });
    span = 6.5;
  } else {
    const c = new CharacterModel(id as CharId, loadout, 'showcase');
    scene.add(c.root);
    items.push({ obj: c.root, c });
    span = 3.2;
  }
}
const angle = q.get('angle');
const spin = angle == null;
const elev = Number(q.get('elev') ?? 0.32);
let a = Number(angle ?? 0.6);
const clock = new THREE.Clock();
const hud = document.getElementById('hud')!;
function frame() {
  R.renderer.info.reset();
  const dt = Math.min(0.05, clock.getDelta());
  if (spin) a += dt * 0.5;
  const d = span * 1.6;
  const ty = grid ? 0.8 : span * 0.18;
  cam.position.set(Math.sin(a) * d * Math.cos(elev), ty + d * Math.sin(elev), Math.cos(a) * d * Math.cos(elev));
  cam.lookAt(0, ty, 0);
  sharedTime.value += dt;
  for (const it of items) {
    it.v?.update(dt, { speed: 0, steer: 0, drift: 0, air: false, landT: 0, boost: false, t: clock.elapsedTime, spinAngle: 0, skillT: 0, beacons: true });
    it.c?.update(dt, { steer: 0, speed: 0 });
  }
  R.render(dt);
  const info = R.renderer.info.render;
  hud.textContent = `draw ${info.calls} · tris ${(info.triangles / 1000).toFixed(1)}k`;
  requestAnimationFrame(frame);
}
R.renderer.info.autoReset = false;
frame();
(window as unknown as { __ready: boolean }).__ready = true;
