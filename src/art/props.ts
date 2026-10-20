import * as THREE from 'three';
import { MeshBuilder, extrudeShape, heartShape, lathe, starShape } from './builder';
import { Rng } from '../core/rng';

/** Procedural prop library. Each builder fills a MeshBuilder at local origin (y=0 is ground). */
type PropFn = (b: MeshBuilder, r: Rng) => void;

const PASTELS = ['#FFC8DD', '#CDB4DB', '#A2D2FF', '#B9FBC0', '#FDFFB6', '#FFD6A5', '#FFADAD', '#BDE0FE'];
const star = extrudeShape(starShape(1, 0.5), 0.35, 0.08);
const heart = extrudeShape(heartShape(1), 0.35, 0.08);

function tree(b: MeshBuilder, trunk: string, crowns: string[], h = 4, r = 2.2) {
  b.cyl(0.32, 0.45, h, trunk, { p: [0, h / 2, 0] });
  crowns.forEach((c, i) => {
    const a = (i / crowns.length) * Math.PI * 2;
    const off = i === 0 ? 0 : r * 0.55;
    b.sphere(r * (i === 0 ? 1 : 0.72), c, { p: [Math.cos(a) * off, h + r * 0.35 + (i === 0 ? 0.3 : -0.2), Math.sin(a) * off] });
  });
}

