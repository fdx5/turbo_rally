import * as THREE from 'three';
import { MeshBuilder, extrudeShape, heartShape, lathe, starShape, type V3 } from '../art/builder';
import { pastel } from '../art/palette';
import {
  FONTS,
  coupangWordmark,
  cyberWord,
  flame,
  hyLogo,
  hyundaiLogo,
  octagon,
  parody,
  policeEmblem,
  recycleMark,
  rocketIcon,
  starOfLife,
  swallowMark,
  teslaT,
  text,
  type Ctx,
} from './decals';
import { roundRect } from '../art/textures';

export type Region = 'side' | 'rear' | 'front' | 'roof';
export const REGIONS: Record<Region, [number, number, number, number]> = {
  side: [0, 0, 2048, 512],
  rear: [0, 512, 1024, 512],
  front: [1024, 512, 1024, 256],
  roof: [1024, 768, 1024, 256],
};
export interface DecalPlane {
  region: Region;
  p: V3;
  face: 'L' | 'R' | 'B' | 'F' | 'U';
  w: number;
  h: number;
}
export interface WheelSpec {
  x: number;
  z: number;
  r: number;
  w: number;
  front: boolean;
  hub: string;
}
export interface AnimPart {
  name: 'drum' | 'beacon' | 'ladder' | 'bed' | 'boom' | 'cone' | 'sign' | 'stopArm' | 'compactor' | 'canopy';
  builder: MeshBuilder;
  pivot: V3;
}
export interface VehicleBlueprint {
  body: MeshBuilder;
  parts: AnimPart[];
  wheels: WheelSpec[];
  seat: V3;
  pose: 'sit' | 'stand' | 'scooter';
  decals: DecalPlane[];
  draw: Partial<Record<Region, (g: Ctx, w: number, h: number) => void>>;
  beacons: { p: V3; color: string }[];
  height: number;
  length: number;
}

const DARK = '#5E5873';
const GLASS = '#BFE3FF';
const TIRE = '#5A5470';
const LIGHT = '#FFF6C9';
const TAIL = '#FF7E9E';

function bp(): VehicleBlueprint {
  return { body: new MeshBuilder(), parts: [], wheels: [], seat: [0, 1, 0], pose: 'sit', decals: [], draw: {}, beacons: [], height: 2, length: 3 };
}
function wheels4(v: VehicleBlueprint, zf: number, zr: number, r: number, track = 0.92, w = 0.42, hub = '#FFFFFF') {
  for (const x of [track, -track]) {
    v.wheels.push({ x, z: zf, r, w, front: true, hub });
    v.wheels.push({ x, z: zr, r, w, front: false, hub });
  }
}
function lights(b: MeshBuilder, zFront: number, zRear: number, y: number, x = 0.62, yr = y) {
  for (const s of [-1, 1]) {
    b.sphere(0.17, LIGHT, { p: [s * x, y, zFront], s: [1, 1, 0.6], glow: 2.2 });
    b.box(0.3, 0.16, 0.08, TAIL, { p: [s * x, yr, zRear] }, 0.4);
  }
}
function bumper(b: MeshBuilder, z: number, y: number, w = 1.9, c = '#E9E4F2') {
  b.box(w, 0.26, 0.3, c, { p: [0, y, z] }, 0.45);
}
function chassis(b: MeshBuilder, len: number, w: number, y: number, c = '#8E87A6') {
  b.box(w, 0.28, len, c, { p: [0, y, 0] }, 0.4);
}
/** Open-top cab: shell + windshield frame, leaving room for the driver. */
function openCab(b: MeshBuilder, z: number, y: number, w: number, l: number, h: number, c: string, opts: { glassTint?: string; noGlass?: boolean } = {}) {
  b.box(w, h, l, c, { p: [0, y + h / 2, z] }, 0.28);
  b.box(w * 0.82, 0.12, l * 0.7, pastel('#D8D2E6'), { p: [0, y + h + 0.02, z - 0.05], outline: false });
  if (!opts.noGlass) {
    // windshield frame (A pillars + top bar) with tinted glass
    // low wrap-around windscreen so the driver's face stays visible (§6.2 checklist)
    const gz = z + l / 2 - 0.08;
    for (const s of [-1, 1]) b.capsule(0.05, 0.22, c, { p: [s * (w / 2 - 0.08), y + h + 0.16, gz], r: [-0.35, 0, 0] });
    b.box(w - 0.08, 0.08, 0.09, c, { p: [0, y + h + 0.3, gz - 0.1] }, 0.4);
    b.box(w - 0.22, 0.24, 0.04, opts.glassTint ?? GLASS, { p: [0, y + h + 0.16, gz - 0.05], r: [-0.35, 0, 0], outline: false }, 0.3);
  }
}
function mirrors(b: MeshBuilder, z: number, y: number, x: number, c = DARK) {
  for (const s of [-1, 1]) {
    b.capsule(0.03, 0.25, c, { p: [s * (x + 0.1), y, z], r: [0, 0, s * 1.2], outline: false });
    b.box(0.08, 0.26, 0.18, c, { p: [s * (x + 0.24), y + 0.1, z] }, 0.4);
  }
}
function lightBar(b: MeshBuilder, v: VehicleBlueprint, p: V3, w = 1.1, colors: [string, string] = ['#FF6B8A', '#5AA9FF']) {
  b.box(w, 0.14, 0.3, '#E4E0EE', { p }, 0.4);
  v.beacons.push({ p: [p[0] - w * 0.28, p[1] + 0.12, p[2]], color: colors[0] });
  v.beacons.push({ p: [p[0] + w * 0.28, p[1] + 0.12, p[2]], color: colors[1] });
}

// ---------------------------------------------------------------------------------------------

