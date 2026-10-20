import * as THREE from 'three';
import { MeshBuilder, extrudeShape, heartShape, lathe, starShape } from '../art/builder';
import { COSMETIC_BY_ID, type CosCategory, type CosmeticDef, type MatKind } from '../data/cosmetics';
import type { CharacterDef } from '../data/characters';

export type CosmeticLoadout = Partial<Record<CosCategory, string>>;
export interface FitCtx {
  def: CharacterDef;
  anatomy: { headY: number; shoulderY: number; eyeX: number; eyeY: number; faceZ: (x: number, y: number) => number };
}
export interface Sink {
  toon: MeshBuilder;
  mat: (k: MatKind) => MeshBuilder;
}
type Fn = (s: Sink) => void;
type SideFn = (s: Sink, sx: number) => void;
export interface CosmeticParts {
  head: Fn[];
  torso: Fn[];
  arm: SideFn[];
  leg: SideFn[];
  fx: { kind: NonNullable<CosmeticDef['fx']>; color: string; slot: CosCategory }[];
}

const STAR = extrudeShape(starShape(1, 0.48), 0.4, 0.06);
const HEART = extrudeShape(heartShape(1), 0.4, 0.06);
const GEM = new THREE.OctahedronGeometry(1, 0);
const RAINBOW = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'];

function mainB(s: Sink, c: CosmeticDef) {
  return c.mat === 'toon' ? s.toon : s.mat(c.mat);
}
function gemB(s: Sink, c: CosmeticDef) {
  return c.tier === 'common' || c.tier === 'rare' ? s.toon : s.mat('gem');
}

