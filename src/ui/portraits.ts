import * as THREE from 'three';
import { CharacterModel } from '../characters/model';
import { VehicleModel } from '../vehicles/vehicleModel';
import { CHARACTERS, type CharId } from '../data/characters';
import { makeLights } from '../core/renderer';
import type { CosmeticLoadout } from '../characters/cosmeticBuild';
import { initEnv, sharedTime } from '../art/materials';
import { outlineUniforms } from '../art/toon';

/** Off-screen thumbnail renderer: character portraits & vehicle cards for the UI. */
let R: THREE.WebGLRenderer | null = null;
const cache = new Map<string, string>();
function renderer() {
  if (R) return R;
  const c = document.createElement('canvas');
  R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.setPixelRatio(1);
  initEnv(R);
  return R;
}
function shoot(obj: THREE.Object3D, size: number, cam: THREE.PerspectiveCamera, bg?: string): string {
  const r = renderer();
  r.setSize(size, size, false);
  const scene = new THREE.Scene();
  const L = makeLights('#FFF4E8', 2.4, '#E6EEFF', '#FFE9D6', 1.3, 0.3, 0);
  L.sun.position.set(3, 5, 6);
  scene.add(L.group, obj);
  if (bg) scene.background = new THREE.Color(bg);
  const prev = outlineUniforms.uResolution.value.clone();
  const prevPx = outlineUniforms.uOutlinePx.value;
  outlineUniforms.uResolution.value.set(size, size);
  outlineUniforms.uOutlinePx.value = Math.max(1.2, size / 160);
  sharedTime.value += 0.0;
  r.render(scene, cam);
  outlineUniforms.uResolution.value.copy(prev);
  outlineUniforms.uOutlinePx.value = prevPx;
  return r.domElement.toDataURL('image/png');
}

export function portrait(id: CharId, loadout: CosmeticLoadout = {}, size = 160, expr: 'neutral' | 'happy' = 'happy'): string {
  const key = `p:${id}:${size}:${expr}:${JSON.stringify(loadout)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = new CharacterModel(id, loadout, 'showcase', true);
  c.setExpression(expr);
  const head = c.p.head;
  c.root.updateMatrixWorld(true);
  const hp = new THREE.Vector3();
  head.getWorldPosition(hp);
  const R0 = c.def.body.headR;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(hp.x + R0 * 0.6, hp.y + R0 * 0.35, hp.z + R0 * 5.4);
  cam.lookAt(hp.x, hp.y - R0 * 0.15, hp.z);
  const url = shoot(c.root, size, cam);
  cache.set(key, url);
  return url;
}

export function vehicleThumb(vehicleId: string, charId: CharId = 'momo', size = 220): string {
  const key = `v:${vehicleId}:${charId}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const v = new VehicleModel(vehicleId);
  const c = new CharacterModel(charId, {}, v.bp.pose, true, true);
  v.seat.add(c.root);
  v.root.rotation.y = -0.6;
  const h = v.bp.height;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
  const d = 9 + v.bp.length * 0.6;
  cam.position.set(d * 0.55, h * 0.9 + 2.2, d);
  cam.lookAt(0, h * 0.42, 0);
  const url = shoot(v.root, size, cam);
  cache.set(key, url);
  return url;
}

/** Warm the cache in idle time so menus never hitch. */
export function prewarmPortraits() {
  const list = CHARACTERS.map((c) => c.id);
  let i = 0;
  const step = () => {
    if (i >= list.length) return;
    portrait(list[i++]);
    (window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 30)))(step);
  };
  step();
}