const BUILDERS: Record<string, () => VehicleBlueprint> = {
  coupang() {
    const v = bp();
    const b = v.body;
    chassis(b, 3.0, 1.7, 0.55);
    openCab(b, 1.0, 0.5, 1.85, 1.15, 0.62, '#FFFFFF');
    b.box(1.9, 0.95, 1.75, '#FFFFFF', { p: [0, 1.13, -0.62] }, 0.12);
    b.box(1.96, 0.12, 1.8, '#E8F2FF', { p: [0, 1.62, -0.62] }, 0.4);
    bumper(b, 1.62, 0.55);
    bumper(b, -1.52, 0.55, 1.8, '#C9C2D6');
    lights(b, 1.55, -1.53, 0.82, 0.6, 0.8);
    mirrors(b, 1.3, 1.25, 0.92);
    b.box(1.6, 0.3, 0.06, '#5BB6F5', { p: [0, 0.95, 1.58] }, 0.4);
    wheels4(v, 1.0, -0.95, 0.46);
    v.seat = [0, 0.95, 0.88];
    v.decals.push({ region: 'side', p: [0.955, 1.13, -0.62], face: 'L', w: 1.7, h: 0.85 }, { region: 'side', p: [-0.955, 1.13, -0.62], face: 'R', w: 1.7, h: 0.85 });
    v.decals.push({ region: 'rear', p: [0, 1.13, -1.502], face: 'B', w: 1.7, h: 0.85 });
    v.draw.side = (g, w, h) => {
      coupangWordmark(g, w * 0.5, h * 0.36, h * 0.5, w * 0.9);
      rocketIcon(g, w * 0.72, h * 0.72, h * 0.16);
      text(g, parody() ? '로켓배숑' : '로켓배송', w * 0.48, h * 0.76, h * 0.2, '#3DA9F5', { font: FONTS.F_KR });
    };
    v.draw.rear = (g, w, h) => {
      coupangWordmark(g, w * 0.5, h * 0.4, h * 0.36, w * 0.88);
      rocketIcon(g, w * 0.3, h * 0.75, h * 0.12);
      text(g, parody() ? '로켓배숑' : '로켓배송', w * 0.55, h * 0.76, h * 0.16, '#3DA9F5');
    };
    v.height = 2.0;
    v.length = 3.2;
    return v;
  },
  epost() {
    const v = bp();
    const b = v.body;
    const red = pastel('#E4002B');
    chassis(b, 3.0, 1.7, 0.55);
    openCab(b, 1.0, 0.5, 1.85, 1.15, 0.62, red);
    b.box(1.9, 0.95, 1.75, '#FFFFFF', { p: [0, 1.13, -0.62] }, 0.12);
    b.box(1.93, 0.2, 1.78, red, { p: [0, 0.78, -0.62] }, 0.2);
    b.box(1.93, 0.1, 1.78, '#FFD45E', { p: [0, 0.95, -0.62] }, 0.2);
    bumper(b, 1.62, 0.55);
    lights(b, 1.55, -1.53, 0.82, 0.6, 0.8);
    mirrors(b, 1.3, 1.25, 0.92);
    wheels4(v, 1.0, -0.95, 0.46);
    v.seat = [0, 0.95, 0.88];
    v.decals.push({ region: 'side', p: [0.955, 1.27, -0.62], face: 'L', w: 1.7, h: 0.55 }, { region: 'side', p: [-0.955, 1.27, -0.62], face: 'R', w: 1.7, h: 0.55 });
    v.decals.push({ region: 'rear', p: [0, 1.2, -1.502], face: 'B', w: 1.6, h: 0.75 });
    v.decals.push({ region: 'front', p: [0, 0.82, 1.585], face: 'F', w: 1.4, h: 0.35 });
    v.draw.side = (g, w, h) => {
      g.fillStyle = '#E4002B';
      g.beginPath();
      g.arc(w * 0.18, h * 0.5, h * 0.36, 0, Math.PI * 2);
      g.fill();
      swallowMark(g, w * 0.18, h * 0.5, h * 0.26);
      text(g, parody() ? '우채국택배' : '우체국택배', w * 0.6, h * 0.5, h * 0.42, '#E4002B', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.rear = (g, w, h) => {
      swallowMark(g, w * 0.5, h * 0.36, h * 0.2, '#E4002B');
      text(g, parody() ? '우채국택배' : '우체국택배', w * 0.5, h * 0.74, h * 0.2, '#E4002B', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.front = (g, w, h) => text(g, parody() ? '우채국' : '우체국', w * 0.5, h * 0.5, h * 0.7, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
    v.height = 2.0;
    v.length = 3.2;
    return v;
  },
  yakult() {
    const v = bp();
    const b = v.body;
    chassis(b, 2.3, 1.3, 0.42, '#C9C2D6');
    b.box(1.45, 1.0, 1.25, '#FFF8EC', { p: [0, 0.98, 0.45] }, 0.22);
    b.box(1.5, 0.18, 1.3, '#F7931E', { p: [0, 1.52, 0.45] }, 0.45);
    b.box(1.48, 0.12, 1.28, '#F7931E', { p: [0, 0.6, 0.45] }, 0.3);
    b.box(1.2, 0.12, 0.9, '#E9E4F2', { p: [0, 0.6, -0.65] }, 0.4); // standing deck
    b.capsule(0.05, 1.0, '#C9C2D6', { p: [0, 1.25, -0.25], r: [0, 0, Math.PI / 2] }); // handle bar
    for (const s of [-1, 1]) b.capsule(0.05, 0.7, '#C9C2D6', { p: [s * 0.5, 0.95, -0.25], r: [0.1, 0, 0] });
    b.sphere(0.15, LIGHT, { p: [0.45, 0.8, 1.1], glow: 2 });
    b.sphere(0.15, LIGHT, { p: [-0.45, 0.8, 1.1], glow: 2 });
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 0.68, z: 0.75, r: 0.34, w: 0.3, front: true, hub: '#F7931E' });
      v.wheels.push({ x: s * 0.62, z: -0.75, r: 0.34, w: 0.3, front: false, hub: '#F7931E' });
    }
    v.pose = 'stand';
    v.seat = [0, 0.98, -0.7];
    v.decals.push({ region: 'side', p: [0.731, 1.0, 0.45], face: 'L', w: 1.15, h: 0.575 }, { region: 'side', p: [-0.731, 1.0, 0.45], face: 'R', w: 1.15, h: 0.575 });
    v.decals.push({ region: 'front', p: [0, 1.05, 1.081], face: 'F', w: 1.2, h: 0.3 });
    v.draw.side = (g, w, h) => {
      hyLogo(g, w * 0.3, h * 0.48, h * 0.8);
      text(g, '프레시 매니저', w * 0.68, h * 0.38, h * 0.22, '#F7931E');
      text(g, parody() ? '야구르트' : '야쿠르트', w * 0.68, h * 0.7, h * 0.24, '#8DC63F');
    };
    v.draw.front = (g, w, h) => hyLogo(g, w * 0.5, h * 0.5, h * 0.9);
    v.height = 1.85;
    v.length = 2.3;
    return v;
  },
  remicon() {
    const v = bp();
    const b = v.body;
    chassis(b, 3.3, 1.6, 0.6, '#9C95B2');
    openCab(b, 1.15, 0.55, 1.85, 1.0, 0.6, pastel('#FF8C42'));
    bumper(b, 1.72, 0.6);
    lights(b, 1.66, -1.66, 0.85, 0.6, 0.8);
    mirrors(b, 1.4, 1.2, 0.92);
    b.box(1.2, 0.4, 0.4, '#9C95B2', { p: [0, 1.0, -1.55] }, 0.3);
    const drum = new MeshBuilder();
    const prof: [number, number][] = [[0.15, -1.15], [0.55, -1.1], [0.85, -0.6], [0.9, 0], [0.85, 0.5], [0.55, 1.0], [0.25, 1.15]];
    drum.add(lathe(prof, 20), '#FFFFFF');
    for (let k = -2; k <= 2; k++) drum.torus(0.86 - Math.abs(k) * 0.08, 0.06, pastel('#FF8C42'), { p: [0, k * 0.38, 0], r: [Math.PI / 2, 0, 0], outline: false });
    drum.detail = 1;
    v.parts.push({ name: 'drum', builder: drum, pivot: [0, 1.18, -0.6] });
    wheels4(v, 1.1, -1.05, 0.48, 0.92, 0.46);
    v.seat = [0, 1.0, 1.05];
    v.decals.push({ region: 'side', p: [0.93, 0.83, 1.15], face: 'L', w: 0.9, h: 0.225 }, { region: 'side', p: [-0.93, 0.83, 1.15], face: 'R', w: 0.9, h: 0.225 });
    v.draw.side = (g, w, h) => text(g, '뚝딱 레미콘', w * 0.5, h * 0.5, h * 0.7, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
    v.height = 2.3;
    v.length = 3.4;
    return v;
  },
  cybertruck() {
    const v = bp();
    const b = v.body;
    const steel = '#CBD0DA';
    // side profile with an open cockpit; the iconic triangle is kept by a steel roll-cage
    const s = new THREE.Shape();
    s.moveTo(-1.6, 0.35);
    s.lineTo(1.65, 0.35);
    s.lineTo(1.72, 0.74);
    s.lineTo(0.72, 1.02);
    s.lineTo(0.58, 0.84);
    s.lineTo(-0.5, 0.84);
    s.lineTo(-0.62, 1.22);
    s.lineTo(-1.6, 0.98);
    s.closePath();
    const g = extrudeShape(s, 1.7, 0.05);
    g.rotateY(-Math.PI / 2);
    b.add(g, steel);
    const apex: V3 = [0, 1.62, 0.02];
    for (const sx of [-0.8, 0.8]) {
      const front = new THREE.Vector3(sx, 1.02, 0.72);
      const top = new THREE.Vector3(sx * 0.95, apex[1], apex[2]);
      const back = new THREE.Vector3(sx, 1.22, -0.62);
      for (const [a, c] of [[front, top], [top, back]] as const) {
        const mid = a.clone().add(c).multiplyScalar(0.5);
        const len = a.distanceTo(c);
        const dir = c.clone().sub(a).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const e = new THREE.Euler().setFromQuaternion(q);
        b.box(0.1, len + 0.06, 0.1, steel, { p: [mid.x, mid.y, mid.z], r: [e.x, e.y, e.z] }, 0.3);
      }
    }
    b.box(1.7, 0.08, 0.1, steel, { p: [0, apex[1], apex[2]] }, 0.4);
    b.box(1.5, 0.05, 0.05, '#FFFFFF', { p: [0, apex[1] + 0.02, apex[2] + 0.06], glow: 2.4 });
    b.box(1.72, 0.08, 2.3, '#3B3F4A', { p: [0, 0.38, 0] }, 0.3);
    b.box(1.6, 0.06, 0.06, '#FFFFFF', { p: [0, 0.8, 1.72], glow: 3 });
    b.box(1.6, 0.06, 0.06, TAIL, { p: [0, 1.0, -1.63], glow: 2 });
    for (const sx of [-1, 1]) for (const z of [1.0, -1.0]) b.box(0.12, 0.42, 1.0, '#9CA3B0', { p: [sx * 0.9, 0.62, z] }, 0.3);
    wheels4(v, 1.0, -1.0, 0.47, 0.92, 0.42, '#7C8394');
    v.seat = [0, 0.82, 0.05];
    v.decals.push({ region: 'rear', p: [0, 0.72, -1.611], face: 'B', w: 1.5, h: 0.75 });
    v.decals.push({ region: 'front', p: [0, 0.58, 1.69], face: 'F', w: 1.0, h: 0.25 });
    v.decals.push({ region: 'side', p: [0.912, 0.6, -0.2], face: 'L', w: 2.2, h: 0.275 }, { region: 'side', p: [-0.912, 0.6, -0.2], face: 'R', w: 2.2, h: 0.275 });
    v.draw.rear = (g, w, h) => cyberWord(g, w * 0.5, h * 0.55, h * 0.22);
    v.draw.front = (g, w, h) => teslaT(g, w * 0.5, h * 0.5, h * 0.36, parody() ? '#7C8394' : '#E31937');
    v.draw.side = (g, w, h) => cyberWord(g, w * 0.5, h * 0.5, h * 0.55, '#8A909C');
    v.height = 1.7;
    v.length = 3.4;
    return v;
  },
  firetruck() {
    const v = bp();
    const b = v.body;
    const red = pastel('#E8343C');
    chassis(b, 3.5, 1.7, 0.6);
    openCab(b, 1.2, 0.55, 1.9, 1.1, 0.65, red);
    b.box(1.95, 1.1, 2.1, red, { p: [0, 1.2, -0.6] }, 0.12);
    b.box(1.98, 0.14, 2.12, '#FFFFFF', { p: [0, 0.95, -0.6] }, 0.3);
    b.box(1.98, 0.08, 2.12, '#FFD45E', { p: [0, 1.15, -0.6] }, 0.3);
    for (let z = -1.4; z <= 0.2; z += 0.4) b.box(1.92, 0.5, 0.06, pastel('#C2272F'), { p: [0, 1.25, z + 0.2], outline: false });
    bumper(b, 1.8, 0.6, 2.0, '#E9E4F2');
    lights(b, 1.74, -1.66, 0.85);
    mirrors(b, 1.45, 1.25, 0.95);
    // ladder (animated slight raise)
    const ladder = new MeshBuilder();
    for (const sx of [-0.35, 0.35]) ladder.box(0.08, 0.08, 2.6, '#E9E4F2', { p: [sx, 0, -0.2] }, 0.4);
    for (let z = -1.4; z <= 1.0; z += 0.3) ladder.cyl(0.03, 0.03, 0.7, '#E9E4F2', { p: [0, 0, z], r: [0, 0, Math.PI / 2] }, 8);
    v.parts.push({ name: 'ladder', builder: ladder, pivot: [0, 1.85, -0.6] });
    // water cannon
    b.cyl(0.12, 0.16, 0.5, '#E9E4F2', { p: [0, 1.95, 0.35], r: [1.2, 0, 0] });
    lightBar(b, v, [0, 1.98, 1.35], 1.3);
    wheels4(v, 1.15, -1.1, 0.48, 0.95, 0.44);
    v.seat = [0, 1.12, 1.05];
    v.decals.push({ region: 'side', p: [0.981, 1.45, -0.6], face: 'L', w: 1.8, h: 0.45 }, { region: 'side', p: [-0.981, 1.45, -0.6], face: 'R', w: 1.8, h: 0.45 });
    v.decals.push({ region: 'front', p: [0, 0.82, 1.762], face: 'F', w: 1.2, h: 0.3 });
    v.decals.push({ region: 'rear', p: [0, 1.25, -1.656], face: 'B', w: 1.4, h: 0.7 });
    v.draw.side = (g, w, h) => {
      text(g, '119', w * 0.25, h * 0.5, h * 0.8, '#FFFFFF', { font: FONTS.F_ROUND, stroke: '#C2272F' });
      text(g, '소방', w * 0.68, h * 0.5, h * 0.7, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.front = (g, w, h) => text(g, '119 소방', w * 0.5, h * 0.52, h * 0.7, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
    v.draw.rear = (g, w, h) => {
      text(g, '119', w * 0.5, h * 0.4, h * 0.42, '#FFFFFF', { font: FONTS.F_ROUND });
      text(g, '소방차', w * 0.5, h * 0.78, h * 0.2, '#FFE9A8', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.height = 2.2;
    v.length = 3.6;
    return v;
  },
  police() {
    const v = bp();
    const b = v.body;
    const blue = pastel('#1E4FA8');
    chassis(b, 3.0, 1.7, 0.5);
    b.box(1.85, 0.6, 3.0, '#FFFFFF', { p: [0, 0.82, 0] }, 0.35);
    b.box(1.87, 0.22, 3.02, blue, { p: [0, 0.68, 0] }, 0.3);
    b.box(1.6, 0.3, 0.9, '#FFFFFF', { p: [0, 1.2, 0.95] }, 0.4); // hood bump
    b.box(1.5, 0.4, 0.05, GLASS, { p: [0, 1.35, 0.55], r: [-0.4, 0, 0], outline: false }, 0.3);
    // roll bar with light bar behind the driver
    for (const sx of [-0.75, 0.75]) b.capsule(0.06, 0.7, '#FFFFFF', { p: [sx, 1.45, -0.55] });
    b.capsule(0.06, 1.5, '#FFFFFF', { p: [0, 1.85, -0.55], r: [0, 0, Math.PI / 2] });
    lightBar(b, v, [0, 2.0, -0.55], 1.3, ['#FF6B8A', '#5AA9FF']);
    bumper(b, 1.55, 0.55);
    bumper(b, -1.55, 0.55);
    lights(b, 1.5, -1.52, 0.85);
    mirrors(b, 0.6, 1.15, 0.92, '#FFFFFF');
    wheels4(v, 1.0, -1.0, 0.45);
    v.seat = [0, 0.9, -0.05];
    v.decals.push({ region: 'side', p: [0.931, 0.85, 0], face: 'L', w: 2.2, h: 0.55 }, { region: 'side', p: [-0.931, 0.85, 0], face: 'R', w: 2.2, h: 0.55 });
    v.decals.push({ region: 'rear', p: [0, 0.85, -1.501], face: 'B', w: 1.4, h: 0.7 });
    v.decals.push({ region: 'roof', p: [0, 1.36, 0.95], face: 'U', w: 1.4, h: 0.35 });
    v.draw.side = (g, w, h) => {
      policeEmblem(g, w * 0.14, h * 0.5, h * 0.36);
      text(g, 'POLICE', w * 0.47, h * 0.5, h * 0.55, '#1E4FA8', { font: FONTS.F_ROUND });
      text(g, '경찰', w * 0.82, h * 0.5, h * 0.5, '#1E4FA8', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.rear = (g, w, h) => {
      text(g, 'POLICE', w * 0.5, h * 0.4, h * 0.3, '#1E4FA8', { font: FONTS.F_ROUND });
      text(g, '경찰', w * 0.5, h * 0.75, h * 0.24, '#1E4FA8', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.roof = (g, w, h) => text(g, '112', w * 0.5, h * 0.52, h * 0.8, '#1E4FA8', { font: FONTS.F_ROUND });
    v.height = 2.1;
    v.length = 3.1;
    return v;
  },
  ambulance() {
    const v = bp();
    const b = v.body;
    chassis(b, 3.2, 1.7, 0.55);
    openCab(b, 1.05, 0.5, 1.85, 1.0, 0.62, '#FFFFFF');
    b.box(1.92, 1.0, 1.95, '#FFFFFF', { p: [0, 1.17, -0.55] }, 0.15);
    b.box(1.94, 0.16, 1.97, pastel('#E8343C'), { p: [0, 0.98, -0.55] }, 0.3);
    b.box(1.94, 0.08, 1.97, pastel('#FF8A3D'), { p: [0, 1.12, -0.55] }, 0.3);
    lightBar(b, v, [0, 1.74, -0.1], 1.3, ['#FF6B8A', '#FF6B8A']);
    bumper(b, 1.62, 0.55);
    lights(b, 1.56, -1.54, 0.82);
    mirrors(b, 1.3, 1.22, 0.92);
    wheels4(v, 1.0, -1.0, 0.46);
    v.seat = [0, 0.95, 0.92];
    v.decals.push({ region: 'side', p: [0.961, 1.36, -0.55], face: 'L', w: 1.8, h: 0.45 }, { region: 'side', p: [-0.961, 1.36, -0.55], face: 'R', w: 1.8, h: 0.45 });
    v.decals.push({ region: 'rear', p: [0, 1.25, -1.526], face: 'B', w: 1.4, h: 0.7 });
    v.draw.side = (g, w, h) => {
      starOfLife(g, w * 0.15, h * 0.5, h * 0.4);
      text(g, '119 구급', w * 0.58, h * 0.5, h * 0.62, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.rear = (g, w, h) => {
      starOfLife(g, w * 0.5, h * 0.38, h * 0.26);
      text(g, '119 구급', w * 0.5, h * 0.8, h * 0.2, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.height = 2.15;
    v.length = 3.3;
    return v;
  },
  seoulbus() {
    const v = bp();
    const b = v.body;
    const blue = pastel('#2E7BD6');
    chassis(b, 4.0, 1.8, 0.55);
    b.box(2.0, 1.3, 4.0, blue, { p: [0, 1.2, -0.15] }, 0.15);
    b.box(2.02, 0.35, 4.02, '#FFFFFF', { p: [0, 0.65, -0.15] }, 0.25);
    // open roof hatch over driver, side windows band
    b.box(2.03, 0.42, 3.0, '#D9EEFF', { p: [0, 1.45, -0.55], outline: false }, 0.2);
    for (let z = -1.9; z <= 0.8; z += 0.55) b.box(2.05, 0.46, 0.06, blue, { p: [0, 1.45, z], outline: false });
    b.box(1.7, 0.3, 0.06, '#FFB067', { p: [0, 1.7, 1.86], glow: 1.6 }); // LED destination
    bumper(b, 1.9, 0.55, 2.0);
    lights(b, 1.86, -2.17, 0.85);
    mirrors(b, 1.75, 1.6, 1.0);
    wheels4(v, 1.25, -1.4, 0.48, 0.98, 0.44);
    v.seat = [0, 1.38, 1.25];
    v.decals.push({ region: 'side', p: [1.011, 0.98, -0.15], face: 'L', w: 2.4, h: 0.6 }, { region: 'side', p: [-1.011, 0.98, -0.15], face: 'R', w: 2.4, h: 0.6 });
    v.decals.push({ region: 'front', p: [0, 1.7, 1.896], face: 'F', w: 1.6, h: 0.4 });
    v.decals.push({ region: 'rear', p: [0, 1.25, -2.161], face: 'B', w: 1.6, h: 0.8 });
    v.draw.side = (g, w, h) => {
      roundRect(g, 0, 0, 0, 0, 0);
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(w * 0.12, h * 0.5, h * 0.36, 0, Math.PI * 2);
      g.fill();
      text(g, 'B', w * 0.12, h * 0.52, h * 0.5, '#2E7BD6', { font: FONTS.F_ROUND });
      text(g, '서울', w * 0.4, h * 0.5, h * 0.62, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
      text(g, '472', w * 0.75, h * 0.5, h * 0.7, '#FFFFFF', { font: FONTS.F_ROUND });
    };
    v.draw.front = (g, w, h) => {
      g.fillStyle = '#2B2B3A';
      g.fillRect(0, 0, w, h);
      text(g, '472 광화문 ▶', w * 0.5, h * 0.52, h * 0.55, '#FFB067', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.rear = (g, w, h) => {
      text(g, '472', w * 0.5, h * 0.36, h * 0.36, '#FFFFFF', { font: FONTS.F_ROUND });
      text(g, '서울 시내버스', w * 0.5, h * 0.76, h * 0.18, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.height = 2.2;
    v.length = 4.3;
    return v;
  },
  taxi() {
    const v = bp();
    const b = v.body;
    const orange = pastel('#F28C38');
    chassis(b, 3.0, 1.7, 0.48);
    b.box(1.82, 0.62, 3.0, orange, { p: [0, 0.82, 0] }, 0.38);
    b.box(1.55, 0.28, 0.85, orange, { p: [0, 1.18, 0.95] }, 0.45);
    b.box(1.5, 0.4, 0.05, GLASS, { p: [0, 1.32, 0.55], r: [-0.45, 0, 0], outline: false }, 0.3);
    b.box(1.55, 0.25, 0.7, orange, { p: [0, 1.16, -1.05] }, 0.45);
    for (const sx of [-0.7, 0.7]) b.capsule(0.06, 0.55, orange, { p: [sx, 1.45, -0.5] });
    b.capsule(0.06, 1.4, orange, { p: [0, 1.75, -0.5], r: [0, 0, Math.PI / 2] });
    const sign = new MeshBuilder();
    sign.box(0.8, 0.32, 0.38, '#FFF6C9', { glow: 1.5 }, 0.3);
    v.parts.push({ name: 'sign', builder: sign, pivot: [0, 1.98, -0.5] });
    bumper(b, 1.55, 0.52);
    bumper(b, -1.55, 0.52);
    lights(b, 1.5, -1.52, 0.82);
    mirrors(b, 0.6, 1.1, 0.9, orange);
    wheels4(v, 1.0, -1.0, 0.45);
    v.seat = [0, 0.88, -0.05];
    v.decals.push({ region: 'side', p: [0.911, 0.86, 0.1], face: 'L', w: 2.0, h: 0.5 }, { region: 'side', p: [-0.911, 0.86, 0.1], face: 'R', w: 2.0, h: 0.5 });
    v.decals.push({ region: 'front', p: [0, 1.98, -0.309], face: 'F', w: 0.76, h: 0.19 });
    v.decals.push({ region: 'front', p: [0, 1.98, -0.691], face: 'B', w: 0.76, h: 0.19 });
    v.draw.side = (g, w, h) => {
      text(g, '서울택시', w * 0.36, h * 0.5, h * 0.5, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
      text(g, 'SEOUL TAXI', w * 0.76, h * 0.52, h * 0.24, '#FFFFFF', { font: FONTS.F_ROUND });
    };
    v.draw.front = (g, w, h) => text(g, 'TAXI', w * 0.5, h * 0.52, h * 0.8, '#F28C38', { font: FONTS.F_ROUND });
    v.height = 2.1;
    v.length = 3.1;
    return v;
  },
  schoolbus() {
    const v = bp();
    const b = v.body;
    const yel = pastel('#FFC21A');
    chassis(b, 3.4, 1.7, 0.55);
    openCab(b, 1.25, 0.5, 1.9, 0.9, 0.62, yel);
    b.box(1.95, 1.3, 2.4, yel, { p: [0, 1.27, -0.45] }, 0.18);
    b.box(1.97, 0.4, 2.0, '#D9EEFF', { p: [0, 1.5, -0.35], outline: false }, 0.2);
    for (let z = -1.3; z <= 0.6; z += 0.5) b.box(1.99, 0.44, 0.06, yel, { p: [0, 1.5, z], outline: false });
    b.box(1.97, 0.08, 2.42, '#5E5873', { p: [0, 0.9, -0.45], outline: false }, 0.2);
    const stop = new MeshBuilder();
    stop.cyl(0.32, 0.32, 0.05, '#F2545B', { r: [0, 0, Math.PI / 2] }, 8);
    stop.cyl(0.08, 0.08, 0.06, '#FFFFFF', { p: [0.0, 0, 0], r: [0, 0, Math.PI / 2] }, 8);
    v.parts.push({ name: 'stopArm', builder: stop, pivot: [1.03, 1.35, 0.3] });
    bumper(b, 1.72, 0.55, 2.0, '#5E5873');
    lights(b, 1.68, -1.66, 0.85);
    mirrors(b, 1.6, 1.3, 0.95);
    wheels4(v, 1.15, -1.15, 0.46);
    v.seat = [0, 1.25, 1.15];
    v.decals.push({ region: 'side', p: [0.981, 1.0, -0.45], face: 'L', w: 2.2, h: 0.55 }, { region: 'side', p: [-0.981, 1.0, -0.45], face: 'R', w: 2.2, h: 0.55 });
    v.decals.push({ region: 'rear', p: [0, 1.3, -1.656], face: 'B', w: 1.6, h: 0.8 });
    v.draw.side = (g, w, h) => {
      text(g, '어린이 보호차량', w * 0.45, h * 0.5, h * 0.48, '#4A3B52', { font: FONTS.F_BLOCK, weight: 400 });
      octagon(g, w * 0.9, h * 0.5, h * 0.36);
    };
    v.draw.rear = (g, w, h) => {
      g.fillStyle = '#FFFFFF';
      roundRect(g, w * 0.08, h * 0.15, w * 0.84, h * 0.7, h * 0.12);
      text(g, '어린이', w * 0.5, h * 0.36, h * 0.26, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
      text(g, '보호차량', w * 0.5, h * 0.66, h * 0.26, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.height = 2.1;
    v.length = 3.5;
    return v;
  },
  garbage() {
    const v = bp();
    const b = v.body;
    const green = pastel('#2FA05A');
    chassis(b, 3.3, 1.7, 0.55);
    openCab(b, 1.15, 0.5, 1.85, 1.0, 0.62, green);
    b.box(1.95, 1.0, 2.0, green, { p: [0, 1.15, -0.55] }, 0.2);
    b.box(1.97, 0.12, 2.02, '#FFFFFF', { p: [0, 0.75, -0.55] }, 0.3);
    const comp = new MeshBuilder();
    comp.box(1.8, 1.2, 0.5, pastel('#2A8C4E'), { p: [0, 0, -0.25] }, 0.3);
    comp.box(1.5, 0.2, 0.3, '#E9E4F2', { p: [0, -0.4, -0.45] }, 0.4);
    v.parts.push({ name: 'compactor', builder: comp, pivot: [0, 1.25, -1.55] });
    bumper(b, 1.7, 0.55);
    lights(b, 1.64, -1.9, 0.85);
    mirrors(b, 1.45, 1.22, 0.92);
    lightBar(b, v, [0, 1.72, -0.4], 0.8, ['#FFB067', '#FFB067']);
    wheels4(v, 1.1, -1.05, 0.47);
    v.seat = [0, 0.95, 1.0];
    v.decals.push({ region: 'side', p: [0.981, 1.15, -0.55], face: 'L', w: 1.8, h: 0.6 }, { region: 'side', p: [-0.981, 1.15, -0.55], face: 'R', w: 1.8, h: 0.6 });
    v.draw.side = (g, w, h) => {
      recycleMark(g, w * 0.15, h * 0.5, h * 0.3);
      text(g, '깨끗한 우리동네', w * 0.6, h * 0.5, h * 0.32, '#FFFFFF', { font: FONTS.F_KR });
    };
    v.height = 2.15;
    v.length = 3.6;
    return v;
  },
  dump() {
    const v = bp();
    const b = v.body;
    const yel = pastel('#FFB703');
    chassis(b, 3.4, 1.7, 0.75, '#9C95B2');
    openCab(b, 1.2, 0.75, 1.95, 1.0, 0.7, yel);
    bumper(b, 1.78, 0.72, 2.0, '#5E5873');
    lights(b, 1.72, -1.6, 1.0);
    mirrors(b, 1.5, 1.5, 1.0);
    const bed = new MeshBuilder();
    bed.box(2.0, 0.18, 2.2, yel, { p: [0, 0, -1.1] }, 0.3);
    for (const sx of [-1, 1]) bed.box(0.14, 0.7, 2.2, yel, { p: [sx * 0.95, 0.35, -1.1] }, 0.3);
    bed.box(2.0, 0.75, 0.14, yel, { p: [0, 0.37, -0.02] }, 0.3);
    bed.box(1.8, 0.4, 1.8, '#F2D49B', { p: [0, 0.35, -1.1], s: [1, 1, 1] }, 0.6);
    v.parts.push({ name: 'bed', builder: bed, pivot: [0, 1.0, 0.55] });
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 0.98, z: 1.15, r: 0.56, w: 0.5, front: true, hub: '#5E5873' });
      v.wheels.push({ x: s * 0.98, z: -1.15, r: 0.56, w: 0.5, front: false, hub: '#5E5873' });
    }
    v.seat = [0, 1.2, 1.05];
    v.decals.push({ region: 'side', p: [1.026, 1.1, 1.2], face: 'L', w: 0.9, h: 0.225 }, { region: 'side', p: [-1.026, 1.1, 1.2], face: 'R', w: 0.9, h: 0.225 });
    v.draw.side = (g, w, h) => text(g, '뚝딱건설', w * 0.5, h * 0.52, h * 0.7, '#5E5873', { font: FONTS.F_BLOCK, weight: 400 });
    v.height = 2.3;
    v.length = 3.6;
    return v;
  },
  excavator() {
    const v = bp();
    const b = v.body;
    const yel = pastel('#FFB703');
    chassis(b, 2.8, 1.9, 0.6, '#5E5873');
    b.cyl(0.9, 0.95, 0.3, '#5E5873', { p: [0, 0.85, -0.1] }, 20);
    b.box(1.9, 0.85, 2.0, yel, { p: [0, 1.4, -0.3] }, 0.3);
    b.box(1.0, 0.95, 0.9, yel, { p: [0.45, 1.75, 0.45] }, 0.3);
    b.box(0.9, 0.55, 0.05, GLASS, { p: [0.45, 1.9, 0.92], outline: false }, 0.3);
    b.box(1.6, 0.6, 0.6, '#5E5873', { p: [0, 1.5, -1.25] }, 0.4);
    const boom = new MeshBuilder();
    boom.box(0.32, 0.32, 1.9, yel, { p: [0, 0.55, 0.85], r: [-0.55, 0, 0] }, 0.35);
    boom.box(0.28, 0.28, 1.3, yel, { p: [0, 0.75, 2.05], r: [0.8, 0, 0] }, 0.35);
    boom.box(0.75, 0.45, 0.55, '#8E87A6', { p: [0, 0.2, 2.45], r: [0.4, 0, 0] }, 0.3);
    for (let k = -1; k <= 1; k++) boom.cone(0.07, 0.2, '#C9C2D6', { p: [k * 0.25, -0.05, 2.7], r: [Math.PI, 0, 0], outline: false }, 6);
    v.parts.push({ name: 'boom', builder: boom, pivot: [-0.45, 1.4, 0.4] });
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 1.0, z: 0.85, r: 0.48, w: 0.5, front: true, hub: yel });
      v.wheels.push({ x: s * 1.0, z: -0.85, r: 0.48, w: 0.5, front: false, hub: yel });
    }
    v.seat = [-0.4, 1.35, 0.15];
    v.decals.push({ region: 'side', p: [0.956, 1.4, -0.4], face: 'L', w: 1.4, h: 0.35 }, { region: 'side', p: [-0.956, 1.4, -0.4], face: 'R', w: 1.4, h: 0.35 });
    v.draw.side = (g, w, h) => text(g, 'TURBO DIG', w * 0.5, h * 0.52, h * 0.6, '#5E5873', { font: FONTS.F_ROUND });
    v.height = 2.4;
    v.length = 3.6;
    return v;
  },
  icecream() {
    const v = bp();
    const b = v.body;
    const pink = '#FFC8DD';
    chassis(b, 3.1, 1.7, 0.5);
    openCab(b, 1.05, 0.48, 1.85, 1.0, 0.6, '#A2D2FF');
    b.box(1.9, 0.95, 1.9, pink, { p: [0, 1.08, -0.55] }, 0.2);
    b.box(1.96, 0.12, 1.96, '#FFFFFF', { p: [0, 1.6, -0.55] }, 0.4);
    // awning
    for (let k = 0; k < 6; k++) b.box(0.08, 0.06, 0.35, k % 2 ? '#FFFFFF' : '#A2D2FF', { p: [0.98, 1.6, -1.25 + k * 0.28], r: [0, 0, -0.5], outline: false }, 0.3);
    b.box(0.05, 0.55, 1.1, '#FFF6E9', { p: [0.96, 1.2, -0.55] }, 0.3);
    const cone = new MeshBuilder();
    cone.add(lathe([[0, 0], [0.35, 0.9], [0, 0.9]], 14).rotateX(Math.PI).translate(0, 0.9, 0), '#E8C79A');
    cone.sphere(0.42, '#FFC8DD', { p: [0, 1.05, 0] });
    cone.sphere(0.34, '#B9FBC0', { p: [0, 1.4, 0] });
    cone.sphere(0.12, '#FF6B8A', { p: [0, 1.75, 0] });
    v.parts.push({ name: 'cone', builder: cone, pivot: [0, 1.64, -0.75] });
    bumper(b, 1.6, 0.5);
    lights(b, 1.55, -1.52, 0.8);
    mirrors(b, 1.3, 1.15, 0.92);
    wheels4(v, 1.0, -1.0, 0.45);
    v.seat = [0, 0.92, 0.9];
    v.decals.push({ region: 'side', p: [-0.951, 1.25, -0.55], face: 'R', w: 1.7, h: 0.6 });
    v.decals.push({ region: 'rear', p: [0, 1.2, -1.501], face: 'B', w: 1.5, h: 0.75 });
    v.draw.side = (g, w, h) => {
      text(g, 'ICE CREAM', w * 0.5, h * 0.4, h * 0.42, '#FF6B9E', { font: FONTS.F_ROUND, stroke: '#FFFFFF' });
      text(g, '달콤 아이스크림', w * 0.5, h * 0.78, h * 0.22, '#5AA9FF');
    };
    v.draw.rear = (g, w, h) => text(g, '🍦 YUMMY', w * 0.5, h * 0.5, h * 0.3, '#FF6B9E', { font: FONTS.F_ROUND });
    v.height = 2.9;
    v.length = 3.2;
    return v;
  },
  porter() {
    const v = bp();
    const b = v.body;
    const blue = pastel('#2E6FD6');
    chassis(b, 3.2, 1.7, 0.5);
    openCab(b, 1.05, 0.48, 1.85, 1.0, 0.72, blue);
    b.box(1.9, 0.12, 2.0, '#9C95B2', { p: [0, 0.75, -0.6] }, 0.3);
    for (const sx of [-1, 1]) b.box(0.08, 0.38, 2.0, '#E9E4F2', { p: [sx * 0.93, 0.98, -0.6] }, 0.3);
    b.box(1.9, 0.38, 0.08, '#E9E4F2', { p: [0, 0.98, -1.58] }, 0.3);
    b.box(0.8, 0.6, 0.7, '#E8B67A', { p: [-0.4, 1.12, -0.3] }, 0.15);
    b.box(0.7, 0.5, 0.6, '#E8B67A', { p: [0.45, 1.06, -1.0] }, 0.15);
    b.box(0.6, 0.45, 0.6, '#FFD6A5', { p: [-0.3, 1.0, -1.15] }, 0.15);
    bumper(b, 1.6, 0.5, 1.9, '#E9E4F2');
    lights(b, 1.56, -1.62, 0.85);
    mirrors(b, 1.3, 1.3, 0.92);
    wheels4(v, 1.0, -1.0, 0.45);
    v.seat = [0, 0.95, 0.9];
    v.decals.push({ region: 'front', p: [0, 0.98, 1.581], face: 'F', w: 1.0, h: 0.25 });
    v.decals.push({ region: 'side', p: [0.931, 1.0, 1.0], face: 'L', w: 0.95, h: 0.2375 }, { region: 'side', p: [-0.931, 1.0, 1.0], face: 'R', w: 0.95, h: 0.2375 });
    v.decals.push({ region: 'rear', p: [0, 0.98, -1.625], face: 'B', w: 1.0, h: 0.5 });
    v.draw.front = (g, w, h) => hyundaiLogo(g, w * 0.5, h * 0.5, h * 0.36, '#FFFFFF');
    v.draw.side = (g, w, h) => text(g, parody() ? 'PORTA' : 'PORTER', w * 0.5, h * 0.52, h * 0.72, '#FFFFFF', { font: FONTS.F_ROUND, italic: true });
    v.draw.rear = (g, w, h) => {
      text(g, parody() ? 'HYUNDAE' : 'HYUNDAI', w * 0.5, h * 0.35, h * 0.22, '#5E5873', { font: FONTS.F_ROUND, spacing: 6 });
      text(g, parody() ? 'PORTA' : 'PORTER', w * 0.5, h * 0.7, h * 0.26, '#5E5873', { font: FONTS.F_ROUND, italic: true });
    };
    v.height = 2.0;
    v.length = 3.3;
    return v;
  },
  tteokbokki() {
    const v = bp();
    const b = v.body;
    const red = pastel('#E8343C');
    chassis(b, 3.1, 1.7, 0.5);
    openCab(b, 1.05, 0.48, 1.85, 1.0, 0.62, '#FFFFFF');
    b.box(1.9, 0.9, 1.9, red, { p: [0, 1.0, -0.55] }, 0.2);
    // orange tent (pojangmacha)
    b.add(new THREE.CylinderGeometry(0.01, 1.35, 0.6, 4, 1), '#FF9F43', { p: [0, 1.82, -0.6], r: [0, Math.PI / 4, 0], s: [1, 1, 1] });
    for (const [x, z] of [[0.9, 0.35], [-0.9, 0.35], [0.9, -1.45], [-0.9, -1.45]]) b.cyl(0.04, 0.04, 0.35, '#C9C2D6', { p: [x, 1.6, z] }, 6);
    // giant tteok skewer sign
    b.cyl(0.03, 0.03, 1.1, '#E8C79A', { p: [0.55, 2.3, -1.2], r: [0, 0, 0.3] }, 6);
    for (let k = 0; k < 4; k++) b.capsule(0.11, 0.2, '#FF5E5E', { p: [0.47 + k * 0.07, 2.05 + k * 0.22, -1.2], r: [0, 0, 0.3 + Math.PI / 2], outline: k === 0 });
    b.cyl(0.6, 0.5, 0.25, '#5E5873', { p: [0, 1.55, -0.55] }, 16);
    for (let k = 0; k < 7; k++) b.capsule(0.07, 0.18, '#FF5E5E', { p: [Math.cos(k) * 0.3, 1.7, -0.55 + Math.sin(k) * 0.3], r: [0, k, Math.PI / 2], outline: false });
    bumper(b, 1.6, 0.5);
    lights(b, 1.55, -1.52, 0.8);
    mirrors(b, 1.3, 1.15, 0.92);
    wheels4(v, 1.0, -1.0, 0.45);
    v.seat = [0, 0.92, 0.9];
    v.decals.push({ region: 'side', p: [0.951, 1.0, -0.55], face: 'L', w: 1.7, h: 0.425 * 1.6 }, { region: 'side', p: [-0.951, 1.0, -0.55], face: 'R', w: 1.7, h: 0.425 * 1.6 });
    v.decals.push({ region: 'rear', p: [0, 1.0, -1.501], face: 'B', w: 1.5, h: 0.75 });
    v.draw.side = (g, w, h) => {
      text(g, '떡볶이', w * 0.38, h * 0.48, h * 0.62, '#FFF6E9', { font: FONTS.F_KR, stroke: '#B8222A' });
      text(g, '매콤달콤', w * 0.78, h * 0.5, h * 0.3, '#FFE066');
    };
    v.draw.rear = (g, w, h) => text(g, '떡볶이 1인분 ♥', w * 0.5, h * 0.5, h * 0.22, '#FFF6E9');
    v.height = 2.9;
    v.length = 3.2;
    return v;
  },
  monster() {
    const v = bp();
    const b = v.body;
    const purple = '#CDB4DB';
    b.box(1.6, 0.3, 2.4, '#5E5873', { p: [0, 1.1, 0] }, 0.4);
    b.box(1.85, 0.7, 2.8, purple, { p: [0, 1.6, 0] }, 0.35);
    b.box(1.5, 0.4, 0.9, purple, { p: [0, 2.05, 0.85] }, 0.45);
    for (const sx of [-0.65, 0.65]) b.capsule(0.07, 0.5, '#FFFFFF', { p: [sx, 2.25, -0.55] });
    b.capsule(0.07, 1.3, '#FFFFFF', { p: [0, 2.5, -0.55], r: [0, 0, Math.PI / 2] });
    for (const sx of [-1, 1]) for (const z of [-1, 1]) b.cyl(0.07, 0.07, 0.8, '#E9E4F2', { p: [sx * 0.7, 1.0, z * 1.05], r: [0, 0, sx * 0.6] }, 8);
    lights(b, 1.4, -1.42, 1.75);
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 1.15, z: 1.05, r: 0.85, w: 0.7, front: true, hub: '#FFE066' });
      v.wheels.push({ x: s * 1.15, z: -1.05, r: 0.85, w: 0.7, front: false, hub: '#FFE066' });
    }
    v.seat = [0, 1.75, -0.1];
    v.decals.push({ region: 'side', p: [0.931, 1.6, 0], face: 'L', w: 2.6, h: 0.65 }, { region: 'side', p: [-0.931, 1.6, 0], face: 'R', w: 2.6, h: 0.65 });
    v.draw.side = (g, w, h) => {
      flame(g, w * 0.05, h * 0.6, h * 0.55);
      flame(g, w * 0.45, h * 0.62, h * 0.45, ['#A2D2FF', '#B9FBC0', '#FFFFFF']);
      text(g, 'MONSTER', w * 0.82, h * 0.5, h * 0.36, '#FFFFFF', { font: FONTS.F_ROUND, stroke: '#9D7BC9' });
    };
    v.height = 2.8;
    v.length = 3.4;
    return v;
  },
  golfcart() {
    const v = bp();
    const b = v.body;
    const mint = '#B9FBC0';
    chassis(b, 2.4, 1.4, 0.42, '#E9E4F2');
    b.box(1.5, 0.5, 0.8, '#FFFFFF', { p: [0, 0.72, 0.85] }, 0.42);
    b.box(1.5, 0.35, 0.6, mint, { p: [0, 0.65, -0.25] }, 0.4);
    b.box(1.4, 0.5, 0.15, mint, { p: [0, 0.98, -0.5] }, 0.4);
    b.box(1.6, 0.12, 2.0, mint, { p: [0, 2.25, 0.05] }, 0.4); // canopy
    b.box(1.66, 0.06, 2.06, '#FFFFFF', { p: [0, 2.33, 0.05] }, 0.4);
    for (const [x, z] of [[0.7, 0.75], [-0.7, 0.75], [0.7, -0.75], [-0.7, -0.75]]) b.cyl(0.04, 0.04, 1.4, '#FFFFFF', { p: [x, 1.55, z] }, 8);
    b.box(1.2, 0.22, 0.05, GLASS, { p: [0, 1.12, 0.84], r: [-0.25, 0, 0], outline: false }, 0.3);
    // golf bag
    b.cyl(0.25, 0.22, 0.9, '#FF9EC7', { p: [0, 1.1, -0.95], r: [-0.25, 0, 0] }, 14);
    for (let k = 0; k < 3; k++) b.cyl(0.03, 0.03, 0.5, '#C9C2D6', { p: [-0.1 + k * 0.1, 1.7, -1.05], r: [-0.25, 0, 0] }, 6);
    for (let k = 0; k < 3; k++) b.sphere(0.07, '#5E5873', { p: [-0.1 + k * 0.1, 1.95, -1.1], outline: false });
    lights(b, 1.25, -1.2, 0.72, 0.5);
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 0.72, z: 0.8, r: 0.36, w: 0.32, front: true, hub: '#FFFFFF' });
      v.wheels.push({ x: s * 0.72, z: -0.8, r: 0.36, w: 0.32, front: false, hub: '#FFFFFF' });
    }
    v.seat = [0, 0.82, -0.05];
    v.decals.push({ region: 'front', p: [0, 0.72, 1.255], face: 'F', w: 1.0, h: 0.25 });
    v.decals.push({ region: 'side', p: [0.761, 0.7, 0.85], face: 'L', w: 0.7, h: 0.175 }, { region: 'side', p: [-0.761, 0.7, 0.85], face: 'R', w: 0.7, h: 0.175 });
    v.draw.front = (g, w, h) => text(g, '⛳ GOLF', w * 0.5, h * 0.52, h * 0.6, '#7BD389', { font: FONTS.F_ROUND });
    v.draw.side = (g, w, h) => text(g, 'NICE SHOT!', w * 0.5, h * 0.52, h * 0.6, '#7BD389', { font: FONTS.F_ROUND });
    v.height = 2.35;
    v.length = 2.5;
    return v;
  },
  scooter() {
    const v = bp();
    const b = v.body;
    const red = '#FF9EB5';
    b.box(0.7, 0.25, 1.9, '#E9E4F2', { p: [0, 0.5, -0.1] }, 0.45);
    b.box(0.75, 0.75, 0.5, red, { p: [0, 0.85, 0.75], r: [-0.25, 0, 0] }, 0.4);
    b.capsule(0.05, 0.6, '#C9C2D6', { p: [0, 1.35, 0.85], r: [-0.3, 0, 0] });
    b.capsule(0.05, 0.75, '#5E5873', { p: [0, 1.65, 0.75], r: [0, 0, Math.PI / 2] });
    b.sphere(0.16, LIGHT, { p: [0, 1.35, 1.05], glow: 2.2 });
    b.capsule(0.32, 0.6, red, { p: [0, 0.85, -0.4], r: [Math.PI / 2, 0, 0] }); // seat body
    // delivery box
    b.box(0.95, 0.85, 0.9, '#FFFFFF', { p: [0, 1.45, -1.05] }, 0.2);
    b.box(0.97, 0.15, 0.92, red, { p: [0, 1.9, -1.05] }, 0.4);
    v.wheels.push({ x: 0, z: 1.0, r: 0.38, w: 0.3, front: true, hub: red });
    v.wheels.push({ x: 0.62, z: -1.0, r: 0.38, w: 0.3, front: false, hub: red });
    v.wheels.push({ x: -0.62, z: -1.0, r: 0.38, w: 0.3, front: false, hub: red });
    b.box(1.5, 0.12, 0.3, '#C9C2D6', { p: [0, 0.45, -1.0] }, 0.4);
    v.pose = 'scooter';
    v.seat = [0, 1.05, -0.3];
    v.decals.push({ region: 'side', p: [0.476, 1.45, -1.05], face: 'L', w: 0.85, h: 0.425 }, { region: 'side', p: [-0.476, 1.45, -1.05], face: 'R', w: 0.85, h: 0.425 });
    v.decals.push({ region: 'rear', p: [0, 1.45, -1.501], face: 'B', w: 0.85, h: 0.425 });
    v.draw.side = (g, w, h) => {
      text(g, '빠른배달', w * 0.5, h * 0.38, h * 0.36, '#FF6B9E');
      text(g, '🛵 30분 OK', w * 0.5, h * 0.75, h * 0.22, '#5E5873');
    };
    v.draw.rear = (g, w, h) => text(g, '배달중 ♥', w * 0.5, h * 0.5, h * 0.3, '#FF6B9E');
    v.height = 2.0;
    v.length = 2.6;
    return v;
  },
};

export function vehicleBlueprint(id: string): VehicleBlueprint {
  const fn = BUILDERS[id] ?? BUILDERS.coupang;
  return fn();
}

// silence unused helpers for some builds
void heartShape;
void starShape;