// ---------------------------------------------------------------------------------------------
// HATS (head group, origin = head centre)
function hat(s: Sink, c: CosmeticDef, f: FitCtx) {
  const R = f.def.body.headR;
  const b = mainB(s, c);
  const top = R * 0.62;
  const k = R / 0.55;
  switch (c.arch) {
    case 'beanie':
    case 'chickhat':
    case 'bearhat': {
      b.sphere(R * 1.04, c.c1, { p: [0, R * 0.12, -R * 0.02], s: [1.02, 0.78, 1.02] });
      b.torus(R * 0.93, R * 0.1, c.c2, { p: [0, R * 0.12, 0], r: [Math.PI / 2, 0, 0], s: [1.05, 1.05, 1] });
      if (c.arch === 'beanie') b.sphere(R * 0.2, c.c2, { p: [0, R * 0.95, 0] });
      if (c.arch === 'chickhat') {
        b.cone(R * 0.12, R * 0.2, c.c2, { p: [0, R * 0.35, R * 0.98], r: [Math.PI / 2, 0, 0] }, 8);
        for (let i = -1; i <= 1; i++) b.capsule(R * 0.05, R * 0.15, c.c1, { p: [i * R * 0.1, R * 0.98, 0], r: [0, 0, i * 0.4] });
      }
      if (c.arch === 'bearhat') for (const sx of [-1, 1]) b.sphere(R * 0.24, c.c1, { p: [sx * R * 0.62, R * 0.8, 0], s: [1, 1, 0.7] });
      break;
    }
    case 'cap':
      b.sphere(R * 1.02, c.c1, { p: [0, R * 0.2, 0], s: [1.02, 0.7, 1.02] });
      b.cyl(R * 0.62, R * 0.62, R * 0.06, c.c1, { p: [0, R * 0.25, R * 0.95], s: [1, 1, 0.75] });
      for (let i = 0; i < 6; i++) b.sphere(R * 0.04, c.c2, { p: [Math.cos(i) * R * 0.5, R * 0.65 + (i % 2) * 0.05, Math.sin(i) * R * 0.5 + R * 0.2], outline: false });
      b.capsule(R * 0.05, R * 0.12, c.c2, { p: [0, R * 0.92, 0], r: [0.3, 0, 0] });
      break;
    case 'flowerband':
      b.torus(R * 0.98, R * 0.05, c.c1, { p: [0, R * 0.25, 0], r: [0.25, 0, 0] });
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        const p: [number, number, number] = [Math.sin(a) * R * 0.98, R * 0.5 + Math.cos(a) * R * 0.15, Math.cos(a) * R * 0.15];
        for (let q = 0; q < 5; q++) b.sphere(R * 0.07, i % 2 ? c.c2 : '#FFFFFF', { p: [p[0] + Math.cos(q * 1.25) * R * 0.08, p[1] + Math.sin(q * 1.25) * R * 0.08, p[2]], outline: false });
        b.sphere(R * 0.05, '#FFE066', { p, outline: false });
      }
      break;
    case 'bucket':
      b.cyl(R * 0.85, R * 1.0, R * 0.55, c.c1, { p: [0, top, 0] });
      b.cyl(R * 1.45, R * 1.45, R * 0.05, c.c1, { p: [0, top - R * 0.25, 0], r: [0.05, 0, 0] }, 24);
      for (let i = 0; i < 3; i++) b.torus(R * (0.88 + i * 0.05), R * 0.04, c.c2, { p: [0, top - R * 0.1 + i * R * 0.12, 0], r: [Math.PI / 2, 0, 0], outline: false });
      break;
    case 'beret':
      b.sphere(R * 1.0, c.c1, { p: [R * 0.1, top + R * 0.05, 0], s: [1.1, 0.35, 1.05], r: [0, 0, -0.18] });
      b.capsule(R * 0.05, R * 0.1, c.c2, { p: [R * 0.1, top + R * 0.42, 0] });
      break;
    case 'straw':
    case 'welcome':
      b.cyl(R * 0.7, R * 0.85, R * 0.45, c.c1, { p: [0, top + R * 0.05, 0] });
      b.cyl(R * 1.55, R * 1.55, R * 0.06, c.c1, { p: [0, top - R * 0.15, 0] }, 26);
      b.torus(R * 0.82, R * 0.08, c.c2, { p: [0, top - R * 0.05, 0], r: [Math.PI / 2, 0, 0] });
      b.sphere(R * 0.16, c.c2, { p: [R * 0.75, top, R * 0.3], s: [1.6, 1, 0.6] });
      b.sphere(R * 0.16, c.c2, { p: [R * 0.75, top, R * 0.55], s: [1.6, 1, 0.6] });
      break;
    case 'helmet':
    case 'unicorn':
      b.sphere(R * 1.12, c.c1, { p: [0, R * 0.08, -R * 0.04], s: [1.0, 0.92, 1.02] });
      b.box(R * 1.5, R * 0.16, R * 0.2, c.c2, { p: [0, R * 0.62, R * 0.55], r: [-0.6, 0, 0] }, 0.4);
      b.capsule(R * 0.08, R * 1.2, c.c2, { p: [0, R * 0.95, 0], r: [Math.PI / 2, 0, 0], outline: false });
      if (c.arch === 'unicorn') {
        const horn = lathe([[0, 0], [R * 0.16, 0], [0, R * 0.75]], 10);
        gemB(s, c).add(horn, c.gem ?? '#FFC8DD', { p: [0, R * 1.05, R * 0.35], r: [0.5, 0, 0] });
        for (let i = 0; i < 3; i++) gemB(s, c).torus(R * (0.12 - i * 0.03), R * 0.025, '#FFFFFF', { p: [0, R * (1.1 + i * 0.15), R * (0.38 + i * 0.08)], r: [Math.PI / 2 + 0.5, 0, 0], outline: false });
      }
      break;
    case 'wizard':
      b.cone(R * 0.85, R * 1.7, c.c1, { p: [0, top + R * 0.75, 0], r: [-0.15, 0, 0.1] }, 20);
      b.torus(R * 0.86, R * 0.1, c.c1, { p: [0, top - R * 0.05, 0], r: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 4; i++) b.add(STAR, c.c2, { p: [Math.cos(i * 1.6) * R * 0.45, top + R * (0.3 + i * 0.3), Math.sin(i * 1.6) * R * 0.45], s: R * 0.12, outline: false });
      break;
    case 'pirate':
      b.sphere(R * 0.95, c.c1, { p: [0, top, 0], s: [1.45, 0.5, 1.0] });
      b.box(R * 2.3, R * 0.35, R * 0.18, c.c1, { p: [0, top + R * 0.15, R * 0.3] }, 0.4);
      b.sphere(R * 0.18, '#FFFFFF', { p: [0, top + R * 0.2, R * 0.42], s: [1, 1, 0.4] });
      b.torus(R * 0.9, R * 0.04, c.c2, { p: [0, top - R * 0.05, 0], r: [Math.PI / 2, 0, 0], s: [1.4, 1, 1], outline: false });
      break;
    case 'cowboy':
      b.cyl(R * 0.62, R * 0.8, R * 0.55, c.c1, { p: [0, top + R * 0.12, 0] });
      b.sphere(R * 1.5, c.c1, { p: [0, top - R * 0.1, 0], s: [1, 0.12, 0.85] });
      b.torus(R * 0.78, R * 0.06, c.c2, { p: [0, top - R * 0.02, 0], r: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 10; i++) gemB(s, c).sphere(R * 0.06, '#FFFFFF', { p: [Math.cos(i * 0.63) * R * 0.8, top, Math.sin(i * 0.63) * R * 0.8], outline: false });
      break;
    case 'chef':
      b.cyl(R * 0.7, R * 0.72, R * 0.45, c.c1, { p: [0, top + R * 0.05, 0] });
      for (let i = 0; i < 5; i++) b.sphere(R * 0.42, c.c1, { p: [Math.cos(i * 1.25) * R * 0.35, top + R * 0.55, Math.sin(i * 1.25) * R * 0.35] });
      for (let i = 0; i < 3; i++) {
        const col = ['#FFC8DD', '#B9FBC0', '#CDB4DB'][i];
        s.toon.cyl(R * 0.14, R * 0.14, R * 0.08, col, { p: [R * (0.75 - i * 0.05), top + R * (0.1 + i * 0.12), R * 0.3], r: [0, 0, 1.4], outline: false });
      }
      break;
    case 'fedora':
      b.cyl(R * 0.65, R * 0.78, R * 0.5, c.c1, { p: [0, top + R * 0.12, 0] });
      b.sphere(R * 0.68, c.c1, { p: [0, top + R * 0.35, 0], s: [1, 0.35, 1] });
      b.cyl(R * 1.3, R * 1.3, R * 0.05, c.c1, { p: [0, top - R * 0.1, 0], r: [0.12, 0, 0] }, 24);
      b.torus(R * 0.75, R * 0.07, c.c2, { p: [0, top, 0], r: [Math.PI / 2, 0, 0] });
      break;
    case 'crown':
    case 'kingcrown':
    case 'tiara': {
      const big = c.arch === 'kingcrown' ? 1.35 : 1;
      const h = c.arch === 'tiara' ? 0.35 : 0.5 * big;
      if (c.arch === 'tiara') {
        b.torus(R * 0.82, R * 0.05, c.c1, { p: [0, top - R * 0.05, R * 0.1], r: [Math.PI / 2 - 0.4, 0, 0] });
        for (let i = -2; i <= 2; i++) b.cone(R * 0.08, R * (0.35 - Math.abs(i) * 0.08), c.c1, { p: [i * R * 0.28, top + R * 0.15, R * 0.55 - Math.abs(i) * R * 0.08] }, 6);
        gemB(s, c).add(GEM, c.gem ?? '#FF4D6D', { p: [0, top + R * 0.12, R * 0.62], s: [R * 0.13, R * 0.18, R * 0.08] });
      } else {
        b.cyl(R * 0.7 * big, R * 0.62 * big, R * h, c.c1, { p: [0, top + R * h * 0.4, 0] }, 20);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          b.cone(R * 0.13 * big, R * 0.32 * big, c.c1, { p: [Math.cos(a) * R * 0.66 * big, top + R * h * 0.9 + R * 0.12, Math.sin(a) * R * 0.66 * big] }, 6);
          b.sphere(R * 0.06 * big, '#FFFFFF', { p: [Math.cos(a) * R * 0.66 * big, top + R * h * 0.9 + R * 0.3 * big, Math.sin(a) * R * 0.66 * big], outline: false });
          gemB(s, c).add(GEM, i % 2 ? (c.gem ?? '#FF6B8A') : '#7DF9FF', { p: [Math.cos(a) * R * 0.72 * big, top + R * h * 0.35, Math.sin(a) * R * 0.72 * big], s: R * 0.08 * big, outline: false });
        }
        if (c.arch === 'kingcrown') gemB(s, c).add(STAR, '#FFE066', { p: [0, top + R * 1.2, 0], s: R * 0.28 });
      }
      break;
    }
    case 'tophat':
      b.cyl(R * 0.62, R * 0.62, R * 1.0, c.c1, { p: [0, top + R * 0.45, 0] }, 22);
      b.cyl(R * 1.05, R * 1.05, R * 0.06, c.c1, { p: [0, top - R * 0.05, 0] }, 24);
      b.torus(R * 0.63, R * 0.08, c.c2, { p: [0, top + R * 0.1, 0], r: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 6; i++) gemB(s, c).add(GEM, c.gem ?? '#E8F7FF', { p: [Math.cos(i * 1.05) * R * 0.66, top + R * 0.1, Math.sin(i * 1.05) * R * 0.66], s: R * 0.07, outline: false });
      break;
    default:
      b.sphere(R, c.c1, { p: [0, R * 0.2, 0], s: [1, 0.7, 1] });
  }
  void k;
}

// ---------------------------------------------------------------------------------------------
// EYEWEAR (head group)
function eyewear(s: Sink, c: CosmeticDef, f: FitCtx, sun: boolean) {
  const R = f.def.body.headR;
  const ex = f.anatomy.eyeX;
  const ey = f.anatomy.eyeY;
  const zf = (x: number) => f.anatomy.faceZ(x, ey) + R * 0.07;
  const b = mainB(s, c);
  const lensCol = sun ? c.c2 : c.c2;
  const lr = R * 0.24;
  const yaw = (x: number) => Math.atan2(x, zf(x));
  const lens = (geo: THREE.BufferGeometry | null, sx: number, scale = 1) => {
    const x = sx * ex;
    const opts = { p: [x, ey, zf(x)] as [number, number, number], r: [0, yaw(x), 0] as [number, number, number], s: [lr * scale, lr * scale, R * 0.05] as [number, number, number], outline: false };
    if (geo) s.toon.add(geo, lensCol, opts);
    else s.toon.cyl(1, 1, 0.5, lensCol, { ...opts, r: [Math.PI / 2, 0, yaw(x)] });
  };
  const frameRing = (sx: number, scale = 1) => {
    const x = sx * ex;
    b.torus(lr * scale, R * 0.035, c.c1, { p: [x, ey, zf(x) + 0.005], r: [0, yaw(x), 0] });
  };
  const temples = () => {
    for (const sx of [-1, 1]) b.capsule(R * 0.025, R * 0.75, c.c1, { p: [sx * R * 0.86, ey + R * 0.05, R * 0.35], r: [Math.PI / 2, 0, 0], outline: false });
    b.capsule(R * 0.025, ex * 0.6, c.c1, { p: [0, ey + lr * 0.4, zf(0) - R * 0.02], r: [0, 0, Math.PI / 2], outline: false });
  };
  switch (c.arch) {
    case 'heart':
      for (const sx of [-1, 1]) {
        const x = sx * ex;
        b.add(HEART, c.c1, { p: [x, ey, zf(x) - 0.01], r: [0, yaw(x), 0], s: [lr * 1.1, lr * 1.1, R * 0.12] });
        lens(HEART, sx, 0.8);
      }
      temples();
      break;
    case 'star':
    case 'crownshades':
      for (const sx of [-1, 1]) {
        const x = sx * ex;
        b.add(STAR, c.c1, { p: [x, ey, zf(x) - 0.01], r: [0, yaw(x), 0], s: [lr * 1.25, lr * 1.25, R * 0.12] });
        lens(STAR, sx, 0.85);
      }
      temples();
      if (c.arch === 'crownshades') for (let i = -2; i <= 2; i++) b.cone(R * 0.06, R * 0.18, c.c1, { p: [i * R * 0.18, ey + lr * 1.3, zf(0)] }, 6);
      if (c.gem) for (const sx of [-1, 1]) gemB(s, c).add(GEM, c.gem, { p: [sx * (ex + lr), ey + lr * 0.6, zf(sx * ex) + 0.02], s: R * 0.06, outline: false });
      break;
    case 'visor':
    case 'shield':
    case 'sport': {
      const w = ex * 2 + lr * 2.4;
      const g = new THREE.CylinderGeometry(R * 1.04, R * 1.04, lr * (c.arch === 'sport' ? 1.4 : 1.9), 28, 1, true, -w / (2 * R), w / R);
      s.toon.add(g, lensCol, { p: [0, ey, 0.02], r: [0, Math.PI, 0], outline: false });
      b.torus(R * 1.05, R * 0.03, c.c1, { p: [0, ey + lr * 0.95, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 1], outline: false });
      if (c.arch === 'visor') for (const sx of [-1, 1]) b.sphere(R * 0.09, c.c1, { p: [sx * R * 0.98, ey, 0.05] });
      break;
    }
    case 'goggles':
      b.torus(R * 1.02, R * 0.06, c.c1, { p: [0, ey, 0], r: [Math.PI / 2, 0, 0] });
      for (const sx of [-1, 1]) {
        const x = sx * ex;
        b.cyl(lr * 1.15, lr * 1.15, R * 0.18, c.c1, { p: [x, ey, zf(x) - R * 0.04], r: [Math.PI / 2, 0, yaw(x)] }, 16);
        lens(null, sx, 1.0);
      }
      break;
    case '3d':
      b.box(ex * 2 + lr * 2.6, lr * 2.3, R * 0.06, c.c1, { p: [0, ey, zf(0) + R * 0.02] }, 0.3);
      s.toon.box(lr * 1.8, lr * 1.6, R * 0.07, '#FF6B8A', { p: [ex, ey, zf(ex) + R * 0.03], outline: false }, 0.3);
      s.toon.box(lr * 1.8, lr * 1.6, R * 0.07, '#5AA9FF', { p: [-ex, ey, zf(ex) + R * 0.03], outline: false }, 0.3);
      temples();
      break;
    case 'monocle': {
      const x = -ex;
      b.torus(lr * 1.15, R * 0.045, c.c1, { p: [x, ey, zf(x)], r: [0, yaw(x), 0] });
      lens(null, -1, 1.1);
      for (let i = 0; i < 6; i++) b.sphere(R * 0.025, c.c1, { p: [x - lr - i * R * 0.05, ey - lr - i * R * 0.12, zf(x) - i * R * 0.06], outline: false });
      if (c.tier !== 'rare' && c.tier !== 'common') gemB(s, c).add(GEM, c.gem ?? '#FFD45E', { p: [x, ey + lr * 1.15, zf(x)], s: R * 0.06 });
      break;
    }
    case 'butterfly':
      for (const sx of [-1, 1]) {
        const x = sx * ex;
        for (const dy of [0.45, -0.4]) b.sphere(lr * (dy > 0 ? 1.1 : 0.8), c.c1, { p: [x + sx * lr * 0.3, ey + dy * lr, zf(x) - 0.01], s: [1, 0.8, 0.15], r: [0, yaw(x), sx * 0.4] });
        lens(null, sx, 0.9);
      }
      temples();
      break;
    case 'cat':
      for (const sx of [-1, 1]) {
        const x = sx * ex;
        b.sphere(lr * 1.2, c.c1, { p: [x, ey, zf(x) - 0.015], s: [1.2, 0.85, 0.12], r: [0, yaw(x), sx * 0.25] });
        b.cone(lr * 0.35, lr * 0.7, c.c1, { p: [x + sx * lr * 1.05, ey + lr * 0.65, zf(x) - 0.01], r: [0, 0, -sx * 0.9] }, 6);
        lens(null, sx, 0.95);
      }
      temples();
      if (c.gem) for (const sx of [-1, 1]) gemB(s, c).add(GEM, c.gem, { p: [sx * (ex + lr * 1.1), ey + lr * 0.7, zf(ex)], s: R * 0.06, outline: false });
      break;
    case 'aviator':
      for (const sx of [-1, 1]) {
        const x = sx * ex;
        b.torus(lr * 1.1, R * 0.03, c.c1, { p: [x, ey - lr * 0.1, zf(x)], r: [0, yaw(x), 0], s: [1, 1.15, 1] });
        s.toon.sphere(lr * 1.05, lensCol, { p: [x, ey - lr * 0.1, zf(x) - 0.01], s: [1, 1.15, 0.12], r: [0, yaw(x), 0], outline: false });
      }
      temples();
      break;
    case 'halfmoon':
      for (const sx of [-1, 1]) {
        const x = sx * ex;
        const g = new THREE.TorusGeometry(lr, R * 0.03, 6, 14, Math.PI);
        g.rotateZ(Math.PI);
        b.add(g, c.c1, { p: [x, ey - lr * 0.2, zf(x)], r: [0, yaw(x), 0] });
      }
      temples();
      break;
    case 'square':
    case 'rainbow':
      for (const sx of [-1, 1]) {
        const x = sx * ex;
        const g = new THREE.TorusGeometry(lr * 1.15, R * 0.04, 4, 4);
        g.rotateZ(Math.PI / 4);
        b.add(g, c.arch === 'rainbow' ? RAINBOW[(sx + 1) * 2] : c.c1, { p: [x, ey, zf(x)], r: [0, yaw(x), 0] });
        lens(null, sx, 1.0);
      }
      temples();
      if (c.gem) for (const sx of [-1, 1]) gemB(s, c).add(GEM, c.gem, { p: [sx * (ex + lr * 0.8), ey + lr * 0.8, zf(ex) + 0.02], s: R * 0.05, outline: false });
      break;
    default: // round
      for (const sx of [-1, 1]) {
        frameRing(sx, 1.05);
        lens(null, sx, 1.0);
      }
      temples();
      if (c.gem) for (let i = 0; i < 9; i++) gemB(s, c).sphere(R * 0.03, c.gem, { p: [R * (0.85 - i * 0.02), ey - i * R * 0.09, R * 0.2], outline: false });
  }
}

// ---------------------------------------------------------------------------------------------
// TORSO (top / pants upper / necklace)
function torsoFit(f: FitCtx) {
  const B = f.def.body;
  return { r: B.torsoR, h: B.torsoH, cy: B.torsoH / 2 + B.torsoR * 0.35, neckY: B.torsoH + B.torsoR * 0.75 };
}
function top(s: Sink, c: CosmeticDef, f: FitCtx) {
  const { r, h, cy } = torsoFit(f);
  const b = mainB(s, c);
  const shell = (rad = 1.08, col = c.c1) => b.capsule(r * rad, h, col, { p: [0, cy, 0], s: [1, 1, 0.94] });
  switch (c.arch) {
    case 'cape':
      shell(1.06, c.c2);
      b.add(lathe([[r * 0.7, 0], [r * 1.45, -h - r * 0.9], [r * 1.5, -h - r * 1.0]], 18, ), c.c1, { p: [0, cy + h / 2 + r * 0.6, -r * 0.15], s: [1, 1, 0.75] });
      b.torus(r * 0.75, r * 0.12, c.c2, { p: [0, f.def.body.torsoH + r * 0.85, 0], r: [Math.PI / 2, 0, 0] });
      if (c.gem) gemB(s, c).add(STAR, c.gem, { p: [0, f.def.body.torsoH + r * 0.7, r * 0.85], s: r * 0.2 });
      break;
    case 'robe':
      shell(1.1);
      b.add(lathe([[r * 1.0, 0], [r * 1.5, -h * 1.2 - r], [0, -h * 1.2 - r]], 20), c.c1, { p: [0, cy, 0], s: [1, 1, 0.9] });
      b.torus(r * 1.1, r * 0.1, c.c2, { p: [0, cy - r * 0.2, 0], r: [Math.PI / 2, 0, 0] });
      b.torus(r * 0.8, r * 0.14, '#FFFFFF', { p: [0, f.def.body.torsoH + r * 0.8, 0], r: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 3; i++) gemB(s, c).add(GEM, c.gem ?? '#FF6B8A', { p: [0, cy + r * 0.4 - i * r * 0.35, r * 1.08], s: r * 0.09 });
      break;
    case 'puffy':
      for (let i = 0; i < 4; i++) b.torus(r * 0.98, r * 0.22, i % 2 ? c.c2 : c.c1, { p: [0, cy - h / 2 - r * 0.2 + i * (h + r * 0.4) / 3.2, 0], r: [Math.PI / 2, 0, 0] });
      shell(1.05);
      break;
    default: {
      shell();
      if (c.arch === 'stripes' || c.arch === 'racing')
        for (let i = 0; i < 4; i++) s.toon.torus(r * 1.085, r * 0.04, c.c2, { p: [0, cy - h / 2 + i * (h / 3), 0], r: [Math.PI / 2, 0, 0], outline: false });
      if (c.arch === 'racing') s.toon.box(r * 0.25, h + r, r * 0.1, c.c2, { p: [r * 0.4, cy, r * 1.0], outline: false }, 0.4);
      if (c.arch === 'hoodie') {
        b.sphere(r * 0.75, c.c1, { p: [0, cy + h / 2 + r * 0.3, -r * 0.85], s: [1.1, 0.9, 0.7] });
        for (let i = 0; i < 4; i++) s.toon.sphere(r * 0.06, c.c2, { p: [Math.cos(i * 1.6) * r * 0.35, cy + Math.sin(i * 1.6) * r * 0.3, r * 1.0], outline: false });
      }
      if (c.arch === 'suspender') for (const sx of [-1, 1]) s.toon.box(r * 0.14, h + r * 1.2, r * 0.05, c.c2, { p: [sx * r * 0.42, cy, r * 1.02], outline: false }, 0.4);
      if (c.arch === 'vest') s.toon.capsule(r * 1.11, h * 0.8, c.c2, { p: [0, cy, 0], s: [1, 1, 0.9] });
      if (c.arch === 'hawaii') for (let i = 0; i < 9; i++) s.toon.sphere(r * 0.1, i % 2 ? c.c2 : '#FFFFFF', { p: [Math.cos(i * 2.1) * r * 1.04, cy + Math.sin(i * 1.3) * h * 0.5, Math.sin(i * 2.1) * r * 1.0], s: [1, 1, 0.4], outline: false });
      if (c.arch === 'sailor') {
        s.toon.box(r * 1.6, r * 0.5, r * 0.08, c.c2, { p: [0, cy + h / 2 + r * 0.35, -r * 0.9], outline: false }, 0.3);
        s.toon.cone(r * 0.25, r * 0.4, '#FF6B6B', { p: [0, cy + h / 2 + r * 0.1, r * 1.0], r: [Math.PI, 0, 0], outline: false }, 8);
      }
      if (c.arch === 'jacket') {
        for (const sx of [-1, 1]) b.box(r * 0.25, h + r * 0.6, r * 0.12, c.c2, { p: [sx * r * 0.35, cy + r * 0.1, r * 1.0], r: [0, 0, sx * 0.15] }, 0.4);
        for (let i = 0; i < 3; i++) gemB(s, c).sphere(r * 0.06, c.gem ?? c.c2, { p: [0, cy - i * r * 0.3, r * 1.08], outline: false });
      }
      if (c.arch === 'astro') {
        s.toon.box(r * 0.8, r * 0.5, r * 0.15, '#A2D2FF', { p: [0, cy + r * 0.2, r * 1.0] }, 0.4);
        s.toon.box(r * 0.9, h + r, r * 0.6, c.c2, { p: [0, cy, -r * 1.0] }, 0.3);
      }
    }
  }
}
function pantsTorso(s: Sink, c: CosmeticDef, f: FitCtx) {
  const B = f.def.body;
  const r = B.torsoR;
  const b = mainB(s, c);
  const y = r * 0.35;
  switch (c.arch) {
    case 'skirt':
    case 'tutu':
    case 'flare':
      b.sphere(r * 1.1, c.c1, { p: [0, y, 0], s: [1, 0.62, 0.98] });
      if (c.arch === 'tutu')
        for (let i = 0; i < 3; i++) b.torus(r * (1.2 + i * 0.08), r * 0.16, i % 2 ? c.c2 : c.c1, { p: [0, y - r * 0.1 - i * r * 0.08, 0], r: [Math.PI / 2, 0, 0] });
      else b.add(lathe([[r * 1.05, 0], [r * 1.45, -r * 0.75], [r * 1.35, -r * 0.82], [0, -r * 0.82]], 20), c.c1, { p: [0, y + r * 0.1, 0] });
      if (c.arch === 'skirt') s.toon.torus(r * 1.4, r * 0.035, c.c2, { p: [0, y - r * 0.62, 0], r: [Math.PI / 2, 0, 0], outline: false });
      break;
    case 'overalls':
      b.sphere(r * 1.1, c.c1, { p: [0, y, 0], s: [1, 0.65, 0.98] });
      b.box(r * 1.1, B.torsoH * 0.7 + r * 0.4, r * 0.1, c.c1, { p: [0, y + r * 0.6, r * 0.98] }, 0.3);
      for (const sx of [-1, 1]) s.toon.sphere(r * 0.07, c.c2, { p: [sx * r * 0.4, y + r * 0.6 + B.torsoH * 0.3, r * 1.04], outline: false });
      break;
    case 'armor':
      b.sphere(r * 1.12, c.c1, { p: [0, y, 0], s: [1, 0.65, 1] });
      for (let i = 0; i < 6; i++) b.box(r * 0.45, r * 0.5, r * 0.12, i % 2 ? c.c2 : c.c1, { p: [Math.cos(i * 1.05) * r * 1.05, y - r * 0.2, Math.sin(i * 1.05) * r * 1.05], r: [0, -i * 1.05 + Math.PI / 2, 0] }, 0.3);
      break;
    default:
      b.sphere(r * 1.1, c.c1, { p: [0, y, 0], s: [1, 0.65, 0.98] });
      s.toon.torus(r * 1.08, r * 0.06, c.c2, { p: [0, y + r * 0.55, 0], r: [Math.PI / 2, 0, 0], outline: false });
  }
}
function necklace(s: Sink, c: CosmeticDef, f: FitCtx) {
  const { r, neckY } = torsoFit(f);
  const b = mainB(s, c);
  const ringR = r * 0.98;
  const pend = (geo: THREE.BufferGeometry, col: string, sc: number, useGem = false) =>
    (useGem ? gemB(s, c) : b).add(geo, col, { p: [0, neckY - r * 0.45, r * 0.98], s: sc });
  const beadsRing = (n: number, col: (i: number) => string, rad: number, size: number, dy = 0, mat?: MeshBuilder) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      (mat ?? b).sphere(size, col(i), { p: [Math.sin(a) * rad, neckY + dy - Math.max(0, Math.cos(a)) * r * 0.25, Math.cos(a) * rad], outline: false }, 8, 6);
    }
  };
  switch (c.arch) {
    case 'beads':
      beadsRing(18, (i) => RAINBOW[i % 6], ringR, r * 0.07);
      break;
    case 'pearls':
      beadsRing(22, () => '#FFFFFF', ringR, r * 0.065, 0, s.mat('pearl'));
      break;
    case 'pearls3':
      for (let k = 0; k < 3; k++) beadsRing(22 + k * 2, () => '#FFFFFF', ringR + k * r * 0.06, r * 0.055, -k * r * 0.12, s.mat('pearl'));
      break;
    case 'riviere':
      beadsRing(16, () => c.gem ?? '#E8F7FF', ringR, r * 0.075, 0, s.mat('gem'));
      b.torus(ringR, r * 0.025, c.c1, { p: [0, neckY, 0], r: [Math.PI / 2, 0, 0], outline: false });
      break;
    case 'lei':
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const p: [number, number, number] = [Math.sin(a) * ringR, neckY - Math.max(0, Math.cos(a)) * r * 0.25, Math.cos(a) * ringR];
        b.sphere(r * 0.13, i % 2 ? c.c1 : c.c2, { p, s: [1, 0.6, 1], outline: false });
      }
      break;
    case 'choker':
      b.torus(r * 0.85, r * 0.07, c.c1, { p: [0, neckY + r * 0.15, 0], r: [Math.PI / 2, 0, 0] });
      for (const sx of [-1, 1]) b.sphere(r * 0.13, c.c1, { p: [sx * r * 0.14, neckY + r * 0.15, r * 0.88], s: [1.3, 0.8, 0.5] });
      b.sphere(r * 0.06, c.c2, { p: [0, neckY + r * 0.15, r * 0.9] });
      break;
    default: {
      b.torus(ringR, r * 0.025, c.c1, { p: [0, neckY - r * 0.08, r * 0.06], r: [Math.PI / 2 + 0.25, 0, 0], outline: false });
      switch (c.arch) {
        case 'shell':
          pend(lathe([[0, 0], [r * 0.2, r * 0.05], [r * 0.05, r * 0.25], [0, r * 0.25]], 8), c.c2, 1);
          break;
        case 'acorn':
          b.sphere(r * 0.13, c.c1, { p: [0, neckY - r * 0.48, r * 0.98], s: [1, 1.2, 1] });
          b.sphere(r * 0.13, c.c2, { p: [0, neckY - r * 0.38, r * 0.98], s: [1.1, 0.6, 1.1] });
          break;
        case 'starp':
          pend(STAR, c.c2, r * 0.17, c.tier !== 'common');
          break;
        case 'heartp':
          pend(HEART, c.c2, r * 0.17, c.tier !== 'common' && c.tier !== 'rare');
          break;
        case 'medal':
          b.cyl(r * 0.18, r * 0.18, r * 0.05, '#FFD45E', { p: [0, neckY - r * 0.5, r * 1.0], r: [Math.PI / 2, 0, 0] }, 16);
          s.toon.add(STAR, '#FFFFFF', { p: [0, neckY - r * 0.5, r * 1.03], s: r * 0.08, outline: false });
          break;
        case 'norigae':
          b.sphere(r * 0.12, c.c1, { p: [0, neckY - r * 0.45, r * 0.98] });
          for (let i = 0; i < 4; i++) s.toon.capsule(r * 0.02, r * 0.35, ['#FF8FB8', '#7BD389', '#5AA9FF', '#FFE066'][i], { p: [(i - 1.5) * r * 0.05, neckY - r * 0.75, r * 0.98], outline: false });
          break;
        case 'gem':
        case 'orb':
          gemB(s, c).add(c.arch === 'orb' ? new THREE.SphereGeometry(1, 16, 12) : GEM, c.gem ?? c.c2, { p: [0, neckY - r * 0.5, r * 1.02], s: r * (c.arch === 'orb' ? 0.16 : 0.15) });
          b.torus(r * 0.17, r * 0.03, c.c1, { p: [0, neckY - r * 0.5, r * 1.0] });
          break;
        case 'trophy':
          b.add(lathe([[0, 0], [r * 0.12, 0], [r * 0.05, r * 0.08], [r * 0.05, r * 0.15], [r * 0.18, r * 0.3], [0, r * 0.3]], 12), c.c1, { p: [0, neckY - r * 0.75, r * 1.0] });
          break;
        case 'megadia':
          for (let i = 0; i < 10; i++) b.torus(r * 0.06, r * 0.025, c.c1, { p: [Math.sin(i * 0.63) * ringR, neckY - Math.max(0, Math.cos(i * 0.63)) * r * 0.25, Math.cos(i * 0.63) * ringR], r: [0, i, 0], outline: false });
          gemB(s, c).add(GEM, c.gem ?? '#E8F7FF', { p: [0, neckY - r * 0.6, r * 1.05], s: [r * 0.22, r * 0.3, r * 0.12] });
          break;
        default:
          break;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// ARMS (sleeves + bracelets)
function sleeve(s: Sink, c: CosmeticDef, f: FitCtx, sx: number) {
  const B = f.def.body;
  if (f.def.id === 'piyo' || f.def.id === 'piko') return;
  const ar = 0.085 + B.torsoR * 0.06;
  const len = c.arch === 'tee' || c.arch === 'stripes' || c.arch === 'hawaii' || c.arch === 'vest' || c.arch === 'suspender' ? B.armLen * 0.35 : B.armLen * 0.8;
  if (c.arch === 'vest' || c.arch === 'cape') return;
  mainB(s, c).capsule(ar * 1.3, len, c.c1, { p: [0, -len / 2 - 0.02, 0] });
  if (c.arch === 'puffy') mainB(s, c).torus(ar * 1.3, ar * 0.35, c.c2, { p: [0, -len - 0.02, 0], r: [Math.PI / 2, 0, 0] });
  void sx;
}
function bracelet(s: Sink, c: CosmeticDef, f: FitCtx, sx: number) {
  if (sx < 0 && c.arch !== 'beads' && c.arch !== 'string') return; // single wrist except paired bands
  const B = f.def.body;
  const ar = 0.085 + B.torsoR * 0.06;
  const y = -B.armLen * 0.88;
  const b = mainB(s, c);
  const ring = (rad = ar * 1.35, t = ar * 0.25, col = c.c1, bb = b) => bb.torus(rad, t, col, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], outline: false });
  switch (c.arch) {
    case 'beads':
    case 'pearls':
    case 'tennis':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const bb = c.arch === 'pearls' ? s.mat('pearl') : c.arch === 'tennis' ? gemB(s, c) : b;
        bb.sphere(ar * 0.32, c.arch === 'beads' ? RAINBOW[i % 6] : (c.gem ?? c.c1), { p: [Math.cos(a) * ar * 1.3, y, Math.sin(a) * ar * 1.3], outline: false }, 8, 6);
      }
      if (c.arch === 'tennis') ring(ar * 1.3, ar * 0.1, c.c1);
      break;
    case 'string':
      ring(ar * 1.25, ar * 0.12, c.c1);
      ring(ar * 1.25, ar * 0.12, c.c2);
      break;
    case 'watch':
    case 'smartwatch':
      ring(ar * 1.3, ar * 0.3);
      b.box(ar * 1.2, ar * 0.35, ar * 1.2, c.c1, { p: [0, y, ar * 1.35] }, 0.4);
      s.toon.cyl(ar * 0.45, ar * 0.45, ar * 0.1, c.arch === 'smartwatch' ? '#2B2B3A' : '#FFFFFF', { p: [0, y, ar * 1.55], r: [Math.PI / 2, 0, 0], outline: false });
      if (c.gem) for (let i = 0; i < 8; i++) gemB(s, c).sphere(ar * 0.1, c.gem, { p: [Math.cos(i * 0.785) * ar * 0.55, y + Math.sin(i * 0.785) * ar * 0.55, ar * 1.56], outline: false });
      break;
    case 'clover':
    case 'starcharm':
    case 'gemcharm':
      ring(ar * 1.3, ar * 0.12);
      (c.arch === 'gemcharm' ? gemB(s, c) : s.toon).add(c.arch === 'starcharm' ? STAR : c.arch === 'gemcharm' ? GEM : HEART, c.c2, { p: [0, y - ar * 0.6, ar * 1.35], s: ar * 0.35 });
      break;
    case 'cuff':
      b.cyl(ar * 1.35, ar * 1.35, ar * 1.2, c.c1, { p: [0, y, 0] }, 16);
      gemB(s, c).add(GEM, c.gem ?? '#FF4D6D', { p: [0, y, ar * 1.4], s: ar * 0.35 });
      break;
    case 'triple':
      for (let k = -1; k <= 1; k++) b.torus(ar * 1.3, ar * 0.15, c.c1, { p: [0, y + k * ar * 0.35, 0], r: [Math.PI / 2, 0, 0], outline: false });
      for (let k = 0; k < 3; k++) gemB(s, c).add(GEM, c.gem ?? '#3DDC97', { p: [0, y + (k - 1) * ar * 0.35, ar * 1.42], s: ar * 0.18, outline: false });
      break;
    case 'floatring':
      for (let k = 0; k < 2; k++) b.torus(ar * (2.1 + k * 0.4), ar * 0.1, k ? c.c2 : c.c1, { p: [0, y + 0.02 * k, 0], r: [Math.PI / 2 + 0.3 * k, 0.2, 0], outline: false });
      break;
    default:
      ring();
  }
}