export const PROPS: Record<string, PropFn> = {
  // ---------- candy ----------
  lollipop(b, r) {
    const c = r.pick(PASTELS);
    b.cyl(0.14, 0.14, 5, '#FFFFFF', { p: [0, 2.5, 0] });
    b.cyl(1.6, 1.6, 0.45, c, { p: [0, 6, 0], r: [Math.PI / 2, 0, 0] }, 28);
    b.torus(1.1, 0.16, '#FFFFFF', { p: [0, 6, 0.24] });
    b.torus(0.55, 0.14, '#FFFFFF', { p: [0, 6, 0.24] });
    b.sphere(0.35, '#FFFFFF', { p: [0, 6, 0.3], s: [1, 1, 0.4] });
  },
  cookieHouse(b, r) {
    const w = r.range(5, 7);
    b.box(w, 4, w * 0.8, '#E8B67A', { p: [0, 2, 0] }, 0.18);
    b.box(w * 1.15, 0.6, w * 0.95, '#FFFFFF', { p: [0, 4.1, 0] }, 0.4);
    const roof = new THREE.ConeGeometry(w * 0.78, 3.4, 4);
    b.add(roof, r.pick(['#FF9EC7', '#B9A6E8', '#8FD3F4']), { p: [0, 5.9, 0], r: [0, Math.PI / 4, 0] });
    b.box(1.3, 2.1, 0.3, '#B5754A', { p: [0, 1.05, w * 0.4] }, 0.3);
    for (const x of [-1, 1]) {
      b.box(1.1, 1.1, 0.25, '#FFF6C9', { p: [x * w * 0.3, 2.6, w * 0.4] }, 0.3);
      b.box(1.3, 0.18, 0.3, '#FFFFFF', { p: [x * w * 0.3, 3.25, w * 0.42] }, 0.5);
    }
    for (let i = 0; i < 6; i++) b.sphere(0.22, r.pick(PASTELS), { p: [r.range(-w / 2, w / 2), r.range(0.6, 3.6), w * 0.41], s: [1, 1, 0.5] });
    b.cyl(0.4, 0.4, 2, '#FF8FB8', { p: [w * 0.25, 7.2, 0] });
  },
  cupcake(b, r) {
    b.add(lathe([[0, 0], [1.6, 0], [2.0, 2.0], [0, 2.0]], 16), '#FFD6A5', { p: [0, 0, 0] });
    const c = r.pick(['#FFC8DD', '#CDB4DB', '#B9FBC0', '#FFFFFF']);
    b.sphere(2.1, c, { p: [0, 2.4, 0], s: [1, 0.55, 1] });
    b.sphere(1.5, c, { p: [0, 3.1, 0], s: [1, 0.6, 1] });
    b.sphere(0.9, c, { p: [0, 3.7, 0], s: [1, 0.7, 1] });
    b.sphere(0.45, '#FF6B8A', { p: [0, 4.4, 0] });
    for (let i = 0; i < 10; i++) {
      const a = r.range(0, Math.PI * 2);
      b.capsule(0.07, 0.25, r.pick(PASTELS), { p: [Math.cos(a) * 1.4, 2.9, Math.sin(a) * 1.4], r: [r.range(0, 3), a, 1.2], outline: false });
    }
  },
  gumdrop(b, r) {
    const c = r.pick(PASTELS);
    b.add(lathe([[0, 0], [1.5, 0], [1.4, 0.9], [0.9, 1.9], [0, 2.2]], 18), c);
  },
  candyCane(b, r) {
    const c = r.pick(['#FF8FB8', '#8FD3F4', '#7BD389']);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 4, 0),
      new THREE.Vector3(0.4, 5.2, 0),
      new THREE.Vector3(1.3, 5.3, 0),
      new THREE.Vector3(1.7, 4.5, 0),
    ]);
    b.add(new THREE.TubeGeometry(curve, 30, 0.32, 10), '#FFFFFF');
    for (let i = 0; i < 8; i++) b.torus(0.33, 0.07, c, { p: [0, 0.4 + i * 0.5, 0], r: [Math.PI / 2 + 0.3, 0, 0], outline: false });
  },
  donutStand(b, r) {
    b.cyl(0.25, 0.3, 3, '#FFFFFF', { p: [0, 1.5, 0] });
    b.torus(1.5, 0.7, '#F2C185', { p: [0, 4.4, 0] });
    b.torus(1.5, 0.55, r.pick(['#FF9EC7', '#B9A6E8', '#FFFFFF']), { p: [0, 4.4, 0.25], s: [1, 1, 0.8] });
  },
  creamHill(b, r) {
    const c = r.pick(['#FFE3EF', '#FFF6E9', '#EFE4FF']);
    b.sphere(28, c, { p: [0, -8, 0], s: [1, 0.85, 1] }, 28, 18);
    b.sphere(16, '#FFFFFF', { p: [6, 12, 4], s: [1, 0.7, 1] }, 24, 14);
    b.sphere(7, '#FF6B8A', { p: [6, 22, 4] }, 20, 14);
    b.cyl(0.4, 0.4, 8, '#7BD389', { p: [6, 30, 4], r: [0.3, 0, 0.2] });
  },
  cakeCastle(b) {
    b.cyl(22, 24, 10, '#FFD6E7', { p: [0, 5, 0] }, 32);
    b.cyl(23, 23, 1.5, '#FFFFFF', { p: [0, 10.5, 0] }, 32);
    b.cyl(15, 16, 9, '#E9DBFF', { p: [0, 15, 0] }, 32);
    b.cyl(16, 16, 1.5, '#FFFFFF', { p: [0, 19.7, 0] }, 32);
    b.cyl(8, 9, 8, '#FFF6E9', { p: [0, 24, 0] }, 28);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.cyl(0.5, 0.5, 4, PASTELS[i], { p: [Math.cos(a) * 5, 30, Math.sin(a) * 5] });
      b.cone(0.6, 1.4, '#FFE066', { p: [Math.cos(a) * 5, 32.7, Math.sin(a) * 5], glow: 2.2 });
    }
    b.sphere(3, '#FF6B8A', { p: [0, 30, 0] });
  },
  // ---------- hangang ----------
  cherryTree(b, r) {
    tree(b, '#9C6B5A', ['#FFC8DD', '#FFB3CF', '#FFD9E8', '#FFC2D6'], r.range(3.2, 4.5), r.range(2.2, 2.8));
  },
  picnic(b, r) {
    b.box(3.5, 0.08, 3.5, r.pick(['#FF9EC7', '#8FD3F4', '#FFE066']), { p: [0, 0.04, 0] }, 0.3);
    b.box(0.9, 0.6, 0.6, '#E8B67A', { p: [0.5, 0.35, 0.4] }, 0.3);
    b.torus(0.32, 0.06, '#C98E5A', { p: [0.5, 0.7, 0.4], r: [0, 0, 0] });
    b.sphere(0.3, '#FF6B6B', { p: [-0.8, 0.3, -0.5] });
    b.sphere(0.25, '#FFFFFF', { p: [-0.4, 0.25, -0.8] });
  },
  bench(b) {
    b.box(2.6, 0.18, 0.7, '#E8B67A', { p: [0, 0.75, 0] }, 0.3);
    b.box(2.6, 0.6, 0.15, '#E8B67A', { p: [0, 1.15, -0.3] }, 0.3);
    for (const x of [-1.1, 1.1]) b.box(0.15, 0.75, 0.6, '#8C8A9E', { p: [x, 0.37, 0] }, 0.3);
  },
  lamp(b, r) {
    b.cyl(0.12, 0.18, 5, '#8F86A8', { p: [0, 2.5, 0] });
    b.sphere(0.55, '#FFF3B8', { p: [0, 5.3, 0], glow: 2.4 });
    b.cyl(0.6, 0.3, 0.3, '#8F86A8', { p: [0, 5.85, 0] });
    void r;
  },
  bike(b, r) {
    const c = r.pick(PASTELS);
    b.torus(0.45, 0.07, '#5E5873', { p: [-0.7, 0.5, 0] });
    b.torus(0.45, 0.07, '#5E5873', { p: [0.7, 0.5, 0] });
    b.capsule(0.06, 1.2, c, { p: [0, 0.9, 0], r: [0, 0, Math.PI / 2] });
    b.capsule(0.06, 0.6, c, { p: [-0.4, 0.75, 0], r: [0, 0, 0.6] });
    b.box(0.4, 0.1, 0.2, '#5E5873', { p: [-0.5, 1.1, 0] });
    b.capsule(0.05, 0.5, '#5E5873', { p: [0.6, 1.15, 0], r: [Math.PI / 2, 0, 0] });
  },
  apartments(b, r) {
    for (let i = 0; i < 4; i++) {
      const h = r.range(30, 55);
      const c = r.pick(['#FFF6E9', '#FFE9F2', '#EAF4FF', '#F3EDFF']);
      b.box(16, h, 12, c, { p: [i * 20 - 30, h / 2, r.range(-6, 6)] }, 0.05);
      b.box(16.4, 2, 12.4, r.pick(PASTELS), { p: [i * 20 - 30, h + 1, 0] }, 0.2);
    }
  },
  archBridge(b) {
    b.box(260, 2.5, 16, '#EDE7F6', { p: [0, 14, 0] }, 0.1);
    for (let i = -5; i <= 5; i++) b.box(4, 16, 6, '#D9D2EA', { p: [i * 24, 6, 0] }, 0.2);
    for (let i = -4; i <= 4; i++) {
      const curve = new THREE.EllipseCurve(i * 24 + 12 - 12, 0, 12, 10, 0, Math.PI, false, 0);
      const pts = curve.getPoints(16).map((p) => new THREE.Vector3(p.x, p.y + 15, 7));
      b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.6, 8), '#FFB3C7');
    }
  },
  n63(b) {
    b.box(18, 90, 14, '#FFE6A8', { p: [0, 45, 0] }, 0.12);
    b.box(18.4, 6, 14.4, '#FFFFFF', { p: [0, 92, 0] }, 0.3);
  },
  // ---------- neon ----------
  tower(b, r) {
    const h = r.range(14, 34);
    const w = r.range(8, 12);
    const c = r.pick(['#6C5BA8', '#5A4E94', '#7A63B5', '#4F4A87']);
    b.box(w, h, w, c, { p: [0, h / 2, 0] }, 0.06);
    const neon = r.pick(['#FF7EC8', '#7DF9FF', '#FFE066', '#B9FBC0']);
    for (let y = 3; y < h - 2; y += 3.2) {
      for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 2.2) {
        if (r.chance(0.55)) b.box(1.2, 1.4, 0.1, r.chance(0.7) ? '#FFF1B8' : neon, { p: [x, y, w / 2 + 0.05], glow: 1.6 });
      }
    }
    b.box(w + 0.3, 0.4, w + 0.3, neon, { p: [0, h, 0], glow: 2.2 });
  },
  busStop(b) {
    b.box(5, 0.2, 2, '#7DF9FF', { p: [0, 3, 0], glow: 1.4 });
    for (const x of [-2.2, 2.2]) b.cyl(0.1, 0.1, 3, '#E4DAFF', { p: [x, 1.5, -0.8] });
    b.box(4.6, 2.2, 0.1, '#BFE9FF', { p: [0, 1.6, -0.9] }, 0.2);
    b.box(3, 0.2, 0.6, '#FFC8DD', { p: [0, 0.7, -0.5] }, 0.3);
  },
  neonSign(b, r) {
    b.cyl(0.15, 0.15, 6, '#5B4E8F', { p: [0, 3, 0] });
    const shape = r.chance(0.5) ? heart : star;
    b.add(shape, r.pick(['#FF7EC8', '#7DF9FF', '#FFE066']), { p: [0, 7, 0], s: 1.5, glow: 2.6 });
  },
  trafficLight(b) {
    b.cyl(0.15, 0.15, 5, '#5B4E8F', { p: [0, 2.5, 0] });
    b.box(0.8, 2.2, 0.6, '#4A4170', { p: [0, 5.6, 0] }, 0.3);
    b.sphere(0.25, '#FF7E9E', { p: [0, 6.3, 0.3], glow: 2.2 });
    b.sphere(0.25, '#FFE066', { p: [0, 5.6, 0.3], glow: 1.2 });
    b.sphere(0.25, '#7DFFB0', { p: [0, 4.9, 0.3], glow: 2.2 });
  },
  namsan(b) {
    b.sphere(30, '#4E7A6A', { p: [0, -10, 0], s: [1.4, 0.8, 1.2] }, 24, 14);
    b.cyl(1.4, 2.4, 50, '#F4EEFF', { p: [0, 34, 0] });
    b.cyl(5, 4, 4, '#FFFFFF', { p: [0, 58, 0] }, 24);
    b.cyl(5.2, 5.2, 1, '#FF7EC8', { p: [0, 56, 0], glow: 2.4 }, 24);
    b.cyl(0.4, 0.6, 16, '#FFFFFF', { p: [0, 68, 0] });
    b.sphere(0.8, '#FF7E9E', { p: [0, 76.5, 0], glow: 3 });
  },
  skyline(b, r) {
    for (let i = 0; i < 6; i++) {
      const h = r.range(30, 80);
      b.box(14, h, 14, r.pick(['#5A4E94', '#6C5BA8', '#463F7E']), { p: [i * 18 - 45, h / 2, r.range(-10, 10)] }, 0.05);
      b.box(14.2, 0.6, 14.2, r.pick(['#FF7EC8', '#7DF9FF', '#FFE066']), { p: [i * 18 - 45, h, 0], glow: 2 });
    }
  },
  // ---------- hanok ----------
  hanok(b, r) {
    const w = r.range(7, 9);
    b.box(w, 0.6, w * 0.7, '#CFC4B5', { p: [0, 0.3, 0] }, 0.2);
    b.box(w * 0.9, 2.8, w * 0.6, '#FFF6E9', { p: [0, 2, 0] }, 0.1);
    for (let x = -w * 0.4; x <= w * 0.41; x += w * 0.2) b.box(0.25, 2.8, 0.25, '#A0694B', { p: [x, 2, w * 0.3] }, 0.3);
    b.box(w * 0.9, 0.25, 0.2, '#A0694B', { p: [0, 3.3, w * 0.3] });
    // curved tiled roof (lathe-ish via scaled cylinder segment)
    const roof = new THREE.CylinderGeometry(0.1, w * 0.62, 2.2, 4, 1);
    b.add(roof, '#6E7EA8', { p: [0, 4.4, 0], r: [0, Math.PI / 4, 0], s: [1.25, 1, 0.85] });
    b.box(w * 1.0, 0.35, 0.5, '#5E6C94', { p: [0, 5.4, 0] }, 0.5);
    for (const sx of [-1, 1]) b.sphere(0.45, '#5E6C94', { p: [sx * w * 0.5, 5.6, 0], s: [1.2, 0.8, 1] });
    b.box(1.4, 1.2, 0.1, '#FFF1D6', { p: [-w * 0.2, 2.2, w * 0.31] }, 0.2);
    void r;
  },
  lanternPole(b, r) {
    b.cyl(0.1, 0.12, 4.2, '#8B5E3C', { p: [0, 2.1, 0] });
    b.capsule(0.08, 1.6, '#8B5E3C', { p: [0.8, 4.1, 0], r: [0, 0, Math.PI / 2] });
    const c = r.pick(['#FF8A8A', '#FFB86B', '#7FB3FF']);
    b.sphere(0.55, c, { p: [1.4, 3.3, 0], s: [1, 1.25, 1], glow: 1.8 });
    b.cyl(0.25, 0.25, 0.15, '#4A3B52', { p: [1.4, 4.0, 0] });
    b.cyl(0.25, 0.25, 0.15, '#4A3B52', { p: [1.4, 2.6, 0] });
  },
  stall(b, r) {
    b.box(4, 1.2, 2, '#E8B67A', { p: [0, 0.6, 0] }, 0.2);
    b.box(4.4, 0.2, 2.6, r.pick(['#FF6B6B', '#FF9EC7']), { p: [0, 3, 0] }, 0.3);
    for (const x of [-1.9, 1.9]) b.cyl(0.08, 0.08, 1.8, '#A0694B', { p: [x, 2.1, 0.9] });
    b.cyl(0.9, 0.7, 0.4, '#5E5873', { p: [-0.8, 1.4, 0] });
    for (let i = 0; i < 6; i++) b.capsule(0.12, 0.3, '#FF5E5E', { p: [-0.8 + r.range(-0.4, 0.4), 1.65, r.range(-0.4, 0.4)], r: [0, r.range(0, 3), Math.PI / 2], outline: false });
    b.box(2, 0.6, 0.1, '#FFF6E9', { p: [0, 3.5, 1.2] }, 0.3);
  },
  pine(b, r) {
    b.cyl(0.35, 0.5, 3, '#9C6B5A', { p: [0, 1.5, 0], r: [0, 0, r.range(-0.15, 0.15)] });
    b.sphere(1.8, '#7FBF8E', { p: [0.4, 3.8, 0], s: [1.4, 0.6, 1.2] });
    b.sphere(1.4, '#8ACB98', { p: [-0.6, 4.6, 0.3], s: [1.4, 0.55, 1.2] });
    b.sphere(1.0, '#95D6A3', { p: [0.1, 5.3, -0.2], s: [1.3, 0.55, 1.1] });
  },
  jar(b, r) {
    for (let i = 0; i < 3; i++) {
      const s = r.range(0.7, 1.1);
      b.add(lathe([[0, 0], [0.6, 0.1], [0.9, 0.6], [0.8, 1.2], [0.45, 1.45], [0.5, 1.55], [0, 1.55]], 16), '#8B5A3C', { p: [i * 1.4 - 1.4, 0, r.range(-0.4, 0.4)], s });
    }
  },
  gate(b) {
    b.box(30, 3, 10, '#D8CDBF', { p: [0, 1.5, 0] }, 0.1);
    b.box(22, 9, 7, '#FFF6E9', { p: [0, 7.5, 0] }, 0.08);
    b.box(8, 6, 7.4, '#B3A291', { p: [0, 3, 0] }, 0.2);
    const roof = new THREE.CylinderGeometry(0.1, 16, 5, 4, 1);
    b.add(roof, '#6E7EA8', { p: [0, 14.2, 0], r: [0, Math.PI / 4, 0], s: [1.25, 1, 0.55] });
    b.box(26, 0.7, 1.2, '#5E6C94', { p: [0, 16.6, 0] }, 0.5);
    for (let x = -9; x <= 9; x += 3) b.box(0.6, 9, 0.6, '#C25B4A', { p: [x, 7.5, 3.6] }, 0.3);
  },
  mountain(b, r) {
    const c = r.pick(['#A9D8A8', '#9ACF9C', '#B4DDB0']);
    b.add(lathe([[0, 0], [60, 0], [40, 18], [22, 32], [8, 40], [0, 42]], 20), c, { s: [1, r.range(0.8, 1.3), 1] });
  },
  pagoda(b) {
    for (let i = 0; i < 5; i++) {
      const w = 9 - i * 1.4;
      b.box(w, 2.6, w, '#E9DCC9', { p: [0, 1.3 + i * 3.6, 0] }, 0.1);
      b.box(w + 2.2, 0.6, w + 2.2, '#6E7EA8', { p: [0, 2.9 + i * 3.6, 0] }, 0.3);
    }
    b.cyl(0.3, 0.3, 4, '#FFE066', { p: [0, 20, 0] });
  },
  // ---------- construction ----------
  cone(b) {
    b.cone(0.45, 1.1, '#FFB067', { p: [0, 0.55, 0] });
    b.cyl(0.3, 0.36, 0.2, '#FFFFFF', { p: [0, 0.55, 0], outline: false });
    b.box(1.0, 0.12, 1.0, '#FFB067', { p: [0, 0.06, 0] }, 0.3);
  },
  container(b, r) {
    const c = r.pick(['#FFADAD', '#A2D2FF', '#B9FBC0', '#CDB4DB', '#FFD6A5']);
    b.box(9, 3.2, 3.6, c, { p: [0, 1.6, 0] }, 0.06);
    for (let x = -4; x <= 4; x += 0.8) b.box(0.18, 2.9, 0.1, c, { p: [x, 1.6, 1.82], outline: false });
    if (r.chance(0.5)) b.box(9, 3.2, 3.6, r.pick(PASTELS), { p: [r.range(-1, 1), 4.8, 0], r: [0, r.range(-0.2, 0.2), 0] }, 0.06);
  },
  sandPile(b, r) {
    b.sphere(3, '#F2D49B', { p: [0, -0.6, 0], s: [1.3, r.range(0.6, 0.9), 1.1] });
  },
  barrel(b) {
    for (let i = 0; i < 3; i++) {
      b.cyl(0.5, 0.5, 1.2, i % 2 ? '#FFB067' : '#A2D2FF', { p: [i * 1.1 - 1.1, 0.6, 0] });
      b.torus(0.5, 0.06, '#FFFFFF', { p: [i * 1.1 - 1.1, 0.8, 0], r: [Math.PI / 2, 0, 0], outline: false });
    }
  },
  scaffold(b) {
    for (let x = 0; x < 3; x++)
      for (let z = 0; z < 2; z++) b.cyl(0.1, 0.1, 9, '#C9C2D6', { p: [x * 3 - 3, 4.5, z * 2.5] });
    for (let y = 1; y < 9; y += 3) b.box(7, 0.25, 3, '#FFE066', { p: [0, y, 1.25] }, 0.3);
  },
  pipes(b) {
    for (let i = 0; i < 3; i++) b.cyl(0.6, 0.6, 6, i === 1 ? '#A2D2FF' : '#FFD6A5', { p: [0, 0.6 + (i === 1 ? 1 : 0), i === 1 ? 0 : (i - 1) * 1.2], r: [0, 0, Math.PI / 2] });
  },
  crane(b) {
    b.box(4, 2, 4, '#FFE066', { p: [0, 1, 0] }, 0.2);
    for (let y = 0; y < 40; y += 4) {
      b.box(2.2, 4, 2.2, '#FFE066', { p: [0, 2 + y + 2, 0] }, 0.05);
    }
    b.box(40, 1.6, 1.8, '#FFE066', { p: [12, 44, 0] }, 0.2);
    b.box(4, 3, 3, '#FFB067', { p: [0, 45.5, 0] }, 0.2);
    b.box(5, 3, 3, '#C9C2D6', { p: [-8, 42.5, 0] }, 0.2);
    b.cyl(0.08, 0.08, 18, '#5E5873', { p: [26, 35, 0] });
    b.box(2, 1.2, 2, '#FFB067', { p: [26, 26, 0] }, 0.3);
  },
  unfinished(b, r) {
    const fl = r.int(4, 7);
    for (let i = 0; i < fl; i++) {
      b.box(20, 0.6, 14, '#E4DDE8', { p: [0, i * 4, 0] }, 0.05);
      for (const [x, z] of [[-9, -6], [9, -6], [-9, 6], [9, 6]]) b.box(0.8, 4, 0.8, '#D4CCD9', { p: [x, i * 4 + 2, z] }, 0.2);
    }
    b.box(20.4, 1.4, 0.3, '#FFB067', { p: [0, fl * 4 - 3, 7.1] }, 0.3);
  },
  // ---------- ice cream ----------
  snowPine(b, r) {
    const h = r.range(1, 1.4);
    b.cyl(0.3, 0.4, 1.5 * h, '#9C6B5A', { p: [0, 0.75 * h, 0] });
    for (let i = 0; i < 3; i++) {
      b.cone(2.2 - i * 0.55, 2.2, '#9FD8C2', { p: [0, (1.8 + i * 1.3) * h, 0] });
      b.cone(1.5 - i * 0.4, 1.0, '#FFFFFF', { p: [0, (2.5 + i * 1.3) * h, 0], outline: false });
    }
  },
  snowman(b, r) {
    b.sphere(1.3, '#FFFFFF', { p: [0, 1.1, 0] });
    b.sphere(0.9, '#FFFFFF', { p: [0, 2.7, 0] });
    b.cone(0.15, 0.7, '#FFB067', { p: [0, 2.75, 0.95], r: [Math.PI / 2, 0, 0] });
    for (const x of [-0.3, 0.3]) b.sphere(0.1, '#4A3B52', { p: [x, 2.95, 0.8], outline: false });
    b.torus(0.75, 0.2, r.pick(['#FF8FB8', '#8FD3F4']), { p: [0, 2.15, 0], r: [Math.PI / 2, 0, 0] });
    b.cyl(0.6, 0.6, 0.8, '#5E5873', { p: [0, 3.8, 0] });
    b.cyl(0.9, 0.9, 0.1, '#5E5873', { p: [0, 3.4, 0] });
  },
  popsicle(b, r) {
    b.box(0.35, 2, 0.15, '#E8C79A', { p: [0, 1, 0] }, 0.4);
    b.box(1.6, 2.6, 0.7, r.pick(['#FFC8DD', '#B9FBC0', '#A2D2FF', '#FDE68A']), { p: [0, 3.2, 0] }, 0.45);
  },
  iceCrystal(b) {
    for (let i = 0; i < 4; i++) {
      b.add(new THREE.OctahedronGeometry(1, 0), '#CDE9FF', { p: [i * 0.8 - 1.2, 1.2 + (i % 2) * 0.6, (i % 3) * 0.4], s: [0.6, 1.6 + (i % 2), 0.6], r: [0, i, (i - 1.5) * 0.25] });
    }
  },
  scoopTree(b, r) {
    b.add(lathe([[0, 0], [0.9, 0], [0.2, 3.6], [0, 3.6]], 14).rotateX(Math.PI).translate(0, 3.6, 0), '#E8C79A');
    b.sphere(1.2, r.pick(['#FFC8DD', '#B9FBC0', '#FDE68A', '#CDB4DB']), { p: [0, 3.9, 0] });
    b.sphere(0.9, r.pick(['#FFFFFF', '#FFC8DD']), { p: [0, 5.0, 0] });
  },
  iceMountain(b, r) {
    const c = r.pick(['#FFC8DD', '#B9FBC0', '#CDB4DB', '#BDE0FE']);
    b.add(lathe([[0, 0], [55, 0], [36, 26], [18, 44], [0, 52]], 20), '#FFFFFF', { s: [1, r.range(0.9, 1.3), 1] });
    b.sphere(20, c, { p: [0, 46, 0], s: [1, 0.55, 1] });
    b.sphere(10, '#FFFFFF', { p: [0, 54, 0], s: [1, 0.6, 1] });
  },
  igloo(b) {
    b.sphere(10, '#FFFFFF', { p: [0, 0, 0] }, 24, 12);
    b.cyl(3.5, 3.5, 6, '#FFFFFF', { p: [0, 2, 9], r: [Math.PI / 2, 0, 0] });
    b.cyl(2.5, 2.5, 6.2, '#A9C9F5', { p: [0, 2, 9], r: [Math.PI / 2, 0, 0], outline: false });
  },
  // ---------- jeju ----------
  palm(b, r) {
    const lean = r.range(-0.25, 0.25);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 3, 3, 0),
      new THREE.Vector3(lean * 7, 6.5, 0),
    ]);
    b.add(new THREE.TubeGeometry(curve, 12, 0.35, 8), '#C9A27A');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.sphere(1.4, i % 2 ? '#7BD389' : '#8EE09B', { p: [lean * 7 + Math.cos(a) * 1.5, 6.6, Math.sin(a) * 1.5], s: [1.6, 0.25, 0.6], r: [0, -a, -0.4] });
    }
    b.sphere(0.35, '#8B5E3C', { p: [lean * 7 + 0.3, 6.2, 0.2] });
  },
  hareubang(b) {
    b.capsule(1.0, 1.4, '#8D8A99', { p: [0, 1.6, 0] });
    b.sphere(1.0, '#8D8A99', { p: [0, 3.6, 0], s: [1, 1.15, 1] });
    b.cyl(0.9, 1.0, 0.7, '#7A7788', { p: [0, 4.6, 0] });
    b.sphere(0.32, '#7A7788', { p: [0, 3.5, 0.95] });
    for (const x of [-0.35, 0.35]) b.sphere(0.2, '#5F5C6E', { p: [x, 3.9, 0.85], outline: false });
    for (const x of [-0.5, 0.5]) b.capsule(0.22, 0.8, '#7A7788', { p: [x, 2.2, 0.85], r: [0, 0, x > 0 ? 0.3 : -0.3] });
  },
  tangerineTree(b, r) {
    tree(b, '#9C6B5A', ['#7BD389', '#6CC57C', '#8EE09B'], 2, 1.9);
    for (let i = 0; i < 8; i++) {
      const a = r.range(0, Math.PI * 2);
      b.sphere(0.32, '#FFA94D', { p: [Math.cos(a) * 1.6, 2.6 + r.range(-0.6, 1), Math.sin(a) * 1.6] });
    }
  },
  umbrella(b, r) {
    b.cyl(0.07, 0.07, 3, '#FFFFFF', { p: [0, 1.5, 0], r: [0.1, 0, 0.1] });
    const c = r.pick(['#FF8FB8', '#8FD3F4', '#FFE066']);
    b.add(lathe([[0, 0], [2, -0.6], [0, 0.4]], 12), c, { p: [0.15, 3.1, 0.15] });
    b.box(1.8, 0.1, 0.8, '#FFFFFF', { p: [1.2, 0.1, 0.4] }, 0.3);
  },
  rock(b, r) {
    for (let i = 0; i < 3; i++) b.add(new THREE.DodecahedronGeometry(r.range(0.8, 1.6), 0), '#6F6C7D', { p: [i * 1.2, 0.4, r.range(-0.6, 0.6)], s: [1, 0.7, 1] });
  },
  hallasan(b) {
    b.add(lathe([[0, 0], [90, 0], [60, 20], [30, 36], [18, 40], [16, 38], [0, 37]], 24), '#9ACF9C');
    b.add(lathe([[0, 0], [20, 0], [17, 2], [0, 1]], 20), '#8FD3F4', { p: [0, 37, 0] });
  },
  lighthouse(b) {
    b.add(lathe([[0, 0], [4, 0], [2.6, 22], [0, 22]], 18), '#FFFFFF');
    for (let i = 0; i < 4; i++) b.cyl(3.6 - i * 0.35, 3.8 - i * 0.35, 2, '#FF8A8A', { p: [0, 3 + i * 5, 0], outline: false });
    b.cyl(2, 2, 3, '#FFF3B8', { p: [0, 23.5, 0], glow: 2.5 });
    b.cone(2.6, 2.4, '#FF8A8A', { p: [0, 26.2, 0] });
  },
  // ---------- rainbow ----------
  starDeco(b, r) {
    b.cyl(0.1, 0.1, 4, '#FFFFFF', { p: [0, 2, 0] });
    b.add(star, r.pick(['#FFE066', '#FFC8DD', '#CDB4DB', '#A2D2FF']), { p: [0, 5, 0], s: 1.3 });
  },
  balloonBunch(b, r) {
    for (let i = 0; i < 5; i++) {
      const p: [number, number, number] = [r.range(-1, 1), 5 + r.range(0, 2), r.range(-1, 1)];
      b.sphere(0.7, r.pick(PASTELS), { p, s: [1, 1.2, 1] });
      b.cyl(0.02, 0.02, p[1], '#FFFFFF', { p: [p[0] / 2, p[1] / 2, p[2] / 2], outline: false });
    }
  },
  cloudPuff(b, r) {
    for (let i = 0; i < 5; i++) b.sphere(r.range(1.5, 2.6), '#FFFFFF', { p: [i * 1.8 - 3.6, r.range(0, 1), r.range(-1, 1)] });
  },
  castle(b) {
    b.cyl(30, 18, 14, '#FFFFFF', { p: [0, -7, 0] }, 24);
    b.box(30, 18, 22, '#FFF0FA', { p: [0, 9, 0] }, 0.05);
    for (const [x, z] of [[-15, -11], [15, -11], [-15, 11], [15, 11]]) {
      b.cyl(4, 4, 28, '#F3E8FF', { p: [x, 14, z] }, 20);
      b.cone(5, 10, x < 0 ? '#FFB3D9' : '#B9A6E8', { p: [x, 33, z] }, 20);
      b.add(star, '#FFE066', { p: [x, 40, z], s: 1.4, glow: 2 });
    }
    b.cyl(6, 6, 34, '#FFFFFF', { p: [0, 17, 0] }, 20);
    b.cone(7.5, 14, '#A2D2FF', { p: [0, 41, 0] }, 20);
    b.add(star, '#FFE066', { p: [0, 51, 0], s: 2.4, glow: 2.4 });
  },
  floatIsland(b, r) {
    b.add(lathe([[0, 0], [14, 0], [10, -6], [4, -14], [0, -16]], 14), '#CDB4DB', { p: [0, 0, 0] });
    b.cyl(14.2, 14.2, 1, '#B9FBC0', { p: [0, 0.4, 0] }, 20);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.cyl(0.3, 0.4, 2, '#9C6B5A', { p: [Math.cos(a) * 7, 1.5, Math.sin(a) * 7] });
      b.sphere(1.8, r.pick(PASTELS), { p: [Math.cos(a) * 7, 3.6, Math.sin(a) * 7] });
    }
  },
  rainbowArch(b) {
    const cols = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'];
    cols.forEach((c, i) => b.add(new THREE.TorusGeometry(60 - i * 2.2, 1.1, 8, 48, Math.PI), c, { outline: false }));
  },
};

export function buildProp(name: string, seed: number, detail = 0.6): MeshBuilder {
  const b = new MeshBuilder();
  b.detail = detail;
  const fn = PROPS[name];
  if (fn) fn(b, new Rng(seed));
  return b;
}