// ---------------------------------------------------------------------------------------------
// LEGS (pants legs + shoes)
function pantsLeg(s: Sink, c: CosmeticDef, f: FitCtx, sx: number) {
  const B = f.def.body;
  const lr = 0.1 + B.torsoR * 0.08;
  const b = mainB(s, c);
  if (c.arch === 'skirt' || c.arch === 'tutu') return;
  const full = !(c.arch === 'shorts');
  const len = full ? B.legLen * 0.92 : B.legLen * 0.45;
  if (c.arch === 'flare') {
    b.add(lathe([[lr * 1.25, 0], [lr * 1.8, -len], [0, -len]], 14), c.c1, { p: [0, 0, 0] });
  } else b.capsule(lr * 1.3, len, c.c1, { p: [0, -len / 2, 0] });
  if (c.arch === 'leggings') for (let i = 0; i < 4; i++) s.toon.torus(lr * 1.32, lr * 0.12, RAINBOW[(i + (sx > 0 ? 0 : 2)) % 6], { p: [0, -len * (0.2 + i * 0.22), 0], r: [Math.PI / 2, 0, 0], outline: false });
  if (c.arch === 'armor') gemB(s, c).add(GEM, c.gem ?? '#FF6B8A', { p: [0, -len * 0.5, lr * 1.3], s: lr * 0.35 });
}
function shoes(s: Sink, c: CosmeticDef, f: FitCtx, sx: number) {
  const B = f.def.body;
  const lr = 0.1 + B.torsoR * 0.08;
  const fy = -B.legLen - lr * 0.3;
  const fz = lr * 0.5;
  const b = mainB(s, c);
  const foot = (scale = 1.18, col = c.c1) => b.sphere(lr * 1.25 * scale, col, { p: [0, fy, fz], s: [1, 0.72, 1.4] });
  const sole = (col = c.c2) => s.toon.box(lr * 2.6, lr * 0.25, lr * 3.6, col, { p: [0, fy - lr * 0.7, fz] }, 0.45);
  switch (c.arch) {
    case 'boot':
    case 'furboot':
      foot();
      b.cyl(lr * 1.35, lr * 1.3, B.legLen * 0.55, c.c1, { p: [0, fy + B.legLen * 0.3, 0] }, 14);
      if (c.arch === 'furboot') b.torus(lr * 1.4, lr * 0.3, c.c2, { p: [0, fy + B.legLen * 0.55, 0], r: [Math.PI / 2, 0, 0] });
      sole();
      break;
    case 'hightop':
      foot();
      b.cyl(lr * 1.35, lr * 1.35, B.legLen * 0.35, c.c1, { p: [0, fy + B.legLen * 0.18, 0] }, 14);
      s.toon.sphere(lr * 0.4, c.c2, { p: [sx * lr * 1.3, fy + lr * 0.3, 0], s: [0.3, 1, 1], outline: false });
      sole('#FFFFFF');
      break;
    case 'skate':
      foot();
      sole();
      for (const z of [-1, 1]) for (const x of [-1, 1]) s.toon.cyl(lr * 0.35, lr * 0.35, lr * 0.3, c.c2, { p: [x * lr * 0.7, fy - lr * 1.1, fz + z * lr * 1.1], r: [0, 0, Math.PI / 2] }, 10);
      break;
    case 'slipper':
      foot(1.2);
      for (const x of [-1, 1]) b.sphere(lr * 0.4, c.c1, { p: [x * lr * 0.6, fy + lr * 0.6, fz + lr * 1.0] });
      sole(c.c2);
      break;
    case 'gomusin':
      b.sphere(lr * 1.3, c.c1, { p: [0, fy - lr * 0.15, fz + lr * 0.1], s: [1, 0.55, 1.5] });
      b.cone(lr * 0.25, lr * 0.5, c.c1, { p: [0, fy, fz + lr * 1.9], r: [Math.PI / 2 - 0.5, 0, 0] }, 8);
      break;
    case 'ballet':
      foot(1.12);
      s.toon.torus(lr * 1.1, lr * 0.08, c.c2, { p: [0, fy + lr * 0.4, fz], r: [Math.PI / 2, 0, 0], outline: false });
      if (c.gem) gemB(s, c).add(GEM, c.gem, { p: [0, fy + lr * 0.3, fz + lr * 1.5], s: lr * 0.3, outline: false });
      break;
    case 'wing':
      foot(1.12);
      sole();
      for (let i = 0; i < 3; i++) b.sphere(lr * (0.6 - i * 0.12), '#FFFFFF', { p: [sx * lr * 1.4, fy + lr * (0.3 + i * 0.35), fz - lr * (0.6 + i * 0.3)], s: [0.25, 0.7, 1.4], r: [0.6, 0, 0] });
      break;
    default: // sneaker
      foot();
      sole();
      for (let i = 0; i < 3; i++) s.toon.capsule(lr * 0.06, lr * 0.6, c.c2, { p: [0, fy + lr * 0.55, fz + lr * (0.2 + i * 0.4)], r: [0, 0, Math.PI / 2], outline: false });
      if (c.gem) gemB(s, c).add(STAR, c.gem, { p: [sx * lr * 1.25, fy + lr * 0.2, fz], s: lr * 0.35, r: [0, Math.PI / 2, 0], outline: false });
  }
}

export function buildCosmeticParts(loadout: CosmeticLoadout, f: FitCtx): CosmeticParts {
  const parts: CosmeticParts = { head: [], torso: [], arm: [], leg: [], fx: [] };
  const get = (cat: CosCategory) => (loadout[cat] ? COSMETIC_BY_ID[loadout[cat]!] : undefined);
  const h = get('hat');
  if (h) parts.head.push((s) => hat(s, h, f));
  const sun = get('sunglasses');
  const gl = get('glasses');
  if (sun) parts.head.push((s) => eyewear(s, sun, f, true));
  else if (gl) parts.head.push((s) => eyewear(s, gl, f, false));
  const t = get('top');
  if (t) {
    parts.torso.push((s) => top(s, t, f));
    parts.arm.push((s, sx) => sleeve(s, t, f, sx));
  }
  const p = get('pants');
  if (p) {
    parts.torso.push((s) => pantsTorso(s, p, f));
    parts.leg.push((s, sx) => pantsLeg(s, p, f, sx));
  }
  const sh = get('shoes');
  if (sh) parts.leg.push((s, sx) => shoes(s, sh, f, sx));
  const n = get('necklace');
  if (n) parts.torso.push((s) => necklace(s, n, f));
  const br = get('bracelet');
  if (br) parts.arm.push((s, sx) => bracelet(s, br, f, sx));
  for (const c of [h, sun ?? gl, t, p, sh, n, br]) if (c?.fx) parts.fx.push({ kind: c.fx, color: c.c2, slot: c.category });
  return parts;
}
